/**
 * The shared look of the member journey screens.
 *
 * `ApplicationStatus`, `ApplicationSubmitted` and the payment screens are one
 * flow, and on mobile they share a palette and a small set of shapes — the
 * success mark, the numbered stage rail, the notice row, the two button weights.
 * Porting each screen separately would have meant transcribing those four times
 * and letting them drift, which is the same failure the member/admin dashboards
 * had before they were unified.
 *
 * Colours are the mobile constants, unchanged, so the two clients render the
 * same flow rather than two designs that merely resemble each other.
 */
import type { ReactNode } from 'react';
import { Check, Hourglass, ArrowRight } from 'lucide-react';

/** `frontend/src/screens/**` — BG, PRIMARY, SUCCESS, INK, MUTED. */
export const PALETTE = {
    bg: '#F0F4F8',
    primary: '#1E50E6',
    success: '#16A34A',
    ink: '#0F172A',
    muted: '#64748B',
    border: '#E8EEF6',
} as const;

/**
 * The success mark, with the two rings mobile pulses behind it.
 *
 * The rings are decorative and `aria-hidden`; the tick carries the meaning. On
 * mobile they animate on a spring — here they ping, which is the same idea at
 * the fidelity CSS gives for free.
 */
export const SuccessMark = ({ tone = PALETTE.success }: { tone?: string }) => (
    <div className="relative h-[150px] flex items-center justify-center mb-6">
        <span
            aria-hidden
            className="absolute w-24 h-24 rounded-full opacity-20 animate-ping"
            style={{ backgroundColor: tone, animationDuration: '2.4s' }}
        />
        <span
            aria-hidden
            className="absolute w-28 h-28 rounded-full opacity-10"
            style={{ backgroundColor: tone }}
        />
        <span
            className="relative w-[92px] h-[92px] rounded-full flex items-center justify-center shadow-xl"
            style={{ backgroundColor: tone, boxShadow: `0 10px 28px -6px ${tone}66` }}
        >
            <Check className="w-11 h-11 text-white" strokeWidth={3} />
        </span>
    </div>
);

export const ScreenTitle = ({ children }: { children: ReactNode }) => (
    <h1 className="font-display text-[26px] lg:text-3xl font-extrabold tracking-tight text-center"
        style={{ color: PALETTE.ink }}>
        {children}
    </h1>
);

export const ScreenSubtitle = ({ children }: { children: ReactNode }) => (
    <p className="text-sm text-center mt-2 mb-7 leading-relaxed max-w-md mx-auto"
       style={{ color: PALETTE.muted }}>
        {children}
    </p>
);

/** The white card every section on these screens sits in. */
export const KitCard = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
    <div className={`rounded-2xl bg-white border p-5 shadow-sm ${className}`}
         style={{ borderColor: PALETTE.border }}>
        {children}
    </div>
);

export const KitCardHeader = ({ title, pill }: { title: string; pill?: string }) => (
    <div className="flex items-center justify-between gap-3 mb-4">
        <p className="font-display text-[15px] font-bold" style={{ color: PALETTE.ink }}>{title}</p>
        {pill ? (
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                  style={{ backgroundColor: '#E0E7FF', color: PALETTE.primary }}>
                {pill}
            </span>
        ) : null}
    </div>
);

export interface KitStage {
    key: string;
    label: string;
    caption: string;
    /** The stage currently being worked; drawn with the hourglass. */
    active?: boolean;
    /** Behind us; drawn with a tick. */
    done?: boolean;
}

/**
 * The numbered rail from `ApplicationSubmittedScreen`.
 *
 * A stage shows its number until something has happened to it — an hourglass
 * while it is being worked, a tick once it is behind us. The number is the
 * useful default: before review starts, "1, 2, 3" tells the applicant how long
 * the road is, which is the question that screen exists to answer.
 */
export const StageRail = ({ stages }: { stages: KitStage[] }) => (
    <div>
        {stages.map((stage, i) => {
            const isLast = i === stages.length - 1;
            const tone = stage.done ? PALETTE.success : stage.active ? PALETTE.primary : '#CBD5E1';
            return (
                <div key={stage.key} className="flex">
                    <div className="w-[26px] shrink-0 flex flex-col items-center">
                        <span
                            className="w-[26px] h-[26px] rounded-full flex items-center justify-center
                                       text-[11px] font-extrabold text-white shrink-0"
                            style={{ backgroundColor: tone }}
                        >
                            {stage.done ? <Check className="w-3.5 h-3.5" strokeWidth={3} />
                                : stage.active ? <Hourglass className="w-3 h-3" />
                                    : i + 1}
                        </span>
                        {!isLast ? (
                            <span className="w-0.5 flex-1 my-1"
                                  style={{ backgroundColor: stage.done ? PALETTE.success : '#E2E8F0' }} />
                        ) : null}
                    </div>

                    <div className="flex-1 min-w-0 ml-3 pb-4">
                        <p className="text-sm font-bold leading-tight"
                           style={{ color: stage.active ? PALETTE.primary : PALETTE.ink }}>
                            {stage.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: PALETTE.muted }}>{stage.caption}</p>
                    </div>
                </div>
            );
        })}
    </div>
);

/** The tinted one-line note mobile puts under a card. */
export const NoticeRow = ({ icon, children, tone = PALETTE.primary, soft = '#EEF2FF' }: {
    icon: ReactNode; children: ReactNode; tone?: string; soft?: string;
}) => (
    <div className="rounded-xl flex items-start gap-2.5 px-3.5 py-3 mt-4"
         style={{ backgroundColor: soft }}>
        <span className="shrink-0 mt-px" style={{ color: tone }}>{icon}</span>
        <p className="text-xs leading-relaxed" style={{ color: tone }}>{children}</p>
    </div>
);

export const PrimaryAction = ({ onClick, children, tone = PALETTE.primary, disabled = false }: {
    onClick: () => void; children: ReactNode; tone?: string; disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full h-12 rounded-xl text-white font-bold text-[15px] flex items-center
                   justify-center gap-2 transition-opacity hover:opacity-90
                   disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ backgroundColor: tone }}
    >
        {children}
        <ArrowRight className="w-4 h-4" />
    </button>
);

export const GhostAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
    <button
        type="button"
        onClick={onClick}
        className="w-full h-12 rounded-xl font-semibold text-[15px] bg-white border
                   transition-colors hover:bg-slate-50 mt-3"
        style={{ borderColor: PALETTE.border, color: PALETTE.ink }}
    >
        {children}
    </button>
);
