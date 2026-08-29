import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Home, LayoutGrid, FileText, PartyPopper, Images, PanelTop,
    Phone, Inbox, LogOut, ChevronsUpDown, Sun, Moon, Menu, X, Shield,
    Search, Bell, ExternalLink, CornerDownLeft,
} from 'lucide-react';
import { getStoredRole, logout } from '@/services/activApi';
import { listContactMessages, getSiteSettings, type SiteSettings } from '@/services/cmsApi';
import { CmsMediaFrame } from '@/components/shared/CmsMediaFrame';
import { STORAGE_KEYS } from '@/config/api.config';

/**
 * The CMS shell.
 *
 * A near-black console rather than the slate panel it was: one ground colour,
 * hairline borders, and colour spent only where it means something — the blue
 * on the current section and the primary action, green on the live indicator,
 * red on the inbox badge. Everything else is white on black at three weights of
 * grey, which is what lets a screen of eight nav items and four figures read at
 * a glance.
 *
 * Navigation is grouped and labelled. A flat list gives no clue which entries
 * change the public site and which are workspace chrome, so the rail is split
 * into WORKSPACE, CONTENT and SUPPORT, each under a small tracked label.
 *
 * Access is checked here rather than on each screen. Every child route edits the
 * live site, so one gate at the layout is both sufficient and harder to forget
 * than a check repeated seven times — and the server enforces the same pair of
 * roles regardless, so this is UX, not security.
 */

type NavItem = {
    to: string;
    label: string;
    icon: typeof Home;
    end?: boolean;
    superOnly?: boolean;
    badge?: 'unread';
    /** Extra words the top-bar search should match on. */
    keywords?: string;
};

/**
 * `Platform Admin` appears only for a super admin.
 *
 * A `cms_admin` cannot reach anything under `/admin` — the server refuses every
 * route there — so showing them the link would offer a door that does not open.
 */
const WORKSPACE_NAV: NavItem[] = [
    { to: '/cms', end: true, label: 'Overview', icon: LayoutGrid, keywords: 'dashboard home start' },
    { to: '/super-admin/dashboard', label: 'Platform Admin', icon: Shield, superOnly: true, keywords: 'admins members approvals' },
];

const CONTENT_NAV: NavItem[] = [
    // First because it is the only entry that changes every page at once.
    { to: '/cms/site', label: 'Header & Footer', icon: PanelTop, keywords: 'logo brand nav menu colours' },
    { to: '/cms/home', label: 'Home Page', icon: Home, keywords: 'carousel hero slides about stats' },
    { to: '/cms/about', label: 'About Us', icon: FileText, keywords: 'story bullets figures' },
    { to: '/cms/events', label: 'Events', icon: PartyPopper, keywords: 'agenda speakers venue audience' },
    { to: '/cms/gallery', label: 'Gallery', icon: Images, keywords: 'photos images album' },
    { to: '/cms/contact', label: 'Contact Details', icon: Phone, keywords: 'address phone email map' },
];

const SUPPORT_NAV: NavItem[] = [
    { to: '/cms/messages', label: 'Inbox', icon: Inbox, badge: 'unread', keywords: 'messages enquiries contact form' },
];

/** The heading shown in the top bar for each route. */
const TITLES: Record<string, string> = {
    '/cms': 'Overview',
    '/cms/site': 'Header & Footer',
    '/cms/home': 'Home Page',
    '/cms/about': 'About Us',
    '/cms/events': 'Events',
    '/cms/gallery': 'Gallery',
    '/cms/contact': 'Contact Details',
    '/cms/messages': 'Inbox',
};

const THEME_KEY = 'cms_theme';

