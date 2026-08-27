/**
 * The single source of truth for how the website reaches the ACTIV backend.
 *
 * This is the web counterpart of `frontend/src/config/api.config.ts` in the
 * mobile app, and it is deliberately the same shape. Both clients talk to ONE
 * backend (`backend/` in this repo) — there is no "web backend". If an endpoint
 * is not listed here it does not exist, and adding one means adding a route in
 * `backend/src`, not inventing a path on this side.
 *
 * The website was originally built against a different, now-retired server on
 * port 4000 whose routes were flat (`/api/personal-form`, `/api/admin/login`).
 * Those paths do not exist on this backend. `services/legacyBridge.ts`
 * translates them so existing pages keep working; new code should import from
 * `services/activApi.ts` instead.
 */

const API_CONFIG = {
    development: {
        // The backend listens on 5000 (backend/.env → PORT). The `/api/v1`
        // suffix is part of the contract: `routes.js` mounts every module under
        // `/api/${config.apiVersion}`, so a request to `/api/auth/login` reaches
        // nothing and falls through to a 404.
        baseURL: 'http://localhost:5000/api/v1',
        timeout: 20000,
    },
    production: {
        baseURL: 'https://YOUR_DOKPLOY_BACKEND_URL.com/api/v1',
        timeout: 10000,
    },
};

const ENV = import.meta.env.DEV ? 'development' : 'production';

/**
 * Overridable per deployment, but always normalised to end in `/api/v1`.
 *
 * The suffix is appended when it is missing rather than trusted from the
 * environment: a bare origin in VITE_API_URL is the easy mistake, and it turns
 * every request into a 404 against the static handler instead of the API.
 */
const normaliseBase = (value: string): string => {
    const trimmed = value.replace(/\/+$/, '');
    return /\/api\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
};

const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const API_BASE_URL = envBase ? normaliseBase(envBase) : API_CONFIG[ENV].baseURL;

export const API_TIMEOUT = API_CONFIG[ENV].timeout;

/**
 * The origin that serves uploaded files.
 *
 * Uploads live at `<origin>/uploads/<file>` with **no** `/api/v1` prefix —
 * `app.js` mounts them as static before the API router. Building an image URL
 * from API_BASE_URL therefore 404s.
 */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** Keys the website stores its session under. */
export const STORAGE_KEYS = {
    AUTH_TOKEN: 'token',
    USER_DATA: 'userData',
    USER_ROLE: 'role',
    USER_ID: 'userId',
    USER_NAME: 'userName',
    USER_EMAIL: 'userEmail',
    IS_LOGGED_IN: 'isLoggedIn',
} as const;

export type UserRole =
    | 'member'
    | 'block_admin'
    | 'district_admin'
    | 'state_admin'
    | 'super_admin'
    /**
     * Content only — the public site, and nothing else.
     *
     * Editing the About page and deleting a block admin are different jobs done
     * by different people. One account doing both means whoever writes the
     * marketing copy can also unstaff a region.
     */
    | 'cms_admin';

/**
 * Where each role lands after signing in.
 *
 * The backend returns exactly one of these five in `data.role`; there is no
 * separate admin login to branch on.
 */
export const HOME_FOR_ROLE: Record<UserRole, string> = {
    member: '/member/unpaid-dashboard',
    block_admin: '/block-admin/dashboard',
    district_admin: '/district-admin/dashboard',
    state_admin: '/state-admin/dashboard',
    /**
     * Each lands where its job is.
     *
     * A super admin used to land in the CMS, from a time when one account did
     * both jobs. Now that content has its own role, a platform administrator
     * lands on the platform.
     */
    super_admin: '/super-admin/dashboard',
    cms_admin: '/cms',
};

/** The admin dashboard endpoint that belongs to each admin role. */
export const DASHBOARD_FOR_ROLE: Partial<Record<UserRole, string>> = {
    block_admin: '/admin/block/dashboard',
    district_admin: '/admin/district/dashboard',
    state_admin: '/admin/state/dashboard',
    super_admin: '/admin/super/overview',
};

