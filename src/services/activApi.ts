/**
 * The website's service layer — one function per real backend endpoint.
 *
 * This is the web equivalent of what the mobile screens call, and it is the
 * only place the website should reach the API from. It exists so that a page
 * never has to know a URL, an envelope shape, or which of the four member forms
 * lives in which collection.
 *
 * Everything here maps 1:1 onto a route in `backend/src/routes.js`.
 */
import api, {
    unwrap,
    setAuthToken,
    clearSession,
    errorMessage,
    clearRequestCache,
    registerCacheClearer,
} from './api';
import {
    API_BASE_URL,
    ENDPOINTS,
    STORAGE_KEYS,
    HOME_FOR_ROLE,
    DASHBOARD_FOR_ROLE,
    type UserRole,
} from '@/config/api.config';

/**
 * A `fetch` aimed at the real API, with the session token attached.
 *
 * Provided for pages that were written around `fetch` and its
 * `response.ok` / `response.json()` shape. It keeps that shape — so migrating
 * such a page is a one-line change rather than a rewrite — while removing the
 * two things that were actually wrong: a hardcoded host that no longer exists,
 * and a token read from a stale `adminToken` key.
 *
 * Prefer the typed functions below in new code; they also normalise the
 * response envelope, which this deliberately does not.
 */
/**
 * Collapse of duplicate GETs.
 *
 * Nine components call `/members/my-profile` independently on mount, and the
 * sidebar renders on every member page alongside whichever page is loading, so
 * one navigation fired it five times inside four seconds in the production log
 * — each a real round trip, each waiting on the same answer.
 *
 * Two layers, both keyed on method + URL + the token the call goes out with, so
 * a session change can never be served another account's response:
 *
 *   in-flight  – concurrent callers share one request. Always correct: they
 *                would have received the same body a moment apart anyway.
 *   fresh      – a completed GET is reusable for GET_CACHE_MS. This is what
 *                catches the mount-a-second-later case that dedupe alone misses.
 *
 * `Response` bodies are single-use, so every caller gets its own `.clone()` and
 * nobody's `.json()` steals another's stream.
 *
 * Any non-GET drops the fresh layer wholesale. Saves here are cross-cutting —
 * writing business info changes what the profile and application endpoints say
 * — and a stale read after a save is the one failure this must not introduce.
 */
const GET_CACHE_MS = 4000;

type CacheEntry = { at: number; response: Response };

const inFlight = new Map<string, Promise<Response>>();
const fresh = new Map<string, CacheEntry>();

/** Clears this file's two maps and nothing else — what the registry calls. */
const dropFetchCache = (): void => {
    inFlight.clear();
    fresh.clear();
};

registerCacheClearer(dropFetchCache);

/**
 * Drop every cached GET, on this transport and on the axios one.
 *
 * The two share endpoints — the sidebar reads `/members/my-profile` through
 * `apiFetch`, `getMyProfile()` reads it through axios — so a write must clear
 * both or the other transport serves the pre-write body for the rest of its
 * TTL. `clearRequestCache` runs the registry, which includes `dropFetchCache`
 * above; the same is true in reverse for a write that goes out through axios.
 */
export const clearApiCache = (): void => {
    clearRequestCache();
};

export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers as HeadersInit);

    let token: string | null = null;
    try {
        token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
        /* storage unavailable */
    }

    // FormData must set its own boundary.
    if (init.body instanceof FormData) headers.delete('Content-Type');
    else if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const method = String(init.method || 'GET').toUpperCase();
    const url = `${API_BASE_URL}${path}`;

    // A caller that passes its own AbortSignal owns that request's lifetime;
    // sharing it would let one component's unmount cancel another's fetch.
    const shareable = method === 'GET' && !init.signal && !init.cache;

    if (!shareable) {
        const request = fetch(url, { ...init, headers });
        if (method !== 'GET') {
            // Clear on completion, not before: a read that resolves while the
            // write is still open would otherwise be cached as post-write.
            request.then(clearApiCache, clearApiCache);
        }
        return request;
    }

    const key = `${method} ${url} ${token || ''}`;

    const cached = fresh.get(key);
    if (cached && Date.now() - cached.at < GET_CACHE_MS) {
        return Promise.resolve(cached.response.clone());
    }
    if (cached) fresh.delete(key);

    const pending = inFlight.get(key);
    if (pending) return pending.then(response => response.clone());

    const request = fetch(url, { ...init, headers })
        .then((response) => {
            // Only successful reads are worth replaying; a 401 or a 500 should
            // be retried by the next caller, not handed round.
            if (response.ok) fresh.set(key, { at: Date.now(), response: response.clone() });
            return response;
        })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, request);
    return request.then(response => response.clone());
};

// ============================================================ types

export interface LoginResult {
    token: string;
    role: UserRole;
    user: Record<string, any>;
    memberDetails: Record<string, any>;
    home: string;
}

export interface RegionNode {
    name: string;
    admins: number;
}

export interface Applicant {
    id: string;
    applicationId: string;
    memberId: string;
    fullName: string;
    email: string;
    phone: string;
    role: string;
    /** Declared on the application; drives the Aspirant vs Business label. */
    doingBusiness?: boolean;
    /**
     * `'business' | 'aspirant'`, as stored on the application. The admin
     * dashboards have always returned it — the Members screens read it — but it
     * was missing from this interface, so the approval queue could not show the
     * "Membership Type" the mobile applicant card shows.
     */
    memberType?: string;
    memberCode?: string;
    gender?: string;
    city?: string;
    level?: string;
    owningTier?: string;
    effectiveTier?: string;
    block: string;
    district: string;
    state: string;
    /**
     * The APPLICATION's outcome: `Pending`, `Approved` or `Rejected`.
     *
     * Written by the State Admin alone (or a Super Admin filling that seat), and
     * it is what makes somebody a member. NOT the same question as `stage`.
     */
    status: string;
    rawStatus: string;
    /**
     * THIS TIER'S OWN VERDICT: pending | approved | rejected.
     *
     * `approved` means the tier that fetched this row approved it — not that the
     * applicant was admitted. The two were one field once, which is why a
     * District admin's Hub read "Approved" on applicants the State had approved
     * and the District had never opened.
     */
    stage: string;
    statusLabel: string;
    approvedByText: string;
    /** The outcome again, named so it cannot be mistaken for `stage`. */
    outcome?: string;
    /** Has THIS tier's verdict still to be given? The only thing that draws buttons. */
    canAct?: boolean;
    /** Would this tier's approval enrol the applicant, or only be recorded? */
    decidesOutcome?: boolean;
    /** All three tiers' verdicts, for a card that wants to lay them out itself. */
    tierReviews?: Record<string, { decision: string; adminType: string; decidedAt: string | null; reason: string }>;
    /** The decided ones among the OTHER two tiers, widest first. */
    otherTierReviews?: { tier: string; label: string; decision: string; decidedAt: string | null }[];
    /** Those, as one line: "State approved · Block rejected". Empty when none. */
    endorsementLine?: string;
    orphaned: boolean;
    fallbackReason: string;
    submittedAt: string | null;
    blockApprovedAt: string | null;
    districtApprovedAt: string | null;
    stateApprovedAt: string | null;
    rejectionReason: string;
    personalDetails: Record<string, any>;
    businessInfo: Record<string, any>;
    financialInfo: Record<string, any>;
    declaration: Record<string, any>;
    /** Whether the member account is enabled; false once an admin suspends it. */
    isActive?: boolean;
}

/**
 * A row of the admin Members directory.
 *
 * The server resolves Active / Inactive, so the two clients cannot disagree
 * about who counts as a member. Rejected applicants appear here as Inactive.
 */
export interface AdminMember extends Applicant {
    memberStatus: 'Active' | 'Inactive';
    /** Empty when active; otherwise says suspended or rejected, and why. */
    inactiveReason: string;
}

export interface AdminDashboard {
    stats: Record<string, any>;
    applicants: {
        pending: Applicant[];
        approved: Applicant[];
        rejected: Applicant[];
        all: Applicant[];
    };
    /** Approved + rejected applicants, with Active/Inactive already resolved. */
    members?: AdminMember[];
    /*
     * `recentActivities` was declared here and never read: the dashboard builds
     * Recent Activity from `applicants.all`, which carries the computed stage.
     * The server has stopped sending it — see `computeBlockDashboard`, the only
     * tier that ever did.
     */
    /** The blocks feeding a district, with their own counts. District only. */
    blocks?: Array<Record<string, any>>;
    /** The districts in a state, likewise. State only. */
    districts?: Array<Record<string, any>>;
    /** True when the admin's own region could not be resolved. */
    scopeUnresolved?: boolean;
    message?: string;
}

const EMPTY_DASHBOARD: AdminDashboard = {
    stats: {},
    applicants: { pending: [], approved: [], rejected: [], all: [] },
    members: [],
};

// ============================================================ auth

/**
 * Sign in. One endpoint for all five roles.
 *
 * There is deliberately no separate admin login: `auth.service.js` checks the
 * member `auth` collection first, then every admin collection, and reports which
 * it found in `data.role`. Calling a second "admin login" endpoint is what the
 * website used to do, and that endpoint has never existed on this backend.
 */
