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
    // screen for whoever signs in next.
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

api.interceptors.response.use(
    (response: AxiosResponse) => response,
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
