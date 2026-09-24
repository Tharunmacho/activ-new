/**
 * Everything that differs between the four admin tiers, in one place.
 *
 * The block, district, state and super admin areas each carried their own copy
 * of Dashboard, Approvals, Members, Settings and AdminSidebar — roughly 3,300
 * lines across twelve files whose only real difference was a route prefix and a
 * label. The copies drifted, and the drift produced bugs rather than cosmetic
 * differences:
 *
 *   - block read `stats.totalApplications` where district and state read
 *     `stats.totalMembers`, so one tier's "Total Members" tile counted
 *     something else entirely;
 *   - only block guarded the stats response, so district and state threw on an
 *     error envelope;
 *   - district alone failed to write `userName`/`userEmail` back to
 *     localStorage, leaving its sidebar stale after an edit;
 *   - district and state kept a fabricated `index % 4 === 3` member status for
 *     two rounds of fixes after block had been corrected.
 *
 * Anything tier-specific belongs here, so a change lands in every tier at once.
 */

export type AdminTier = 'block' | 'district' | 'state' | 'super' | 'events';

/** One entry in a tier's navigation rail. */
export interface NavItem {
    /** Route path. */
    to: string;
    label: string;
    /** Which react-icons/fa glyph the sidebar renders. */
    icon: 'home' | 'check' | 'users' | 'shield' | 'calendar' | 'megaphone' | 'bell' | 'cog'
    | 'ticket' | 'tags' | 'list';
    /**
     * A SECTION rather than a single destination.
     *
     * The entry becomes a disclosure: pressing it opens the children beneath it
     * and navigates to the first of them. Used for Events, which is three
     * screens that belong together — the programme, the categories it is filed
     * under, and the bookings taken against it — and was previously two
     * unrelated top-level entries with the third missing entirely.
     *
     * The parent's own `to` is the section's landing page and must equal the
     * first child's `to`. They are the same screen; a parent pointing somewhere
     * else would light two rail entries for one page, or none.
     */
    children?: NavItem[];
}

export interface TierConfig {
    /** Route prefix, e.g. `/block-admin`. */
    base: string;
    /** How the tier is named in prose. */
    label: string;
    /** The role string stored at login. */
    role: string;
    /** Heading shown on the tier's dashboard. */
    dashboardTitle: string;
    /** The region field this tier owns on an applicant/admin record. */
    regionKey: 'block' | 'district' | 'state' | null;
    /** `ApprovalQueue`'s level prop — drives its copy and empty states. */
    queueLevel: 'block' | 'district' | 'state' | 'super';
    /**
     * Which region levels the Approvals screen offers as filters, outermost
     * first — the levels BENEATH this tier's own patch.
     *
     * A block admin gets none: every applicant they can see is in their one
     * block, and a filter with a single option is a control that cannot change
     * the answer. A district admin filters by block, a state admin by district
     * and then block, and the super admin by all three.
     *
     * Declared here rather than derived from `regionKey` because the two say
     * different things — `regionKey` is the level this tier OWNS, and these are
     * the levels it looks DOWN at.
     */
    approvalFilters: ('state' | 'district' | 'block')[];
    /** Initials shown in the sidebar avatar fallback. */
    initials: string;
    /**
     * The tier's navigation rail.
     *
     * Declared per tier rather than assembled from `base`. The shared sidebar
     * originally hardcoded Dashboard / Approvals / Members / Settings for
     * everyone, which is right for the three geofenced tiers and wrong for the
     * super admin: it replaced Hub, Admins and Events with two links to pages
     * the super admin reaches from the Hub, and dropped Manage Admins and Events
     * out of the navigation entirely.
     *
     * Mobile is the reference — `SuperAdminBottomTabs` is Hub / Admins / Events
     * / Settings, and the three tier navigators are Dashboard / Approvals /
     * Members / Settings.
     */
    nav: NavItem[];
}