export const login = async (
    email: string,
    password: string,
    /**
     * WHICH SIGN-IN SCREEN this came from: `admin` for /admin/login, `member`
     * for /login. The server refuses the wrong one and returns no token at all
     * — see `assertPortal` in `auth.service.js`. Omitted, either is accepted,
     * which is what the mobile app still does.
     */
    portal?: 'member' | 'admin',
): Promise<LoginResult> => {
    /*
     * Forget the previous session before asking about the next one.
     *
     * A failed sign-in used to leave the old one entirely intact — token, role,
     * everything — because nothing on the error path cleared it. The visible
     * consequence is in the console of a state admin's dashboard: a 401 from
     * `/auth/login`, then four 404s from `/members/my-profile`,
     * `business-info`, `financial-info` and `declaration-info`. Those come from
     * `ProfileContext`, which correctly skips them unless the stored role says
     * 'member' — and after a failed login over a stale member session, it still
     * did. Four round trips that cannot succeed, competing for the browser's
     * six connections with the dashboard request that actually matters.
     */
    clearSession();

    const res = await api.post(ENDPOINTS.AUTH.LOGIN, {
        email: String(email || '').toLowerCase().trim(),
        password,
        ...(portal ? { portal } : {}),
    });

    const data = unwrap<any>(res, {});
    const token: string = data?.token || '';
    if (!token) throw new Error(res.data?.message || 'Login failed');

    const user = data.user || {};
    const role = (data.role || user.role || 'member') as UserRole;

    try {
        localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
        localStorage.setItem(STORAGE_KEYS.USER_ID, String(user.id || user._id || ''));
        localStorage.setItem(STORAGE_KEYS.USER_NAME, String(user.fullName || ''));
        localStorage.setItem(STORAGE_KEYS.USER_EMAIL, String(user.email || ''));
        localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true');
        // Written for the pages that still read these directly. `adminToken` in
        // particular is what 22 admin pages build their Authorization header
        // from; leaving it stale is what produced 401s on a valid session.
        localStorage.setItem('memberId', String(user.memberId || user.id || user._id || ''));
        localStorage.setItem('adminToken', token);
        if (role !== 'member') {
            localStorage.setItem('adminData', JSON.stringify({
                id: String(user.id || user._id || ''),
                fullName: user.fullName || '',
                email: user.email || '',
                role,
                state: user.state,
                district: user.district,
                block: user.block,
                phoneNumber: user.phoneNumber,
            }));
        }
    } catch {
        /* storage unavailable; the session still works for this tab */
    }
    
    setAuthToken(token);

    return {
        token,
        role,
        user,
        memberDetails: data.memberDetails || user,
        home: HOME_FOR_ROLE[role] || '/member/unpaid-dashboard',
    };
};

export const register = async (payload: {
    fullName: string;
    email: string;
    password: string;
    phoneNumber: string;
    /** Where WhatsApp notifications go. Server falls back to `phoneNumber`. */
    whatsappNumber?: string;
    state: string;
    district: string;
    block: string;
    city?: string;
    /** Members outside India give a place instead of a state/district/block. */
    place?: string;
}): Promise<LoginResult> => {
    // `payload` is posted whole, so a new field reaches the server as soon as
    // the type admits it — unlike the wrapper in `shared/services/authService`,
    // which names each field and silently drops any it has not been told about.
    const res = await api.post(ENDPOINTS.AUTH.REGISTER, payload);
    const data = unwrap<any>(res, {});
    const token: string = data?.token || '';
    const user = data.user || {};
    // Register returns the role on `user`, not at the top level as login does.
    const role = (user.role || 'member') as UserRole;

    if (token) {
        /*
         * Identity first, token last.
         *
         * `setAuthToken` fires SESSION_EVENT, and everything listening for it
         * asks "who is this?" the moment it arrives. Writing the token first
         * meant that question was answered from an empty `USER_ROLE`, so a
         * brand-new member looked like nobody in particular for the rest of the
         * session. `login()` already writes the identity first; this now
         * matches it.
         */
        try {
            localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
            localStorage.setItem(STORAGE_KEYS.USER_ID, String(user.id || ''));
            localStorage.setItem(STORAGE_KEYS.USER_EMAIL, String(user.email || ''));
            localStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true');
            /*
             * The name too — `login()` writes it and this did not.
             *
             * A member who registers is signed in on the spot and never passes
             * through `login()`, so nothing had ever written `userName` for
             * them. Every screen that greets a member reads that key, which is
             * why a brand-new account was welcomed as "Member". The register
             * response already carries it on `memberDetails`.
             */
            const registeredName = String(data.memberDetails?.fullName || user.fullName || '');
            if (registeredName) localStorage.setItem(STORAGE_KEYS.USER_NAME, registeredName);
        } catch { /* ignore */ }

        setAuthToken(token);
    }

    return { token, role, user, memberDetails: data.memberDetails || {}, home: HOME_FOR_ROLE[role] };
};

export const logout = async (): Promise<void> => {
    // Best effort: the server only drops a cache entry, so a failure here must
    // not stop the client from forgetting its own token.
    await api.post(ENDPOINTS.AUTH.LOGOUT).catch(() => null);
    clearSession();
};

export const changePassword = async (oldPassword: string, newPassword: string) =>
    unwrap(await api.post(ENDPOINTS.AUTH.CHANGE_PASSWORD, { oldPassword, newPassword }), null);

export const forgotPassword = async (email: string): Promise<string> => {
    const res = await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
    // Always the same message whether or not the address is registered — the
    // endpoint deliberately reveals nothing.
    return res.data?.message || 'If that email is registered, a reset link is on its way.';
};

export const verifyResetToken = async (token: string): Promise<boolean> => {
    const data = unwrap<any>(
        await api.get(`${ENDPOINTS.AUTH.VERIFY_RESET_TOKEN}?token=${encodeURIComponent(token)}`),
        { valid: false },
    );
    return !!data?.valid;
};

export const resetPassword = async (token: string, newPassword: string) =>
    unwrap(await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token, newPassword }), null);

/** The stored role, for route guards. Client-side only — the server re-checks. */
export const getStoredRole = (): UserRole | null => {
    try {
        return (localStorage.getItem(STORAGE_KEYS.USER_ROLE) as UserRole) || null;
    } catch {
        return null;
    }
};

