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

export type AdminTier = 'block' | 'district' | 'state' | 'super';

/** One entry in a tier's navigation rail. */
export interface NavItem {
    /** Route path. */
    to: string;
    label: string;
    /** Which react-icons/fa glyph the sidebar renders. */
    icon: 'home' | 'check' | 'users' | 'shield' | 'calendar' | 'megaphone' | 'cog';
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
const withTierNav = (config: Omit<TierConfig, 'nav'>): TierConfig => ({
    ...config,
    nav: TIER_NAV(config.base),
});

const TIER_NAV = (base: string): NavItem[] => [
    { to: base + '/dashboard', label: 'Dashboard', icon: 'home' },
    { to: base + '/approvals', label: 'Approvals', icon: 'check' },
    { to: base + '/members', label: 'Members', icon: 'users' },
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
        initials: 'BA',
    }),
    district: withTierNav({
        base: '/district-admin',
        label: 'District',
        role: 'district_admin',
        dashboardTitle: 'District Admin Dashboard',
        regionKey: 'district',
        queueLevel: 'district',
        initials: 'DA',
    }),
    state: withTierNav({
        base: '/state-admin',
        label: 'State',
        role: 'state_admin',
        dashboardTitle: 'State Admin Dashboard',
        regionKey: 'state',
        queueLevel: 'state',
        initials: 'SA',
    }),
    super: {
        base: '/super-admin',
        label: 'Super',
        role: 'super_admin',
        dashboardTitle: 'Super Admin Dashboard',
        regionKey: null,
        queueLevel: 'super',
        initials: 'SU',
        // Not TIER_NAV: the super admin is not geofenced and has no queue of its
        // own to work. Hub is the landing page, and Admins and Events are
        // sections only this role has. Matches SuperAdminBottomTabs on mobile.
        nav: [
            { to: '/super-admin/dashboard', label: 'Hub', icon: 'home' },
            { to: '/super-admin/admins', label: 'Admins', icon: 'shield' },
            { to: '/super-admin/events', label: 'Events', icon: 'calendar' },
            // Association Updates. Only this role authors them, and they are
            // not events — an update has no date, no venue and no attendees.
            { to: '/super-admin/updates', label: 'Updates', icon: 'megaphone' },
            { to: '/super-admin/settings', label: 'Settings', icon: 'cog' },
        ],
    },
};

/**
 * The tier a config belongs to, from the role stored at login.
 *
 * Used where a component has no `tier` prop to hand — the sidebar reads the
 * signed-in role rather than being told, so it cannot disagree with the session.
 */
export const tierForRole = (role?: string | null): AdminTier => {
    switch (String(role || '')) {
        case 'district_admin': return 'district';
        case 'state_admin': return 'state';
        case 'super_admin': return 'super';
        default: return 'block';
    }
};
