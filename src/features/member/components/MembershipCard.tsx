import { BadgeCheck, CalendarDays, CalendarClock, MapPin, IdCard, FileText, User } from 'lucide-react';
import {
    BIZ_CARD, BIZ_CARD_TITLE, BIZ_BADGE, BIZ_DETAIL_LABEL, BIZ_DETAIL_VALUE,
} from '@/components/layout/surface';

/**
 * The member's card — the object, not a coloured panel with two facts on it.
 *
 * ==========================================================================
 * THE SAME CARD AS EVERY OTHER ON THE PAGE — WHITE, ON THE TINTED SHEET
 * ==========================================================================
 *
 * Same surface as `SectionCard`: white, `slate-200` hairline, the two-stop
 * shadow from `BIZ_CARD`. Same type, too — the holder's name takes the 22px
 * extrabold the card headings take, and the six values are 16px bold, so this
 * card and the four under it read as one set rather than as a badge sitting on
 * top of a dashboard.
 *
 * IT IMPORTS THOSE TOKENS RATHER THAN RESTATING THEM. Every one of them was a
 * hand-copied class string with a comment saying which token it matched, which
 * is a promise the compiler cannot keep: the Business form's badge later grew a
 * fixed `h-7` to stop two pills sitting two pixels apart, and this card — the
 * one a member screenshots — kept the old spelling and the old misalignment.
 * A copy annotated with the name of the thing it copies is still a copy.
 *
 * WHAT STILL MARKS IT AS THE MEMBER'S OWN, without a different background:
 * the blue band across the top, the blue plate carrying their photo or
 * initials, and the status pill. Colour identifies; it is not the ground.
 *
 * THREE EARLIER ATTEMPTS, so none of them comes back:
 *
 *   - A full-bleed NAVY slab with a gold hairline. The only dark surface in the
 *     member area, so it read as a banner dropped in from somewhere else — and
 *     a thin amber bar across the top of a dark box is the shape of an ALERT,
 *     sitting above a membership in perfectly good standing.
 *   - A plain white card on a WHITE page. Right about belonging, but at that
 *     point nothing on the page had anything to stand on. The fix was the page
 *     (`SHEET` on the member shell's `<main>`), not the card.
 *   - A `blue-50` TINTED card. It solved "the member's card should stand out"
 *     while the page was still white; once the page became the tinted sheet,
 *     the tinted card was simply the one panel that did not match.
 *
 * ==========================================================================
 * SIX FACTS, THREE COLUMNS, TWO ROWS — NO RAGGED EDGE
 * ==========================================================================
 *
 *   Member ID   ·  Member since  ·  Valid until
 *   Block       ·  District      ·  State
 *
 * The region used to be its own section with its own heading, three cells wide
 * in a four-column grid — so it left a column of nothing beside State, under a
 * heading the labels below already supplied. Six cells over three columns
 * divide exactly, which is what makes the block read as a table rather than as
 * a scatter.
 *
 * The membership TYPE moved up beside the plan name ("Aspirant Membership ·
 * Annual"). It describes the membership rather than being a separate fact, and
 * it was the cell making six into seven.
 *
 * NOTHING IS INVENTED. Every field is omitted when the record has nothing for
 * it — no placeholder id, no fallback date, no "—" standing in for a region
 * nobody captured. A card with four fields on it is a card about a member whose
 * record holds four fields; a card with placeholders is a lie, and this is the
 * screen a member screenshots.
 */

export interface MembershipCardProps {
    name: string;
    /** "Company Member" / "Aspirant Member" — what kind of membership this is. */
    planName: string;
    /** `annual`, `lifetime`, … as stored. Blank and `none` are both "not set". */
    membershipType?: string;
    memberId?: string;
    memberSinceLabel?: string;
    /**
     * WHEN IT LAPSES, already formatted. Empty means "nothing to say" — either
     * a lifetime membership or a record with no expiry on it.
     *
     * A card that gives a start date and no end date reads as permanent, and an
     * annual membership is not. This is the one fact a member checks a card for
     * after the number.
     */
    validUntilLabel?: string;
    /** True for a lifetime membership: prints "Lifetime" where the date goes. */
    lifetime?: boolean;
    /**
     * THE REAL STORED STATUS — `active`, `expired`, `pending`, …
     *
     * The band used to print "ACTIVE" unconditionally, which is a card telling
     * an expired member their membership is in good standing. Defaults to
     * `active` only because every caller today renders this behind a paid gate;
     * pass the record's own value.
     */
    status?: string;
    /** The three region levels, SEPARATELY. See the note on the field grid. */
    block?: string;
    district?: string;
    state?: string;
    photoUrl?: string;
    onCertificate?: () => void;
    onProfile?: () => void;
}

