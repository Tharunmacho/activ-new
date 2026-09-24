import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lock, Inbox } from 'lucide-react';

import { CARD_SUBTITLE, CARD_TITLE } from '@/components/layout/appTypography';
/**
 * The pieces every paid-member screen is built from.
 *
 * The dashboard, the updates feed, the events list and the directory are four
 * screens showing four different things in the same three shapes: a titled
 * section with an optional "see all", a card, and an empty state. Written once
 * here so those three shapes cannot drift apart — the alternative is what the
 * member area had, where each screen invented its own heading size and its own
 * way of saying "nothing here yet".
 *
 * Palette is the site's blue on slate. There is no purple in the member area
 * any more, and nothing here reintroduces it.
 */

// ---------------------------------------------------------------- section

export function SectionCard({
    title,
    subtitle,
    icon,
    action,
    actionTo,
    actionLabel,
    children,
    className = '',
}: {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    /** A custom action. Use `actionTo` for the ordinary "see all" link. */
    action?: ReactNode;
    actionTo?: string;
    actionLabel?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        /*
          * THE ADMIN AREA'S CARD, to the pixel — `ADMIN_CARD` in
          * `features/admin/components/AdminUI.tsx`.
          *
          * Same radius, same hairline, same two-layer shadow: a tight contact
          * edge plus a wide soft lift. This carried its own flatter pair, so a
          * member panel and a super-admin panel were two different surfaces for
          * the same idea, and the member half read as the less finished one.
          *
          */
        /*
          * A COLUMN, so a card told to fill its grid row actually does.
          *
          * `h-full` on the section stretches the box; without `flex flex-col`
          * and a growing body, the contents still sit at their natural height
          * and an empty-state illustration ends up pinned to the top of a tall
          * card with a band of nothing under it. The body grows instead, so the
          * "No updates yet" block stays centred in whatever height the row
          * gives the card.
          */
        <section className={`flex flex-col bg-white rounded-2xl border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] ${className}`}>
            <header className="flex items-start gap-3 px-5 lg:px-6 pt-5 pb-4">
                {icon ? (
                    <span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center
                                     justify-center shrink-0">
                        {icon}
                    </span>
                ) : null}

                <div className="min-w-0 flex-1">
                    <h2 className={`${CARD_TITLE} text-slate-900`}>{title}</h2>
                    {subtitle ? <p className={`${CARD_SUBTITLE} text-slate-500 mt-0.5`}>{subtitle}</p> : null}
                </div>

                {action ? (
                    <div className="shrink-0">{action}</div>
                ) : actionTo ? (
                    <Link
                        to={actionTo}
                        className="shrink-0 inline-flex items-center gap-0.5 text-[1.0625rem] font-semibold
                                   text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        {actionLabel || 'See all'}
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                ) : null}
            </header>

            <div className="flex-1 flex flex-col justify-center px-5 lg:px-6 pb-5 lg:pb-6">
                {children}
            </div>
        </section>
    );
}

// ---------------------------------------------------------------- empty state

/**
 * Nothing here — said in a way that distinguishes the two reasons for it.
 *
 * "No events yet" and "no events matching that filter" look identical to a
 * component and mean opposite things to a member: the first is the association
 * having published nothing, the second is their own search. `detail` is where
 * that distinction is drawn, and every caller passes one.
 */
