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
    | 'cms_admin'
    /**
     * Events only — the programme, its categories and its bookings. A separate
     * account for the person who runs events, with the super admin's own event
     * screens and nothing else of the platform.
     */
    | 'events_admin';

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
    events_admin: '/events-admin/dashboard',
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

    /*
     * ======================================================================
     * RE-ANCHOR A STALE HOST, NOT A WORKING ONE
     * ======================================================================
     *
     * This re-anchored EVERY value carrying `/uploads/`, absolute ones
     * included. That repairs the rows it was written for — a URL built on
     * `http://localhost:5000` or `http://10.0.2.2:5000` by whichever machine
     * did the uploading is useless to every other client.
     *
     * But it also rewrote URLs that were perfectly good. An event banner
     * stored as `https://<the real backend>/uploads/…` was re-pointed at
     * whatever API this build talks to — so running the site locally against
     * the SHARED database asked `localhost:5000` for a file that only exists
     * on the deployed server, got a 404, and drew an empty frame. Reported as
     * "why are the images not showing".
     *
     * So the repair is narrowed to the hosts that actually need repairing:
     * loopback, the Android emulator's alias, and private LAN addresses. A
     * public hostname is left exactly as it was stored, because it works.
     */
    const uploadIndex = raw.indexOf('/uploads/');
    if (uploadIndex !== -1) {
        const isAbsolute = /^https?:\/\//i.test(raw);
        if (!isAbsolute) return `${API_ORIGIN}${raw.slice(uploadIndex)}`;

        let host = '';
        try { host = new URL(raw).hostname; } catch { host = ''; }

        const unreachableElsewhere = !host
            || host === 'localhost'
            || host === '127.0.0.1'
            || host === '0.0.0.0'
            || host === '10.0.2.2'
            || /^10\./.test(host)
            || /^192\.168\./.test(host)
            || /^172\.(1[6-9]|2\d|3[01])\./.test(host);

        return unreachableElsewhere ? `${API_ORIGIN}${raw.slice(uploadIndex)}` : raw;
    }

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
 * Hosts that serve a sized rendition when asked for one.
 *
 * Unsplash and the picture services take `?w=`; a file on our own `/uploads`
 * does not, and asking would just add a query string nothing reads.
 */
const RESIZABLE_MEDIA_HOSTS = [
    'images.unsplash.com',
    'res.cloudinary.com',
    'ik.imagekit.io',
];

/**
 * The same address, at the size it is actually drawn.
 *
 * A seeded photograph is an original camera file — 7442px wide in one case —
 * and a card that paints it into a 56px thumbnail still downloads and DECODES
 * every one of those pixels. That decode is what stops a page answering a
 * scroll; it does not show up as a slow frame, it shows up as a page that feels
 * stuck. Measured on the region pages: 116 megapixels for eighteen images.
 *
 * Pass the width of the slot, not of the file. An editor who has already sized
 * a URL themselves (`w` is present) is left alone, and anything we host is
 * returned untouched.
 */