export const isAuthenticated = (): boolean => {
    try {
        return !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {
        return false;
    }
};

/** Decode the JWT locally, so a page can read role/region without a round trip. */
export const decodeToken = (token?: string | null): Record<string, any> | null => {
    const raw = token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null);
    if (!raw) return null;
    try {
        const payload = raw.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
};

/**
 * Restore a session on page load.
 *
 * Deliberately does NOT use `/auth/me`: that route resolves through a
 * per-process cache and answers 404 on a cold server. `/members/my-profile` and
 * `/admin/profile` read the database and are correct.
 */
export const restoreSession = async () => {
    const claims = decodeToken();
    if (!claims) return null;
    if (claims.exp && claims.exp * 1000 < Date.now()) {
        clearSession();
        return null;
    }

    const role = (claims.role || 'member') as UserRole;
    const profile =
        role === 'member' ? await getMyProfile().catch(() => null) : await getAdminProfile().catch(() => null);

    return { claims, role, profile, home: HOME_FOR_ROLE[role] };
};

// ============================================================ regions (public)

/**
 * The region tree, cached and de-duplicated.
 *
 * Mirrors the mobile app's `services/regions.ts`. Two reasons it matters here:
 * a registration form mounts three dependent dropdowns that would otherwise
 * each fire a request, and `/regions/*` is rate-limited to 200 requests per
 * 15 minutes per IP — an office behind one NAT address shares that budget.
 *
 * Concurrent callers share the in-flight promise, so a page that mounts two
 * pickers at once still makes one request.
 */
const REGION_CACHE_TTL_MS = 60_000;

export interface RegionTree { coverageAvailable: boolean; states: any[] }

/**
 * WHICH REGIONS THE ANSWER COVERS. Two different questions, two listings.
 *
 *   selectable  regions an APPLICANT may pick, pruned bottom-up: a block needs
 *               a block admin, a district needs such a block, a state needs
 *               such a district. Pruned that way so a dropdown cannot offer a
 *               state the applicant is unable to finish choosing through.
 *   all         every region the admin database knows, staffing counts and all.
 *               A state carrying only a state admin is in here, with no
 *               districts under it.
 *
 * `selectable` stays the default: it is what every registration screen was
 * already asking for, and widening that silently would put dead ends in the
 * applicant's dropdowns.
 */
export type RegionScope = 'selectable' | 'all';

/*
 * ONE CACHE SLOT PER SCOPE.
 *
 * A single slot would have the two listings evict each other — an event form
 * asking for `all` would fill the cache, and the registration screen mounting
 * next would read the wider tree out of it and offer an applicant a state with
 * no blocks beneath it. Keyed, they are simply two answers.
 */
const regionCache: Partial<Record<RegionScope, { at: number; tree: RegionTree }>> = {};
const regionInFlight: Partial<Record<RegionScope, Promise<RegionTree>>> = {};

export const getRegionTree = async (
    force = false,
    include: RegionScope = 'selectable',
): Promise<RegionTree> => {
    const cached = regionCache[include];
    if (!force && cached && Date.now() - cached.at < REGION_CACHE_TTL_MS) return cached.tree;

    const inFlight = regionInFlight[include];
    if (!force && inFlight) return inFlight;

    const request = (async (): Promise<RegionTree> => {
        try {
            const payload = unwrap<any>(await api.get(ENDPOINTS.REGIONS.TREE, {
                // Sent only for the wider listing, so the request the
                // registration screens make is byte-for-byte the one they always
                // made and cannot be affected by a change made for the other.
                params: include === 'all' ? { include: 'all' } : undefined,
            }), {});

            const tree: RegionTree = {
                // False means the platform has no staffed region at all — a
                // different thing from "the request failed", and the two need
                // different messages on screen.
                coverageAvailable: !!payload.coverageAvailable,
                states: Array.isArray(payload.states) ? payload.states : [],
            };
            /*
             * An empty tree is not cached.
             *
             * Every region dropdown on the platform reads this one answer, so a
             * single empty response — a request that raced the session, a
             * momentary blip — would blank every one of them for the whole TTL
             * with nothing on screen to explain it. That is precisely how "I
             * cannot see the states" gets reported. A real empty answer (no
             * block admin anywhere yet) simply costs one more request until
             * there is something to cache.
             */
            if (tree.states.length) regionCache[include] = { at: Date.now(), tree };
            return tree;
        } finally {
            delete regionInFlight[include];
        }
    })();

    regionInFlight[include] = request;
    return request;
};

/**
 * Drop the cache — call after an admin is created, so a new region appears.
 *
 * BOTH scopes, always. A new block admin can change either listing, and the one
 * that is not cleared is the one showing a region tree from before the account
 * existed — which reads, on screen, as the admin not having been created.
 */
export const invalidateRegionCache = () => {
    (Object.keys(regionCache) as RegionScope[]).forEach(scope => { delete regionCache[scope]; });
};

const sameName = (a?: string | null, b?: string | null) =>
    String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * The three list helpers all read the one cached tree rather than calling their
 * own endpoint, so filling in a registration form costs a single request.
 *
 * THEY READ THE FULL TREE, NOT THE PRUNED ONE.
 *
 * The pruned listing keeps only regions staffed all the way down to a block
 * admin. As a rule for opening a region to registration that is sound; as the
 * answer to "which states exist" it is wrong, and it was reaching the applicant
 * as the second. A platform with two staffed states offered one, and the state
 * the Super Admin had just created was missing from the form with nothing on
 * screen to explain it.
 *
 * Showing it is safe because THE APPLICATION STILL ROUTES. `tierRouting`
 * computes ownership from live staffing at read time — `effectiveTier` walks up
 * from the tier the status names to the first one that has an admin, and falls
 * back to `super` when none does — so an application filed in a state with no
 * block admin lands in the state admin's queue rather than in nobody's. That
 * machinery exists precisely for the region tree being uneven, and pruning the
 * dropdown as well only hid the region from the person trying to join it.
 *
 * District and block stay optional on the form, so a state with nothing beneath
 * it is not a dead end: the applicant picks the state, leaves the rest blank,
 * and their file goes to whoever is actually there.
 */
export const getStates = async () => {
    const tree = await getRegionTree(false, 'all');
    return {
        states: tree.states.map((s: any) => ({ name: s.name, admins: s.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

export const getDistricts = async (state: string) => {
    const tree = await getRegionTree(false, 'all');
    const node = tree.states.find((s: any) => sameName(s.name, state));
    return {
        districts: (node?.districts || []).map((d: any) => ({ name: d.name, admins: d.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

export const getBlocks = async (state: string, district: string) => {
    const tree = await getRegionTree(false, 'all');
    const stateNode = tree.states.find((s: any) => sameName(s.name, state));
    const districtNode = (stateNode?.districts || []).find((d: any) => sameName(d.name, district));
    return {
        blocks: (districtNode?.blocks || []).map((b: any) => ({ name: b.name, admins: b.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

/**
 * THE MAP OF INDIA, not the map of who is staffed.
 *
 * `getStates`/`getDistricts`/`getBlocks` above read the ADMIN tree, which is
 * the right answer for a registration form — an applicant may only choose a
 * region somebody can review them in. It is the wrong answer for a search
 * filter: a member looking for suppliers in Kerala should be able to ask, and
 * on a database with one staffed state the dropdown offered one state.
 *
 * These three read `/regions/geography`, the canonical dataset the server
 * already publishes, and return plain arrays of names.
 */
const geography = async (params: string): Promise<string[]> => {
    try {
        const res = await api.get(`/regions/geography${params}`);
        const data = res?.data?.data || res?.data || {};
        const rows = data.states || data.districts || data.blocks || [];
        return Array.isArray(rows) ? rows.filter(Boolean).map(String) : [];
    } catch {
        return [];
    }
};

export const listAllStates = () => geography('');

export const listAllDistricts = (state: string) =>
    (state ? geography(`?state=${encodeURIComponent(state)}`) : Promise.resolve([]));

export const listAllBlocks = (state: string, district: string) => (
    state && district
        ? geography(`?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`)
        : Promise.resolve([])
);

/** Pre-flight, so the user sees the problem before submitting the form. */
export const validateRegion = async (state: string, district: string, block: string) =>
    unwrap<{ ok: boolean; reason: string; region: any }>(
        await api.get(ENDPOINTS.REGIONS.VALIDATE, { params: { state, district, block } }),
        { ok: false, reason: 'Could not validate region', region: null },
    );

/** The canonical India reference — super-admin pickers only. */
export const getGeography = async (state?: string, district?: string) =>
    unwrap<any>(await api.get(ENDPOINTS.REGIONS.GEOGRAPHY, { params: { state, district } }), {});

// ============================================================ member profile

export const getMyProfile = async () => unwrap<any>(await api.get(ENDPOINTS.MEMBERS.MY_PROFILE), {});

/** What has happened to this member's account, newest first. */
export interface MemberActivity {
    id: string;
    type: string;
    description: string;
    entityType: string;
    at: string;
}

/**
 * The activity feed.
 *
 * Resolves to an empty list rather than throwing: a dashboard whose feed failed
 * should show the rest of the dashboard, not an error page.
 */
export const getRecentActivity = async (limit = 10): Promise<MemberActivity[]> => {
    try {
        const data = unwrap<any>(await api.get(ENDPOINTS.MEMBERS.RECENT_ACTIVITY, { params: { limit } }), {});
        return data.activities || [];
    } catch {
        return [];
    }
};

export interface Certificate {
    kind: string;
    title: string;
    body: string;
    member: {
        name: string; membershipNumber: string; email: string;
        block: string; district: string; state: string;
        /** Members outside India: no region — the place and country instead. */
        isInternational?: boolean; place?: string; country?: string;
    };
    /** `annual` | `lifetime` | `''`. The client words it for display. */
    membershipType: 'annual' | 'lifetime' | '';
    memberSince: string | null;
    activatedAt: string | null;
    /**
     * When it lapses. NULL MEANS IT DOES NOT — a lifetime membership.
     *
     * Never render a null as a date. A certificate carrying an invented expiry
     * is a lie with a number on it, and one carrying no end date at all reads
     * as permanent, which an annual membership is not.
     */
    validUntil: string | null;
    /**
     * “2026-27” on a TAX certificate, `''` on the membership one.
     *
     * The financial year the exemption may be claimed against. Derived on the
     * server from the same date as `validUntil`, so the two cannot disagree —
     * and derived there rather than in each client, because the website and the
     * mobile app computing it separately is how the two would come to print
     * different years on the same document.
     */
    financialYear: string;
    /**
     * What was actually received — the TAX certificate only, `null` on the other.
     *
     * The exemption certificate is laid out as a Form 10BE, which names a sum
     * and the transaction it arrived on.
     *
     * `amount` IS NULLABLE AND HAS TO BE TREATED SO. Both `paymentAmount` and
     * `paymentId` were undeclared on the member schema for a long window and
     * Mongoose strict mode dropped them on every payment in it, so a member
     * activated then has a paid membership and no record of the sum. Filling
     * that gap with a plausible figure would put a number on a tax document
     * that nobody can reconcile against the books — the row is dropped instead.
     */
    contribution: {
        /** Rupees. NULL when the platform has no record of the sum. */
        amount: number | null;
        /** The gateway's transaction id, or `''`. */
        reference: string;
        receivedOn: string | null;
    } | null;
    /** A quotable reference, stable for a given membership on a given day. */
    reference: string;
    issuedAt: string;
    issuedBy: string;
}

/**
 * Fetch a certificate's contents.
 *
 * This one DOES throw. The server refuses with 403 when a membership is not yet
 * active, and that refusal is the answer the member needs to see — swallowing
 * it would show them a blank certificate instead of the reason they cannot have
 * one.
 */
export const getCertificate = async (kind: 'membership' | 'tax-exemption'): Promise<Certificate> =>
    unwrap<Certificate>(await api.get(ENDPOINTS.MEMBERS.CERTIFICATE(kind)), null as any);
export const getBusinessInfo = async () => unwrap<any>(await api.get(ENDPOINTS.MEMBERS.BUSINESS_INFO), {});
export const getFinancialInfo = async () => unwrap<any>(await api.get(ENDPOINTS.MEMBERS.FINANCIAL_INFO), {});
export const getDeclarationInfo = async () => unwrap<any>(await api.get(ENDPOINTS.MEMBERS.DECLARATION_INFO), {});

/**
 * The one profile writer.
 *
 * All four registration forms post here. The server routes each group of fields
 * to its own collection by which keys are present, ignores empty strings so a
 * partial save cannot blank existing data, and mirrors personal details onto the
 * member's Application so the admin queues stay in step.
 */
export const updateProfile = async (payload: Record<string, any>) =>
    unwrap<any>(await api.put(ENDPOINTS.MEMBERS.UPDATE_PROFILE, payload), {});

export const uploadProfilePhoto = async (file: File) => {
    const form = new FormData();
    form.append('profilePhoto', file);
    return unwrap<{ profilePhoto: string }>(await api.post(ENDPOINTS.MEMBERS.PROFILE_PHOTO, form), {
        profilePhoto: '',
    });
};

export const listMembers = async (params: Record<string, any> = {}) =>
    unwrap<{ members: any[]; pagination: any }>(await api.get(ENDPOINTS.MEMBERS.LIST, { params }), {
        members: [],
        pagination: {},
    });

// ============================================================ applications

export const submitApplication = async (payload: Record<string, any>) =>
    unwrap<any>(await api.post(ENDPOINTS.APPLICATIONS.CREATE, payload), {});

export const getMyApplications = async () =>
    unwrap<any[]>(await api.get(ENDPOINTS.APPLICATIONS.MINE), []);

/**
 * =========================================================================
 * AN APPLICATION HAS ONE REVIEW, NOT THREE
 * =========================================================================
 *
 * This section used to model a relay — Block signs, then District, then State —
 * and everything below derived "how far along is it" from which tier had
 * stamped its timestamp. That workflow is gone. An application is submitted to
 * its Block, District and State admin at the same time and the first of them to
 * decide decides it, so there is one review with three possible answers: being
 * looked at, approved, refused.
 *
 * `normaliseStatus` is the browser's copy of the server's `normalizeStatus`.
 * Live rows still carry `Pending-Block`, `pending_district_approval` and bare
 * `approved`, and nothing rewrote them — every undecided spelling means the
 * same thing now.
 */
const normaliseStatus = (value: any): 'Pending' | 'Approved' | 'Rejected' => {
    const key = String(value || '').trim().toLowerCase().replace(/[\s_\-.]/g, '');
    if (key === 'rejected' || key === 'declined') return 'Rejected';
    if (key === 'approved' || key === 'stateapproved' || key === 'complete' || key === 'completed') {
        return 'Approved';
    }
    return 'Pending';
};

/**
 * Pick the application a member should be shown.
 *
 * The most *advanced* one, not simply the newest. A member can hold more than
 * one row — a resubmission, or a legacy duplicate — and sorting by date can put
 * an untouched record in front of one that has already been decided. The status
 * screen would then tell someone their application had not been looked at when
 * it had been approved.
 *
 * Three tiers of "advanced" collapsed to two: decided beats undecided. An
 * approval leads because it is the answer the member is waiting for, and a
 * rejection ranks above an untouched row for the same reason — a decision is
 * news and a blank is not.
 */
export const pickMostAdvancedApplication = (list: any[]): any | null => {
    if (!Array.isArray(list) || list.length === 0) return null;
    return (
        list.find((a) => normaliseStatus(a?.status) === 'Approved') ||
        list.find((a) => normaliseStatus(a?.status) === 'Rejected') ||
        list[0]
    );
};

/**
 * Where the application stands.
 *
 * `isApproved` reads the status first and the timestamp second, because either
 * alone is incomplete: a legacy row may carry `stateApprovedAt` with a
 * lowercase status, and a row approved today carries both.
 *
 * THE THREE TIER FLAGS ARE KEPT AND ALL THREE NOW MEAN "APPROVED". They are
 * read by four screens and by the mobile app, and "which tiers have signed off"
 * is not a fact about a file any more — one tier signs and the review is over.
 * Leaving them to mean three different things would make `isBlockApproved` true
 * while the member's application had not been approved at all, and those
 * screens print exactly that as progress.
 */
export const deriveApprovalFlags = (app: any) => {
    const status = normaliseStatus(app?.status);
    /*
     * APPROVED MEANS THE STATE APPROVED, and `status` already says so — the
     * server writes it for the State and for nobody else.
     *
     * `|| !!app?.stateApprovedAt` used to be here and had to go. That field is
     * stamped by EVERY approval whoever made it, because it is the one place
     * the member screens read "the day this was approved" from. As a test of
     * whether the application was granted it answered yes for a file a Block
     * admin had merely endorsed.
     */
    const isApproved = status === 'Approved';
    const isRejected = status === 'Rejected';
    const isUnderReview = !!app && !isApproved && !isRejected;

    const v = (tier: 'block' | 'district' | 'state') => tierVerdict(app, tier);

    return {
        isApproved,
        isRejected,
        isUnderReview,
        // Per tier now, and genuinely different from one another.
        isBlockApproved: v('block') === 'approved',
        isDistrictApproved: v('district') === 'approved',
        isStateApproved: v('state') === 'approved',
    };
};

/**
 * One tier's verdict on an application, for the applicant's own screens.
 *
 * READ FROM THE SERVER'S ANSWER (`tierReviews`) whenever it is there — the rule
 * lives in `backend/src/modules/common/tierReviews.js` and
 * `getUserApplications` resolves it before sending. The fallbacks below are for
 * a payload from an older build only, and they follow the same rule:
 *
 *   - `blockApprovedAt` / `districtApprovedAt` are trustworthy. Both previous
 *     workflows wrote them only when that tier itself acted.
 *   - `stateApprovedAt` IS NOT, and is deliberately absent. Every approval
 *     stamps it, so reading it as the State's verdict would credit the State
 *     with every decision a Block or District admin ever made.
 */
export const tierVerdict = (
    app: any,
    tier: 'block' | 'district' | 'state',
): 'pending' | 'approved' | 'rejected' => {
    const served = app?.tierReviews?.[tier]?.decision;
    if (served === 'approved' || served === 'rejected') return served;
    if (served === 'pending') return 'pending';

    if (tier === 'block' && app?.blockApprovedAt) return 'approved';
    if (tier === 'district' && app?.districtApprovedAt) return 'approved';

    const signer = String(
        normaliseStatus(app?.status) === 'Rejected'
            ? app?.rejectedBy?.adminType
            : app?.approvedBy?.adminType
        || '',
    );
    const SEAT: Record<string, string> = {
        BlockAdmin: 'block', DistrictAdmin: 'district',
        StateAdmin: 'state', SuperAdmin: 'state',
    };
    // An approval with no attribution at all predates the field; the State is
    // the only tier that could have granted it.
    const seat = SEAT[signer] || (normaliseStatus(app?.status) === 'Approved' && !app?.approvedBy ? 'state' : '');
    if (seat && seat === tier) {
        return normaliseStatus(app?.status) === 'Rejected' ? 'rejected' : 'approved';
    }
    return 'pending';
};

/** Who signed one tier's verdict, for the line under that stage. */
export const tierDecidedByLabel = (app: any, tier: 'block' | 'district' | 'state'): string => {
    const LABELS: Record<string, string> = {
        BlockAdmin: 'Block Admin',
        DistrictAdmin: 'District Admin',
        StateAdmin: 'State Admin',
        SuperAdmin: 'ACTIV Head Office',
    };
    const served = app?.tierReviews?.[tier];
    if (served?.adminType) return LABELS[String(served.adminType)] || '';
    if (tierVerdict(app, tier) === 'pending') return '';
    return LABELS[`${tier[0].toUpperCase()}${tier.slice(1)}Admin`] || '';
};

/** When one tier decided, for the date under that stage. */
export const tierDecidedAt = (app: any, tier: 'block' | 'district' | 'state'): string | null => {
    const served = app?.tierReviews?.[tier]?.decidedAt;
    if (served) return served;
    if (tier === 'block') return app?.blockApprovedAt || null;
    if (tier === 'district') return app?.districtApprovedAt || null;
    return app?.approvedBy?.approvedAt || app?.rejectedBy?.rejectedAt || app?.stateApprovedAt || null;
};

/** Who signed the decision, for the line under it. `''` when nobody has. */
export const decidedByLabel = (app: any): string => {
    const LABELS: Record<string, string> = {
        BlockAdmin: 'Block Admin',
        DistrictAdmin: 'District Admin',
        StateAdmin: 'State Admin',
        SuperAdmin: 'ACTIV Head Office',
    };
    const status = normaliseStatus(app?.status);
    if (status === 'Rejected') return LABELS[String(app?.rejectedBy?.adminType || '')] || '';
    if (status === 'Approved') return LABELS[String(app?.approvedBy?.adminType || '')] || '';
    return '';
};

export type TimelineStageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';

/**
 * A stage's state on the timeline.
 *
 * ONE ANSWER PER TIER. Each of the Block, District and State admin records
 * their own verdict, so the three rows genuinely differ and the rail can show
 * an applicant what each of their admins has said.
 *
 * This briefly gave every key the same answer, which was right while the three
 * tiers shared one verdict and became wrong the moment they stopped. What it
 * must never go back to is the RELAY reading — one row "In Review" and two
 * "Waiting" — because nobody is queued behind anybody: all three hold the file
 * from the day it is submitted. An undecided tier is `in_progress`, not
 * `pending`.
 */
export const timelineStageStatus = (
    stage: 'review' | 'block' | 'district' | 'state',
    app: any,
): TimelineStageStatus => {
    if (!app) return 'pending';

    // `review` is the whole-application question, kept for callers that show a
    // single row.
    if (stage === 'review') {
        const f = deriveApprovalFlags(app);
        if (f.isRejected) return 'rejected';
        if (f.isApproved) return 'approved';
        return 'in_progress';
    }

    const verdict = tierVerdict(app, stage);
    if (verdict === 'approved') return 'approved';
    if (verdict === 'rejected') return 'rejected';
    /*
     * Undecided, and IN REVIEW rather than "Waiting".
     *
     * All three tiers hold the file from the day it is submitted, so no tier is
     * queued behind another. "Waiting" belonged to the relay, where two of the
     * three rows described a turn that had not come round yet.
     */
    return 'in_progress';
};

/**
 * The review timeline for the member's own application.
 *
 * Same derivation the mobile app uses, so both clients tell an applicant the
 * same story about where their file is.
 *
 * Three review stages — Block, District, State — because each tier records its
 * own verdict and an applicant is entitled to see all three. Only the State's
 * approval grants the membership; the two beneath it are endorsements.
 */
export const getApplicationTimeline = async () => {
    const app = pickMostAdvancedApplication(await getMyApplications());
    if (!app) return null;

    const flags = deriveApprovalFlags(app);

    return {
        application: { ...app, ...flags },
        stages: ([
            { key: 'block', title: 'Block Admin Review' },
            { key: 'district', title: 'District Admin Review' },
            { key: 'state', title: 'State Admin Approval' },
        ] as const).map(stage => ({
            key: stage.key,
            title: stage.title,
            status: timelineStageStatus(stage.key, app),
            reviewDate: tierDecidedAt(app, stage.key),
            decidedBy: tierDecidedByLabel(app, stage.key),
        })),
        decidedBy: decidedByLabel(app),
        rejectionReason: app.rejectionReason || '',
        rejectedBy: app.rejectedBy?.adminType || '',
    };
};

/**
 * The application the member should see.
 *
 * Most advanced, not newest — see `pickMostAdvancedApplication`.
 */
export const getMyApplication = async () => pickMostAdvancedApplication(await getMyApplications());

/**
 * Has this member paid?
 *
 * Payment is recorded on the MEMBER (`users.membershipStatus`), never on the
 * application — the application only tracks the three approval tiers. Pages
 * were reading `application.paymentStatus`, a field that does not exist, from
 * `/applications/my-applications`, which returns an *array* — so the check was
 * undefined twice over and every member looked unpaid.
 *
 * Approval and payment are separate states: a fully approved application still
 * leaves `membershipStatus` at 'pending' until the member pays.
 */
export const getPaymentStatus = async (): Promise<'completed' | 'pending'> => {
    try {
        const profile = await getMyProfile();
        const status = String(profile?.membershipStatus || '').toLowerCase();
        /*
         * `approved` is not paid, and treating it as paid contradicted the
         * paragraph directly above. It is the three-tier workflow approving the
         * APPLICATION — the event that unlocks the payment step. Collapsing it
         * with `active` showed the paid dashboard to members who had never paid,
         * hid the Pay button they needed, and left the backend refusing to open
         * a payment order for them. `PAID_STATUSES` in the backend's
         * `memberContext.js` is the same list.
         */
        return status === 'active' || status === 'completed' ? 'completed' : 'pending';
    } catch {
        // Unknown is treated as unpaid: showing paid-only features to someone
        // who has not paid is the worse failure.
        return 'pending';
    }
};

export const isMembershipPaid = async (): Promise<boolean> =>
    (await getPaymentStatus()) === 'completed';

export const getApplication = async (id: string) =>
    unwrap<any>(await api.get(ENDPOINTS.APPLICATIONS.BY_ID(id)), null);

export const listApplications = async (params: Record<string, any> = {}) =>
    unwrap<{ applications: any[]; pagination: any }>(await api.get(ENDPOINTS.APPLICATIONS.LIST, { params }), {
        applications: [],
        pagination: {},
    });

/**
 * Approve or reject, from whichever tier the caller belongs to.
 *
 * The tier-agnostic endpoints let one button work on every admin dashboard: the
 * caller's role decides which review runs, so the client never has to know what
 * stage the file currently sits at.
 */
/**
 * Activate, suspend or permanently delete a member from the Members screen.
 *
 * `id` is the application id the directory row carries. The server accepts the
 * member and auth ids too, because the payload's `memberId` is one or the other
 * depending on whether the applicant has an auth record.
 *
 * `delete` is a cascade and cannot be undone: application, credential, member
 * record and all four additional forms go.
 */
export const memberAction = async (id: string, action: 'activate' | 'suspend' | 'delete') =>
    unwrap<any>(await api.post(ENDPOINTS.ADMIN.USER_ACTION(id, action), {}), {});

/**
 * Approve or reject, keeping the server's own sentence.
 *
 * The API answers with the outcome in words — "Application approved by the
 * Block Admin. Member profile created." — and `unwrap` returns only `data`, so
 * every caller was throwing that away and inventing its own "Approved". The
 * message is the one place that names which tier the decision was recorded
 * under, which matters now that any of the three could have made it.
 */
export const approveApplication = async (id: string) => {
    const res = await api.post(ENDPOINTS.APPLICATIONS.APPROVE(id), {});
    return { ...unwrap<any>(res, {}), message: res?.data?.message || '' };
};

export const rejectApplication = async (id: string, rejectionReason: string) => {
    const res = await api.post(ENDPOINTS.APPLICATIONS.REJECT(id), { rejectionReason });
    return { ...unwrap<any>(res, {}), message: res?.data?.message || '' };
};

/**
 * Explicit per-tier review, when the caller wants to name the tier.
 *
 * The tier no longer decides WHETHER the caller may act — every tier covering
 * the applicant's region can decide a pending application — only which of them
 * the decision is recorded under. The endpoints stay role-gated, so this cannot
 * be used to sign a decision as a tier the caller is not.
 */
export const reviewApplication = async (
    id: string,
    tier: 'block' | 'district' | 'state',
    action: 'approve' | 'reject',
    rejectionReason?: string,
) => {
    const path = {
        block: ENDPOINTS.APPLICATIONS.BLOCK_REVIEW,
        district: ENDPOINTS.APPLICATIONS.DISTRICT_REVIEW,
        state: ENDPOINTS.APPLICATIONS.STATE_REVIEW,
    }[tier](id);

    return unwrap<any>(await api.post(path, { action, rejectionReason }), {});
};

export const deleteApplication = async (id: string) =>
    unwrap<any>(await api.delete(ENDPOINTS.APPLICATIONS.DELETE(id)), null);

/**
 * One application flattened into the profile shape the "View Profile" modals render.
 *
 * The four form sections live under `data` on the application document —
 * `data.personalDetails`, `data.businessInfo`, `data.financialInfo`,
 * `data.declaration`. The pages were written against a retired API that
 * returned them as `personalForm` / `businessForm` / `financialForm` /
 * `declarationForm` at the top level, so they read keys that do not exist and
 * the modal opened blank on a request that had succeeded.
 *
 * Top-level application fields win over the nested copies: they are what the
 * geofence and the admin queues actually match on.
 */
export const getApplicationProfile = async (applicationId: string) => {
    const app = await getApplication(applicationId);
    if (!app) return null;

    const data = app.data || {};
    const personal = data.personalDetails || data.personal || {};
    const business = data.businessInfo || data.business || {};
    const financial = data.financialInfo || data.financial || {};
    const declaration = data.declaration || {};

    return {
        /*
            The flat shape first, then the nested one over it.

            Applications are stored two ways. One created through the forms
            nests its sections — `data.personalDetails`, `data.businessInfo`,
            and so on — but the older rows, and anything written by the
            registration path, store every field flat on `data` itself. This
            function only ever read the nested shape, so for a flat application
            all four sections resolved to `{}` and the detail view showed a name
            and an email and nothing else, however much the applicant had
            actually filled in.

            Spreading `data` underneath means a flat row is read too, while a
            nested one still wins where both carry the same key.
        */
        ...data,
        ...personal,
        ...business,
        ...financial,
        ...declaration,

        name: app.fullName || personal.fullName || '',
        fullName: app.fullName || personal.fullName || '',
        email: app.email || personal.email || '',
        phone: app.phone || personal.phone || personal.phoneNumber || '',
        phoneNumber: app.phone || personal.phoneNumber || personal.phone || '',
        state: app.state || personal.state || '',
        district: app.district || personal.district || '',
        block: app.block || personal.block || '',
        city: personal.city || '',

        /**
         * Carried through so the detail view can tell an aspirant from a
         * business applicant without a second request. It decides which of the
         * four sections apply — an aspirant is never asked the Business or
         * Financial questions, so showing those sections for one would render
         * a page of empty rows.
         */
        registrationType: app.registrationType || '',
        memberType: app.memberType || '',
        doingBusiness: business.doingBusiness ?? (data as any).doingBusiness,

        status: app.status || '',
        submittedAt: app.createdAt || null,
        blockApprovedAt: app.blockApprovedAt || null,
        districtApprovedAt: app.districtApprovedAt || null,
        stateApprovedAt: app.stateApprovedAt || null,
        rejectionReason: app.rejectionReason || '',
    };
};

/**
 * The approval record the admin screens render — one review, then payment.
 *
 * Built from the server's `Applicant` shape, which already carries the tier
 * bucketing and every approval timestamp. The pages used to derive this
 * themselves from a retired API's fields — `app.approvals.block.status`,
 * `app.memberName`, `app.status === 'pending_block_approval'` — none of which
 * this backend returns, so every application rendered as "Under Review" at
 * stage 1 with an "Unknown" applicant.
 */
export interface ApprovalStage {
    id: number;
    key: 'review' | 'payment';
    title: string;
    reviewer: string;
    status: 'Approved' | 'Rejected' | 'Under Review' | 'Pending';
    reviewDate: string | null;
    notes: string;
}

export interface ApplicationRecord {
    id: string;
    userId: string;
    submittedAt: string;
    status: string;
    stage: number;
    stages: ApprovalStage[];
    memberData: Record<string, any>;
    profile: Applicant;
    /** The server's own bucket: pending | approved | rejected. */
    bucket: string;
    orphaned: boolean;
    fallbackReason: string;
}

/*
 * Two positions, not four: under review, or decided.
 *
 * The four were the relay's rungs. Anything still pending — however it is
 * spelled in the collection — sits at 1, and an approval goes straight to the
 * payment step, because approval IS the end of the review.
 */
const STATUS_TO_STAGE: Record<string, number> = {
    Pending: 1,
    Approved: 2,
    Rejected: 1,
};

/** Turn one server `Applicant` into the record the approval screens render. */
export const toApplicationRecord = (a: any): ApplicationRecord => {
    const status = normaliseStatus(a?.status);
    const currentStage = STATUS_TO_STAGE[status] ?? 1;

    /*
     * WHO the review belongs to, named from the region rather than the tier.
     *
     * There is one review row now and three admins standing behind it, so an
     * undecided row names the region — which is what the applicant recognises
     * anyway — and a decided one names the tier that actually signed it.
     */
    const decidedBy = decidedByLabel(a);
    const region = [a?.block, a?.district, a?.state].filter(Boolean).join(', ');

    const reviewStatus: ApprovalStage['status'] =
        status === 'Rejected' ? 'Rejected'
            : status === 'Approved' ? 'Approved'
                : 'Under Review';

    const stages: ApprovalStage[] = [
        {
            id: 1,
            key: 'review',
            title: 'Application Review',
            reviewer: decidedBy || (region ? `${region} Admins` : 'Block, District and State Admin'),
            status: reviewStatus,
            reviewDate: status === 'Approved'
                ? (a?.stateApprovedAt || a?.districtApprovedAt || a?.blockApprovedAt || null)
                : status === 'Rejected'
                    ? (a?.rejectedBy?.rejectedAt || null)
                    : null,
            notes: status === 'Rejected' ? a?.rejectionReason || '' : '',
        },
        {
            id: 2,
            key: 'payment',
            title: 'Payment',
            reviewer: 'Member',
            // Approval is not payment: an approved application still sits at
            // membershipStatus 'pending' until the member pays.
            status: status === 'Approved' ? 'Under Review' : 'Pending',
            reviewDate: null,
            notes: '',
        },
    ];

    let displayStatus = 'Under Review';
    if (status === 'Rejected') displayStatus = 'Rejected';
    else if (status === 'Approved') displayStatus = 'Ready for Payment';

    return {
        id: String(a?.id || a?.applicationId || a?._id || ''),
        userId: String(a?.memberId || ''),
        submittedAt: a?.submittedAt || a?.createdAt || '',
        status: displayStatus,
        stage: currentStage,
        stages,
        memberData: {
            name: a?.fullName || '',
            email: a?.email || '',
            phone: a?.phone || '',
            block: a?.block || '',
            district: a?.district || '',
            state: a?.state || '',
            memberType: a?.role || '',
            registrationDate: a?.submittedAt || '',
        },
        profile: a as Applicant,
        bucket: a?.stage || 'pending',
        orphaned: !!a?.orphaned,
        fallbackReason: a?.fallbackReason || '',
    };
};

/**
 * Every application this admin can see, already mapped.
 *
 * Reads the tier dashboard rather than `/applications`: the dashboard is
 * geofenced to the admin's own region, which is the whole of what decides who
 * may see an application, and the buckets are computed server-side so the three
 * tiers cannot disagree about one file.
 */
export const getAdminApplications = async (): Promise<ApplicationRecord[]> => {
    const dashboard = await getAdminDashboard();
    return (dashboard.applicants?.all || []).map(toApplicationRecord);
};

// ============================================================ business / companies

export const createCompany = async (fields: Record<string, any>, logo?: File | null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    if (logo) form.append('logo', logo);
    return unwrap<any>(await api.post(ENDPOINTS.BUSINESS.CREATE, form), {});
};

export const getMyCompany = async () => unwrap<any>(await api.get(ENDPOINTS.BUSINESS.MINE), null);
export const getMyCompanies = async () => unwrap<any[]>(await api.get(ENDPOINTS.BUSINESS.ALL), []);
export const getCompany = async (id: string) => unwrap<any>(await api.get(ENDPOINTS.BUSINESS.BY_ID(id)), null);

/** The network-wide directory: every member's company, with products attached. */
export const discoverCompanies = async (q = '', limit = 200) =>
    unwrap<any[]>(await api.get(ENDPOINTS.BUSINESS.DISCOVER, { params: { q, limit } }), []);

export const updateCompany = async (id: string, fields: Record<string, any>, logo?: File | null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    if (logo) form.append('logo', logo);
    return unwrap<any>(await api.put(ENDPOINTS.BUSINESS.UPDATE_BY_ID(id), form), {});
};

export const deleteCompany = async (id: string) =>
    unwrap<any>(await api.delete(ENDPOINTS.BUSINESS.DELETE_BY_ID(id)), null);

// ============================================================ products

export const createProduct = async (fields: Record<string, any>, image?: File | null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    if (image) form.append('image', image);
    return unwrap<any>(await api.post(ENDPOINTS.PRODUCTS.CREATE, form), {});
};

export const getMyProducts = async (companyId?: string) =>
    unwrap<any[]>(await api.get(ENDPOINTS.PRODUCTS.LIST, { params: { companyId } }), []);

/** Network-wide product search. Matches name/category/sku, never description. */
export const discoverProducts = async (q = '', limit = 100) =>
    unwrap<any[]>(await api.get(ENDPOINTS.PRODUCTS.DISCOVER, { params: { q, limit } }), []);

export const getProduct = async (id: string) => unwrap<any>(await api.get(ENDPOINTS.PRODUCTS.BY_ID(id)), null);

export const updateProduct = async (id: string, fields: Record<string, any>, image?: File | null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        form.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
    });
    if (image) form.append('image', image);
    return unwrap<any>(await api.put(ENDPOINTS.PRODUCTS.BY_ID(id), form), {});
};

export const deleteProduct = async (id: string) =>
    unwrap<any>(await api.delete(ENDPOINTS.PRODUCTS.BY_ID(id)), null);

export const getProductStats = async (companyId?: string) =>
    unwrap<any>(await api.get(ENDPOINTS.PRODUCTS.STATS, { params: { companyId } }), {
        total: 0,
        featured: 0,
        active: 0,
    });

export const getProductActivities = async (limit = 10) =>
    unwrap<any[]>(await api.get(ENDPOINTS.PRODUCTS.ACTIVITIES, { params: { limit } }), []);

// ============================================================ admin

/**
 * The dashboard endpoint belonging to the signed-in admin.
 *
 * Resolved at call time, never at module load: the role is not known until
 * someone signs in, so a value computed when the module is first imported would
 * send every tier to the block dashboard.
 */
export const dashboardPathForRole = (): string => {
    const role = getStoredRole() || 'block_admin';
    return DASHBOARD_FOR_ROLE[role as UserRole] || ENDPOINTS.ADMIN.BLOCK_DASHBOARD;
};


/** The caller's own geofenced dashboard, chosen by their role. */
export const getAdminDashboard = async (role?: UserRole): Promise<AdminDashboard> => {
    const resolved = role || getStoredRole() || 'block_admin';
    const path = DASHBOARD_FOR_ROLE[resolved] || ENDPOINTS.ADMIN.BLOCK_DASHBOARD;
    return unwrap<AdminDashboard>(await api.get(path), EMPTY_DASHBOARD);
};

export const getBlockDashboard = async () =>
    unwrap<AdminDashboard>(await api.get(ENDPOINTS.ADMIN.BLOCK_DASHBOARD), EMPTY_DASHBOARD);
export const getDistrictDashboard = async () =>
    unwrap<AdminDashboard>(await api.get(ENDPOINTS.ADMIN.DISTRICT_DASHBOARD), EMPTY_DASHBOARD);
export const getStateDashboard = async () =>
    unwrap<AdminDashboard>(await api.get(ENDPOINTS.ADMIN.STATE_DASHBOARD), EMPTY_DASHBOARD);

export const getAdminProfile = async () => unwrap<any>(await api.get(ENDPOINTS.ADMIN.PROFILE), {});

export const updateAdminProfile = async (payload: Record<string, any>) =>
    unwrap<any>(await api.put(ENDPOINTS.ADMIN.PROFILE, payload), {});

export const getAdminStats = async () => unwrap<any>(await api.get(ENDPOINTS.ADMIN.STATS), {});

export const getAdminUsers = async (params: Record<string, any> = {}) =>
    unwrap<{ users: any[]; pagination: any }>(await api.get(ENDPOINTS.ADMIN.USERS, { params }), {
        users: [],
        pagination: {},
    });

export const getAdminAnalytics = async (period = 'month') =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.ANALYTICS, { params: { period } }), {});

export const generateReport = async (options: Record<string, any> = {}) =>
    unwrap<any>(await api.post(ENDPOINTS.ADMIN.REPORTS, options), {});

// ---- notification delivery oversight (super admin) -------------------------

/** One row of the delivery log. */
export interface NotificationLogRow {
    _id: string;
    event: string;
    channel: 'in_app' | 'email' | 'whatsapp';
    recipient: string;
    sender?: string;
    replyTo?: string;
    templateId?: string;
    subject?: string;
    status: 'queued' | 'sent' | 'failed';
    /**
     * The provider was never contacted — no credentials are configured.
     *
     * Deliberately separate from `status`. A mock row is a successful no-op, and
     * collapsing it into `sent` would tell a Super Admin that members were
     * emailed on a deployment with no mail server at all.
     */
    mock?: boolean;
    providerMessageId?: string;
    lastError?: string;
    attempts?: number;
    data?: any;
    createdAt: string;
}

export interface NotificationHealth {
    sent: number; failed: number; queued: number; mock: number; total: number;
}

export interface DeliveryStatus {
    email: {
        configured: boolean; host: string | null; user: string | null;
        from: string; regionalFrom: boolean; supportAddress: string;
        verification?: { ok: boolean; configured: boolean; error?: string };
    };
    whatsapp: {
        configured: boolean; baseUrl: string; templateEndpoint: string;
        textEndpoint: string; authStyle: string;
        webhookConfigured: boolean; webhookUrl: string;
    };
}

export const getNotificationLogs = async (params: Record<string, any> = {}) =>
    unwrap<{ logs: NotificationLogRow[]; health: NotificationHealth; pagination: any }>(
        await api.get(ENDPOINTS.NOTIFICATIONS.LOGS, { params }),
        { logs: [], health: { sent: 0, failed: 0, queued: 0, mock: 0, total: 0 }, pagination: {} }
    );

export const getDeliveryStatus = async (verifyEmail = false) =>
    unwrap<DeliveryStatus>(
        await api.get(ENDPOINTS.NOTIFICATIONS.DELIVERY_STATUS, {
            params: verifyEmail ? { verifyEmail: '1' } : {}
        }),
        null as any
    );

export const retryNotification = async (id: string) =>
    unwrap<NotificationLogRow>(await api.post(ENDPOINTS.NOTIFICATIONS.RETRY(id), {}), null as any);

export const previewRegionRouting = async (region: Record<string, string>) =>
    unwrap<any>(await api.get(ENDPOINTS.NOTIFICATIONS.ROUTING_PREVIEW, { params: region }), null as any);

export const sendTestNotification = async (channel: 'email' | 'whatsapp', to: string) =>
    unwrap<any>(await api.post(ENDPOINTS.NOTIFICATIONS.TEST_SEND, { channel, to }), null as any);

// ---- super admin -----------------------------------------------------------

export const getSuperOverview = async () => unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_OVERVIEW), {});
export const superSearch = async (q: string) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_SEARCH, { params: { q } }), {});
export const getSuperApplications = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_APPLICATIONS, { params }), {});
export const getDirectory = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_DIRECTORY, { params }), {});
export const listAdmins = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_ADMINS, { params }), {});
export const createAdmin = async (payload: Record<string, any>) =>
    unwrap<any>(await api.post(ENDPOINTS.ADMIN.SUPER_ADMINS, payload), {});
export const updateAdmin = async (id: string, payload: Record<string, any>) =>
    unwrap<any>(await api.put(ENDPOINTS.ADMIN.SUPER_ADMIN_BY_ID(id), payload), {});
export const deleteAdmin = async (id: string) =>
    unwrap<any>(await api.delete(ENDPOINTS.ADMIN.SUPER_ADMIN_BY_ID(id)), {});
export const previewAdminRemoval = async (id: string) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_ADMIN_REMOVAL_PREVIEW(id)), {});
export const suggestAdminRegions = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_ADMIN_REGIONS, { params }), {});
/*
 * The six `listTeamAdmins` / `createTeamAdmin` / … calls were here, for a
 * district or state admin staffing the regions beneath them. Admin accounts are
 * the Super Admin's now — the screen, the routes and the endpoints all went
 * together, so there is nothing left for them to call.
 */