export function EmptyState({
    icon,
    title,
    detail,
    action,
}: {
    icon?: ReactNode;
    title: string;
    detail: string;
    action?: ReactNode;
}) {
    return (
        <div className="py-10 px-4 text-center">
            <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto mb-3
                             flex items-center justify-center">
                {icon || <Inbox className="w-6 h-6" />}
            </span>
            <p className="text-[1.1875rem] font-semibold text-slate-700">{title}</p>
            <p className="text-[1.0625rem] text-slate-500 mt-1 max-w-sm mx-auto">{detail}</p>
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

// ---------------------------------------------------------------- plan gate

/**
 * A feature this membership does not include (ENT-001).
 *
 * Shown rather than hidden. A member who simply cannot find the catalogue
 * concludes the site is broken and asks support; one who is told it belongs to
 * a Company membership knows where they stand and what it would take. The
 * requirement asks for "hide OR explain", and explaining is the better half of
 * that choice everywhere there is something worth saying.
 *
 * Never rendered as a disabled button. A greyed-out control invites a click
 * that does nothing, which is the worst of both.
 */
export function PlanLockedCard({
    title,
    explanation,
    upgradeTo = '/payment/membership-plans',
}: {
    title: string;
    explanation: string;
    upgradeTo?: string;
}) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
            <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400
                                 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                    <h3 className={`${CARD_TITLE} text-slate-800`}>{title}</h3>
                    <p className="text-[1.0625rem] text-slate-600 mt-1 leading-relaxed">{explanation}</p>
                    <Link
                        to={upgradeTo}
                        className="inline-flex items-center gap-1 mt-3 text-[1.0625rem] font-semibold
                                   text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        Compare memberships <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- stat tile

/**
 * One number and what it counts.
 *
 * `tone` marks a figure that is a problem rather than a fact — four lines out
 * of stock is not the same kind of number as forty products. Colour is the only
 * thing that distinguishes them at a glance on a row of tiles.
 */
export function StatTile({
    label,
    value,
    hint,
    icon,
    tone = 'neutral',
    to,
}: {
    label: string;
    value: string | number;
    hint?: string;
    icon?: ReactNode;
    tone?: 'neutral' | 'warn' | 'good';
    to?: string;
}) {
    const TONES = {
        neutral: 'text-slate-900',
        warn: 'text-amber-600',
        good: 'text-emerald-600',
    } as const;

    /*
     * THE LABEL WRAPS; IT DOES NOT TRUNCATE.
     *
     * Both lines carried `truncate`, and these tiles sit two-up on a phone —
     * about 150px of text width each. "Upcoming events" became "UPCOMING EV…"
     * and "Needs restock" became "NEEDS RESTO…", so on the one screen size
     * where the tile is smallest, the thing the number MEANS was the part
     * thrown away. `items-start` because a two-line label must not drag the
     * icon down to its own centre.
     *
     * `break-words` as well as wrapping: a single long word — a region name, a
     * product line — has no space to break at and would otherwise push the
     * tile's own border out from the inside.
     */
    const body = (
        <>
            <div className="flex items-start gap-2 text-slate-500">
                {icon ? <span className="w-4 h-4 shrink-0 mt-px">{icon}</span> : null}
                <span className="text-[1.0625rem] font-semibold uppercase tracking-wide
                                 leading-snug break-words min-w-0">{label}</span>
            </div>
            <p className={`text-[1.75rem] font-bold mt-2 tabular-nums ${TONES[tone]}`}>{value}</p>
            {hint ? <p className="text-[1.0625rem] text-slate-400 mt-0.5 leading-snug break-words">{hint}</p> : null}
        </>
    );

    /* `p-4` on a phone — 20px of padding each side of a ~150px tile is a third
       of it spent on air. */
    const className = 'bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)] min-w-0';

    return to ? (
        <Link to={to} className={`${className} block hover:border-blue-400 transition-colors`}>{body}</Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

// ---------------------------------------------------------------- skeleton

/** A quiet placeholder while a section loads, sized like the rows it replaces. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        /*
         * WHITE CARDS, NOT GREY BARS.
         *
         * These were `bg-slate-100` on what used to be a white page. The
         * member area's page is `#f3f6fb` with a dot field now, and slate-100
         * on that is very nearly invisible — a screen that was loading looked
         * like a screen that had rendered nothing, which is exactly how the
         * Documents screen was reported. They are cards with a bar inside
         * them now: the same shape as what is coming, so the page does not
         * jump when it arrives.
         */
        <div className="space-y-4" aria-hidden>
            {Array.from({ length: rows }).map((_, i) => (
                <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5
                               shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.18)]"
                >
                    <div className="h-4 w-1/3 rounded bg-slate-200" />
                    <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------- membership gate

/**
 * A feature that opens when the membership does — shown, explained, and sold.
 *
 * The difference between this and `PlanLockedCard` above is which question it
 * answers. That one says "your membership does not include this"; this one says
 * "your membership is not active yet, and here is the one step that changes
 * that". Only the second has a button, because only the second has something
 * the member can do about it right now.
 *
 * `cta` comes from `membershipCta(access)` so the button names the step this
 * account is actually on. Offering "Activate membership" to someone whose
 * application has not been reviewed points at a payment screen that will refuse
 * them, and a member who is refused once stops pressing the button.
 */
export function MembershipGate({
    icon,
    title,
    detail,
    cta,
    children,
}: {
    icon?: ReactNode;
    title: string;
    detail: string;
    cta: { label: string; to: string; detail: string };
    /** What the member CAN do meanwhile. Rendered under the call to action. */
    children?: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 lg:p-8 shadow-[0_1px_3px_rgba(16,24,40,0.10),0_6px_16px_-6px_rgba(16,24,40,0.12)]">
            <div className="flex items-start gap-4">
                <span className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center
                                 justify-center shrink-0 shadow-sm">
                    {icon || <Lock className="w-5 h-5" />}
                </span>

                <div className="min-w-0 flex-1">
                    <h3 className={`${CARD_TITLE} text-slate-900`}>{title}</h3>
                    <p className="text-[1.1875rem] text-slate-600 mt-2 leading-relaxed max-w-2xl">{detail}</p>

                    {cta.detail ? (
                        <p className="text-[1.0625rem] text-blue-700 font-medium mt-3">{cta.detail}</p>
                    ) : null}

                    <Link
                        to={cta.to}
                        className="inline-flex items-center gap-1.5 mt-4 bg-blue-600 hover:bg-blue-700
                                   text-white text-[1.1875rem] font-bold px-5 py-2.5 rounded-xl shadow-sm
                                   transition-colors"
                    >
                        {cta.label} <ChevronRight className="w-4 h-4" />
                    </Link>

                    {children ? <div className="mt-6">{children}</div> : null}
                </div>
            </div>
        </div>
    );
}

/**
 * One line of what an active membership adds, for the list under a gate.
 *
 * Deliberately not a link and not a button. Everything named here is either
 * already open to the member — in which case it is in the rail — or it is the
 * thing the gate above is selling. A control here would be a third answer, and
 * the member area has had enough of those.
 */
export function GateBenefit({
    icon,
    title,
    detail,
    open = false,
}: {
    icon: ReactNode;
    title: string;
    detail: string;
    /** Already available before payment — marked, so the list is honest. */
    open?: boolean;
}) {
    return (
        <li className="flex items-start gap-3">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                open ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-blue-100 text-blue-600'
            }`}>
                {icon}
            </span>
            <span className="min-w-0">
                <span className="flex items-center gap-2">
                    <span className="text-[1.1875rem] font-bold text-slate-900 leading-tight">{title}</span>
                    {open ? (
                        <span className="text-[1.0625rem] font-bold uppercase tracking-wide text-emerald-700
                                         bg-emerald-100 rounded-full px-1.5 py-0.5 shrink-0">
                            Open now
                        </span>
                    ) : null}
                </span>
                <span className="block text-[1.0625rem] text-slate-500 mt-0.5 leading-snug">{detail}</span>
            </span>
        </li>
    );
}
