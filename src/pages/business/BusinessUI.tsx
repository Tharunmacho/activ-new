import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { CARD_SUBTITLE, CARD_TITLE } from '@/components/layout/appTypography';
/**
 * The business area's shared surface primitives.
 *
 * Every one of the twelve business screens used to hand-roll its own card
 * (`border-0 shadow-lg rounded-xl`, `bg-white rounded-lg shadow-sm`,
 * `rounded-2xl border-0 shadow-lg`…), its own section heading and its own empty
 * state, so nothing quite matched anything else.
 *
 * These follow the flat style of `pages/cms/components/CmsUI.tsx`, which is the
 * cleanest system in the repo: a white surface, a `slate-200` hairline, a soft
 * shadow, and exactly one accent colour. `CmsUI` is not imported directly
 * because it hard-codes the CMS's self-scoped dark theme (`#172033`, `dark:`
 * variants); the business area is light-only.
 */

/**
 * What to call a company whose name has not been filled in.
 *
 * The business profile has no required fields — a member starts it, gets as far
 * as the logo, and comes back for the rest — so a nameless company is a normal
 * intermediate state rather than a fault. Rendered bare it is an empty heading
 * and a blank row in the switcher, which reads as data that failed to load.
 *
 * One helper rather than `|| 'Company'` written differently at each of the
 * dozen places a company name appears: the member should meet the same word
 * every time, not "Company" in the directory and "Business" on the dashboard.
 * Same answer the event list gives to the same question — see REGION-TARGETED
 * EVENTS in CLAUDE.md.
 */
export const companyName = (company: { businessName?: string | null } | null | undefined): string =>
    (company?.businessName || '').trim() || 'Untitled company';

export function Card({
    children,
    className = '',
    padded = true,
    /**
     * An anchor target, for a form long enough to need a section rail.
     *
     * `scroll-mt-6` goes with it: an `href="#id"` jump aligns the element to the
     * very top of the scroll container, so without the margin the card's heading
     * sits flush against the edge and reads as clipped.
     */
    id,
}: {
    children: ReactNode;
    className?: string;
    padded?: boolean;
    id?: string;
}) {
    return (
        <section
            id={id}
            className={`bg-white border border-slate-200 rounded-2xl scroll-mt-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)] ${padded ? 'p-6' : ''} ${className}`}
        >
            {children}
        </section>
    );
}

export function SectionHeading({
    title,
    description,
    icon: Icon,
    actions,
}: {
    title: string;
    description?: string;
    icon?: LucideIcon;
    actions?: ReactNode;
}) {
    return (
        <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
                <h2 className={`${CARD_TITLE} text-slate-900 flex items-center gap-2`}>
                    {Icon ? <Icon className="w-5 h-5 text-blue-600 shrink-0" /> : null}
                    {title}
                </h2>
                {description ? (
                    <p className={`${CARD_SUBTITLE} text-slate-500 mt-1`}>{description}</p>
                ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
    );
}

/**
 * One figure in a stat row.
 *
 * `unit` is the small caps label under the value — the CMS dashboard's idiom.
 * The value is solid `slate-900` rather than the gradient clip-text the business
 * dashboards used: a two-stop gradient between two shades of the same blue
 * renders as a flat fill anyway, at the cost of making the number unselectable
 * in some browsers.
 */
export function StatTile({
    label,
    value,
    unit,
    icon: Icon,
}: {
    label: string;
    value: string | number;
    unit?: string;
    icon?: LucideIcon;
}) {
    return (
        /*
         * Sized to sit two-up on a phone.
         *
         * `p-6` and `text-[2.125rem]` were written for a card with a whole row to
         * itself, which is what these got below `sm` — four tall boxes each
         * carrying one number, so the four figures the page opens with took a
         * full screen of scrolling to read. Two columns is the arrangement the
         * member dashboard already uses at that width, and it needs the padding
         * and the figure to step down with it. Both are back to full size from
         * `sm`, where the card is wide again.
         *
         * `min-w-0` and `break-words` on the label: at ~170px "Products Listed"
         * is two lines, and without them it pushes the card's own border out.
         */
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 min-w-0 transition-colors hover:border-slate-300 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]">
            <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-[1.1875rem] sm:text-[1.25rem] font-semibold text-slate-500 leading-snug break-words min-w-0">
                    {label}
                </span>
                {Icon ? (
                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Icon className="w-[1.125rem] h-[1.125rem] text-blue-600" />
                    </span>
                ) : null}
            </div>
            <div className="text-[2.125rem] sm:text-[2.5625rem] font-extrabold tracking-tight text-slate-900 tabular-nums">{value}</div>
            {unit ? (
                <p className="text-[1rem] sm:text-[1.1875rem] text-slate-500 font-bold mt-1.5 uppercase tracking-wider
                              leading-snug break-words">{unit}</p>
            ) : null}
        </div>
    );
}

/**
 * A responsive form grid.
 *
 * Two columns from `md` up, so a ten-digit phone number stops being an
 * 850px-wide input. Pass `full` on a child wrapper for fields that genuinely
 * want the whole row (a description textarea, a file picker).
 */
export function FieldGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${className}`}>{children}</div>;
}

export function Field({
    label,
    hint,
    required,
    full,
    children,
}: {
    label: string;
    hint?: string;
    required?: boolean;
    full?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={full ? 'md:col-span-2' : undefined}>
            <label className="block text-[1.25rem] font-bold text-slate-800 mb-2">
                {label}
                {required ? <span className="text-red-500 ml-0.5">*</span> : null}
            </label>
            {children}
            {hint ? <p className="text-[1.1875rem] text-slate-500 mt-2">{hint}</p> : null}
        </div>
    );
}

export function EmptyState({
    icon: Icon,
    title,
    hint,
    action,
}: {
    icon: LucideIcon;
    title: string;
    hint?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <span className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-blue-600" />
            </span>
            <p className="text-[1.5625rem] font-extrabold tracking-tight text-slate-900 mb-1.5">{title}</p>
            {hint ? <p className="text-[1.25rem] text-slate-500 max-w-md">{hint}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            <p className="text-[1.25rem] font-medium text-slate-500">{label}</p>
        </div>
    );
}

/** A small status chip. `tone` maps to the palette used across the business area. */
export function Chip({
    children,
    tone = 'blue',
    icon: Icon,
}: {
    children: ReactNode;
    tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate';
    icon?: LucideIcon;
}) {
    const tones: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700',
        green: 'bg-green-100 text-green-700',
        amber: 'bg-amber-100 text-amber-700',
        red: 'bg-red-100 text-red-700',
        slate: 'bg-slate-100 text-slate-700',
    };
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[1.1875rem] font-bold ${tones[tone]}`}
        >
            {Icon ? <Icon className="w-4 h-4" /> : null}
            {children}
        </span>
    );
}