export const bulkTemplate = async () => unwrap<any>(await api.get(ENDPOINTS.ADMIN.SUPER_BULK_TEMPLATE), {});
export const bulkValidate = async (csv: string) =>
    unwrap<any>(await api.post(ENDPOINTS.ADMIN.SUPER_BULK_VALIDATE, { csv }), {});
export const bulkCommit = async (csv: string, sendEmails = true) =>
    unwrap<any>(await api.post(ENDPOINTS.ADMIN.SUPER_BULK_COMMIT, { csv, sendEmails }), {});

// ============================================================ events / notifications / audit

export const listEvents = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.EVENTS.LIST, { params }), []);
export const getEvent = async (id: string) => unwrap<any>(await api.get(ENDPOINTS.EVENTS.BY_ID(id)), null);
export const createEvent = async (fields: Record<string, any>, banner?: File | null) => {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => v != null && form.append(k, String(v)));
    if (banner) form.append('banner', banner);
    return unwrap<any>(await api.post(ENDPOINTS.EVENTS.LIST, form), {});
};
export const setEventStatus = async (id: string, status: 'draft' | 'published') =>
    unwrap<any>(await api.patch(ENDPOINTS.EVENTS.STATUS(id), { status }), {});
export const deleteEvent = async (id: string) => unwrap<any>(await api.delete(ENDPOINTS.EVENTS.BY_ID(id)), null);

