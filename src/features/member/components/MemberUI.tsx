import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Lock, Inbox } from 'lucide-react';

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
        <section className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
            <header className="flex items-start gap-3 px-5 lg:px-6 pt-5 pb-4">
                {icon ? (
                    <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center
                                     justify-center shrink-0">
                        {icon}
                    </span>
                ) : null}

                <div className="min-w-0 flex-1">
                    <h2 className="text-base lg:text-lg font-bold text-slate-900 leading-tight">{title}</h2>
                    {subtitle ? <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p> : null}
                </div>

                {action ? (
                    <div className="shrink-0">{action}</div>
                ) : actionTo ? (
                    <Link
                        to={actionTo}
                        className="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-semibold
                                   text-blue-600 hover:text-blue-700 hover:underline"
                    >
                        {actionLabel || 'See all'}
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                ) : null}
            </header>

            <div className="px-5 lg:px-6 pb-5 lg:pb-6">{children}</div>
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
            <p className="text-sm font-semibold text-slate-700">{title}</p>
            <p className="text-[13px] text-slate-500 mt-1 max-w-sm mx-auto">{detail}</p>
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
                    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
                    <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{explanation}</p>
                    <Link
                        to={upgradeTo}
                        className="inline-flex items-center gap-1 mt-3 text-[13px] font-semibold
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

    const body = (
        <>
            <div className="flex items-center gap-2 text-slate-500">
                {icon ? <span className="w-4 h-4 shrink-0">{icon}</span> : null}
                <span className="text-[11px] font-semibold uppercase tracking-wide truncate">{label}</span>
            </div>
            <p className={`text-2xl font-bold mt-2 tabular-nums ${TONES[tone]}`}>{value}</p>
            {hint ? <p className="text-[11px] text-slate-400 mt-0.5 truncate">{hint}</p> : null}
        </>
    );

    const className = 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-w-0';

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
        <div className="space-y-3" aria-hidden>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
        </div>
    );
}
