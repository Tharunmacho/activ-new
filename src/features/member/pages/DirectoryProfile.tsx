import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Building2, Package, Users, CalendarDays, MessageSquare, Lock, Loader2 } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton, SectionCard } from '@/features/member/components/MemberUI';
import useMembershipGate from '@/features/member/useMembershipGate';
import { useProfile } from '@/contexts/ProfileContext';
import { getMyApplication } from '@/services/activApi';
import {
    deriveMemberAccess, membershipCta, MEMBERS_ONLY_COPY,
} from '@/features/member/memberAccess';
import { formatDate } from '@/features/member/components/eventFormat';
import {
    getDirectoryEntry, recordProductView,
    type DirectoryEntry, type DirectoryProduct,
} from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import { openConversationWith } from '@/services/messagesApi';
import { resolveMediaUrl } from '@/config/api.config';

import { CARD_TITLE } from '@/components/layout/appTypography';
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

    // `Omit` because the card's products are the FULL lines — category and
    // price — not the four-tile preview `DirectoryEntry` carries.
    const [entry, setEntry] = useState<
        (Omit<DirectoryEntry, 'products'> & { products: DirectoryProduct[] }) | null
    >(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /*
     * Whether this reader may contact the member they are looking at.
     *
     * Browsing the directory is open to an applicant — that is the point of
     * showing them who is already a member. Reaching a person through it is the
     * one thing an active membership buys, so the control is present either way
     * and says which of the two it is doing.
     */
    const { profileCompletion } = useProfile();
    const { isPaid } = useMembershipGate();
    const [application, setApplication] = useState<any>(null);
    const [askedToConnect, setAskedToConnect] = useState(false);
    const [opening, setOpening] = useState(false);
    const [openError, setOpenError] = useState('');

    /**
     * IS THIS THE MEMBER'S OWN CARD?
     *
     * The directory lists everybody, the reader included, so a member can and
     * does land on their own profile — and it was offering them a "Message
     * Tharun" button with their own name on it. Pressing it asked the server to
     * open a conversation between one person and themselves, which it correctly
     * refused; the applicant was then shown an error for doing the only thing
     * the screen invited them to do.
     *
     * Read from storage rather than a fetch: the id is written at login
     * (`activApi.login` stores `memberId`) and this only needs to compare two
     * strings. `userId` is the fallback for a session that predates that key.
     */
    const isSelf = useMemo(() => {
        try {
            const me = localStorage.getItem('memberId') || localStorage.getItem('userId') || '';
            return !!me && !!id && String(me) === String(id);
        } catch {
            // Storage unavailable (private window, blocked cookies). Falling
            // back to "not me" leaves the button, which the server still
            // refuses — the honest failure, not a hidden control.
            return false;
        }
    }, [id]);

    /**
     * Open the thread with this member, then go to it.
     *
     * The conversation is created on the SERVER before navigating, so Messages
     * opens on a real thread rather than on an inbox the member then has to
     * find their way back out of. `openConversationWith` is idempotent — the
     * participant pair is uniquely indexed — so pressing this twice reaches the
     * same conversation rather than making a second one.
     *
     * The server refuses if either side's membership is not active, and its
     * sentence is the one shown: it knows which of the two is the problem and
     * this screen does not.
     */
    const startConversation = async () => {
        if (!id || opening || isSelf) return;
        setOpening(true);
        setOpenError('');
        try {
            const conversation = await openConversationWith(id);
            navigate(conversation?.id ? `/member/messages?c=${conversation.id}` : '/member/messages');
        } catch (err) {
            /*
             * The same rule as the inbox: a member never sees the router's own
             * 404. `Route /api/v1/messages not found` under a Message button
             * reads as "this site is broken", when the honest answer is that
             * the service is not reachable right now.
             */
            const raw = errorMessage(err, '');
            setOpenError(
                !raw || /route .* not found|network error|404|50\d|ECONNREFUSED/i.test(raw)
                    ? 'Messaging is unavailable at the moment. Please try again in a few minutes.'
                    : raw,
            );
        } finally {
            setOpening(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        getMyApplication()
            .then((app) => { if (!cancelled) setApplication(app); })
            .catch(() => { /* an applicant with no application is the normal case */ });
        return () => { cancelled = true; };
    }, []);

    const access = useMemo(
        () => deriveMemberAccess(profileCompletion, application, isPaid),
        [profileCompletion, application, isPaid],
    );

    const cta = useMemo(() => membershipCta(access), [access]);

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
                            className="text-[1rem] font-semibold text-blue-600 hover:underline"
                        >
                            Back to the directory
                        </button>
                    }
                />
            </MemberPageShell>
        );
    }

    const photo = resolveMediaUrl(entry.profilePhoto);
    /*
     * The region, not an address.
     *
     * `city` is no longer sent — see the note on `toDirectoryEntry`. Block,
     * district and state name an administrative area rather than a place, which
     * is the line this directory draws: a buyer may know which block a supplier
     * trades in without being handed the way to turn up at their premises.
     */
    const where = [entry.block, entry.district, entry.state].filter(Boolean).join(', ');

    return (
        <MemberPageShell
            title={entry.fullName}
            subtitle="Member Directory"
            width="standard"
            actions={
                <button
                    type="button"
                    onClick={() => navigate('/member/directory')}
                    className="text-[1rem] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                    All members
                </button>
            }
        >
            <div className="space-y-5">
                {/* ---------- identity ---------- */}
                {/* `BIZ_CARD` — the Business Account form's card, which is what
                    every other panel in the member area now wears. The flatter
                    pair this carried made it the odd one out. */}
                <div className="bg-white rounded-2xl border border-slate-200
                                shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]
                                p-5 lg:p-6 flex flex-wrap items-start gap-5">
                    {photo ? (
                        <img
                            src={photo}
                            alt=""
                            className="w-20 h-20 rounded-2xl object-cover shrink-0 ring-2 ring-blue-50"
                        />
                    ) : (
                        <span className="w-20 h-20 rounded-2xl bg-blue-600 text-white shrink-0
                                         flex items-center justify-center text-[1.5625rem] font-bold">
                            {(entry.fullName || '?').split(' ').filter(Boolean).slice(0, 2)
                                .map((part) => part[0]).join('').toUpperCase()}
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
                        <h2 className={`${CARD_TITLE} text-slate-900`}>{entry.fullName}</h2>

                        {/*
                          * REGION AND MEMBER-SINCE AS LABELLED FIELDS.
                          *
                          * They were 11px and 13px grey lines with an icon in
                          * front — captions, floating under the name. The
                          * Business Account form states a fact as a small
                          * uppercase KEY over a bold VALUE (`BIZ_DETAIL_LABEL` /
                          * `BIZ_DETAIL_VALUE` in `components/layout/surface.ts`),
                          * and that is what these are.
                          */}
                        <div className="mt-4 grid gap-x-8 gap-y-4 grid-cols-1 sm:grid-cols-2">
                            {where ? (
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold
                                                  uppercase tracking-widest text-slate-400">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" /> Region
                                    </p>
                                    <p className="mt-1 text-[1.1875rem] font-bold text-slate-900 break-words">{where}</p>
                                </div>
                            ) : null}

                            {entry.memberSince ? (
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[1.0625rem] font-extrabold
                                                  uppercase tracking-widest text-slate-400">
                                        <CalendarDays className="w-3.5 h-3.5 shrink-0" /> Member since
                                    </p>
                                    <p className="mt-1 text-[1.1875rem] font-bold text-slate-900 tabular-nums">
                                        {formatDate(entry.memberSince)}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        {entry.sectors.length ? (
                            <div className="flex flex-wrap items-center gap-2 mt-4">
                                {entry.sectors.map((sector) => (
                                    <span
                                        key={sector}
                                        className="inline-flex h-7 items-center rounded-full bg-blue-50 px-3
                                                   text-[1.0625rem] font-bold uppercase tracking-[0.08em]
                                                   text-blue-700"
                                    >
                                        {sector}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {/*
                          * One control, two honest answers.
                          *
                          * For an active membership it opens Messages. For an
                          * applicant it says, in place, that connecting with
                          * members is what activating adds — and then offers the
                          * step this account is actually on. It is not disabled
                          * and it is not hidden: a greyed-out button invites a
                          * click that does nothing, and a hidden one means an
                          * applicant never learns the feature exists.
                          */}
                        {/*
                          * NOT ON YOUR OWN CARD.
                          *
                          * A line rather than a disabled button: a greyed-out
                          * "Message Tharun" with Tharun's own name on it still
                          * invites the click, and a control that cannot work is
                          * better removed than dimmed. Everything else on the
                          * card — the catalogue, the region — is exactly what
                          * another member sees, which is the point of being
                          * able to open it.
                          */}
                        <div className="mt-5">
                            {isSelf ? (
                                <p className="text-[1rem] font-semibold text-slate-500">
                                    This is how other members see your profile.
                                </p>
                            ) : (
                            <button
                                type="button"
                                disabled={opening}
                                onClick={() => (access.membershipActive
                                    ? startConversation()
                                    : setAskedToConnect(true))}
                                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl
                                           bg-blue-600 text-[1.1875rem] font-bold text-white shadow-sm
                                           transition-colors hover:bg-blue-700 disabled:opacity-60"
                            >
                                {!access.membershipActive
                                    ? <Lock className="w-3.5 h-3.5" />
                                    : opening
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <MessageSquare className="w-4 h-4" />}
                                Message {(entry.fullName || '').split(' ').filter(Boolean)[0] || 'member'}
                            </button>
                            )}

                            {openError ? (
                                <p className="mt-2 text-[1rem] font-medium text-amber-700">{openError}</p>
                            ) : null}

                            {askedToConnect && !access.membershipActive ? (
                                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                                    <p className="text-[1rem] font-bold text-slate-900">
                                        {MEMBERS_ONLY_COPY.title}
                                    </p>
                                    <p className="text-[1rem] text-slate-600 mt-1 leading-relaxed">
                                        {MEMBERS_ONLY_COPY.short} {cta.detail}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate(cta.to)}
                                        className="inline-flex items-center gap-1 mt-3 text-[1rem]
                                                   font-bold text-blue-700 hover:underline"
                                    >
                                        {cta.label} →
                                    </button>
                                </div>
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
                                            <p className="text-[1.1875rem] font-semibold text-slate-900 truncate">
                                                {company.businessName}
                                            </p>
                                            {company.businessType ? (
                                                <p className="text-[1.0625rem] text-blue-700 font-medium">
                                                    {company.businessType}
                                                </p>
                                            ) : null}
                                            {/* `location` and `area` are gone: they were the
                                                company's street address in prose, and the
                                                directory does not hand those out. */}
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
                        <div className="grid gap-5 grid-cols-2 lg:grid-cols-3">
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
                                            <p className="text-[1rem] font-semibold text-slate-900 truncate">
                                                {product.name}
                                            </p>
                                            <p className="text-[0.8125rem] text-slate-500 truncate">
                                                {product.category}
                                            </p>
                                            {product.price > 0 ? (
                                                <p className="text-[1rem] font-bold text-blue-700 mt-0.5 tabular-nums">
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