export const getNotifications = async (page = 1, limit = 20) =>
    unwrap<{ notifications: any[]; pagination: any; unread: number }>(
        await api.get(ENDPOINTS.NOTIFICATIONS.LIST, { params: { page, limit } }),
        { notifications: [], pagination: {}, unread: 0 },
    );
export const markNotificationRead = async (id: string) =>
    unwrap<any>(await api.patch(ENDPOINTS.NOTIFICATIONS.MARK_READ(id)), null);
export const markAllNotificationsRead = async () =>
    unwrap<any>(await api.patch(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ), null);

export const getAuditLog = async (params: Record<string, any> = {}) =>
    unwrap<any>(await api.get(ENDPOINTS.AUDIT.LIST, { params }), {});
export const getAuditCounts = async () => unwrap<any>(await api.get(ENDPOINTS.AUDIT.COUNTS), {});

// ============================================================ payment

export const createPaymentRequest = async (amount: number, membershipType: string, purpose?: string) =>
    unwrap<any>(
        await api.post(ENDPOINTS.PAYMENT.CREATE_REQUEST, { amount, membershipType, purpose }),
        {},
    );

export const checkPaymentStatus = async (paymentRequestId: string) =>
    unwrap<any>(await api.get(ENDPOINTS.PAYMENT.STATUS(paymentRequestId)), {});