/**
 * How each stored status looks and reads on the band.
 *
 * A table rather than a ternary, because "not active" is three different things
 * to a member — lapsed, awaiting payment, cancelled — and one grey "Inactive"
 * pill for all three tells them nothing about what to do next.
 *
 * Tinted pills with a ring, not solid fills: on a white card a solid emerald
 * lozenge is the loudest thing on the page, and the loudest thing on a
 * membership card should be the member's name.
 */
const STATUS_META: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    expired: { label: 'Expired', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
    pending: { label: 'Payment pending', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    approved: { label: 'Payment pending', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
};

/** One printed fact. Renders nothing at all when there is nothing to print. */
function Field({
    icon, label, value, mono = false,
}: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    /** Identifiers and dates get tabular figures so they cannot jitter. */
    mono?: boolean;
}) {
    if (!value) return null;
    return (
        <div className="min-w-0">
            {/* The Business Account form's key-and-value pair, which is exactly
                what these are — imported, not restated. */}
            <p className={`flex items-center gap-1.5 ${BIZ_DETAIL_LABEL}`}>
                <span className="shrink-0 text-slate-400">{icon}</span>
                <span className="truncate">{label}</span>
            </p>
            <p className={`mt-1 break-words ${BIZ_DETAIL_VALUE} ${mono ? 'tabular-nums' : ''}`}>
                {value}
            </p>
        </div>
    );
}

export default function MembershipCard({
    name,
    planName,
    membershipType = '',
    memberId = '',
    memberSinceLabel = '',
    validUntilLabel = '',
    lifetime = false,
    status = 'active',
    block = '',
    district = '',
    state = '',
    photoUrl = '',
    onCertificate,
    onProfile,
}: MembershipCardProps) {
    const initials = (name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'M';

    /*
     * `none` is a real stored value meaning "not set", and printing it renders
     * the word "None" on the card as though it were a tier.
     */
    const typeLabel = membershipType && membershipType.toLowerCase() !== 'none'
        ? membershipType
        : '';

    const validity = lifetime ? 'Lifetime' : validUntilLabel;

    /**
     * The plan and the term on one line — "Aspirant Membership · Annual".
     *
     * Capitalised HERE rather than with a `capitalize` class, because the class
     * only reaches the first letter of each word and this string is built from
     * two sources: `planName` arrives already in title case, `membershipType`
     * arrives as the stored lower-case enum. It rendered as
     * "Membership · annual" — one half of a sentence shouting and the other
     * half mumbling.
     */
    const subtitle = [planName, typeLabel]
        .map(part => String(part || '').trim())
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' · ');

    const hasFields = !!(memberId || memberSinceLabel || validity || block || district || state);
    const hasActions = !!(onCertificate || onProfile);

    const badge = STATUS_META[String(status || '').toLowerCase()] || STATUS_META.active;

    return (
        <section
            aria-label="Your membership card"
            /* The Business Account form's card — what every other panel on this
               page is wearing. */
            className={`overflow-hidden ${BIZ_CARD}`}
        >
            {/* ----------------------------------------------------- band */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3
                            border-b border-blue-100 bg-blue-50">
                <p className={`truncate ${BIZ_DETAIL_LABEL} text-blue-700`}>
                    ACTIV Membership
                </p>
                {/* The RECORD's status, not a constant. A card that prints
                    "ACTIVE" over a lapsed membership is the one thing on this
                    screen a member would act on and be wrong about. */}
                <span className={`shrink-0 ${BIZ_BADGE} ${badge.cls}`}>
                    <BadgeCheck className="w-3.5 h-3.5" /> {badge.label}
                </span>
            </div>

            <div className="px-5 sm:px-6 py-5">
                {/* ------------------------------------------------ holder */}
                <div className="flex items-center gap-4">
                    {/*
                      The photograph, or the initials in its place. A fixed
                      square either way, so the name beside it starts at the same
                      x whether or not a member has uploaded one — the layout
                      does not shift when the picture 404s.

                      THE ONE SOLID BLOCK OF COLOUR. `blue-600` on the tinted
                      ground, ringed in white so it reads as set INTO the card
                      rather than painted on it — the same relationship the icon
                      plates have with the white cards below.
                    */}
                    <span className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-blue-600
                                     flex items-center justify-center">
                        {photoUrl ? (
                            <img
                                src={photoUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                /* A dead URL leaves the plate, not the browser's
                                   torn-page glyph mid-layout. */
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : (
                            <span className="text-[1.5625rem] font-extrabold text-white">{initials}</span>
                        )}
                    </span>

                    <div className="min-w-0">
                        {/*
                          `break-words`, not `truncate`. A long name is the whole
                          point of the line it is on, and clipping it with an
                          ellipsis on a 390px screen makes the card belong to
                          somebody whose name cannot be read.
                        */}
                        <h2 className={`leading-tight break-words ${BIZ_CARD_TITLE}`}>
                            {name}
                        </h2>
                        {subtitle && (
                            <p className="mt-1 text-[1.1875rem] font-bold text-blue-600">{subtitle}</p>
                        )}
                    </div>
                </div>

                {/* ------------------------------------------------ fields */}
                {hasFields && (
                    <div className="mt-5 pt-5 border-t border-slate-200
                                    grid gap-x-8 gap-y-5 grid-cols-2 sm:grid-cols-3">
                        <Field
                            icon={<IdCard className="w-3.5 h-3.5" />}
                            label="Member ID"
                            value={memberId}
                            mono
                        />
                        <Field
                            icon={<CalendarDays className="w-3.5 h-3.5" />}
                            label="Member since"
                            value={memberSinceLabel}
                            mono
                        />
                        {/* The end date sits beside the start date, where a
                            reader compares the two without hunting. */}
                        <Field
                            icon={<CalendarClock className="w-3.5 h-3.5" />}
                            label={lifetime ? 'Validity' : 'Valid until'}
                            value={validity}
                            mono
                        />
                        <Field
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label="Block"
                            value={block}
                        />
                        <Field
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label="District"
                            value={district}
                        />
                        <Field
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label="State"
                            value={state}
                        />
                    </div>
                )}
            </div>

            {/* --------------------------------------------------- actions */}
            {hasActions && (
                /*
                 * `flex-col` on a phone, a row from `sm`. Two half-width buttons
                 * on a 390px screen give each about 150px, which is not enough
                 * for "Membership certificate" without wrapping to two lines at
                 * different heights. Full width each, stacked, is the honest
                 * answer at that size.
                 */
                <div className="flex flex-col sm:flex-row gap-2.5 px-5 sm:px-6 py-4
                                border-t border-slate-200 bg-slate-50">
                    {onCertificate && (
                        <button
                            type="button"
                            onClick={onCertificate}
                            className="inline-flex items-center justify-center gap-2 rounded-xl
                                       bg-blue-600 px-4 py-2.5 text-[1.1875rem] font-bold text-white
                                       shadow-sm transition-colors hover:bg-blue-700"
                        >
                            <FileText className="w-4 h-4" /> Membership certificate
                        </button>
                    )}
                    {onProfile && (
                        <button
                            type="button"
                            onClick={onProfile}
                            className="inline-flex items-center justify-center gap-2 rounded-xl
                                       border border-slate-200 bg-white px-4 py-2.5 text-[1.1875rem]
                                       font-bold text-slate-700 shadow-sm transition-colors
                                       hover:border-slate-300 hover:bg-slate-50"
                        >
                            <User className="w-4 h-4" /> View my profile
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
