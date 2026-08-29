import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Home, LayoutGrid, FileText, PartyPopper, Images, PanelTop,
    Phone, Inbox, LogOut, ChevronDown, Sun, Moon, Menu, X, Shield,
} from 'lucide-react';
import { getStoredRole, logout } from '@/services/activApi';
import { listContactMessages } from '@/services/cmsApi';
import { STORAGE_KEYS } from '@/config/api.config';

/**
 * The CMS shell.
 *
 * Two groups — MAIN for navigation, CONTENT for the things that get edited —
 * because a flat list of eight items gives no clue which of them change the
 * public site. CONTENT collapses; MAIN does not, since two items are never
 * worth hiding.
 *
 * Access is checked here rather than on each screen. Every child route edits
 * the live site, so one gate at the layout is both sufficient and harder to
 * forget than a check repeated seven times — and the server enforces
 * `requireRole('super_admin')` regardless, so this is UX, not security.
 */

/**
 * `Platform Admin` appears only for a super admin.
 *
 * A `cms_admin` cannot reach anything under `/admin` — the server refuses every
 * route there — so showing them the link would offer a door that does not open.
 */
const MAIN_NAV = [
    { to: '/cms', end: true, label: 'Dashboard', icon: LayoutGrid },
    { to: '/super-admin/dashboard', label: 'Platform Admin', icon: Shield, superOnly: true },
];

const CONTENT_NAV = [
    // First because it is the only entry that changes every page at once.
    { to: '/cms/site', label: 'Header & Footer', icon: PanelTop },
    { to: '/cms/home', label: 'Home Page', icon: Home },
    { to: '/cms/about', label: 'About Us', icon: FileText },
    { to: '/cms/events', label: 'Events Manager', icon: PartyPopper },
    { to: '/cms/gallery', label: 'Gallery Manager', icon: Images },
    { to: '/cms/contact', label: 'Contact Details', icon: Phone },
    { to: '/cms/messages', label: 'Inbox', icon: Inbox, badge: 'unread' },
];

/** The heading shown in the top bar for each route. */
const TITLES: Record<string, string> = {
    '/cms': 'Dashboard',
    '/cms/site': 'Header & Footer',
    '/cms/home': 'Home Page',
    '/cms/about': 'About Us',
    '/cms/events': 'Events Manager',
    '/cms/gallery': 'Gallery Manager',
    '/cms/contact': 'Contact Details',
    '/cms/messages': 'Inbox',
};

const THEME_KEY = 'cms_theme';

