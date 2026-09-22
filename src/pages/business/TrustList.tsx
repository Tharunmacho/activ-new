import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, MapPin, Phone, Mail, Package, ShieldCheck, Search, Compass, X,
    ShieldPlus, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import BusinessPageShell from './BusinessPageShell';
/* Where an unpaid member is sent. A function, not a literal:
   these routes moved once already. */
import { dashboardPathFor } from '@/features/member/memberAccess';
import { Card, EmptyState, Loading } from './BusinessUI';
import { resolveMediaUrl } from '@/config/api.config';
import {
    getTrustList, removeFromTrustList, errorMessage, getPaymentStatus,
    type PublicCompany,
} from '@/services/activApi';

/**
 * TRUST LIST — the companies this member kept from Discover.
 *
 * Discover answers "who on the network sells this?" and answers it afresh every
 * time. That is the right behaviour for a search and the wrong one for a
 * supplier you dealt with in March: the only way back was to remember the words
 * that surfaced them.
 *
 * Kept server-side, per member, in its own collection — see
 * `trustedcompany.model.js` for why it is a join collection rather than an array
 * of ids on the member.
 *
 * Cards carry the SAME fields the directory does, because a trust-list row is
 * populated through the same `PUBLIC_FIELDS` whitelist the member-facing company
 * page uses. Trusting a company must not become a way to read more about it than
 * the directory shows.
 */