/**
 * Derived from the tier's own `base` rather than written out beside it, so the
 * rail cannot point at a prefix the tier no longer uses.
 */
const withTierNav = (config: Omit<TierConfig, 'nav'>, showHub = false): TierConfig => ({
    ...config,
    nav: TIER_NAV(config.base, showHub),
});

/**
 * The rail for the three geofenced tiers.
 *
 * `showHub` adds the Hub entry for the two tiers that oversee regions beneath
 * them — a state admin monitors the districts and blocks of their state, a
 * district admin the blocks of their district. A BLOCK admin has nothing beneath
 * them, so the entry is absent rather than present-and-empty: a drill-down with
 * nothing to drill into is a link that reads as broken.
 *
 * ------------------------------------------------- NO "ADMINS" ON A TIER RAIL
 *
 * There was an Admins entry beside the Hub, giving a state admin the district
 * and block accounts of their state and a district admin the block accounts of
 * their district. The association asked for it to come off both: creating,
 * editing and deleting admin accounts is the Super Admin's, and one screen
 * owning that is what keeps "who may appoint whom" a single answer rather than
 * three tiers' worth of delegation rules.
 *
 * The page, the routes and the `/admin/team/admins` endpoints behind it went
 * with the entry. A rail item is not a permission boundary, so leaving the API
 * reachable would have moved the capability out of sight rather than removed
 * it.
 *
 * The Hub still reports staffing — how many admins a region has, and which have
 * none. That is the Super Admin's cue to appoint somebody, and a tier admin
 * knowing their block is unstaffed is worth having; it is a count, not a
 * control.
 */
const TIER_NAV = (base: string, showHub = false): NavItem[] => [
    { to: base + '/dashboard', label: 'Dashboard', icon: 'home' },
    { to: base + '/approvals', label: 'Approvals', icon: 'check' },
    { to: base + '/members', label: 'Members', icon: 'users' },
    ...(showHub ? [
        { to: base + '/hub', label: 'Hub', icon: 'shield' as const },
    ] : []),
    { to: base + '/settings', label: 'Settings', icon: 'cog' },
];