export const completePayment = async (payload: Record<string, any>) =>
    unwrap<any>(await api.post(ENDPOINTS.PAYMENT.COMPLETE, payload), {});

export { errorMessage, unwrap };

// ============================================================ admin management

/**
 * Types for the admin-management endpoints.
 *
 * The calls themselves already exist above — `listAdmins`, `createAdmin`,
 * `bulkValidate` and the rest were written when the endpoint map was, and then
 * nothing ever imported them. Only the shapes were missing, which is why the
 * screen that should have used them was never built against anything concrete.
 *
 * Worth knowing before reading that screen: region fields are FREE TEXT,
 * deliberately. Typing a brand-new block into a brand-new district is a valid
 * one-step way to open that region for registration — no parent admin is
 * required. `suggestAdminRegions` is what stops that splitting one region into
 * two: "Tamil Nadu" and "tamil  nadu" are different regions to `buildGeoFilter`,
 * each holding half of one queue.
 */

export type AdminRole = 'block_admin' | 'district_admin' | 'state_admin';

export interface ManagedAdmin {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    role: AdminRole;
    state: string;
    district: string;
    block: string;
    /** Pre-joined by the server, e.g. "Dharmavaram, Sri Sathya Sai, Andhra Pradesh". */
    region: string;
    active: boolean;
    /** Other active admins on this exact region. 0 means sole owner of the queue. */
    coAdmins: number;
    source?: string;
    createdVia?: string;
}