const TrustList = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<PublicCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [removing, setRemoving] = useState<string | null>(null);

    /**
     * Has this member paid?
     *
     * Decides which empty state is honest, not which rows are shown — the
     * list itself is the member's own and always theirs to read. `null` is
     * “not known yet” and is treated as unpaid, because promising a feature
     * to somebody who cannot use it is the worse of the two mistakes.
     */
    const [paid, setPaid] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        getPaymentStatus()
            .then((status) => { if (!cancelled) setPaid(status === 'completed'); })
            .catch(() => { if (!cancelled) setPaid(false); });
        return () => { cancelled = true; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setCompanies(await getTrustList());
        } catch (error) {
            console.warn('Could not load the trust list:', error);
            toast.error(errorMessage(error, 'Could not load your trust list'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    /**
     * Filtered in the browser, deliberately.
     *
     * A trust list is a handful of companies, not a directory: a round trip per
     * keystroke would be slower than the filter and would make the box unusable
     * offline. Discover queries the server because it searches the whole
     * network; this searches a list already in hand.
     */
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return companies;
        return companies.filter((company) => {
            const haystack = [
                company.businessName,
                company.businessType,
                company.location,
                company.area,
                company.note,
                ...(company.productCategories || []).map((c) => c?.description),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(q);
        });
    }, [companies, query]);

    const remove = async (company: PublicCompany) => {
        if (!company._id) return;
        setRemoving(company._id);
        // Removed from the list immediately, and put back if the call fails.
        // A row that lingers after the button is pressed reads as a dead button.
        const previous = companies;
        setCompanies((current) => current.filter((row) => row._id !== company._id));
        try {
            await removeFromTrustList(company._id);
            toast.success(`${company.businessName || 'Company'} removed from your trust list`);
        } catch (error) {
            setCompanies(previous);
            toast.error(errorMessage(error, 'Could not remove that company'));
        } finally {
            setRemoving(null);
        }
    };

    return (
        <BusinessPageShell
            title="Trust List"
            subtitle={
                loading
                    ? 'Companies you have kept from Discover'
                    : `${companies.length} ${companies.length === 1 ? 'company' : 'companies'} you have kept from Discover`
            }
            width="wide"
            actions={
                <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => navigate('/business/discover')}
                >
                    <Compass className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Find more</span>
                </Button>
            }
        >
            {loading ? (
                <Loading label="Loading your trust list…" />
            ) : companies.length === 0 ? (
                paid === true ? (
                    <Card>
                        <EmptyState
                            icon={ShieldCheck}
                            title="Your trust list is empty"
                            hint="Search the network in Discover and add the companies you want to keep. They stay here until you remove them."
                            action={
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => navigate('/business/discover')}
                                >
                                    <Compass className="h-4 w-4 mr-2" />
                                    Open Discover
                                </Button>
                            }
                        />
                    </Card>
                ) : (
                    /*
                      THE SAME SCREEN, TO SOMEBODY WHO CANNOT USE IT YET.

                      “Search Discover and add the companies you want to keep”
                      is a dead end before the membership: Discover answers
                      them with a count and no companies, so there is nothing
                      there to add and the button walks them INTO the gate
                      rather than through it.
                    */
                    <Card className="p-8 sm:p-10">
                        <div className="text-center">
                            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center
                                             rounded-2xl bg-blue-50">
                                <ShieldCheck className="h-7 w-7 text-blue-600" />
                            </span>
                            <h2 className="text-[1.75rem] font-bold text-slate-900">
                                Your trust list opens with membership
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-[1.25rem] text-slate-600">
                                A trust list is the suppliers you have dealt with and would deal
                                with again — kept in one place, and visible to the members who are
                                deciding whether to deal with you.
                            </p>
                        </div>

                        <div className="mt-8 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-3">
                            {[
                                {
                                    icon: ShieldPlus,
                                    title: 'Keep who you trust',
                                    detail: 'Add a company from Discover and it stays until you remove it.',
                                },
                                {
                                    icon: Eye,
                                    title: 'Be kept by others',
                                    detail: 'Your company shows how many members trust it — on every screen it appears.',
                                },
                                {
                                    icon: Building2,
                                    title: 'Reach them directly',
                                    detail: 'Names, catalogues and telephone numbers, across the whole network.',
                                },
                            ].map(({ icon: Icon, title, detail }) => (
                                <div key={title} className="text-center sm:text-left">
                                    <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center
                                                     rounded-xl bg-blue-50 text-blue-600 sm:mx-0">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <p className="text-[1.25rem] font-bold text-slate-900">{title}</p>
                                    <p className="text-[1.125rem] leading-relaxed text-slate-600">
                                        {detail}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 text-center">
                            <Button
                                className="h-12 bg-blue-600 px-8 text-[1.25rem] font-bold hover:bg-blue-700"
                                /* The unpaid dashboard, not the plans — the same
                                   destination Discover uses. The plans screen is a
                                   Pay button with no idea whether an admin has
                                   approved anything; this one shows the
                                   application's progress and offers payment only
                                   once it is approved. */
                                onClick={() => navigate(dashboardPathFor(false))}
                            >
                                Become a member
                            </Button>
                            <p className="mt-3 text-[1.125rem] text-slate-500">
                                Keep the suppliers you rely on, and be kept by the members who rely
                                on you. Your account and your products stay exactly as they are.
                            </p>
                        </div>
                    </Card>
                )
            ) : (
                <div className="space-y-5">
                    <Card className="flex items-center gap-3">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Filter your trust list by name, type, place or product…"
                            className="border-0 shadow-none focus-visible:ring-0 px-0 h-11 !text-[1.25rem]"
                        />
                        {query ? (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                className="text-slate-400 hover:text-slate-700 shrink-0"
                                aria-label="Clear the filter"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </Card>

                    {filtered.length === 0 ? (
                        <Card>
                            <EmptyState
                                icon={Search}
                                title={`Nothing in your trust list matches “${query.trim()}”`}
                                hint="Clear the filter to see all of them, or search the whole network in Discover."
                            />
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
                            {filtered.map((company) => {
                                const location = [company.area, company.location].filter(Boolean).join(', ');
                                const categories = company.productCategories || [];

                                return (
                                    <Card key={company._id} className="flex flex-col">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`/business/company/${company._id}`)}
                                            className="flex items-start gap-4 text-left group"
                                        >
                                            <span className="w-14 h-14 rounded-xl bg-slate-100 flex items-center
                                                             justify-center overflow-hidden shrink-0">
                                                {company.logo ? (
                                                    <img
                                                        src={resolveMediaUrl(company.logo)}
                                                        alt={company.businessName || 'Company'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <Building2 className="h-7 w-7 text-slate-400" />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block font-bold text-[1.25rem] text-slate-900 truncate
                                                                 group-hover:text-blue-700 transition-colors">
                                                    {company.businessName || 'Company'}
                                                </span>
                                                <span className="block text-[1.25rem] text-slate-500 truncate">
                                                    {company.businessType || '—'}
                                                </span>
                                            </span>
                                        </button>

                                        <dl className="mt-4 space-y-1.5 text-[1.25rem]">
                                            {location ? (
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <span className="truncate">{location}</span>
                                                </div>
                                            ) : null}
                                            {company.mobileNumber ? (
                                                <div className="flex items-center gap-2 text-slate-700">
                                                    <Phone className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <a href={`tel:${company.mobileNumber}`} className="hover:underline">
                                                        {company.mobileNumber}
                                                    </a>
                                                </div>
                                            ) : null}
                                            {company.email ? (
                                                <div className="flex items-center gap-2 text-slate-600">
                                                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <a href={`mailto:${company.email}`} className="truncate hover:underline">
                                                        {company.email}
                                                    </a>
                                                </div>
                                            ) : null}
                                        </dl>

                                        {categories.length > 0 && (
                                            <ul className="flex flex-wrap gap-1.5 mt-4">
                                                {categories.slice(0, 3).map((category, index) => (
                                                    <li
                                                        key={`${category?.code || 'custom'}-${index}`}
                                                        className="inline-flex items-center gap-1 rounded-md border
                                                                   border-slate-200 bg-slate-50 px-2 py-1
                                                                   text-[1rem] text-slate-600"
                                                    >
                                                        <Package className="h-3 w-3" />
                                                        {category?.description}
                                                    </li>
                                                ))}
                                                {categories.length > 3 ? (
                                                    <li className="text-[1rem] text-slate-400 self-center">
                                                        +{categories.length - 3} more
                                                    </li>
                                                ) : null}
                                            </ul>
                                        )}

                                        {company.note ? (
                                            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2
                                                          text-[1.1875rem] text-amber-900">
                                                {company.note}
                                            </p>
                                        ) : null}

                                        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50"
                                                onClick={() => navigate(`/business/company/${company._id}`)}
                                            >
                                                View company
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={removing === company._id}
                                                className="border-blue-200 text-blue-700 hover:bg-blue-50"
                                                onClick={() => remove(company)}
                                            >
                                                <ShieldCheck className="h-4 w-4 mr-1.5" />
                                                Trusted
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </BusinessPageShell>
    );
};

export default TrustList;
