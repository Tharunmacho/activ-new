import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaHome, FaCheckCircle, FaUsers, FaCog, FaSignOutAlt, FaTimes, FaUserShield, FaCalendarAlt } from 'react-icons/fa';
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
        cog: <FaCog />,
    } as const;

    const nav = config.nav.map(item => ({ ...item, node: ICONS[item.icon] }));

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
        navigate('/login');
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
                        className="md:hidden text-white hover:bg-white/20"
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
                    <Avatar className="w-12 h-12 ring-2 ring-white/30 shadow-lg flex-shrink-0">
                        {!!avatarUrl && <AvatarImage src={avatarUrl} className="object-cover" />}
                        <AvatarFallback className="bg-white/20 backdrop-blur-sm text-white font-bold">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">{userName}</div>
                        <div className="text-xs text-blue-100 font-medium truncate">{roleLabel}</div>
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
                        // The landing route matches exactly; the rest also match
                        // their sub-paths, so a detail page keeps its section lit.
                        const active =
                            location.pathname === item.to ||
                            (item.to !== config.nav[0].to && location.pathname.startsWith(item.to));
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                onClick={() => onClose?.()}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
                                    ? 'bg-white text-blue-600 shadow-lg'
                                    : 'text-white hover:bg-white/20 backdrop-blur-sm'
                                    }`}
                            >
                                <span className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-white'}`}>
                                    {item.node}
                                </span>
                                <span className="font-medium text-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <div className="p-3 md:p-4 border-t border-white/20 shrink-0">
                <Button
                    variant="ghost"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 text-white hover:bg-red-500/80 hover:text-white py-3 px-4 rounded-xl justify-start transition-all duration-200 backdrop-blur-sm"
                >
                    <FaSignOutAlt className="w-5 h-5" />
                    <span className="font-medium text-sm">Log out</span>
                </Button>
            </div>
        </div>
    );

    const shell =
        'bg-gradient-to-b from-blue-600 via-purple-600 to-indigo-700 shadow-lg relative overflow-hidden';

    return (
        <>
            {/* Desktop rail */}
            {/*
              * Wider from `lg` up, not from `md`.
              *
              * The rail was 256px at every desktop width, which is narrow for
              * entries like "Application Status" and "Association Updates" and
              * left them wrapping or truncating. It grows on the screens that
              * have the room; at `md` (768px) it stays 256px, because widening
              * there would take the space back off an admin table that is
              * already tight on a tablet.
              *
              * This is the one rail every tier renders - block, district, state
              * and super all re-export this file - so the four move together.
              */}
            <div className={`hidden md:flex md:flex-col md:w-64 lg:w-[288px] xl:w-[304px] h-screen sticky top-0 min-h-0 ${shell}`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                {content}
            </div>

            {/* Mobile drawer — same min-h-0 treatment, same clipping otherwise. */}
            {isOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
                    <div className={`absolute left-0 top-0 bottom-0 w-4/5 max-w-sm flex flex-col min-h-0 ${shell}`}>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full filter blur-3xl pointer-events-none" />
                        {content}
                    </div>
                </div>
            )}
        </>
    );
}
