import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaCheckCircle, FaUsers, FaCog, FaSignOutAlt, FaTimes, FaUserShield, FaCalendarAlt, FaBullhorn, FaBell, FaTicketAlt, FaTags, FaListUl, FaChevronDown } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiFetch, logout } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';
import { TIERS, tierForRole, type AdminTier } from './tierConfig';

type Props = {
    className?: string;
    onClose?: () => void;
    isOpen?: boolean;
    refreshTrigger?: number;
    /** Optional override; by default the tier comes from the signed-in role. */
    tier?: AdminTier;
};

/**
 * The one admin navigation rail, for every tier.
 *
 * There were four copies of this file (~205 lines each) differing only in the
 * route prefix and the avatar initials.
 *
 * Two defects are fixed here rather than four times over:
 *
 * **The nav could not scroll.** The rail is `h-screen ... overflow-hidden` and
 * the `<nav>` inside it was `flex-1 overflow-y-auto`. A flex item's `min-height`
 * defaults to `auto`, so `flex-1` will not shrink it below its content height:
 * the nav grew to fit every item, overflowed the rail, and the rail's
 * `overflow-hidden` clipped it. `overflow-y-auto` never engaged and the bottom
 * items were unreachable rather than scrollable. `min-h-0` on the nav and on
 * the flex column that holds it is what makes the scroll container real.
 *
 * **`SidebarContent` was declared inside the render body.** A component defined
 * during render is a new type on every render, so React unmounted and remounted
 * the entire subtree each time the parent updated — the avatar re-requested
 * itself and any focus inside was lost. One `<aside>` rendered once removes it.
 */
