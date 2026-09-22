import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Briefcase, Box, Compass, ShieldCheck, BarChart3, Settings,
    ArrowLeft, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getPaymentStatus } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';

type Props = {
    /** Drawer state, owned by `BusinessPageShell`. */
    isOpen?: boolean;
    onClose?: () => void;
    disableNavigation?: boolean;
};

/**
 * The rail's entries, grouped.
 *
 * GROUPED FOR THE SAME REASON THE MEMBER RAIL IS. A flat run of six or eight
 * entries is the length at which a list stops being scannable; three short
 * lists under headings are read at a glance. This rail and the member rail are
 * two halves of one product and a member walks between them constantly, so they
 * are the same object with different destinations rather than two designs that
 * merely resemble each other.
 *
 * STOCK IS NOT HERE. It was a screen of its own answering "what have I got",
 * beside Products answering "what do I sell". The association asked for it to
 * come out; its route is gone with it, so nothing links into a screen that is
 * no longer offered.
 */
const NAV_GROUPS: { label: string; entries: { to: string; label: string; icon: typeof Briefcase }[] }[] = [
    {
        label: 'Overview',
        entries: [{ to: '/business/dashboard', label: 'Business', icon: Briefcase }],
    },
    {
        label: 'Catalogue',
        entries: [
            { to: '/business/products', label: 'Products', icon: Box },
            { to: '/business/analytics', label: 'Analytics', icon: BarChart3 },
        ],
    },
    {
        label: 'Network',
        entries: [
            { to: '/business/discover', label: 'Discover', icon: Compass },
            /*
             * Trust List sits directly under Discover, because that is where its
             * entries come from. A saved-companies list filed under Settings is
             * a list nobody finds; beside the search that fills it, the pair
             * reads as one idea — find them, keep them.
             */
            { to: '/business/trust-list', label: 'Trust List', icon: ShieldCheck },
        ],
    },
    {
        label: 'Account',
        entries: [{ to: '/business/settings', label: 'Settings', icon: Settings }],
    },
];

/**
 * The business area's navigation rail.
 *
 * BUILT TO THE MEMBER RAIL'S MEASUREMENTS, deliberately and line for line:
 * the 5.5rem brand row with the mark centred on the rail, `lg:w-72 xl:w-80`,
 * grouped entries at `text-[1.375rem]` on `py-3.5`, the tinted active row with a rule
 * on its leading edge rather than a solid blue bar, the collapse control on the
 * first heading, and identity in a bordered card at the foot. It used to be its
 * own thing — 15px entries, a solid blue active bar, the company block at the
 * top where it pushed the navigation a hundred pixels down — so walking from
 * the member dashboard into the business area felt like leaving the product.
 *
 * Structure follows `pages/cms/CmsLayout.tsx`: ONE `<aside>` that is `fixed` on
 * small screens and `lg:static` from large up, sliding in on `translate-x`.
 *
 * It used to be two separate trees — a `hidden md:flex` rail and a
 * `fixed inset-0 md:hidden` drawer — both rendering a `SidebarContent`
 * component that was *defined inside the render body*. A component declared
 * during render is a new type on every render, so React unmounted and remounted
 * the entire subtree each time the parent updated: the logo image re-requested
 * itself and any focus inside was lost. Declaring the markup once, inline,
 * removes both the duplication and the remount.
 */