export default function CmsLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [drawer, setDrawer] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [query, setQuery] = useState('');
    const [site, setSite] = useState<SiteSettings | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    /**
     * Theme is per-browser, not per-account.
     *
     * It is a viewing preference rather than a setting worth a round trip, and
     * reading it synchronously means the panel never flashes the wrong colours
     * while a request is in flight.
     */
    const [dark, setDark] = useState(() => {
        try { return localStorage.getItem(THEME_KEY) !== 'light'; } catch { return true; }
    });

    const role = getStoredRole();

    /**
     * Who may edit content.
     *
     * Both, deliberately: `cms_admin` is the role that exists for this, and a
     * `super_admin` locked out of the content they administer is a support
     * ticket. The server enforces the same pair — this is UX, not security.
     */
    const canEdit = role === 'super_admin' || role === 'cms_admin';
    const read = (key: string) => {
        try { return localStorage.getItem(key) || ''; } catch { return ''; }
    };
    const email = read(STORAGE_KEYS.USER_EMAIL);
    const name = read(STORAGE_KEYS.USER_NAME);

    const displayName = name || email.split('@')[0] || 'Admin';
    const initial = displayName.charAt(0).toUpperCase();

    useEffect(() => {
        if (!canEdit) navigate('/login', { replace: true });
    }, [canEdit, navigate]);

    /**
     * The theme, remembered — and applied at the document root.
     *
     * Setting it on `documentElement` rather than on the panel's own wrapper is
     * what makes `dark:` variants resolve everywhere, including content React
     * renders through a portal: toasts, selects and dialogs sit outside this
     * subtree and could never inherit a class placed on it. The class is removed
     * when the CMS unmounts, so leaving the panel leaves the public site alone.
     */
    useEffect(() => {
        try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* private mode */ }

        const root = document.documentElement;
        root.classList.toggle('dark', dark);
        return () => root.classList.remove('dark');
    }, [dark]);

    /*
     * The real mark, not a letter tile.
     *
     * It comes from `/cms/site` — the same document this panel edits and the
     * same one the public header renders — so the logo an editor uploads shows
     * up here too, rather than the panel carrying a hardcoded stand-in that
     * quietly disagrees with the site.
     */
    useEffect(() => {
        let cancelled = false;
        getSiteSettings()
            .then((data) => { if (!cancelled) setSite(data); })
            .catch(() => { /* the initial falls back below */ });
        return () => { cancelled = true; };
    }, []);

    // The inbox count is the one number worth carrying on every screen: a
    // message nobody notices is the same as one never sent.
    useEffect(() => {
        let cancelled = false;
        listContactMessages({ limit: 1 })
            .then((r) => { if (!cancelled) setUnread(r.unread || 0); })
            .catch(() => { /* a badge is not worth an error */ });
        return () => { cancelled = true; };
    }, [location.pathname]);

    // Close the drawer on navigation, or it stays open over the new screen.
    useEffect(() => { setDrawer(false); setQuery(''); }, [location.pathname]);

    /**
     * ⌘K / Ctrl-K focuses the search.
     *
     * The shortcut is advertised on the input itself, so it has to actually
     * work — a printed affordance that does nothing is worse than none.
     */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
            if (e.key === 'Escape') { setQuery(''); searchRef.current?.blur(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const visible = (items: NavItem[]) => items.filter(i => !i.superOnly || role === 'super_admin');

    /** Every destination the search can reach, in one flat list. */
    const allNav = useMemo(
        () => [...visible(WORKSPACE_NAV), ...CONTENT_NAV, ...SUPPORT_NAV],
        [role],
    );

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return allNav.filter(i =>
            i.label.toLowerCase().includes(q) || (i.keywords || '').includes(q)).slice(0, 6);
    }, [query, allNav]);

    if (!canEdit) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    /*
     * One palette object rather than `dark:` variants scattered through the
     * markup — the panel carries its own theme, independent of the public site,
     * and every surface in it is picked here rather than guessed at each use.
     */
    const t = dark
        ? {
            shell: 'bg-[#000000]',
            side: 'bg-[#000000] border-[#161616]',
            head: 'bg-[#000000]/85 border-[#161616]',
            card: 'bg-[#0A0A0A] border-[#1F1F1F]',
            title: 'text-white',
            muted: 'text-[#A1A1AA]',
            faint: 'text-[#52525B]',
            item: 'text-[#A1A1AA] hover:bg-[#121212] hover:text-white',
            active: 'bg-[#2563EB]/12 text-[#93B4FB]',
            divide: 'border-[#161616]',
            field: 'bg-[#0A0A0A] border-[#1F1F1F] text-white placeholder:text-[#52525B]',
            toggleTrack: 'bg-[#0A0A0A] border-[#1F1F1F]',
            toggleOn: 'bg-[#1F1F1F] text-white',
            iconHover: 'hover:text-white hover:border-[#2563EB]/50',
        }
        : {
            shell: 'bg-[#F6F7F9]',
            side: 'bg-white border-slate-200',
            head: 'bg-white/85 border-slate-200',
            card: 'bg-white border-slate-200',
            title: 'text-slate-900',
            muted: 'text-slate-500',
            faint: 'text-slate-400',
            item: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            active: 'bg-[#2563EB]/10 text-[#1D4ED8]',
            divide: 'border-slate-200',
            field: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
            toggleTrack: 'bg-slate-100 border-slate-200',
            toggleOn: 'bg-white text-slate-900 shadow-sm',
            iconHover: 'hover:text-slate-900 hover:border-[#2563EB]/50',
        };

    /*
     * The current section carries a blue bar on its leading edge as well as the
     * tint. On a near-black ground a background alone at this opacity is easy to
     * miss; the bar is what makes "where am I" answerable without reading.
     */
    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `relative flex items-center gap-3.5 pl-4 pr-3 py-3 rounded-lg text-base font-medium
         transition-colors ${isActive
            ? `${t.active} before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2
               before:h-5 before:w-[3px] before:rounded-full before:bg-[#2563EB]`
            : t.item}`;

    const pageTitle = TITLES[location.pathname] || 'Content Management';
    const logo = site?.brand?.logo;

    const NavGroup = ({ label, items }: { label: string; items: NavItem[] }) => (
        <div className="mb-6 last:mb-0">
            <p className={`px-4 pb-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.14em] ${t.faint}`}>
                {label}
            </p>
            <div className="space-y-0.5">
                {items.map(({ to, end, label: text, icon: Icon, badge }) => (
                    <NavLink key={to} to={to} end={end} className={linkClass}>
                        <Icon className="w-[1.25rem] h-[1.25rem] shrink-0" />
                        <span className="truncate flex-1">{text}</span>
                        {badge === 'unread' && unread > 0 && (
                            <span className="text-[0.6875rem] font-bold bg-[#DC2626] text-white
                                             rounded-full min-w-[1.25rem] text-center px-1.5 py-0.5 shrink-0">
                                {unread}
                            </span>
                        )}
                    </NavLink>
                ))}
            </div>
        </div>
    );

    return (
        // `h-screen overflow-hidden`, not `min-h-screen`. The rail and the working
        // area are two independent scroll regions; with a growing page height they
        // scrolled together, which carried the rail's footer off the bottom.
        <div className={`h-screen overflow-hidden flex font-sans ${dark ? 'dark ' : ''}${t.shell}`}>
            {drawer && (
                <div className="fixed inset-0 bg-black/70 z-30 lg:hidden" onClick={() => setDrawer(false)} />
            )}

            {/* ======================================================= sidebar */}
            <aside
                className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-[20rem] shrink-0 border-r
                            h-screen min-h-0 flex flex-col transition-transform duration-200 ${t.side}
                            ${drawer ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* brand — the site's own mark, uploaded in Header & Footer */}
                <div className={`h-[5.5rem] shrink-0 flex items-center gap-3 px-5 border-b ${t.divide}`}>
                    {logo?.url ? (
                        <span className="block h-12 w-auto max-w-[13rem] shrink-0">
                            <CmsMediaFrame media={logo} className="object-contain object-left" />
                        </span>
                    ) : (
                        // Only until the mark loads or if none is uploaded yet.
                        <span className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center
                                         justify-center font-display font-extrabold text-base shrink-0">
                            A
                        </span>
                    )}

                    <button className={`lg:hidden ml-auto ${t.muted}`} onClick={() => setDrawer(false)} aria-label="Close menu">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* `min-h-0` is what makes this a real scroll container: a flex
                    item's min-height defaults to `auto`, so `flex-1` will not
                    shrink it below its content and `overflow-y-auto` never
                    engages. */}
                <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-5">
                    <NavGroup label="Workspace" items={visible(WORKSPACE_NAV)} />
                    <NavGroup label="Content" items={CONTENT_NAV} />
                    <NavGroup label="Support" items={SUPPORT_NAV} />
                </nav>

                {/* Pinned below the scrolling nav, so both stay reachable at any
                    viewport height. */}
                <div className={`shrink-0 border-t ${t.divide} p-3 space-y-3`}>
                    <div className={`rounded-xl border ${t.card}`}>
                        <button
                            type="button"
                            onClick={() => setUserOpen((v) => !v)}
                            className="w-full flex items-center gap-3 p-3 text-left"
                        >
                            <span className="w-9 h-9 rounded-lg bg-[#2563EB] text-white flex items-center
                                             justify-center text-[0.875rem] font-bold shrink-0">
                                {initial}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={`block text-[0.9375rem] font-semibold truncate ${t.title}`}>
                                    {displayName}
                                </span>
                                <span className={`block text-[0.8125rem] truncate ${t.muted}`}>
                                    {email || 'Administrator'}
                                </span>
                            </span>
                            <ChevronsUpDown className={`w-4 h-4 shrink-0 ${t.faint}`} />
                        </button>

                        {userOpen && (
                            <div className={`border-t ${t.divide} p-1.5`}>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg
                                               text-[0.875rem] font-medium text-[#F87171]
                                               hover:bg-[#DC2626]/10 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Log out
                                </button>
                            </div>
                        )}
                    </div>

                    {/* A segmented control, not an icon that flips: which theme is
                        active should be readable without pressing it. */}
                    <div className={`grid grid-cols-2 gap-1 rounded-xl border p-1 ${t.toggleTrack}`}>
                        {([['Light', false, Sun], ['Dark', true, Moon]] as const).map(([label, wants, Icon]) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => setDark(wants)}
                                aria-pressed={dark === wants}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg
                                            text-[0.875rem] font-medium transition-colors
                                            ${dark === wants ? t.toggleOn : t.muted}`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </aside>

            {/* =================================================== main column */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <header className={`h-[5.5rem] shrink-0 border-b flex items-center gap-3 px-5 lg:px-8
                                    backdrop-blur ${t.head}`}>
                    <button className={`lg:hidden ${t.muted}`} onClick={() => setDrawer(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* search — jumps between CMS sections */}
                    <div className="relative w-full max-w-[26rem] hidden sm:block">
                        <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${t.faint}`} />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && matches[0]) navigate(matches[0].to);
                            }}
                            placeholder="Search sections…"
                            aria-label="Search CMS sections"
                            className={`w-full h-12 pl-11 pr-16 rounded-xl border text-[0.9375rem]
                                        outline-none focus:border-[#2563EB] transition-colors ${t.field}`}
                        />
                        <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 text-[0.6875rem]
                                         font-medium px-1.5 py-0.5 rounded border ${t.divide} ${t.faint}`}>
                            ⌘K
                        </kbd>

                        {matches.length > 0 && (
                            <div className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-xl
                                             border overflow-hidden ${t.card} shadow-2xl`}>
                                {matches.map(({ to, label, icon: Icon }, i) => (
                                    <button
                                        key={to}
                                        type="button"
                                        onClick={() => navigate(to)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left
                                                    text-[0.875rem] ${t.item}`}
                                    >
                                        <Icon className="w-4 h-4 shrink-0" />
                                        <span className="flex-1 truncate">{label}</span>
                                        {i === 0 && <CornerDownLeft className={`w-3.5 h-3.5 ${t.faint}`} />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <h1 className={`sm:hidden font-display text-[1.125rem] font-bold tracking-tight ${t.title}`}>
                        {pageTitle}
                    </h1>

                    <div className="ml-auto flex items-center gap-2.5 shrink-0">
                        {/* The public site is live and this panel edits it — worth
                            saying on every screen, because that is the whole risk. */}
                        <span className={`hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full
                                          border text-[0.75rem] font-semibold ${t.card} ${t.muted}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                            Live
                        </span>

                        <NavLink
                            to="/cms/messages"
                            aria-label={`Inbox${unread ? `, ${unread} unread` : ''}`}
                            className={`relative w-9 h-9 rounded-full border flex items-center justify-center
                                        transition-colors ${t.card} ${t.muted} ${t.iconHover}`}
                        >
                            <Bell className="w-4 h-4" />
                            {unread > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[1.125rem] text-[0.625rem]
                                                 font-bold bg-[#DC2626] text-white rounded-full px-1 py-0.5">
                                    {unread}
                                </span>
                            )}
                        </NavLink>

                        <a
                            href="/"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#2563EB]
                                       hover:bg-[#1D4ED8] text-white text-[0.9375rem] font-semibold
                                       transition-colors"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden sm:inline">View site</span>
                        </a>
                    </div>
                </header>

                <main className="flex-1 min-h-0 overflow-y-auto p-5 lg:p-8">
                    <Outlet context={{ dark }} />
                </main>
            </div>
        </div>
    );
}