export default function CmsLayout() {
    const navigate = useNavigate();
    const location = useLocation();

    const [drawer, setDrawer] = useState(false);
    const [contentOpen, setContentOpen] = useState(true);
    const [userOpen, setUserOpen] = useState(false);
    const [unread, setUnread] = useState(0);

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
     * The `dark` class was put only on the panel's own wrapper div, to keep the
     * theme from reaching the public site. It kept the CHROME dark, because the
     * rail and header are painted from the `t` palette above — explicit class
     * names that do not depend on the variant resolving. Everything inside a
     * card is written as `bg-white dark:bg-[#0a0a0a]`, and those `dark:`
     * variants were not matching, so every card stayed white on a black shell.
     *
     * Setting it on `documentElement` makes the variant resolve everywhere,
     * including content React renders through a portal — toasts, selects and
     * dialogs sit outside the panel's div and could never have inherited it.
     * The class is removed when the CMS unmounts, so the original intent holds:
     * leave the panel and the public site is untouched.
     */
    useEffect(() => {
        try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* private mode */ }

        const root = document.documentElement;
        root.classList.toggle('dark', dark);
        return () => root.classList.remove('dark');
    }, [dark]);

    // The inbox count is the one number worth carrying on every screen: a
    // message nobody notices is the same as one never sent.
    useEffect(() => {
        let cancelled = false;
        listContactMessages({ limit: 1 })
            .then((r) => { if (!cancelled) setUnread(r.unread || 0); })
            .catch(() => { /* a badge is not worth an error */ });
        return () => { cancelled = true; };
    }, [location.pathname]);

    if (!canEdit) return null;

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    // One palette object rather than `dark:` variants scattered through the
    // markup — the panel carries its own theme, independent of the public site.
    const t = dark
        ? {
            shell: 'bg-slate-950',
            side: 'bg-slate-900 border-slate-800',
            head: 'bg-slate-900 border-slate-800',
            title: 'text-slate-50',
            muted: 'text-slate-400',
            faint: 'text-slate-500',
            item: 'text-slate-400 hover:bg-slate-800 hover:text-slate-50',
            divide: 'border-slate-800',
            userCard: 'hover:bg-slate-800',
        }
        : {
            shell: 'bg-slate-100',
            side: 'bg-white border-slate-200',
            head: 'bg-white border-slate-200',
            title: 'text-slate-900',
            muted: 'text-neutral-500',
            faint: 'text-neutral-400',
            item: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            divide: 'border-slate-200',
            userCard: 'hover:bg-slate-100',
        };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[0.9375rem] transition-colors ${
            isActive ? 'bg-blue-600 text-white font-medium' : t.item
        }`;

    const pageTitle = TITLES[location.pathname] || 'Content Management';

    return (
        // The `dark` class is scoped to this subtree, so the panel's theme never
        // reaches the public site rendered by the other routes.
        // `h-screen overflow-hidden`, not `min-h-screen`. The rail and the
        // working area are two independent scroll regions; with a growing page
        // height they instead scrolled together, which is what carried the
        // sidebar's Logout button off the bottom of the screen.
        <div className={`h-screen overflow-hidden flex ${dark ? 'dark ' : ''}${t.shell}`}>
            {drawer && (
                <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setDrawer(false)} />
            )}

            {/* ------------------------------------------------------- sidebar */}
            {/*
                `lg:static` dropped `inset-y-0`, so above `lg` the rail had no
                height at all — it grew to fit its own content, and once the
                CONTENT list was expanded that pushed Logout below the fold with
                no way to scroll to it. `h-screen` pins it to the viewport, and
                `min-h-0` lets the nav inside actually shrink.
            */}
            <aside
                className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-[18.125rem] shrink-0 border-r
                            h-screen min-h-0 flex flex-col
                            transition-transform duration-200 ${t.side}
                            ${drawer ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                <div className={`h-[4.5rem] shrink-0 flex items-center justify-between px-6 border-b ${t.divide}`}>
                    <span className={`text-[1.3125rem] font-bold tracking-tight ${t.title}`}>Admin Panel</span>
                    <button className={`lg:hidden ${t.muted}`} onClick={() => setDrawer(false)} aria-label="Close menu">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Signed-in user */}
                <div className={`px-4 py-4 shrink-0 border-b ${t.divide}`}>
                    <button
                        type="button"
                        onClick={() => setUserOpen((v) => !v)}
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${t.userCard}`}
                    >
                        <span className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center
                                         justify-center text-lg font-semibold shrink-0">
                            {initial}
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                            <span className={`block text-[0.9375rem] font-semibold truncate ${t.title}`}>{displayName}</span>
                            <span className={`block text-[0.8125rem] truncate ${t.muted}`}>Administrator</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${t.muted} ${userOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {userOpen && (
                        <p className={`mt-2 px-2 text-[0.8125rem] break-all ${t.faint}`}>
                            {email || 'No email on record'}
                        </p>
                    )}
                </div>

                {/* `min-h-0` is what makes this a real scroll container: a flex
                    item's min-height defaults to `auto`, so `flex-1` will not
                    shrink it below its content and `overflow-y-auto` never
                    engages. */}
                <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
                    <p className={`px-4 pb-2 text-[0.6875rem] font-semibold tracking-[0.12em] ${t.faint}`}>MAIN</p>
                    {MAIN_NAV.filter(i => !i.superOnly || role === 'super_admin')
                        .map(({ to, end, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end={end} onClick={() => setDrawer(false)} className={linkClass}>
                            <Icon className="w-[1.125rem] h-[1.125rem] shrink-0" />
                            <span className="truncate">{label}</span>
                        </NavLink>
                    ))}

                    <button
                        type="button"
                        onClick={() => setContentOpen((v) => !v)}
                        className={`w-full flex items-center justify-between px-4 pt-6 pb-2 text-[0.6875rem]
                                    font-semibold tracking-[0.12em] ${t.faint}`}
                    >
                        CONTENT
                        <ChevronDown className={`w-4 h-4 transition-transform ${contentOpen ? '' : '-rotate-90'}`} />
                    </button>

                    {contentOpen && CONTENT_NAV.map(({ to, label, icon: Icon, badge }) => (
                        <NavLink key={to} to={to} onClick={() => setDrawer(false)} className={linkClass}>
                            <Icon className="w-[1.125rem] h-[1.125rem] shrink-0" />
                            <span className="truncate flex-1">{label}</span>
                            {badge === 'unread' && unread > 0 && (
                                <span className="text-[0.6875rem] bg-red-500 text-white rounded-full px-2 py-0.5 shrink-0">
                                    {unread}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Pinned to the bottom of the rail, outside the scrolling nav,
                    so it is reachable at any viewport height. */}
                <div className={`px-3 py-4 shrink-0 border-t ${t.divide}`}>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[0.9375rem]
                                   text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-[1.125rem] h-[1.125rem]" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* --------------------------------------------------- main column */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <header className={`h-[4.5rem] shrink-0 border-b flex items-center gap-3 px-5 lg:px-8 ${t.head}`}>
                    <button className={`lg:hidden ${t.muted}`} onClick={() => setDrawer(true)} aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>

                    <h1 className={`text-[1.3125rem] font-bold tracking-tight ${t.title}`}>{pageTitle}</h1>

                    <button
                        type="button"
                        onClick={() => setDark((v) => !v)}
                        className={`ml-auto p-2 rounded-lg transition-colors ${t.muted}`}
                        aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                        title={dark ? 'Light theme' : 'Dark theme'}
                    >
                        {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </header>

                {/* The faint radial wash keeps a mostly-empty page from reading as
                    a dead screen, without competing with the content on it. */}
                <main
                    className="flex-1 min-h-0 overflow-y-auto p-5 lg:p-8"
                    style={dark ? {
                        // A neutral lift, not a blue one: the wash was
                        // rgba(37,99,235,...) — the same blue as the active nav
                        // item — which tinted the whole working area navy.
                        backgroundImage: 'radial-gradient(900px 500px at 50% 35%, rgba(255,255,255,0.035), transparent 70%)',
                    } : undefined}
                >
                    <Outlet context={{ dark }} />
                </main>
            </div>
        </div>
    );
}