/**
 * Turn a stored image value into a URL this browser can actually load.
 *
 * Uploads are stored as a relative `/uploads/<file>` path. Older rows hold an
 * absolute URL built from whatever host the *uploading* device used
 * (`http://localhost:5000/...`, `http://10.0.2.2:5000/...`, a stale LAN IP),
 * which every other client fails to fetch — the <img> just renders blank. Any
 * value carrying an `/uploads/` segment is therefore re-anchored to the API
 * origin we are actually talking to, which repairs those rows on read.
 */
export const resolveMediaUrl = (value?: string | null): string => {
    const raw = (value || '').trim();
    if (!raw) return '';

    // Local picker results and inline data are already displayable.
    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    // Anything the backend stores lands under /uploads — profile photos, event
    // banners, CMS media. Those and only those belong to the API origin.
    const uploadIndex = raw.indexOf('/uploads/');
    if (uploadIndex !== -1) return `${API_ORIGIN}${raw.slice(uploadIndex)}`;

    // A genuine remote asset (S3, Cloudinary, an avatar service) is left alone.
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

    /**
     * Any other site-relative path is a file shipped with THIS site —
     * `/logo_ACTIVian-removebg-preview.png` lives in `website/public`, not in
     * the backend's upload directory. Returning it untouched lets the browser
     * resolve it against the page's own origin.
     *
     * Prefixing the API origin here is what hid the logo: the path was correct,
     * the file existed, and the request went to a server that had never heard
     * of it and answered 404.
     */
    return raw.startsWith('/') ? raw : `/${raw}`;
};

/**
 * Every endpoint this backend exposes, exactly as `backend/src/routes.js`
 * mounts them. Mirrors the mobile app's ENDPOINTS map.
 */