export const sizedMediaUrl = (value?: string | null, width = 900): string => {
    const resolved = resolveMediaUrl(value);
    if (!resolved || resolved.startsWith('data:') || resolved.startsWith('blob:')) return resolved;

    try {
        const url = new URL(
            resolved,
            typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
        );
        if (!RESIZABLE_MEDIA_HOSTS.includes(url.hostname)) return resolved;
        if (url.searchParams.has('w')) return resolved;
        url.searchParams.set('w', String(Math.round(width)));
        /* 75 is the quality these services default to for a resized rendition
           and is indistinguishable at these sizes; the seeded URLs ask for 80. */
        if (!url.searchParams.has('q')) url.searchParams.set('q', '75');
        return url.toString();
    } catch {
        return resolved;
    }
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
        /**
         * The member directory (DIR-001).
         *
         * Not `LIST` above. `/members` hands the query string straight to
         * `MemberDetails.find` as a filter, which is fine for an admin listing
         * and wrong for a member-facing search: the caller can filter on any
         * field of the schema, and the whole matched document comes back. The
         * directory endpoints name their filters and name their fields.
         */
        DIRECTORY: '/members/directory',
        DIRECTORY_SECTORS: '/members/directory/sectors',
        DIRECTORY_ENTRY: (id: string) => `/members/directory/${id}`,
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
        // Catalogue and stock management (BUS-001, BUS-002).
        LOW_STOCK: '/products/low-stock',
        STOCK_MOVEMENTS: '/products/stock-movements',
        ADJUST_STOCK: (id: string) => `/products/${id}/stock`,
        PUBLISH: (id: string) => `/products/${id}/publish`,
        VIEW: (id: string) => `/products/${id}/view`,
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

        /*
         * The same admin management, for every tier that staffs a region.
         *
         * Super, state and district all call these; the server decides who may
         * manage whom from the token. The `/super/*` paths above stay for the
         * mobile app, which is super-admin only.
         */
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
        // Registration (EVT-002). `MY_REGISTRATIONS` is a literal path and is
        // declared by the router above `/:id`, or it reads as an event id.
        MY_REGISTRATIONS: '/events/my-registrations',
        REGISTER: (id: string) => `/events/${id}/register`,
        // Paying for a held seat is a second step, not a flag on the first: a
        // seat can be held now and paid for later, and a payment can be retried.
        PAY_REGISTRATION: (id: string) => `/events/${id}/register/pay`,
        REGISTRATIONS: (id: string) => `/events/${id}/registrations`,
        // The audience preview. A literal path, declared above `/:id` server-side.
        REACH: '/events/reach',

        /*
         * The organiser's view of the public "Book Now" bookings.
         *
         * Under `/events` and therefore behind the members' token — taking a
         * booking is something a stranger does, reading everyone's name, mobile
         * and what they paid is not. The public half lives in `EVENT_BOOKINGS`
         * below, on its own unauthenticated mount.
         */
        BOOKINGS: (id: string) => `/events/${id}/bookings`,
        BOOKING: (id: string, ref: string) => `/events/${id}/bookings/${ref}`,
        RECORD_BOOKING_PAYMENT: (id: string, ref: string) =>
            `/events/${id}/bookings/${ref}/record-payment`,
        CANCEL_BOOKING: (id: string, ref: string) => `/events/${id}/bookings/${ref}/cancel`,

        /*
         * Every event with its seat figures — the Booking Events landing table.
         *
         * A LITERAL PATH under `/events`, and the server declares it above
         * `/:id` for that reason. Written here exactly as the router has it:
         * a mismatch would be read as the event id "bookings" and answer 400.
         */
        BOOKING_OVERVIEW: '/events/bookings/overview',

        /*
         * The contact book — everyone who has booked anything, and one person's
         * whole history. Literal paths above `/:id`, as the router declares them.
         *
         * The person is addressed by a QUERY parameter rather than a path
         * segment: an email address carries dots, and something in front of the
         * app eventually reads a trailing `.com` as a file extension.
         */
        BOOKING_PEOPLE: '/events/bookings/people',
        BOOKING_PERSON: '/events/bookings/person',

        /** One row per PERSON, rather than per booking — the door list. */
        ATTENDEES: (id: string) => `/events/${id}/attendees`,

        /**
         * The CSV download.
         *
         * FETCHED AS A BLOB, never opened as a plain `<a href>`. This route sits
         * behind the same `verifyToken` as the rest of `/events`, and a bare
         * link carries no Authorization header — the browser would navigate away
         * from the admin screen to a 401 JSON body. `exportBookingsCsv` in
         * `eventBookingAdminApi` requests it through the axios instance that
         * holds the token and hands the blob to a download.
         */
        EXPORT_BOOKINGS: (id: string) => `/events/${id}/bookings/export`,

        /*
         * The category chips an event is filed under. The SAME rows the public
         * events grid filters by — see `eventcategory.service.js`.
         *
         * `/events/categories` is a literal above `/:id` server-side, for the
         * third time in this block.
         */
        CATEGORIES: '/events/categories',
        CATEGORY: (categoryId: string) => `/events/categories/${categoryId}`,
        CATEGORY_MOVE: (categoryId: string) => `/events/categories/${categoryId}/move`,
        CATEGORIES_STANDARD: '/events/categories/standard',
    },

    /**
     * Public event bookings — "Book Now", with no account.
     *
     * A SEPARATE MOUNT, not a path under `/events`. That router opens with a
     * blanket `verifyToken`; these are the guest paths and must answer without
     * a token. See `backend/src/modules/events/eventbooking.routes.js`.
     */
    EVENT_BOOKINGS: {
        /** The event as the booking page needs it: price, seats left, deadline. */
        EVENT: (eventId: string) => `/event-bookings/event/${eventId}`,
        /** Take a booking. Sends no amount — the server prices it. */
        CREATE: (eventId: string) => `/event-bookings/event/${eventId}`,
        /** One booking by its reference, which is all a guest has. */
        BY_REF: (ref: string) => `/event-bookings/${ref}`,
        /** The step a real gateway replaces. */
        AUTHORIZE: (ref: string) => `/event-bookings/${ref}/authorize`,
        PAY: (ref: string) => `/event-bookings/${ref}/pay`,
    },

    /** Association Updates (MEM-001) — news targeted at a member's region. */
    ANNOUNCEMENTS: {
        LIST: '/announcements',
        ADMIN_LIST: '/announcements/admin',
        BY_ID: (id: string) => `/announcements/${id}`,
        STATUS: (id: string) => `/announcements/${id}/status`,
    },

    NOTIFICATIONS: {
        LIST: '/notifications',
        MARK_READ: (id: string) => `/notifications/${id}/read`,
        MARK_ALL_READ: '/notifications/read-all',

        /*
         * Super-admin delivery oversight. Every email and WhatsApp message the
         * platform has attempted, whether it left the building, and why it did
         * not. Role-gated on the server.
         */
        LOGS: '/notifications/logs',
        DELIVERY_STATUS: '/notifications/delivery-status',
        RETRY: (id: string) => `/notifications/retry/${id}`,
        ROUTING_PREVIEW: '/notifications/routing-preview',
        TEST_SEND: '/notifications/test-send',
    },

    ANALYTICS: {
        USER_GROWTH: '/analytics/user-growth',
        APPLICATIONS: '/analytics/applications',
        MEMBERS: '/analytics/members',
        /**
         * A member's own operational analytics (BUS-003).
         *
         * The three above are admin-only — the router gates everything after
         * `/me` with `requireRole('district_admin', ...)`. This one is scoped to
         * the caller's own id instead, which is why it needs no role.
         */
        ME: '/analytics/me',
    },

    AUDIT: {
        LIST: '/audit',
        COUNTS: '/audit/counts',
    },

    PAYMENT: {
        /** Which checkout is live — mock, or a hosted gateway. */
        CONFIG: '/payment/config',
        /** Start a hosted (Instamojo) payment. Returns the URL to send them to. */
        CREATE_REQUEST: '/payment/create-request',
        STATUS: (id: string) => `/payment/status/${id}`,
        /** Public: where Instamojo sends the buyer back to. Confirms a paid booking. */
        RETURN: (orderId: string) => `/payment/return/${encodeURIComponent(orderId)}`,
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

/*
 * THERE IS NO PRICE TABLE HERE, AND THERE MUST NOT BE ONE.
 *
 * `MEMBERSHIP_PRICES` stood here — starter 500, intermediate 1000, advanced
 * 2000, lifetime 2500 — and nothing imported it. That is worse than a table in
 * use, not better: a dead one attracts the next person who needs a price and
 * hands them figures that were correct on the day they were typed. The Super
 * Admin has owned membership pricing since it moved to the `membershipPlans`
 * collection, and a copy in a client is a WRONG price the moment they edit one.
 *
 * Prices come from the server, every time:
 *   `GET /membership/plans`       every active plan
 *   `GET /membership/plans/mine`  the plan THIS applicant is offered
 * and an event's price from the event's own availability payload, which
 * resolves the member rate against the reader's live membership.
 */
