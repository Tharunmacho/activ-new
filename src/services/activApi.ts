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
    status: string;
    rawStatus: string;
    /** pending | approved | rejected | upstream | closed */
    stage: string;
    statusLabel: string;
    approvedByText: string;
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
    recentActivities?: Array<Record<string, any>>;
    blocks?: Array<Record<string, any>>;
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
export const login = async (email: string, password: string): Promise<LoginResult> => {
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
    state: string;
    district: string;
    block: string;
    city?: string;
}): Promise<LoginResult> => {
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

let regionCache: { at: number; tree: { coverageAvailable: boolean; states: any[] } } | null = null;
let regionInFlight: Promise<{ coverageAvailable: boolean; states: any[] }> | null = null;

export const getRegionTree = async (force = false) => {
    if (!force && regionCache && Date.now() - regionCache.at < REGION_CACHE_TTL_MS) {
        return regionCache.tree;
    }
    if (!force && regionInFlight) return regionInFlight;

    regionInFlight = (async () => {
        try {
            const payload = unwrap<any>(await api.get(ENDPOINTS.REGIONS.TREE), {});
            const tree = {
                // False means the platform has no staffed region at all — a
                // different thing from "the request failed", and the two need
                // different messages on screen.
                coverageAvailable: !!payload.coverageAvailable,
                states: Array.isArray(payload.states) ? payload.states : [],
            };
            regionCache = { at: Date.now(), tree };
            return tree;
        } finally {
            regionInFlight = null;
        }
    })();

    return regionInFlight;
};

/** Drop the cache — call after an admin is created, so a new region appears. */
export const invalidateRegionCache = () => {
    regionCache = null;
};

const sameName = (a?: string | null, b?: string | null) =>
    String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * The three list helpers all read the one cached tree rather than calling their
 * own endpoint, so filling in a registration form costs a single request.
 */
export const getStates = async () => {
    const tree = await getRegionTree();
    return {
        states: tree.states.map((s: any) => ({ name: s.name, admins: s.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

export const getDistricts = async (state: string) => {
    const tree = await getRegionTree();
    const node = tree.states.find((s: any) => sameName(s.name, state));
    return {
        districts: (node?.districts || []).map((d: any) => ({ name: d.name, admins: d.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

export const getBlocks = async (state: string, district: string) => {
    const tree = await getRegionTree();
    const stateNode = tree.states.find((s: any) => sameName(s.name, state));
    const districtNode = (stateNode?.districts || []).find((d: any) => sameName(d.name, district));
    return {
        blocks: (districtNode?.blocks || []).map((b: any) => ({ name: b.name, admins: b.admins })) as RegionNode[],
        coverageAvailable: tree.coverageAvailable,
    };
};

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
    };
    memberSince: string | null;
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
 * Pick the application a member should be shown.
 *
 * The most *advanced* one, not simply the newest. A member can hold more than
 * one row — a resubmission, or a legacy duplicate — and sorting by date can put
 * a stale `Pending-Block` record in front of one that has already reached the
 * State tier. The status screen would then tell someone their application had
 * not been looked at when it was one approval from done.
 */
export const pickMostAdvancedApplication = (list: any[]): any | null => {
    if (!Array.isArray(list) || list.length === 0) return null;
    return (
        list.find((a) => a?.status === 'Approved') ||
        list.find((a) => a?.status === 'Pending-State') ||
        list.find((a) => a?.status === 'Pending-District') ||
        list[0]
    );
};

/**
 * Which tiers have signed off.
 *
 * Derived from the status AND the timestamps, because either alone is
 * incomplete: a file at `Pending-State` has necessarily cleared Block and
 * District even if an older row never recorded those timestamps, and a
 * timestamp proves a tier signed off regardless of where the file sits now.
 */
export const deriveApprovalFlags = (app: any) => {
    const status = app?.status || '';
    const isBlockApproved =
        status === 'Approved' ||
        status === 'Pending-State' ||
        status === 'Pending-District' ||
        !!app?.blockApprovedAt;
    const isDistrictApproved =
        status === 'Approved' || status === 'Pending-State' || !!app?.districtApprovedAt;
    const isStateApproved = status === 'Approved' || !!app?.stateApprovedAt;

    return { isBlockApproved, isDistrictApproved, isStateApproved, isRejected: status === 'Rejected' };
};

export type TimelineStageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected';

/**
 * One tier's state on the review timeline.
 *
 * A rejection belongs to the first tier that had not yet approved — that is the
 * tier that must have refused it, and it is what `rejectedBy.adminType` records
 * on the server.
 */
export const timelineStageStatus = (
    stage: 'block' | 'district' | 'state',
    app: any,
): TimelineStageStatus => {
    const f = deriveApprovalFlags(app);

    if (f.isRejected) {
        if (stage === 'block' && !f.isBlockApproved) return 'rejected';
        if (stage === 'district' && f.isBlockApproved && !f.isDistrictApproved) return 'rejected';
        if (stage === 'state' && f.isDistrictApproved && !f.isStateApproved) return 'rejected';
    }

    if (stage === 'block') {
        if (f.isBlockApproved) return 'approved';
        return app?.status === 'Pending-Block' ? 'in_progress' : 'pending';
    }
    if (stage === 'district') {
        if (f.isDistrictApproved) return 'approved';
        return app?.status === 'Pending-District' && f.isBlockApproved ? 'in_progress' : 'pending';
    }
    if (stage === 'state') {
        if (f.isStateApproved) return 'approved';
        return app?.status === 'Pending-State' && f.isDistrictApproved ? 'in_progress' : 'pending';
    }
    return 'pending';
};

/**
 * The three-tier review timeline for the member's own application.
 *
 * Same derivation the mobile app uses, so both clients tell an applicant the
 * same story about where their file is.
 */
export const getApplicationTimeline = async () => {
    const app = pickMostAdvancedApplication(await getMyApplications());
    if (!app) return null;

    const flags = deriveApprovalFlags(app);

    return {
        application: { ...app, ...flags },
        stages: [
            {
                key: 'block' as const,
                title: 'Block Review',
                status: timelineStageStatus('block', app),
                reviewDate: app.blockApprovedAt || null,
            },
            {
                key: 'district' as const,
                title: 'District Review',
                status: timelineStageStatus('district', app),
                reviewDate: app.districtApprovedAt || null,
            },
            {
                key: 'state' as const,
                title: 'State Review',
                status: timelineStageStatus('state', app),
                reviewDate: app.stateApprovedAt || null,
            },
        ],
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

export const approveApplication = async (id: string) =>
    unwrap<any>(await api.post(ENDPOINTS.APPLICATIONS.APPROVE(id), {}), {});

export const rejectApplication = async (id: string, rejectionReason: string) =>
    unwrap<any>(await api.post(ENDPOINTS.APPLICATIONS.REJECT(id), { rejectionReason }), {});

/** Explicit per-tier review, when the caller wants to name the tier. */
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
 * The four-stage approval record the admin screens render.
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
    key: 'block' | 'district' | 'state' | 'payment';
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
    /** The server's own per-tier bucket: pending | approved | rejected | upstream | closed. */
    bucket: string;
    orphaned: boolean;
    fallbackReason: string;
}

const STATUS_TO_STAGE: Record<string, number> = {
    'Pending-Block': 1,
    'Pending-District': 2,
    'Pending-State': 3,
    Approved: 4,
    Rejected: 1,
};

/** Turn one server `Applicant` into the record the approval screens render. */
export const toApplicationRecord = (a: any): ApplicationRecord => {
    const status = a?.status || 'Pending-Block';
    const currentStage = STATUS_TO_STAGE[status] ?? 1;
    const rejectedBy = a?.rejectedBy?.adminType || '';

    // A tier is Approved once its timestamp exists — that is the fact the
    // server records. "Under Review" belongs only to the tier now holding it.
    const stageFor = (
        index: number,
        key: ApprovalStage['key'],
        title: string,
        reviewer: string,
        approvedAt: string | null,
        rejectorType: string,
    ): ApprovalStage => {
        let stageStatus: ApprovalStage['status'] = 'Pending';
        if (approvedAt) stageStatus = 'Approved';
        else if (status === 'Rejected' && rejectedBy === rejectorType) stageStatus = 'Rejected';
        else if (currentStage === index && status !== 'Rejected') stageStatus = 'Under Review';

        return {
            id: index,
            key,
            title,
            reviewer,
            status: stageStatus,
            reviewDate: approvedAt || (stageStatus === 'Rejected' ? a?.rejectedBy?.rejectedAt || null : null),
            notes: stageStatus === 'Rejected' ? a?.rejectionReason || '' : '',
        };
    };

    const stages: ApprovalStage[] = [
        stageFor(1, 'block', 'Block Review', `${a?.block || 'Block'} Admin`, a?.blockApprovedAt || null, 'BlockAdmin'),
        stageFor(2, 'district', 'District Review', `${a?.district || 'District'} Admin`, a?.districtApprovedAt || null, 'DistrictAdmin'),
        stageFor(3, 'state', 'State Review', `${a?.state || 'State'} Admin`, a?.stateApprovedAt || null, 'StateAdmin'),
        {
            id: 4,
            key: 'payment',
            title: 'Payment',
            reviewer: 'Member',
            // Approval is not payment: a fully approved application still sits
            // at membershipStatus 'pending' until the member pays.
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
 * geofenced to the admin's own region and the buckets are computed server-side,
 * where the rule that the same application shows a different stage to each tier
 * actually lives.
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