export default function BusinessSidebar({
    isOpen = false,
    onClose = () => {},
    disableNavigation = false,
}: Props) {
    const location = useLocation();
    const navigate = useNavigate();

    /**
     * Collapsed state, shared with the member rail under one key.
     *
     * Deliberately the same `activ:railCollapsed` the member rail reads. It is a
     * preference about how someone likes to work, not a per-area choice —
     * collapsing the rail on the dashboard and finding it expanded again one
     * click later in the business area is the behaviour that makes people stop
     * using a collapse control at all.
     *
     * Read defensively: a private window throws on `localStorage`, and the rail
     * must still render.
     */
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        try { return localStorage.getItem('activ:railCollapsed') === '1'; } catch { return false; }
    });

    useEffect(() => {
        try { localStorage.setItem('activ:railCollapsed', collapsed ? '1' : '0'); } catch { /* storage unavailable */ }
    }, [collapsed]);

    /**
     * The page behind the open drawer does not scroll.
     *
     * Without it a finger drag scrolls the page underneath a rail that stays
     * put, which reads as the menu having come loose. The previous value is
     * restored rather than assumed to be `''`.
     */
    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previous; };
    }, [isOpen]);

    /**
     * The sidebar names the company every other screen is acting on.
     *
     * It used to fetch `/business-profiles/me` itself — the member's NEWEST
     * company — so after switching company the sidebar still showed the old one
     * while the pages beside it showed the new one. Reading the shared selection
     * means the header and the content can no longer disagree.
     */
    const { activeCompany, loadCompanies } = useActiveCompanyStore();

    useEffect(() => {
        loadCompanies();

        // Kept for the screens that still announce a save this way.
        const handleCompanyUpdate = () => { loadCompanies({ force: true }); };
        window.addEventListener('companyDataUpdated', handleCompanyUpdate);
        window.addEventListener('companyUpdated', handleCompanyUpdate);

        return () => {
            window.removeEventListener('companyDataUpdated', handleCompanyUpdate);
            window.removeEventListener('companyUpdated', handleCompanyUpdate);
        };
    }, [loadCompanies]);

    // `activeCompany` absent means no company yet, which is the ACCOUNT — not a
    // company missing its name. The two states read differently on purpose.
    const companyName = activeCompany
        ? ((activeCompany.businessName || '').trim() || 'Untitled company')
        : 'Business Account';
    const companyPhone = activeCompany?.mobileNumber || '';

    /**
     * Re-anchored to the API origin. The logo is stored as a relative
     * `/uploads/<file>` path, which a browser resolves against *this* site —
     * where nothing serves uploads — so the avatar fell back to initials for
     * every company that had one.
     */
    const companyLogo = resolveMediaUrl(activeCompany?.logo);

    const initials = companyName
        ? companyName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'BA';

    const handleBackToDashboard = async () => {
        try {
            const isPaid = (await getPaymentStatus()) === 'completed';
            navigate(isPaid ? '/payment/member-dashboard' : '/member/unpaid-dashboard');
        } catch (error) {
            // Unknown payment state is treated as unpaid — showing paid-only
            // screens to someone who has not paid is the worse failure.
            console.warn('Payment status check safely caught:', error);
            navigate('/member/unpaid-dashboard');
        }
        onClose();
    };

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                    onClick={onClose}
                    aria-hidden
                />
            )}

            <aside
                className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 lg:h-screen w-72 shrink-0
                            bg-white border-r border-slate-200 flex flex-col
                            transition-transform duration-200 transition-[width]
                            ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                            ${collapsed ? 'lg:w-[5rem]' : 'lg:w-72 xl:w-80'}`}
            >
                {/*
                  THE MARK, CENTRED — as on the member rail.

                  The close button is positioned rather than in the flow, so the
                  mark centres on the RAIL and not on the space left beside a
                  button: in the flow, an invisible 40px button on one side
                  pushes the logo 20px off centre on desktop.
                */}
                <div className={`relative h-[5.5rem] bg-white border-b border-slate-200 flex-shrink-0
                                flex items-center justify-center ${collapsed ? 'px-2' : 'px-6'}`}>
                    <Link
                        to="/business/dashboard"
                        onClick={onClose}
                        className="flex items-center justify-center"
                    >
                        <img
                            src="/logo_ACTIVian-removebg-preview.png"
                            alt="ACTIV"
                            className={`w-auto object-contain ${collapsed ? 'h-8' : 'h-12'}`}
                        />
                    </Link>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                <nav className="p-3 flex-1 min-h-0 overflow-y-auto overscroll-contain member-rail-scroll">
                    {NAV_GROUPS.map((group) => (
                        /* No card around a group: the rail is one white surface,
                           and the headings do the separating. */
                        <div key={group.label} className="mb-5 last:mb-0">
                            <div className={`mb-2 flex items-center gap-2 ${collapsed ? 'px-0 justify-center' : 'px-3.5'}`}>
                                {!collapsed && (
                                    <p className="flex-1 min-w-0 text-[1rem] font-bold uppercase
                                                  tracking-[0.06em] text-slate-900 truncate">
                                        {group.label}
                                    </p>
                                )}

                                {/*
                                  THE COLLAPSE CONTROL, on the first heading only —
                                  where the member rail puts it. Desktop only:
                                  below `lg` the rail is a slide-over and the close
                                  button already dismisses it, so a second control
                                  that shrinks a panel about to be dismissed is two
                                  answers to one question.
                                */}
                                {group === NAV_GROUPS[0] && (
                                    <button
                                        type="button"
                                        onClick={() => setCollapsed((c) => !c)}
                                        aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
                                        title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
                                        className="hidden lg:flex w-6 h-6 shrink-0 items-center justify-center
                                                   rounded-md text-slate-400 transition-colors
                                                   hover:bg-slate-100 hover:text-slate-700"
                                    >
                                        {collapsed
                                            ? <ChevronRight className="w-3 h-3" />
                                            : <ChevronLeft className="w-3 h-3" />}
                                    </button>
                                )}
                            </div>

                            <div className="space-y-0.5">
                                {group.entries.map(({ to, label, icon: Icon }) => {
                                    const active = location.pathname === to;
                                    const isDisabled = disableNavigation && to !== '/business/create-profile';

                                    return (
                                        <Link
                                            key={to}
                                            to={to}
                                            title={label}
                                            onClick={(e: React.MouseEvent) => {
                                                if (isDisabled) {
                                                    e.preventDefault();
                                                    toast.error('Please complete your business profile first');
                                                    return;
                                                }
                                                onClose();
                                            }}
                                            className={`relative flex items-center gap-3.5 py-3.5 rounded-xl
                                                        text-[1.375rem] transition-colors
                                                        ${collapsed ? 'px-0 justify-center' : 'px-3.5'} ${
                                                isDisabled
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : active
                                                        ? 'bg-blue-50 text-blue-700 font-semibold'
                                                        : 'text-slate-600 font-normal hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                        >
                                            {/* The rule on the leading edge. Inset so it
                                                reads as marking the row, not as a border
                                                on it. */}
                                            {active && !isDisabled && (
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2
                                                                 h-6 w-1 rounded-r-full bg-blue-600" />
                                            )}

                                            <span className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                                                isDisabled ? 'text-slate-300' : active ? 'text-blue-600' : 'text-slate-400'
                                            }`}>
                                                <Icon className="w-5 h-5" />
                                            </span>

                                            {!collapsed && <span className="flex-1 min-w-0 truncate">{label}</span>}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/*
                  THE COMPANY AND THE WAY OUT, TOGETHER AT THE FOOT — the member
                  rail's arrangement.

                  The company block sat directly under the mark before, which
                  pushed the navigation a hundred pixels down the rail and put the
                  thing read least often above the thing read most. Identity goes
                  at the bottom, in a bordered card, with the way out beside it —
                  so the rail opens on the destinations and closes on "which
                  company am I in, and how do I leave".
                */}
                <div className={`pt-3 pb-6 bg-white border-t border-slate-200 flex-shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
                    <Link
                        to="/business/settings"
                        onClick={onClose}
                        /* Tinted, like the member rail's — a filled card under a
                           white rail reads as a distinct object, where a white one
                           on white needs its border to do all the work. */
                        className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50
                                    transition-colors hover:border-slate-300 hover:bg-slate-100
                                    ${collapsed ? 'p-2 justify-center' : 'p-3.5'}`}
                    >
                        <Avatar className="w-11 h-11 shrink-0 rounded-xl">
                            {/*
                                No stock photograph as a fallback. A company with no
                                logo uploaded was shown a stranger's office from
                                Unsplash, in the slot where its own mark belongs.
                                With no src the AvatarFallback renders the company
                                initials, which are at least its own.
                            */}
                            {!!companyLogo && <AvatarImage src={companyLogo} className="object-cover" />}
                            <AvatarFallback className="bg-blue-600 text-white font-semibold text-[1.1875rem] rounded-xl">
                                {initials}
                            </AvatarFallback>
                        </Avatar>

                        {!collapsed && (
                            <span className="min-w-0 flex-1">
                                <span className="block text-[1.125rem] font-semibold text-slate-900 truncate">
                                    {companyName}
                                </span>
                                <span className="block text-[1rem] text-slate-500 truncate">
                                    {companyPhone || 'No phone'}
                                </span>
                            </span>
                        )}
                    </Link>

                    <button
                        type="button"
                        onClick={handleBackToDashboard}
                        title="Back to Dashboard"
                        className={`mt-2 w-full flex items-center gap-3.5 py-3 rounded-xl text-[1.125rem]
                                    font-semibold text-blue-700 transition-colors hover:bg-blue-50
                                    ${collapsed ? 'px-0 justify-center' : 'px-3.5'}`}
                    >
                        <ArrowLeft className="w-5 h-5 shrink-0" />
                        {!collapsed && 'Back to Dashboard'}
                    </button>
                </div>
            </aside>
        </>
    );
}
