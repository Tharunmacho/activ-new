/**
 * The one axios instance the website uses.
 *
 * Web counterpart of `frontend/src/services/api.ts`. Same interceptors, same
 * rules; `localStorage` stands in for `AsyncStorage`. Nothing should call
 * `fetch` or `axios` directly — a bare call skips the token header and the
 * timeout, and a request with no timeout is how a tab ends up spinning forever
 * against a sleeping server.
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { API_BASE_URL, API_TIMEOUT, STORAGE_KEYS } from '@/config/api.config';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------- token store

export const getAuthToken = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch {
        // Private-mode browsers throw on storage access rather than returning null.
        return null;
    }
};

/**
 * Fired whenever the signed-in identity changes — sign in, or sign out.
 *
 * Providers mounted at the app root run their effects once, when the app
 * mounts. Signing in is a client-side `navigate()` with no page reload, so at
 * the moment those effects ran there was no token: `ProfileProvider` saw an
 * unauthenticated visitor, returned early, and never ran again. Profile
 * completion therefore stayed at 0% for the whole session however much the
 * member had actually filled in, and only a hard refresh corrected it.
 *
 * Anything that derives from the session listens for this instead of assuming
 * one mount equals one user.
 */
export const SESSION_EVENT = 'activ:session-changed';

const announceSessionChange = (): void => {
    try {
        window.dispatchEvent(new Event(SESSION_EVENT));
    } catch {
        /* no window (SSR / tests) — nothing is listening either */
    }
};

export const setAuthToken = (token: string): void => {
    try {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        // Mirrored immediately — see syncLegacyTokenKeys for why.
        localStorage.setItem('adminToken', token);
    } catch {
        /* storage unavailable — the session lives for this page only */
    }
    announceSessionChange();
};

/**
 * Keep `adminToken` in step with the canonical `token`.
 *
 * Twenty-two admin pages read `localStorage.getItem('adminToken')` and build
 * their own `Authorization` header rather than going through this client. That
 * key was written by the retired port-4000 login; nothing writes it now, so
 * those pages either sent `Bearer null` or replayed a token signed with the old
 * server's secret — both of which come back as
 * `401 Invalid or expired token` on requests that had every right to succeed.
 *
 * There is exactly one session, so there should be exactly one token value. The
 * canonical key wins; a lone legacy value is adopted only when there is nothing
 * else, which keeps a session alive across the upgrade instead of silently
 * logging everyone out.
 *
 * This is bridge scaffolding. When those pages are migrated to `activApi`, the
 * mirror and this function go with them.
 */
export const syncLegacyTokenKeys = (): void => {
    try {
        const canonical = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const legacy = localStorage.getItem('adminToken');

        if (canonical) {
            if (legacy !== canonical) localStorage.setItem('adminToken', canonical);
            return;
        }

        // A token is only usable if it is a JWT this backend could have issued;
        // a leftover opaque value from the old server is worse than none,
        // because it produces a 401 that reads like an expired session.
        if (legacy && legacy.split('.').length === 3) {
            localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, legacy);
        } else if (legacy) {
            localStorage.removeItem('adminToken');
        }
    } catch {
        /* storage unavailable */
    }
};

export const clearSession = (): void => {
    try {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        // Written by older code paths; cleared too so a stale identity cannot
        // outlive the token that authorised it.
        /*
         * `userDataLastFetch` belongs here too, and leaving it out had teeth.
         *
         * The sidebar used it as a two-minute "do not re-fetch the profile"
         * stamp. It survived sign-out, so registering a second account in the
         * same browser inside two minutes meant the new session skipped its
         * profile fetch entirely — the previous member's timestamp said the data
         * was fresh. The name was cleared with everything else and never
         * refilled, so a brand-new account greeted its owner as "Member".
         */
        ['adminToken', 'adminData', 'memberId', 'userProfilePhoto', 'userDataLastFetch',
            'userOrganization', 'profileCompletion', 'hasVisitedDashboard'].forEach((key) =>
            localStorage.removeItem(key),
        );
    } catch {
        /* nothing to clear */
    }
    // So a signed-out session does not leave the previous member's figures on
    // screen for whoever signs in next. The request cache goes with it — the key
    // is token-scoped, so a stale entry could not be served anyway, but holding
    // the previous member's payloads in memory after they have signed out is not
    // something to leave to a technicality.
    clearRequestCache();
    announceSessionChange();
};

// ------------------------------------------------------------- request/response

api.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;

        // The browser must set the multipart boundary itself. Leaving our JSON
        // default in place produces a body the server cannot parse, and multer
        // reports it as "no file uploaded" rather than as a header problem.
        if (config.data instanceof FormData) delete config.headers['Content-Type'];

        return config;
    },
    (error) => Promise.reject(error),
);

/* ------------------------------------------------------- GET de-duplication */

/**
 * One request per distinct GET, and a completed one reusable for a moment.
 *
 * `apiFetch` in `activApi` already did this, but nothing else did: every typed
 * function on top of this file — `getMyProfile`, `getMyApplication`,
 * `getBusinessInfo`, `getRecentActivity`, the CMS readers, the admin readers —
 * goes through the axios instance, which had no such collapsing. The production
 * log shows what that costs: **seven** `GET /members/my-profile` in a single
 * page load, because the dashboard, the sidebar, the profile context and the
 * membership gate each ask independently and none of them knows about the
 * others.
 *
 * The key includes the token, so one account's answer can never be handed to
 * another. It includes the params, so `?limit=6` and `?limit=10` stay distinct.
 *
 * `data` is cloned per caller. Sharing one object between four components is an
 * invitation for one of them to mutate what the others are rendering; these
 * payloads are a few hundred bytes, so the copy is free next to the round trip
 * it saves.
 */
