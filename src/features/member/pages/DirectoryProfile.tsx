import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Building2, Package, Users, CalendarDays } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton, SectionCard } from '@/features/member/components/MemberUI';
import { formatDate } from '@/features/member/components/eventFormat';
import {
    getDirectoryEntry, recordProductView,
    type DirectoryEntry, type DirectoryProduct,
} from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * One member's directory card.
 *
 * Everything shown here is what `directory.service.js` chose to expose — an
 * allow-list, not the member document with a password stripped off it. There is
 * no email address and no phone number: a directory that hands out contact
 * details to anyone with a login is a mailing list, and the association has not
 * asked its members for permission to be one.
 *
 * Opening this page records a profile view for the member being looked at,
 * which is what their operational analytics count. The recording happens on the
 * server, in the same request — see the note in `directory.controller.js`.
 */
export default function DirectoryProfile() {
    const { id = '' } = useParams();
    const navigate = useNavigate();

    const [entry, setEntry] = useState<(DirectoryEntry & { products: DirectoryProduct[] }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        getDirectoryEntry(id)
            .then((row) => { if (!cancelled) setEntry(row); })
            .catch((err) => {
                if (!cancelled) setError(errorMessage(err, 'Could not open this member'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [id]);

    if (loading) {
        return (
            <MemberPageShell title="Member" subtitle="Member Directory" width="standard">
                <RowsSkeleton rows={4} />
            </MemberPageShell>
        );
    }

    if (error || !entry) {
        return (
            <MemberPageShell title="Member" subtitle="Member Directory" width="standard">
                <EmptyState
                    icon={<Users className="w-6 h-6" />}
                    title="This member is not listed"
                    detail={error || 'Only members with an active membership appear in the directory.'}
                    action={
                        <button
                            type="button"
                            onClick={() => navigate('/member/directory')}
                            className="text-[0.8125rem] font-semibold text-blue-600 hover:underline"
                        >
                            Back to the directory
                        </button>
                    }
                />
            </MemberPageShell>
        );
    }

    const photo = resolveMediaUrl(entry.profilePhoto);
    const where = [entry.city, entry.block, entry.district, entry.state].filter(Boolean).join(', ');

    return (
        <MemberPageShell
            title={entry.fullName}
            subtitle="Member Directory"
            width="standard"
            actions={
                <button
                    type="button"
                    onClick={() => navigate('/member/directory')}
                    className="text-[0.8125rem] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                    All members
                </button>
            }
        >
            <div className="space-y-5">
                {/* ---------- identity ---------- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:p-6
                                flex flex-wrap items-start gap-4">
                    {photo ? (
                        <img
                            src={photo}
                            alt=""
                            className="w-20 h-20 rounded-2xl object-cover shrink-0 ring-2 ring-blue-50"
                        />
                    ) : (
                        <span className="w-20 h-20 rounded-2xl bg-blue-600 text-white shrink-0
                                         flex items-center justify-center text-xl font-bold">
                            {(entry.fullName || '?').split(' ').filter(Boolean).slice(0, 2)
                                .map((part) => part[0]).join('').toUpperCase()}
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold text-slate-900">{entry.fullName}</h2>

                        {where ? (
                            <p className="text-[0.8125rem] text-slate-500 mt-1 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" /> {where}
                            </p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                            {entry.sectors.map((sector) => (
                                <span
                                    key={sector}
                                    className="text-[0.6875rem] font-semibold text-blue-700 bg-blue-50
                                               px-2.5 py-1 rounded-full"
                                >
                                    {sector}
                                </span>
                            ))}

                            {entry.memberSince ? (
                                <span className="text-[0.6875rem] text-slate-500 inline-flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" />
                                    Member since {formatDate(entry.memberSince)}
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* ---------- businesses ---------- */}
                {entry.companies.length > 0 ? (
                    <SectionCard
                        title={entry.companies.length === 1 ? 'Business' : 'Businesses'}
                        icon={<Building2 className="w-5 h-5" />}
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            {entry.companies.map((company) => {
                                const logo = resolveMediaUrl(company.logo);

                                return (
                                    <div
                                        key={company.id}
                                        className="rounded-xl border border-slate-200 p-4 flex gap-3 min-w-0"
                                    >
                                        {logo ? (
                                            <img
                                                src={logo}
                                                alt=""
                                                loading="lazy"
                                                className="w-11 h-11 rounded-lg object-cover shrink-0 bg-slate-100"
                                            />
                                        ) : (
                                            <span className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600
                                                             shrink-0 flex items-center justify-center">
                                                <Building2 className="w-5 h-5" />
                                            </span>
                                        )}

                                        <div className="min-w-0">
                                            <p className="text-[0.875rem] font-semibold text-slate-900 truncate">
                                                {company.businessName}
                                            </p>
                                            {company.businessType ? (
                                                <p className="text-[0.75rem] text-blue-700 font-medium">
                                                    {company.businessType}
                                                </p>
                                            ) : null}
                                            {company.location || company.area ? (
                                                <p className="text-[0.75rem] text-slate-500 truncate mt-0.5">
                                                    {[company.area, company.location].filter(Boolean).join(', ')}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                ) : null}

                {/* ---------- catalogue ---------- */}
                <SectionCard
                    title="Catalogue"
                    subtitle={entry.products.length > 0
                        ? `${entry.productCount} listed`
                        : undefined}
                    icon={<Package className="w-5 h-5" />}
                >
                    {entry.products.length === 0 ? (
                        <EmptyState
                            icon={<Package className="w-6 h-6" />}
                            title="Nothing listed yet"
                            detail="This member has not published any products or services."
                        />
                    ) : (
                        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                            {entry.products.map((product) => {
                                const image = resolveMediaUrl(product.imageUrl);

                                return (
                                    <div
                                        key={product.id}
                                        // Fire-and-forget: this is what the seller's
                                        // catalogue analytics count, and it has
                                        // nothing to say back to the viewer.
                                        onMouseEnter={() => recordProductView(product.id)}
                                        className="rounded-xl border border-slate-200 overflow-hidden"
                                    >
                                        <div className="aspect-[4/3] bg-slate-100">
                                            {image ? (
                                                <img
                                                    src={image}
                                                    alt=""
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="w-full h-full flex items-center justify-center
                                                                 text-slate-300">
                                                    <Package className="w-7 h-7" />
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-2.5">
                                            <p className="text-[0.78125rem] font-semibold text-slate-900 truncate">
                                                {product.name}
                                            </p>
                                            <p className="text-[0.6875rem] text-slate-500 truncate">
                                                {product.category}
                                            </p>
                                            {product.price > 0 ? (
                                                <p className="text-[0.78125rem] font-bold text-blue-700 mt-0.5 tabular-nums">
                                                    ₹{product.price.toLocaleString('en-IN')}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </SectionCard>
            </div>
        </MemberPageShell>
    );
}