export const TIERS: Record<AdminTier, TierConfig> = {
    block: withTierNav({
        base: '/block-admin',
        label: 'Block',
        role: 'block_admin',
        dashboardTitle: 'Block Admin Dashboard',
        regionKey: 'block',
        queueLevel: 'block',
        // A block admin sees one block. A filter with one option cannot
        // change the answer, so none is offered.
        approvalFilters: [],
        initials: 'BA',
    }),
    district: withTierNav({
        base: '/district-admin',
        label: 'District',
        role: 'district_admin',
        dashboardTitle: 'District Admin Dashboard',
        regionKey: 'district',
        queueLevel: 'district',
        approvalFilters: ['block'],
        initials: 'DA',
    }, true),
    state: withTierNav({
        base: '/state-admin',
        label: 'State',
        role: 'state_admin',
        dashboardTitle: 'State Admin Dashboard',
        regionKey: 'state',
        queueLevel: 'state',
        approvalFilters: ['district', 'block'],
        initials: 'SA',
    }, true),
    super: {
        base: '/super-admin',
        label: 'Super',
        role: 'super_admin',
        dashboardTitle: 'Super Admin Dashboard',
        regionKey: null,
        queueLevel: 'super',
        approvalFilters: ['state', 'district', 'block'],
        initials: 'SU',
        // Not TIER_NAV: the super admin is not geofenced and has no queue of its
        // own to work. Hub is the landing page, and Admins and Events are
        // sections only this role has. Matches SuperAdminBottomTabs on mobile.
        nav: [
            { to: '/super-admin/dashboard', label: 'Hub', icon: 'home' },
            { to: '/super-admin/admins', label: 'Admins', icon: 'shield' },
            /*
             * EVENTS IS A SECTION, not a link.
             *
             * Three screens do one job and were not presented as doing it:
             * the programme itself, the categories events are filed under
             * (which had no screen at all — the chip list was reachable only
             * through the CMS, on a page about the public site's furniture),
             * and the bookings taken against them, which sat at the top level
             * beside Membership as though it were unrelated to Events.
             *
             * The parent points at the same route as its first child, which is
             * what makes pressing the section header do something rather than
             * only toggle a disclosure.
             */
            {
                to: '/super-admin/events',
                label: 'Events',
                icon: 'calendar',
                children: [
                    { to: '/super-admin/events', label: 'All events', icon: 'list' },
                    // The chips an event is filed under, and the same rows the
                    // public events grid filters by — see `eventcategory.service`.
                    { to: '/super-admin/events/categories', label: 'Categories', icon: 'tags' },
                    // The takings and the door list. Often a different person
                    // from the one who writes the programme, and opened far
                    // more often — so it is a peer of the editor, not a tab
                    // buried inside it.
                    { to: '/super-admin/bookings', label: 'Bookings', icon: 'ticket' },
                ],
            },
            // What a membership costs, and which commencement-year band earns
            // which plan. Only this role sets prices.
            { to: '/super-admin/membership', label: 'Membership', icon: 'shield' },
            // Association Updates. Only this role authors them, and they are
            // not events — an update has no date, no venue and no attendees.
            { to: '/super-admin/updates', label: 'Updates', icon: 'megaphone' },
            // Whether the platform is actually reaching anybody. Only this role
            // sees it: the log holds every address and phone number the system
            // has ever messaged, which is not a geofenced tier admin's business.
            { to: '/super-admin/notifications', label: 'Notifications', icon: 'bell' },
            { to: '/super-admin/settings', label: 'Settings', icon: 'cog' },
        ],
    },
    /*
     * THE EVENTS ADMIN — one portal, the programme.
     *
     * A separate account for whoever runs the association's events. Its screens
     * ARE the super admin's (the same components, mounted under `/events-admin`
     * — see `adminBasePath`), so there is one events editor, one categories
     * screen and one bookings screen, and nothing about an event can differ by
     * which portal saved it. The server opens the event endpoints to this role
     * and refuses it everywhere else.
     */
    events: {
        base: '/events-admin',
        label: 'Events',
        role: 'events_admin',
        dashboardTitle: 'Events Dashboard',
        regionKey: null,
        queueLevel: 'super',
        approvalFilters: [],
        initials: 'EV',
        nav: [
            { to: '/events-admin/dashboard', label: 'Dashboard', icon: 'home' },
            {
                to: '/events-admin/events',
                label: 'Events',
                icon: 'calendar',
                children: [
                    { to: '/events-admin/events', label: 'All events', icon: 'list' },
                    { to: '/events-admin/events/categories', label: 'Categories', icon: 'tags' },
                    { to: '/events-admin/bookings', label: 'Bookings', icon: 'ticket' },
                ],
            },
            // Profile and password — the account is issued with a temporary one.
            { to: '/events-admin/settings', label: 'Settings', icon: 'cog' },
        ],
    },
};

/**
 * Where the event screens live for whoever is signed in: `/events-admin` for
 * the events admin, `/super-admin` for everyone else. The events, categories
 * and bookings pages are shared by both portals and build every link through
 * this, so a click never drops an events admin into a super-admin URL.
 */
export const adminBasePath = (): string => {
    let role = '';
    try { role = localStorage.getItem('role') || ''; } catch { /* storage blocked */ }
    return role === 'events_admin' ? '/events-admin' : '/super-admin';
};

/**
 * The tier a config belongs to, from the role stored at login.
 *
 * Used where a component has no `tier` prop to hand — the sidebar reads the
 * signed-in role rather than being told, so it cannot disagree with the session.
 */
export const tierForRole = (role?: string | null): AdminTier => {
    switch (String(role || '')) {
        case 'events_admin': return 'events';
        case 'district_admin': return 'district';
        case 'state_admin': return 'state';
        case 'super_admin': return 'super';
        default: return 'block';
    }
};