const GET_TTL_MS = 4000;

type CacheEntry = { at: number; response: AxiosResponse };

const inFlightGets = new Map<string, Promise<AxiosResponse>>();
const freshGets = new Map<string, CacheEntry>();

/**
 * Caches living outside this file that must be dropped whenever this one is.
 *
 * `activApi.apiFetch` keeps its own pair of maps over the `fetch` path, and the
 * two layers read the same endpoints: the member sidebar's `/members/my-profile`
 * goes through `apiFetch`, the typed `getMyProfile()` goes through axios. Left
 * unwired, a save through either transport would clear only its own half and
 * the other would keep serving the pre-save body for the rest of its TTL — the
 * exact stale-read this de-duplication exists not to introduce.
 *
 * A registry rather than an import because the dependency only runs one way:
 * `activApi` imports this file, so this file cannot import it back.
 */
const externalClearers = new Set<() => void>();

/**
 * Register a cache that should be dropped alongside this one. The callback must
 * only clear its own storage — calling back into `clearRequestCache` would
 * recurse.
 */
export const registerCacheClearer = (clear: () => void): void => {
    externalClearers.add(clear);
};

/** Drop every cached GET. Called on any mutation and on any session change. */
export const clearRequestCache = (): void => {
    inFlightGets.clear();
    freshGets.clear();
    externalClearers.forEach((clear) => {
        try {
            clear();
        } catch {
            // One misbehaving registrant must not leave the rest cached.
        }
    });
};

const cloneResponse = (response: AxiosResponse): AxiosResponse => {
    try {
        return { ...response, data: structuredClone(response.data) };
    } catch {
        // A payload holding something unclonable is rare and not worth failing
        // over; sharing it is still better than a second round trip.
        return response;
    }
};

const originalGet = api.get.bind(api);

api.get = function dedupedGet(url: string, config?: any) {
    /*
     * A caller with its own AbortSignal owns that request's lifetime, and one
     * with a custom `adapter` or `responseType` is not asking for JSON — neither
     * can be safely shared, so both go straight through. A custom
     * `validateStatus` goes through too: it can resolve a 4xx, and the cache
     * below assumes anything that resolved is a successful read worth replaying.
     */
    const shareable =
        !config?.signal && !config?.adapter && !config?.responseType && !config?.validateStatus;
    if (!shareable) return originalGet(url, config);

    const key = `${url}|${JSON.stringify(config?.params ?? null)}|${getAuthToken() || ''}`;

    const cached = freshGets.get(key);
    if (cached && Date.now() - cached.at < GET_TTL_MS) {
        return Promise.resolve(cloneResponse(cached.response));
    }
    if (cached) freshGets.delete(key);

    const pending = inFlightGets.get(key);
    if (pending) return pending.then(cloneResponse);

    const request = originalGet(url, config)
        .then((response: AxiosResponse) => {
            // Only successful reads are worth replaying. A 4xx or 5xx should be
            // retried by the next caller, not handed round.
            freshGets.set(key, { at: Date.now(), response });
            return response;
        })
        .finally(() => {
            inFlightGets.delete(key);
        });

    inFlightGets.set(key, request);
    return request.then(cloneResponse);
} as typeof api.get;

api.interceptors.response.use(
    (response: AxiosResponse) => {
        // A write changes what the reads say. Clearing on the way out rather
        // than on the way in matters: a GET that resolved while the write was
        // still open would otherwise be cached as post-write.
        if (String(response.config?.method || 'get').toLowerCase() !== 'get') clearRequestCache();
        return response;
    },
    (error: AxiosError) => {
        const status = error.response?.status;
        const url = error.config?.url || '';

        // A 401 while *attempting* to sign in means "wrong password", not
        // "session expired". Clearing storage and redirecting there would bounce
        // the user off the login page they are standing on.
        const isAuthAttempt =
            url.includes('/auth/login') ||
            url.includes('/auth/register') ||
            url.includes('/auth/forgot-password') ||
            url.includes('/auth/reset-password');

        if (status === 401 && !isAuthAttempt) {
            clearSession();
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                window.location.assign('/login');
            }
        }

        return Promise.reject(error);
    },
);

// ------------------------------------------------------------------- helpers

/**
 * Pull the payload out of a response.
 *
 * Most routes answer with the `ApiResponse` envelope
 * `{ success, statusCode, message, data }`, but the product routes answer with
 * a bare `{ success, data, count }`. Reaching for `.data.data` blindly breaks on
 * the second shape, so both are handled here once.
 */
export const unwrap = <T>(response: any, fallback: T): T => {
    const body = response?.data;
    if (body === undefined || body === null) return fallback;
    if (Object.prototype.hasOwnProperty.call(body, 'data') && body.data !== undefined && body.data !== null) {
        return body.data as T;
    }
    return (body ?? fallback) as T;
};

/**
 * A message worth showing a human.
 *
 * The distinction that matters is network-versus-server: a failed connection
 * has no `response`, and reporting that as "invalid email or password" sends
 * the user off to check credentials that were never even transmitted.
 */
export const errorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
    const err = error as AxiosError<{ message?: string }>;

    if (err?.response) {
        return err.response.data?.message || `${fallback} (${err.response.status})`;
    }
    if (err?.code === 'ECONNABORTED') {
        return 'The server took too long to respond. It may be starting up — please try again.';
    }
    if (err?.request) {
        return 'Cannot reach the server. Check that the backend is running and that this site is allowed by CORS.';
    }
    return (err as Error)?.message || fallback;
};

export default api;
