import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Store, Pencil, ArrowLeftRight, PlusCircle, Share2, Package, PlusSquare,
    Compass, BarChart3, LayoutDashboard, Trash2, LogOut,
    BadgeCheck, Clock, Ban, Building2, type LucideIcon,
} from "lucide-react";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, Chip } from "./BusinessUI";
import { toast } from "sonner";
import { apiFetch, getPaymentStatus, logout } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';

/**
 * Business Settings — the website's copy of `SettingsScreen.tsx`.
 *
 * What stood here originally was a four-tab preferences panel (Account,
 * Notifications, Security & Privacy, Preferences) in which almost nothing did
 * anything: five notification switches held in local `useState` and sent
 * nowhere, two security buttons with no `onClick`, and Language/Timezone
 * selects bound to nothing. The Account tab did save, but its "Business
 * Category" box was bound to `businessType` — a four-value schema enum — while
 * suggesting "Technology, Retail, Food & Beverage" in its own placeholder, so
 * every suggestion it made returned a 400. Editing now routes to the real form
 * at `/business/companies/edit/:id`, which gets the enum and the multipart logo
 * upload right.
 *
 * Layout: this screen is the agreed quality reference for the area, so its
 * sectioned-card character is preserved. Two things changed for desktop — it
 * was pinned to `max-w-3xl` (768px, leaving ~340px of dead gutter either side
 * at 1440px), and each of its eleven rows ended in a `ChevronRight`, which is an
 * iOS/Android disclosure indicator with no meaning under a mouse pointer.
 */

type StatusTone = {
    label: string;
    tone: 'green' | 'amber' | 'red';
    Icon: LucideIcon;
};

// The company record carries `status` (pending until an admin activates it).
const STATUS_TONES: Record<string, StatusTone> = {
    active: { label: 'Active', tone: 'green', Icon: BadgeCheck },
    pending: { label: 'Pending Approval', tone: 'amber', Icon: Clock },
    inactive: { label: 'Inactive', tone: 'red', Icon: Ban },
};