export interface AdminListResult {
    admins: ManagedAdmin[];
    counts: { all: number; block_admin: number; district_admin: number; state_admin: number };
    total: number;
}

export interface BulkRow {
    lineNumber: number;
    role: string;
    roleLabel: string;
    fullName: string;
    email: string;
    region: string;
    errors: string[];
    warnings: string[];
}

export interface BulkReport {
    totalRows: number;
    validCount: number;
    invalidCount: number;
    warningCount: number;
    byRole: Record<string, number>;
    /** False means the generated passwords reach nobody but this screen. */
    emailConfigured: boolean;
    rows: BulkRow[];
}

// ============================================================ membership plans

/**
 * Membership pricing.
 *
 * The Super Admin owns the amounts and the commencement-year bands, and the
 * rows they edit are the same rows the payment order charges from. That is the
 * point of routing this through the API rather than keeping a table in the
 * bundle: there is one price, and it is the association's to set.
 */

export interface MembershipPlanRow {
    key: string;
    name: string;
    description: string;
    /** Rupees. The server stores paise and converts at the edge. */
    price: number;
    audience: 'business' | 'aspirant';
    minYears: number;
    /** `null` is the open-ended top band — "10 and above". */
    maxYears: number | null;
    /** Derived from the band, never stored beside it. */
    experience: string;
    features: string[];
    popular: boolean;
    active: boolean;
    order: number;
}