export default function AdminSidebar({
    onClose,
    isOpen = false,
    refreshTrigger = 0,
    tier,
}: Props) {
    const location = useLocation();
    const navigate = useNavigate();
    const [adminInfo, setAdminInfo] = useState<any>(null);
    /**
     * Which sections the admin has opened or closed by hand.
     *
     * Keyed by label and holding ONLY the entries they have touched. A section
     * they have not touched falls back to "open if you are inside it", which is
     * what makes the rail arrive already showing where you are. Seeding this
     * from the route at mount instead would freeze that answer, so navigating
     * from Hub into Categories would leave the section shut on the very screen
     * it contains.
     */
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

    const role = (typeof window !== 'undefined' ? localStorage.getItem('role') : '') || '';
    const config = TIERS[tier || tierForRole(role)];

    const userName = useMemo(
        () => adminInfo?.fullName
            || (typeof window !== 'undefined' ? localStorage.getItem('userName') : '')
            || 'Admin',
        [adminInfo],
    );

    // Re-anchored to the API origin: an avatar stored as a relative
    // `/uploads/...` path resolves against this site, which serves no uploads.
    const avatarUrl = useMemo(() => resolveMediaUrl(adminInfo?.avatarUrl), [adminInfo]);

    const roleLabel = `${config.label} Admin`;
    const initials = config.initials;

    /**
     * The tier declares its own items; this only maps the glyph name to a node.
     *
     * These four used to be hardcoded here for every tier. That is correct for
     * block, district and state, and wrong for the super admin, whose rail is
     * Hub / Admins / Events / Settings — consolidating the four sidebars
     * silently replaced it with the tier list, so Manage Admins and Events
     * disappeared from the navigation.
     */
    const ICONS = {
        home: <FaHome />,
        check: <FaCheckCircle />,
        users: <FaUsers />,
        shield: <FaUserShield />,
        calendar: <FaCalendarAlt />,
        megaphone: <FaBullhorn />,
        bell: <FaBell />,
        ticket: <FaTicketAlt />,
        tags: <FaTags />,
        list: <FaListUl />,
        cog: <FaCog />,
    } as const;

    const nav = config.nav;

    /**
     * Whether a rail entry is the page you are on.
     *
     * The tier's LANDING route matches exactly; everything else also matches its
     * sub-paths so a detail page keeps its section lit. `/super-admin/events` is
     * the exception that forced this to be a function rather than an inline
     * expression: it is both a section landing page AND the prefix of
     * `/super-admin/events/categories`, so a prefix match lights both entries at
     * once and an exact match leaves Categories dark on the screen it names.
     *
     * `exact` is passed for an entry that has a sibling living beneath its path.
     */
    const isActive = (to: string, exact = false) =>
        location.pathname === to
        || (!exact && to !== config.nav[0].to && location.pathname.startsWith(to + '/'));

    /**
     * A section is lit when ANY of its children is, including while collapsed.
     *
     * Without this, opening Bookings — a child of Events living at its own
     * top-level path — left nothing in the rail highlighted at all, and the
     * screen read as having been reached from outside the navigation.
     */
    const sectionActive = (item: { to: string; children?: { to: string }[] }) =>
        !!item.children?.some((child) => isActive(child.to, child.to === item.to));

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const response = await apiFetch('/admin/profile');
                if (!response.ok || cancelled) return;
                const data = await response.json();
                if (cancelled) return;
                setAdminInfo(data.data);
                if (data.data) {
                    // Every tier writes these back; district used to skip it, so
                    // its header stayed stale after a profile edit.
                    try {
                        localStorage.setItem('userName', data.data.fullName || '');
                        localStorage.setItem('userEmail', data.data.email || '');
                    } catch { /* storage unavailable */ }
                }
            } catch (error) {
                console.error('Sidebar: could not fetch admin info:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [refreshTrigger]);

    /**
     * The page behind the open drawer does not scroll.
     *
     * Without this the drawer sits still while a finger drag scrolls the
     * dashboard underneath it, which reads as the menu having come loose from
     * the page. The previous value is restored rather than assumed to be `''`,
     * so a screen that locks scrolling for its own reasons is not unlocked by
     * closing this.
     */
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    /**
     * `logout()`, not a hand-written list of keys.
     *
     * This removed seven localStorage entries but never `token` — the key
     * `apiFetch` authenticates with — so "Log out" navigated to /login while
     * leaving a live session token in the browser.
     */
    const handleLogout = async () => {
        try {
            await logout();
        } catch (err) {
            console.warn('Logout safely caught:', err);
        }
        navigate('/admin/login');
        onClose?.();
    };

    // Rendered once, as plain JSX — see the note above about remounting.
    const content = (
        <div className="relative z-10 h-full min-h-0 flex flex-col">
            {/* Brand */}
            <div className="p-4 md:p-6 border-b border-white/20 shrink-0">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="lg:hidden text-white hover:bg-white/20"
                    >
                        <FaTimes className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center justify-center flex-1">
                        <img
                            src="/logo_ACTIVian-removebg-preview.png"
                            alt="ACTIVian Logo"
                            className="h-10 md:h-12 lg:h-14 w-auto object-contain brightness-0 invert"
                        />
                    </div>
                </div>
            </div>

            {/* Signed-in admin */}
            <div
                className="p-4 md:p-6 border-b border-white/20 cursor-pointer hover:bg-white/10 transition-colors shrink-0"
                onClick={() => { navigate(`${config.base}/settings`); onClose?.(); }}
                title="Click to edit profile"
            >
                <div className="flex items-center gap-3">
                    <Avatar className="w-14 h-14 ring-2 ring-white/30 shadow-lg flex-shrink-0">
                        {!!avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                        <AvatarFallback className="bg-white/20 backdrop-blur-sm text-white text-[1.25rem] font-extrabold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        {/* 17px / 14px, in step with the page headings the rail
                            sits beside. At 14px / 12px the signed-in name read as
                            a caption rather than as who you are. */}
                        <div className="text-[1.25rem] font-extrabold tracking-tight text-white truncate">
                            {userName}
                        </div>
                        <div className="text-[1.1875rem] text-blue-100 font-semibold truncate mt-0.5">{roleLabel}</div>
                    </div>
                </div>
            </div>

            {/* Navigation — the real scroll container. `min-h-0` is what lets it
                shrink below its content and actually scroll. */}
            {/*
              * Same scroll behaviour as the member rail: the header and the
              * sign-out block stay put while the entries move, and scrolling to
              * the end of the list does not start scrolling the page behind it.
              * `member-rail-scroll` is the slim scrollbar - the native one is
              * full-width and reads as a second border inside a 288px column.
              */}
            <nav className="p-3 md:p-4 flex-1 min-h-0 overflow-y-auto overscroll-contain member-rail-scroll">
                <div className="space-y-2">
                    {nav.map((item) => {
                        /* ------------------------------------------ a SECTION */
                        if (item.children?.length) {
                            const lit = sectionActive(item);
                            const open = openSections[item.label] ?? lit;

                            return (
                                <div key={item.label}>
                                    <button
                                        type="button"
                                        /*
                                         * Navigating AND opening, on one press.
                                         *
                                         * A header that only toggles a drawer is
                                         * a control that appears to do nothing
                                         * when its section is already open, which
                                         * is the commonest press. So: from
                                         * outside the section it opens the drawer
                                         * and goes to the landing page; from
                                         * inside it, where the drawer is already
                                         * open and you are already on one of
                                         * these screens, it collapses.
                                         */
                                        onClick={() => {
                                            if (!lit) {
                                                setOpenSections((previous) => ({ ...previous, [item.label]: true }));
                                                navigate(item.to);
                                                onClose?.();
                                            } else {
                                                setOpenSections((previous) => ({ ...previous, [item.label]: !open }));
                                            }
                                        }}
                                        aria-expanded={open}
                                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl
                                                    transition-all duration-200 ${lit && !open
                                                ? 'bg-white/25 text-white backdrop-blur-sm'
                                                : 'text-white hover:bg-white/20 backdrop-blur-sm'}`}
                                    >
                                        <span className="w-[1.375rem] h-[1.375rem] text-[1.25rem] text-white
                                                         flex items-center justify-center">
                                            {ICONS[item.icon]}
                                        </span>
                                        <span className="font-bold text-[1.25rem] flex-1 text-left">{item.label}</span>
                                        <FaChevronDown
                                            className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200
                                                        ${open ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {open && (
                                        /*
                                         * Indented, and hung off a hairline rule.
                                         *
                                         * Indentation alone is ambiguous at this
                                         * width — the children read as ordinary
                                         * entries that happen to start further
                                         * in. The rule is what says they belong
                                         * to the thing above them.
                                         */
                                        <div className="mt-1 ml-5 pl-3 border-l border-white/25 space-y-1">
                                            {item.children.map((child) => {
                                                const active = isActive(child.to, child.to === item.to);
                                                return (
                                                    <Link
                                                        key={child.to + child.label}
                                                        to={child.to}
                                                        onClick={() => onClose?.()}
                                                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl
                                                                    transition-all duration-200 ${active
                                                                ? 'bg-white text-blue-600 shadow-md font-semibold'
                                                                : 'text-blue-50 hover:bg-white/15 font-medium'}`}
                                                    >
                                                        <span className={`w-5 h-5 text-[1.25rem] flex items-center justify-center
                                                                          ${active ? 'text-blue-600' : 'text-blue-100'}`}>
                                                            {ICONS[child.icon]}
                                                        </span>
                                                        {/* One step under its parent, not two. A child at
                                                            13px beside a 16px parent read as a footnote. */}
                                                        <span className="text-[1.1875rem]">{child.label}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        /* --------------------------------------------- a LINK */
                        const active = isActive(item.to);
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => onClose?.()}
                                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl
                                            transition-all duration-200 ${active
                                    ? 'bg-white text-blue-600 shadow-lg'
                                    : 'text-white hover:bg-white/20 backdrop-blur-sm'
                                    }`}
                            >
                                <span className={`w-[1.375rem] h-[1.375rem] text-[1.25rem] flex items-center
                                                  justify-center ${active ? 'text-blue-600' : 'text-white'}`}>
                                    {ICONS[item.icon]}
                                </span>
                                <span className="font-bold text-[1.25rem]">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <div className="p-3 md:p-4 border-t border-white/20 shrink-0">
                <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full h-auto flex items-center gap-3.5 text-white hover:bg-red-500/80
                               hover:text-white py-3.5 px-4 rounded-xl justify-start
                               transition-all duration-200 backdrop-blur-sm"
                >
                    <FaSignOutAlt className="w-[1.375rem] h-[1.375rem]" />
                    <span className="font-bold text-[1.25rem]">Log out</span>
                </Button>
            </div>
        </div>
    );

    /**
     * The rail's paint, and NOTHING that positions it.
     *
     * This string used to end `relative overflow-hidden`, and it is shared by
     * the desktop rail (`sticky`) and the mobile drawer (`absolute`). Tailwind
     * emits its position utilities in one fixed order — `static`, `fixed`,
     * `absolute`, `relative`, `sticky` — so a class list carrying two of them
     * is decided by that order and not by the order they are written in.
     *
     * `relative` sits AFTER `absolute`, so it won: the drawer panel resolved to
     * `position: relative`, which made its `top-0 bottom-0` inert and left it
     * exactly as tall as its own content. On a phone that is the gradient
     * ending a few hundred pixels short of the bottom of the screen with the
     * page showing beneath it — the reported "sidebar does not fit". The
     * desktop rail was unaffected only because `sticky` sorts after `relative`.
     *
     * Each caller now declares its own positioning, and both `absolute` and
     * `sticky` already establish the containing block the two blur circles
     * inside need, so nothing lost the context `relative` was there to provide.
     */
    const shell =
        'bg-gradient-to-b from-blue-600 via-purple-600 to-indigo-700 shadow-lg overflow-hidden';

    return (
        <>
            {/* Desktop rail */}
            {/*
              * The rail appears from `lg`, not from `md`.
              *
              * It used to appear at 768px while five of the eight admin screens
              * hid their menu button at `lg` — so between 768px and 1023px a
              * tablet showed the rail AND a hamburger that opened nothing,
              * because the drawer was `md:hidden`. `lg` is also where the member
              * rail switches, so the two halves of the product now agree, and a
              * 768px tablet gets the whole width for the tables rather than
              * giving 280px of it to navigation.
              *
              * This is the one rail every tier renders - block, district, state
              * and super all re-export this file - so the four move together.
              */}
            {/* `shrink-0`: the shell is `overflow-hidden`, which makes a flex
                item's automatic minimum width zero, so a wide page could
                squeeze the rail down to a sliver of gradient at the edge. */}
            <div className={`hidden lg:flex lg:flex-col shrink-0 lg:w-[17.5rem] xl:w-[20.5rem] 2xl:w-[22rem] h-screen sticky top-0 min-h-0 ${shell}`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                {content}
            </div>

            {/* Mobile drawer — same min-h-0 treatment, same clipping otherwise. */}
            {isOpen && (
                /*
                 * `h-[100dvh]`, not `inset-0` alone.
                 *
                 * On a phone browser the address bar collapses as the page
                 * scrolls, and `100vh` is the TALLER of the two states — so a
                 * `vh`-sized overlay overhangs the screen while the bar is
                 * showing. `dvh` is the height actually on screen right now, so
                 * the panel reaches the bottom edge in both states.
                 */
                <div className="fixed inset-0 z-50 h-[100dvh] lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={onClose} />
                    <div className={`absolute left-0 top-0 h-full w-[85%] max-w-[22rem] flex flex-col min-h-0 ${shell}`}>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                        {content}
                    </div>
                </div>
            )}
        </>
    );
}