const Settings = () => {
    const navigate = useNavigate();

    const { activeCompany, companies, hasLoaded, loadCompanies, setActiveCompany } =
        useActiveCompanyStore();

    const [isListed, setIsListed] = useState(true);
    const [isSavingListing, setIsSavingListing] = useState(false);
    const [catalogStats, setCatalogStats] = useState({ total: 0, active: 0, featured: 0 });
    const [confirmDelete, setConfirmDelete] = useState(false);

    const companyName = activeCompany?.businessName || '';
    const companyId = activeCompany?._id || '';
    const companiesCount = (companies || []).length;
    const statusTone =
        STATUS_TONES[(activeCompany?.status || 'pending').toLowerCase()] || STATUS_TONES.pending;

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    useEffect(() => {
        setIsListed(activeCompany?.isActive !== false);
    }, [activeCompany?._id, activeCompany?.isActive]);

    /**
     * A settings screen that cannot tell you whether your catalog is empty is
     * just a menu, so pull the same counts the dashboard shows — from the same
     * endpoint mobile uses, rather than counting a product list in the browser.
     */
    useEffect(() => {
        if (!hasLoaded) return;
        let cancelled = false;

        const loadStats = async () => {
            if (!companyId) {
                setCatalogStats({ total: 0, active: 0, featured: 0 });
                return;
            }
            try {
                const res = await apiFetch(
                    `/products/stats?companyId=${encodeURIComponent(companyId)}`,
                );
                const body = await res.json();
                const payload = body?.data || {};
                if (cancelled) return;
                setCatalogStats({
                    total: Number(payload.total || 0),
                    active: Number(payload.active || 0),
                    featured: Number(payload.featured || 0),
                });
            } catch (err) {
                console.warn('Catalog stats safely caught:', err);
                if (!cancelled) setCatalogStats({ total: 0, active: 0, featured: 0 });
            }
        };

        loadStats();
        return () => { cancelled = true; };
    }, [companyId, hasLoaded]);

    /**
     * Every company-scoped action needs a company to act on. Rather than
     * navigating to a screen that would render empty, say so and offer the fix.
     */
    const requireCompany = (run: () => void) => {
        if (!companyId) {
            toast.error('No active company', {
                description: 'Select or create a company first, then try again.',
                action: { label: 'My Companies', onClick: () => navigate('/business/companies') },
            });
            return;
        }
        run();
    };

    /**
     * Directory visibility — drives whether other members find this company in
     * Discover. Optimistic, reverted if the write fails.
     */
    const handleToggleListing = async (next: boolean) => {
        if (!companyId) {
            requireCompany(() => { });
            return;
        }

        setIsListed(next);
        setIsSavingListing(true);

        try {
            const response = await apiFetch(`/business-profiles/${companyId}`, {
                method: 'PUT',
                body: JSON.stringify({ isActive: next }),
            });
            const result = await response.json();

            if (!result.success) throw new Error(result.message || 'Update failed');

            await loadCompanies({ force: true });
            toast.success(next ? 'Listed in Discover' : 'Hidden from Discover');
        } catch (error: any) {
            setIsListed(!next);
            toast.error('Could not update listing', {
                description: error?.message || 'Please check your connection and try again.',
            });
        } finally {
            setIsSavingListing(false);
        }
    };

    const handleShareCompany = async () => {
        if (!activeCompany) {
            requireCompany(() => { });
            return;
        }

        const lines = [
            activeCompany.businessName || '',
            activeCompany.businessType || '',
            activeCompany.mobileNumber ? `Phone: ${activeCompany.mobileNumber}` : '',
            activeCompany.email ? `Email: ${activeCompany.email}` : '',
            [activeCompany.area, activeCompany.location].filter(Boolean).join(', '),
            activeCompany.description || '',
        ].filter(Boolean);

        const text = lines.join('\n');

        try {
            // The Web Share sheet is mobile's `Share.share`. It does not exist on
            // most desktop browsers, so fall back to the clipboard rather than
            // leaving the button dead there.
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                await navigator.share({ title: activeCompany.businessName || 'Business Details', text });
                return;
            }
            await navigator.clipboard.writeText(text);
            toast.success('Business details copied to clipboard');
        } catch (err) {
            // An abort (the user dismissed the share sheet) is not an error.
            console.warn('Share safely caught:', err);
        }
    };

    const handleDeleteCompany = async () => {
        setConfirmDelete(false);
        if (!companyId) return;

        try {
            const response = await apiFetch(`/business-profiles/${companyId}`, { method: 'DELETE' });
            const result = await response.json();

            if (!result.success) throw new Error(result.message || 'Delete failed');

            // Drop the selection before reloading, so no screen keeps rendering
            // the deleted company's data.
            setActiveCompany(null);
            await loadCompanies({ force: true });
            toast.success('Company removed successfully');
            navigate('/business/companies');
        } catch (error: any) {
            toast.error('Failed to delete company', { description: error?.message });
        }
    };

    /** Leaves the business area but keeps the session — not a logout. */
    const handleExitBusiness = async () => {
        try {
            const isPaid = (await getPaymentStatus()) === 'completed';
            navigate(isPaid ? '/payment/member-dashboard' : '/member/unpaid-dashboard');
        } catch (error) {
            console.warn('Exit navigation safely caught:', error);
            navigate('/member/unpaid-dashboard');
        }
    };

    /** Ends the session for real. */
    const handleLogout = async () => {
        try {
            // `logout()` also tells the server to drop its cache entry, and
            // clears every session key — `localStorage.clear()` used to wipe
            // unrelated site state along with it.
            await logout();
        } catch (err) {
            console.warn('Logout safely caught:', err);
        }
        navigate('/');
        toast.success('Logged out successfully');
    };

    /**
     * One actionable row.
     *
     * No trailing chevron: the affordance on a pointer UI is the hover state and
     * the cursor, not a disclosure arrow borrowed from a touch list.
     */
    const Row = ({
        Icon, title, subtitle, onClick, last,
    }: {
        Icon: LucideIcon; title: string; subtitle: string; onClick: () => void; last?: boolean;
    }) => (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-4 py-3.5 px-3 -mx-3 text-left rounded-lg
                        hover:bg-slate-50 transition-colors ${last ? '' : 'border-b border-slate-100'}`}
        >
            <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon className="h-[1.125rem] w-[1.125rem] text-blue-600" />
            </span>
            <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sm text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500">{subtitle}</span>
            </span>
        </button>
    );

    return (
        <BusinessPageShell
            title="Business Settings"
            subtitle="Manage your company, catalog and directory presence"
            width="standard"
            actions={
                <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Log Out
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Which company every setting below applies to */}
                <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        {activeCompany?.logo ? (
                            <img
                                src={resolveMediaUrl(activeCompany.logo)}
                                alt={companyName}
                                className="w-14 h-14 rounded-xl object-cover shrink-0"
                            />
                        ) : (
                            <span className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                <Store className="h-7 w-7 text-blue-600" />
                            </span>
                        )}
                        <div className="min-w-0">
                            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                                Active company
                            </p>
                            <p className="text-lg font-bold text-slate-900 truncate">
                                {companyName || 'None selected'}
                            </p>
                            <p className="text-sm text-slate-500 truncate">
                                {activeCompany?.businessType || 'Business'}
                                {activeCompany?.location ? ` · ${activeCompany.location}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Chip tone={statusTone.tone} icon={statusTone.Icon}>{statusTone.label}</Chip>
                        <Chip tone="blue" icon={Building2}>
                            {companiesCount} {companiesCount === 1 ? 'company' : 'companies'}
                        </Chip>
                    </div>
                </Card>

                {/*
                    Two columns from xl up. On mobile these six panels are one
                    long scroll — which is right for a phone and wrong for a
                    1440px monitor, where the same content ran well past two
                    viewport heights with empty space on both sides.
                */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <div className="space-y-6">
                        <Card>
                            <SectionHeading title="Company Profile" icon={Pencil} />
                            <Row
                                Icon={Pencil}
                                title="Edit Company Profile"
                                subtitle="Name, type, contact, location and logo"
                                onClick={() => requireCompany(() => navigate(`/business/companies/edit/${companyId}`))}
                            />
                            <Row
                                Icon={ArrowLeftRight}
                                title="Manage Companies"
                                subtitle="Switch between or review your business accounts"
                                onClick={() => navigate('/business/companies')}
                            />
                            <Row
                                Icon={PlusCircle}
                                title="Add New Company"
                                subtitle="Register another business under your membership"
                                onClick={() => navigate('/business/companies/add')}
                            />
                            <Row
                                Icon={Share2}
                                title="Share Business Details"
                                subtitle="Send name, contact and location to a buyer"
                                onClick={handleShareCompany}
                                last
                            />
                        </Card>

                        <Card>
                            <SectionHeading title="Catalog" icon={Package} />

                            <div className="grid grid-cols-3 rounded-xl bg-slate-50 border border-slate-200 py-4 mb-3">
                                <div className="text-center border-r border-slate-200">
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{catalogStats.total}</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Items</p>
                                </div>
                                <div className="text-center border-r border-slate-200">
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{catalogStats.active}</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Live</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{catalogStats.featured}</p>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">Featured</p>
                                </div>
                            </div>

                            <Row
                                Icon={Package}
                                title="Products & Services"
                                subtitle="Review, edit or remove your catalog items"
                                onClick={() => requireCompany(() => navigate('/business/products'))}
                            />
                            <Row
                                Icon={PlusSquare}
                                title="Add Product or Service"
                                subtitle="Publish a new item with photo, price and stock"
                                onClick={() => requireCompany(() => navigate('/business/add-product'))}
                                last
                            />
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <SectionHeading title="Directory &amp; Reach" icon={Compass} />

                            <div className="flex items-center gap-4 py-3.5 border-b border-slate-100">
                                <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                    <Compass className="h-[1.125rem] w-[1.125rem] text-blue-600" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-slate-800">List in Discover</p>
                                    <p className="text-xs text-slate-500">
                                        {isListed
                                            ? 'Other members can find this company and its products'
                                            : 'Hidden from search across the member network'}
                                    </p>
                                </div>
                                {isSavingListing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 shrink-0" />
                                ) : (
                                    <Switch
                                        checked={isListed}
                                        onCheckedChange={handleToggleListing}
                                        disabled={!companyId}
                                    />
                                )}
                            </div>

                            <Row
                                Icon={Compass}
                                title="Browse the Network"
                                subtitle="Search companies and products across members"
                                onClick={() => navigate('/business/discover')}
                            />
                            <Row
                                Icon={BarChart3}
                                title="Analytics"
                                subtitle="Profile views and catalog performance"
                                onClick={() => navigate('/business/analytics')}
                                last
                            />
                        </Card>

                        <Card>
                            <SectionHeading title="Session" icon={LayoutDashboard} />
                            <Row
                                Icon={LayoutDashboard}
                                title="Exit to Member Dashboard"
                                subtitle="Leave the business area, stay signed in"
                                onClick={handleExitBusiness}
                                last
                            />
                        </Card>

                        {/* Irreversible actions, kept apart from everything else */}
                        <Card className="border-red-200">
                            <SectionHeading title="Danger Zone" icon={Trash2} />
                            <button
                                type="button"
                                onClick={() => requireCompany(() => setConfirmDelete(true))}
                                className="w-full flex items-center gap-4 py-3.5 px-3 -mx-3 text-left rounded-lg hover:bg-red-50 transition-colors"
                            >
                                <span className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                    <Trash2 className="h-[1.125rem] w-[1.125rem] text-red-500" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block font-semibold text-sm text-red-600">Delete This Company</span>
                                    <span className="block text-xs text-slate-500">
                                        Removes {companyName || 'the company'} and its catalog permanently
                                    </span>
                                </span>
                            </button>
                        </Card>
                    </div>
                </div>
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Company</AlertDialogTitle>
                        <AlertDialogDescription>
                            Permanently delete "{companyName}"? Its products and listing are removed
                            with it. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCompany}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </BusinessPageShell>
    );
};

export default Settings;