export interface MembershipSettings {
    /** Offer every plan instead of the one the applicant's band earns them. */
    showAllPlans: boolean;
}

/** The plans this member is offered, resolved from their commencement year. */
export const getMyMembershipPlans = async () =>
    unwrap<{
        plans: MembershipPlanRow[];
        matched: MembershipPlanRow | null;
        years: number | null;
        reason: 'band' | 'aspirant' | 'all' | 'no-year' | 'no-band';
        showAllPlans: boolean;
    }>(await api.get('/membership/plans/mine'), {
        plans: [], matched: null, years: null, reason: 'no-year', showAllPlans: false,
    });

/** Every plan, retired ones included — the Super Admin's editor. */
export const listMembershipPlans = async () =>
    unwrap<{ plans: MembershipPlanRow[]; settings: MembershipSettings }>(
        await api.get('/admin/super/membership/plans'),
        { plans: [], settings: { showAllPlans: false } },
    );

export const createMembershipPlan = async (payload: Partial<MembershipPlanRow>) =>
    unwrap<MembershipPlanRow>(await api.post('/admin/super/membership/plans', payload), {} as MembershipPlanRow);

export const updateMembershipPlan = async (key: string, payload: Partial<MembershipPlanRow>) =>
    unwrap<MembershipPlanRow>(
        await api.put(`/admin/super/membership/plans/${encodeURIComponent(key)}`, payload),
        {} as MembershipPlanRow,
    );

/** Retires rather than deletes — a paid membership still points at it. */
export const retireMembershipPlan = async (key: string) =>
    unwrap<MembershipPlanRow>(
        await api.post(`/admin/super/membership/plans/${encodeURIComponent(key)}/retire`, {}),
        {} as MembershipPlanRow,
    );

export const updateMembershipSettings = async (settings: Partial<MembershipSettings>) =>
    unwrap<MembershipSettings>(
        await api.put('/admin/super/membership/settings', settings),
        { showAllPlans: false },
    );

/**
 * The published plans, for a screen that needs the bands rather than a price
 * for one person — the commencement-year hint on the business form.
 *
 * Reads the PUBLIC listing: an applicant filling in that form may not yet have
 * the record `/plans/mine` resolves against, and the bands are not private.
 * Shapes the legacy response (`amount`, `entitlements`) into the same row every
 * other caller here uses, so one screen cannot end up reading paise while
 * another reads rupees.
 */
export const getMembershipPlanCatalogue = async (): Promise<MembershipPlanRow[]> => {
    const data = unwrap<{ plans: any[] }>(await api.get('/membership/plans'), { plans: [] });

    return (data.plans || []).map((row) => ({
        key: String(row.key || ''),
        name: String(row.name || ''),
        description: String(row.tagline || row.description || ''),
        price: Number(row.amount ?? (Number(row.amountPaise || 0) / 100)),
        audience: row.audience === 'aspirant' ? 'aspirant' : 'business',
        minYears: Number(row.minYears || 0),
        maxYears: row.maxYears === null || row.maxYears === undefined ? null : Number(row.maxYears),
        experience: String(row.experience || ''),
        features: Array.isArray(row.entitlements) ? row.entitlements : [],
        popular: row.popular === true,
        active: row.isActive !== false,
        order: Number(row.displayOrder || 0),
    }));
};

/**
 * Snap the commencement-year bands into one continuous run.
 *
 * One request rather than a series of plan updates, because the intermediate
 * states of such a series are exactly the overlaps the server rejects.
 */
export const alignMembershipBands = async () =>
    unwrap<{ changed: number; plans: MembershipPlanRow[] }>(
        await api.post('/admin/super/membership/plans/align', {}),
        { changed: 0, plans: [] },
    );

/**
 * Delete a plan outright.
 *
 * Refused by the server, with a count, when payments reference it — deleting
 * then would leave those receipts describing a plan that does not exist. The
 * caller offers `retireMembershipPlan` at that point.
 */
export const deleteMembershipPlan = async (key: string) =>
    unwrap<{ deleted: boolean; key: string; name: string; orders: number }>(
        await api.delete(`/admin/super/membership/plans/${encodeURIComponent(key)}`),
        { deleted: false, key, name: '', orders: 0 },
    );


/* ------------------------------------------------------------------ */
/* TRUST LIST, and the member-facing company page                      */
/* ------------------------------------------------------------------ */

/** One product as it appears on a company's member-facing page. */
export interface PublicProduct {
    _id: string;
    name?: string;
    category?: string;
    price?: number;
    stock?: number;
    sku?: string;
    description?: string;
    imageUrl?: string;
    isFeatured?: boolean;
}

/**
 * A company through the server's public whitelist.
 *
 * There is no PAN, GSTIN, turnover or registration number on this type, and
 * there must not be: the fields are chosen by `PUBLIC_FIELDS` in
 * `business.controller.js` and this interface is the client's copy of that
 * decision. Widening it here would not add the data — it would add a field that
 * is always `undefined` and read, wrongly, as one the server forgot to send.
 */
export interface PublicCompany {
    _id: string;
    businessName?: string;
    businessType?: string;
    description?: string;
    businessActivities?: string;
    constitutionType?: string;
    numberOfEmployees?: string;
    productCategories?: { code?: string; description?: string; industryType?: string }[];
    memberOfOtherChamber?: boolean;
    otherChamber?: string;
    mobileNumber?: string;
    email?: string;
    area?: string;
    location?: string;
    logo?: string;
    /** The cover image across the top of the public profile. */
    banner?: string;
    /** The bodies ticked and the schemes availed. Never the numbers. */
    govtRegistrations?: string[];
    govtSchemes?: string[];
    status?: string;
    isActive?: boolean;
    createdAt?: string;
    products?: PublicProduct[];
    /** How many members keep this company on their trust list. */
    trustedBy?: number;
    /** Whether the CALLER does. Two different questions, both needed. */
    isTrusted?: boolean;
    /** True when the viewer owns it — the page says so rather than pretending. */
    isOwner?: boolean;
    /** Only on trust-list rows. */
    trustedAt?: string;
    note?: string;
}

/** A company as the rest of the network sees it. */
export const getPublicCompany = async (id: string) =>
    unwrap<PublicCompany | null>(
        await api.get(`/business-profiles/public/${encodeURIComponent(id)}`),
        null,
    );

/** The member's trust list, newest first, as full company cards. */
export const getTrustList = async () =>
    unwrap<PublicCompany[]>(await api.get('/business-profiles/trust-list'), []);

/**
 * Just the ids.
 *
 * Discover renders up to 200 cards and each needs to know whether its company
 * is already trusted. One request for the whole set, not one per card.
 */
export const getTrustListIds = async () =>
    unwrap<string[]>(await api.get('/business-profiles/trust-list/ids'), []);

export const addToTrustList = async (companyId: string, note = '') =>
    unwrap<{ companyId: string; isTrusted: boolean; trustedBy: number }>(
        await api.post(`/business-profiles/trust-list/${encodeURIComponent(companyId)}`, { note }),
        { companyId, isTrusted: true, trustedBy: 0 },
    );

export const removeFromTrustList = async (companyId: string) =>
    unwrap<{ companyId: string; isTrusted: boolean; trustedBy: number }>(
        await api.delete(`/business-profiles/trust-list/${encodeURIComponent(companyId)}`),
        { companyId, isTrusted: false, trustedBy: 0 },
    );