export const ENDPOINTS = {
    HEALTH: '/health',

    AUTH: {
        REGISTER: '/auth/register',
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        REFRESH: '/auth/refresh',
        ME: '/auth/me',
        CHANGE_PASSWORD: '/auth/change-password',
        FORGOT_PASSWORD: '/auth/forgot-password',
        RESET_PASSWORD: '/auth/reset-password',
        VERIFY_RESET_TOKEN: '/auth/reset-password/verify',
    },

    // Public — the registration screens call these before a token exists.
    REGIONS: {
        STATES: '/regions/states',
        DISTRICTS: '/regions/districts',
        BLOCKS: '/regions/blocks',
        TREE: '/regions/tree',
        VALIDATE: '/regions/validate',
        GEOGRAPHY: '/regions/geography',
    },

    MEMBERS: {
        MY_PROFILE: '/members/my-profile',
        BUSINESS_INFO: '/members/business-info',
        FINANCIAL_INFO: '/members/financial-info',
        DECLARATION_INFO: '/members/declaration-info',
        UPDATE_PROFILE: '/members/profile',
        PROFILE_PHOTO: '/members/profile-photo',
        LIST: '/members',
        /** The member's own feed — application, approval and payment events. */
        RECENT_ACTIVITY: '/members/recent-activity',
        /** `kind` is 'membership' or 'tax-exemption'. */
        CERTIFICATE: (kind: string) => `/members/certificate/${kind}`,
    },

    APPLICATIONS: {
        CREATE: '/applications',
        MINE: '/applications/my-applications',
        LIST: '/applications',
        BY_ID: (id: string) => `/applications/${id}`,
        BY_USER: (userId: string) => `/applications/user/${userId}`,
        STATUS: (id: string) => `/applications/${id}/status`,
        BLOCK_REVIEW: (id: string) => `/applications/${id}/block-review`,
        DISTRICT_REVIEW: (id: string) => `/applications/${id}/district-review`,
        STATE_REVIEW: (id: string) => `/applications/${id}/state-review`,
        APPROVE: (id: string) => `/applications/${id}/approve`,
        REJECT: (id: string) => `/applications/${id}/reject`,
        DELETE: (id: string) => `/applications/${id}`,
    },

    // Mounted at the API root, not under a prefix.
    BUSINESS: {
        CREATE: '/business-profiles',
        MINE: '/business-profiles/me',
        ALL: '/business-profiles/all',
        DISCOVER: '/business-profiles/discover',
        BY_ID: (id: string) => `/business-profiles/${id}`,
        UPDATE_MINE: '/business-profiles/me',
        UPDATE_BY_ID: (id: string) => `/business-profiles/${id}`,
        DELETE_MINE: '/business-profiles/me',
        DELETE_BY_ID: (id: string) => `/business-profiles/${id}`,
    },

    PRODUCTS: {
        CREATE: '/products',
        LIST: '/products',
        DISCOVER: '/products/discover',
        STATS: '/products/stats',
        ACTIVITIES: '/products/activities',
        BY_ID: (id: string) => `/products/${id}`,
    },

    ADMIN: {
        BLOCK_DASHBOARD: '/admin/block/dashboard',
        DISTRICT_DASHBOARD: '/admin/district/dashboard',
        STATE_DASHBOARD: '/admin/state/dashboard',
        SUPER_DASHBOARD: '/admin/super/dashboard',

        SUPER_OVERVIEW: '/admin/super/overview',
        SUPER_SEARCH: '/admin/super/search',
        SUPER_APPLICATIONS: '/admin/super/applications',
        SUPER_DIRECTORY: '/admin/super/directory',
        SUPER_ADMINS: '/admin/super/admins',
        SUPER_ADMIN_BY_ID: (id: string) => `/admin/super/admins/${id}`,
        SUPER_ADMIN_REGIONS: '/admin/super/admins/regions',
        SUPER_ADMIN_REMOVAL_PREVIEW: (id: string) => `/admin/super/admins/${id}/removal-preview`,
        SUPER_BULK_TEMPLATE: '/admin/super/admins/bulk/template',
        SUPER_BULK_VALIDATE: '/admin/super/admins/bulk/validate',
        SUPER_BULK_COMMIT: '/admin/super/admins/bulk',
        SUPER_PROFILE_PHOTO: '/admin/super/profile/photo',

        STATS: '/admin/stats',
        USERS: '/admin/users',
        USER_ROLE: (id: string) => `/admin/users/${id}/role`,
        USER_TOGGLE: (id: string) => `/admin/users/${id}/toggle-status`,
        USER_ACTION: (id: string, action: string) => `/admin/users/${id}/${action}`,
        ANALYTICS: '/admin/analytics',
        REPORTS: '/admin/reports/generate',
        PROFILE: '/admin/profile',
    },

    EVENTS: {
        LIST: '/events',
        BY_ID: (id: string) => `/events/${id}`,
        STATUS: (id: string) => `/events/${id}/status`,
    },

    NOTIFICATIONS: {
        LIST: '/notifications',
        MARK_READ: (id: string) => `/notifications/${id}/read`,
        MARK_ALL_READ: '/notifications/read-all',
    },

    ANALYTICS: {
        USER_GROWTH: '/analytics/user-growth',
        APPLICATIONS: '/analytics/applications',
        MEMBERS: '/analytics/members',
    },

    AUDIT: {
        LIST: '/audit',
        COUNTS: '/audit/counts',
    },

    PAYMENT: {
        CREATE_REQUEST: '/payment/create-request',
        STATUS: (id: string) => `/payment/status/${id}`,
        RENEW: '/payment/renew',
        /** The plans and prices, as the server holds them. */
        PLANS: '/payment/plans',
        /** Start a payment. The server decides the amount from the plan. */
        ORDER: '/payment/order',
        /** One order, the caller's own. */
        ORDER_BY_ID: (orderId: string) => `/payment/order/${orderId}`,
        /** Interim stand-in for the gateway's authorisation step. */
        MOCK_AUTHORIZE: '/payment/mock-authorize',
        /** Verify a signed payment and activate the membership. */
        COMPLETE: '/payment/complete',
    },
} as const;

/** Membership prices, enforced server-side in `payment.routes.js`. */
export const MEMBERSHIP_PRICES: Record<string, number> = {
    starter: 500,
    intermediate: 1000,
    advanced: 2000,
    lifetime: 2500,
    aspirant: 500,
};
