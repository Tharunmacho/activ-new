import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Box, Compass, BarChart3, Settings, ArrowLeft, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

const NAV = [
    { to: '/business/dashboard', label: 'Business', icon: Briefcase },
    { to: '/business/products', label: 'Products', icon: Box },
    { to: '/business/discover', label: 'Discover', icon: Compass },
    { to: '/business/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/business/settings', label: 'Settings', icon: Settings },
];

/**
 * The business area's navigation rail.
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

    const companyName = activeCompany?.businessName || 'Business Account';
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
                className={`fixed lg:static inset-y-0 left-0 z-40 w-[280px] shrink-0 bg-white border-r
                            border-slate-200 flex flex-col transition-transform duration-200
                            ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                {/* Company identity */}
                <div className="h-[72px] flex items-center justify-between gap-3 px-5 border-b border-slate-200">
                    <Link
                        to="/business/settings"
                        onClick={onClose}
                        className="flex items-center gap-3 min-w-0 group"
                    >
                        <Avatar className="w-10 h-10 shrink-0 ring-2 ring-blue-100 group-hover:ring-blue-300 transition-all">
                            {/*
                                No stock photograph as a fallback. A company with no logo
                                uploaded was shown a stranger's office from Unsplash, in
                                the slot where its own mark belongs. With no src the
                                AvatarFallback renders the company initials, which are at
                                least its own.
                            */}
                            {!!companyLogo && <AvatarImage src={companyLogo} className="object-cover" />}
                            <AvatarFallback className="bg-blue-600 text-white font-semibold text-sm">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                            <span className="block text-[15px] font-semibold text-slate-900 truncate">
                                {companyName}
                            </span>
                            <span className="block text-[13px] text-slate-500 truncate">
                                {companyPhone || 'No phone'}
                            </span>
                        </span>
                    </Link>

                    <button
                        type="button"
                        className="lg:hidden text-slate-400 hover:text-slate-600 shrink-0"
                        onClick={onClose}
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                    {NAV.map(({ to, label, icon: Icon }) => {
                        const active = location.pathname === to;
                        const isDisabled = disableNavigation && to !== '/business/create-profile';

                        return (
                            <Link
                                key={to}
                                to={to}
                                onClick={(e: React.MouseEvent) => {
                                    if (isDisabled) {
                                        e.preventDefault();
                                        toast.error('Please complete your business profile first');
                                        return;
                                    }
                                    onClose();
                                }}
                                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[15px] transition-colors ${
                                    isDisabled
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : active
                                            ? 'bg-blue-600 text-white font-medium'
                                            : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Icon className="w-[18px] h-[18px] shrink-0" />
                                <span className="truncate">{label}</span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="px-3 py-4 border-t border-slate-200">
                    <button
                        type="button"
                        onClick={handleBackToDashboard}
                        className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-lg text-[15px]
                                   text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                        <ArrowLeft className="w-[18px] h-[18px]" />
                        Back to Dashboard
                    </button>
                </div>
            </aside>
        </>
    );
}
