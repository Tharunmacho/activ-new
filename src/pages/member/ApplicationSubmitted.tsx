/**
 * Application Submitted — the website's version of the mobile screen.
 *
 * Ported from `frontend/src/screens/application/ApplicationSubmittedScreen.tsx`:
 * a success mark, the statement, an "Approval Progress" card carrying a
 * "Stage 1 of 3" pill and the numbered review rail, the notification notice, and
 * the two actions in mobile's order — View Application Status, then Go to
 * Dashboard.
 *
 * WHAT THIS SCREEN IS FOR, and why it is dressed the way it is. It is the end
 * of a long form — four steps, a declaration, a signature — and the only thing
 * the member receives in return. It was a tick and four white cards on a white
 * page, which reads as a form that has stopped rather than as a thing achieved.
 * So there is a hero: a deep blue field, the tick DRAWN rather than shown, and
 * the reference on the hero itself where it can be photographed. Everything
 * below it is the same information in the same order as before.
 *
 * The presentation lives in `index.css` under the `as-` prefix — keyframes in a
 * JSX <style> tag are re-parsed on every render, and there they also inherit the
 * one reduced-motion block rather than repeating it per animation.
 *
 * The reference and the stage states are read from the application itself, not
 * from localStorage. The screen previously showed
 * `localStorage.getItem('applicationId') || 'ACTV2024001'` — a hardcoded
 * placeholder that every member saw whenever that key was missing, which is
 * always, because nothing writes it any more.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import {
    Bell, Loader2, Copy, Check, CalendarDays, MapPin, BadgeCheck,
    ArrowRight, LayoutDashboard, ShieldCheck, Mail,
} from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import { deriveApprovalFlags } from '@/services/activApi';
import { formatApplicationRef } from '@/lib/applicationRef';
import { dashboardPathFor, applicantKindLabel } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';
import { PALETTE } from '@/features/member/memberScreenKit';

import { CARD_TITLE, PAGE_TITLE } from '@/components/layout/appTypography';
/** "5 Sept 2026". Empty for a date that is missing or will not parse. */
const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * What the association does next, in the member's terms.
 *
 * This screen answered "it is in" and stopped, which leaves the one question a
 * person actually has at this moment — "so what happens now, and when?" — to be
 * guessed at. The three steps below say the same thing the rail does, as
 * process rather than as state, because a rail of pending nodes tells you where
 * a file is and nothing about what is being done to it.
 *
 * No dates are promised. The association reviews on its own schedule, and a
 * screen that invents "within 7 days" is a screen that starts lying on day
 * eight.
 *
 * THE FIRST STEP USED TO SAY "Three tiers review it… each has to approve before
 * it moves on", which is how the workflow worked and is now the opposite of how
 * it works: the three admins receive the application together and the first one
 * to decide decides it. Left as it was, a member approved by their block admin
 * on day one would spend the next month waiting for two reviews that were never
 * going to happen.
 */
const WHAT_NEXT = [
    {
        icon: ShieldCheck,
        title: 'Your local admins review it',
        detail: 'It goes to the Block, District and State admin for your area at the '
            + 'same time. Any one of them can approve it.',
    },
    {
        icon: Bell,
        title: 'You hear as soon as it is decided',
        detail: 'A notification arrives the moment it is approved or sent back — '
            + 'nothing here needs watching in the meantime.',
    },
    {
        icon: BadgeCheck,
        title: 'Then you pay and you are in',
        detail: 'Once it is approved, your membership payment unlocks and your '
            + 'profile goes live in the directory.',
    },
];

/**
 * The review, and then the payment.
 *
 * Three rows — Block, District, State — became two. The three were the relay's
 * rungs; there is one review now, and the step after it that the member
 * actually has to do something about is paying.
 */
const STAGE_LABELS = [
    { key: 'review', label: 'Application Review' },
    { key: 'payment', label: 'Membership Payment' },
];

export default function ApplicationSubmitted() {
    const navigate = useNavigate();
    const { isPaid } = useMembershipGate();
    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        setApplication(await getUserApplication().catch(() => null));
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const flags = deriveApprovalFlags(application);
    const appRef = formatApplicationRef(application);
    const dashboard = dashboardPathFor(isPaid === true);

    /**
     * Which stage the file is actually at.
     *
     * A member can come back to this URL later, so it is looked up rather than
     * hardcoded: telling someone whose application has been approved that they
     * are at stage 1 is worse than doing the small amount of work to check.
     *
     * The review is cleared once, by whichever admin got to it, and the payment
     * step is cleared by the member paying — which this screen does not know
     * about, so it never shows as done here.
     */
    const cleared = flags.isApproved ? 1 : 0;
    const currentStage = Math.min(cleared + 1, STAGE_LABELS.length);

    const stages = STAGE_LABELS.map((stage, i) => ({
        key: stage.key,
        label: stage.label,
        caption: flags.isRejected && i === 0
            ? 'Sent back'
            : i < cleared ? 'Approved' : i === cleared ? 'In progress' : 'Waiting',
        done: i < cleared,
        active: i === cleared,
    }));

    const copyRef = () => {
        if (!appRef.full) return;
        navigator.clipboard?.writeText(appRef.full)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
            })
            .catch(() => { /* clipboard blocked; the tooltip still carries it */ });
    };

    if (loading) {
        return (
            <MemberPageShell title="Application Submitted" width="wide" sidebar={false} backTo={dashboard}>
                <div className="flex flex-col items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: PALETTE.primary }} />
                </div>
            </MemberPageShell>
        );
    }

    return (
        /*
          No `subtitle` on the shell. The shell header and the hero were printing
          the same sentence one above the other, which is the clearest possible
          signal that a screen was assembled rather than designed. The header is
          chrome — a title and the way back; the hero is the message.
        */
        <MemberPageShell
            title="Application Submitted"
            width="wide"
            sidebar={false}
            backTo={dashboard}
        >
            <div className="w-full pb-4">

                {/* ------------------------------------------------- the hero */}
                <section className="as-hero as-rise rounded-3xl px-6 py-12 sm:px-10 sm:py-14 text-center">
                    <div className="relative">
                        <SuccessBadge />

                        <h1 className={`font-display ${PAGE_TITLE} text-white as-rise`}
                            style={{ ['--as-delay' as string]: '0.08s' }}>
                            Application Submitted
                        </h1>

                        <p className="mt-3 text-[1.1875rem] sm:text-[1.1875rem] text-blue-100/90 max-w-xl mx-auto as-rise"
                           style={{ ['--as-delay' as string]: '0.14s' }}>
                            Your membership application is in and moving through review.
                        </p>

                        {/*
                          THE REFERENCE, ON THE HERO.

                          It used to be one of four equal cells in a strip below.
                          It is not equal: it is the thing a member is asked for
                          on every phone call and the thing they screenshot this
                          page for. It sits where a photograph of the screen will
                          definitely catch it, and it still copies in one click.
                        */}
                        {appRef.short ? (
                            <div className="mt-7 flex justify-center as-rise"
                                 style={{ ['--as-delay' as string]: '0.2s' }}>
                                <div className="inline-flex items-center gap-3 rounded-full
                                                border border-white/25 bg-white/10 backdrop-blur
                                                pl-4 pr-2 py-2">
                                    <span className="text-[0.75rem] font-bold uppercase
                                                     tracking-[0.1em] text-blue-100/80">
                                        Reference
                                    </span>
                                    <span className="text-[1.1875rem] font-semibold tracking-wide text-white tabular-nums"
                                          title={appRef.full}>
                                        {appRef.short}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={copyRef}
                                        title={`Copy full ID: ${appRef.full}`}
                                        aria-label="Copy full application ID"
                                        className="rounded-full p-1.5 text-white/80 transition-colors
                                                   hover:bg-white/20 hover:text-white
                                                   focus:outline-none focus-visible:ring-2
                                                   focus-visible:ring-white/70"
                                    >
                                        {copied
                                            ? <Check className="w-4 h-4" />
                                            : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        {/* Announced rather than shown — the icon swap is silent. */}
                        <span className="sr-only" role="status" aria-live="polite">
                            {copied ? 'Application reference copied' : ''}
                        </span>
                    </div>
                </section>

                {/*
                  THE FACTS, ON A CARD THAT OVERLAPS THE HERO.

                  Date, member type and the region reviewing it — what a member
                  quotes alongside the reference, and what the status screen
                  prints in this same order. Pulled up over the hero's lower edge
                  so the two read as one object: a confirmation with its details
                  attached, rather than a banner and then a table.
                */}
                <div className="px-2 sm:px-6 -mt-8 relative">
                    <div className="as-rise as-lift rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25)]
                                    border grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x"
                         style={{ borderColor: PALETTE.border, ['--as-delay' as string]: '0.26s' }}>
                        <FactCell
                            icon={<CalendarDays className="w-3.5 h-3.5" />}
                            label="Submitted"
                            value={formatDate(application?.submittedAt || application?.createdAt) || '—'}
                        />
                        <FactCell
                            icon={<BadgeCheck className="w-3.5 h-3.5" />}
                            label="Member Type"
                            value={applicantKindLabel(application) || '—'}
                        />
                        <FactCell
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            label="Reviewed In"
                            value={[application?.block, application?.district].filter(Boolean).join(', ') || '—'}
                            title={[application?.block, application?.district, application?.state]
                                .filter(Boolean).join(', ')}
                        />
                    </div>
                </div>

                {/*
                  TWO COLUMNS THAT BOTH CARRY THEIR WEIGHT.

                  The right-hand column used to hold two buttons and then roughly
                  400px of bare white down to the fold, because a 2:1 grid was
                  being used to put a pair of buttons beside a three-item list.
                  The progress rail and what-happens-next are the two halves of
                  the same answer, so they sit side by side, and the actions go
                  under the rail where a member arrives at them having read it.
                */}
                <div className="grid gap-6 lg:grid-cols-2 items-start mt-8 px-2 sm:px-6">

                    <div className="space-y-6 as-rise" style={{ ['--as-delay' as string]: '0.32s' }}>
                        <Panel>
                            <PanelHeader
                                title="Approval Progress"
                                pill={`Stage ${currentStage} of ${STAGE_LABELS.length}`}
                            />
                            <ProgressRail stages={stages} />
                        </Panel>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => navigate('/member/application-status')}
                                className="group w-full h-12 rounded-xl font-display font-bold text-white
                                           flex items-center justify-center gap-2
                                           shadow-[0_8px_20px_-8px_rgba(30,80,230,0.7)]
                                           transition-all hover:-translate-y-0.5
                                           hover:shadow-[0_12px_26px_-8px_rgba(30,80,230,0.75)]
                                           focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                style={{ background: `linear-gradient(135deg, ${PALETTE.primary}, #2F6BFF)` }}
                            >
                                View Application Status
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate(dashboard)}
                                className="w-full h-12 rounded-xl bg-white border font-display font-bold
                                           flex items-center justify-center gap-2 transition-colors
                                           hover:bg-slate-50 focus:outline-none focus-visible:ring-2"
                                style={{ borderColor: PALETTE.border, color: PALETTE.ink }}
                            >
                                <LayoutDashboard className="w-4 h-4" style={{ color: PALETTE.muted }} />
                                Go to Dashboard
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6 as-rise" style={{ ['--as-delay' as string]: '0.38s' }}>
                        <Panel>
                            <PanelHeader title="What happens next" />

                            <ol className="space-y-5 mt-1">
                                {WHAT_NEXT.map((step, i) => {
                                    const Icon = step.icon;
                                    return (
                                        <li key={step.title} className="flex gap-3.5">
                                            <span className="w-9 h-9 rounded-xl flex items-center justify-center
                                                             shrink-0"
                                                  style={{ backgroundColor: '#EEF2FF', color: PALETTE.primary }}>
                                                <Icon className="w-[1.125rem] h-[1.125rem]" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="font-display text-[1.1875rem] font-bold leading-tight"
                                                   style={{ color: PALETTE.ink }}>
                                                    <span className="tabular-nums" style={{ color: PALETTE.muted }}>
                                                        {i + 1}.{' '}
                                                    </span>
                                                    {step.title}
                                                </p>
                                                <p className="text-[1rem] mt-1 leading-relaxed"
                                                   style={{ color: PALETTE.muted }}>
                                                    {step.detail}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </Panel>

                        <Notice icon={<Bell className="w-4 h-4" />}>
                            You&apos;ll be notified as each stage is completed.
                        </Notice>

                        {/*
                          Where to go with a question — including the reference,
                          because "quote your application id" is the first thing
                          anyone will be asked and it is on this screen already.
                        */}
                        <Notice icon={<Mail className="w-4 h-4" />} tone={PALETTE.muted} soft="#F8FAFC">
                            Questions? Write to{' '}
                            <a
                                href={`mailto:support@activ.org.in?subject=${
                                    encodeURIComponent(`Application ${appRef.short || ''}`)}`}
                                className="font-semibold underline"
                                style={{ color: PALETTE.primary }}
                            >
                                support@activ.org.in
                            </a>
                            {appRef.short ? ` and quote ${appRef.short}.` : '.'}
                        </Notice>
                    </div>
                </div>
            </div>
        </MemberPageShell>
    );
}

/**
 * The tick, drawn.
 *
 * A white disc on the blue hero rather than the kit's green one: green on this
 * field fights it, and the confirmation is already carried by the word above.
 * The two haloes are `aria-hidden` decoration — the `<title>` on the SVG is what
 * a screen reader is given.
 */
const SuccessBadge = () => (
    <div className="relative h-28 flex items-center justify-center mb-5">
        <span aria-hidden className="as-mark-ring absolute w-24 h-24 rounded-full bg-white/25" />
        <span aria-hidden className="as-mark-ring as-mark-ring--slow absolute w-24 h-24 rounded-full bg-white/20" />
        <span className="relative w-[5.5rem] h-[5.5rem] rounded-full bg-white flex items-center
                         justify-center shadow-[0_14px_34px_-10px_rgba(2,16,54,0.65)]">
            <svg viewBox="0 0 52 52" className="w-14 h-14" role="img" aria-label="Submitted">
                <circle
                    className="as-check-circle"
                    cx="26" cy="26" r="24"
                    fill="none"
                    stroke={PALETTE.success}
                    strokeWidth="2.5"
                    opacity="0.35"
                />
                <path
                    className="as-check-tick"
                    d="M15 27.5 L22.5 35 L38 19"
                    fill="none"
                    stroke={PALETTE.success}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </span>
    </div>
);

/** A white surface. Local to this screen so the shared kit stays as it is. */
const Panel = ({ children }: { children: ReactNode }) => (
    <div className="as-lift rounded-2xl bg-white border p-5 sm:p-6
                    shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.2)]"
         style={{ borderColor: PALETTE.border }}>
        {children}
    </div>
);

const PanelHeader = ({ title, pill }: { title: string; pill?: string }) => (
    <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className={`font-display ${CARD_TITLE}`} style={{ color: PALETTE.ink }}>{title}</h2>
        {pill ? (
            <span className="shrink-0 text-[0.8125rem] font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#EEF2FF', color: PALETTE.primary }}>
                {pill}
            </span>
        ) : null}
    </div>
);

/**
 * The three review tiers as a rail.
 *
 * The connector between two nodes is drawn in the colour of the step ABOVE it,
 * so the line itself fills in as the file advances and the rail can be read at a
 * glance without comparing three captions. The active node keeps a slow halo:
 * this is the one screen where "nothing is happening yet" is the correct state
 * and needs to look alive rather than stalled.
 */
const ProgressRail = ({ stages }: {
    stages: { key: string; label: string; caption: string; done: boolean; active: boolean }[];
}) => (
    <ol className="relative">
        {stages.map((stage, i) => {
            const last = i === stages.length - 1;
            const tone = stage.done ? PALETTE.success : stage.active ? PALETTE.primary : '#CBD5E1';
            return (
                <li key={stage.key} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {!last ? (
                        <span
                            aria-hidden
                            className="absolute left-[0.9375rem] top-8 bottom-1 w-0.5 rounded-full"
                            style={{ backgroundColor: stage.done ? PALETTE.success : '#E2E8F0' }}
                        />
                    ) : null}

                    <span
                        className={`relative z-10 w-[1.875rem] h-[1.875rem] rounded-full shrink-0
                                    flex items-center justify-center text-[1.0625rem] font-bold
                                    ${stage.active ? 'as-pulse' : ''}`}
                        style={{
                            backgroundColor: stage.done || stage.active ? tone : '#F1F5F9',
                            color: stage.done || stage.active ? '#FFFFFF' : PALETTE.muted,
                        }}
                    >
                        {stage.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                    </span>

                    <div className="min-w-0 pt-0.5">
                        <p className="font-display text-[1.1875rem] font-bold leading-tight"
                           style={{ color: stage.done || stage.active ? PALETTE.ink : PALETTE.muted }}>
                            {stage.label}
                        </p>
                        <p className="text-[1.0625rem] mt-0.5 font-semibold" style={{ color: tone }}>
                            {stage.caption}
                        </p>
                    </div>
                </li>
            );
        })}
    </ol>
);

const Notice = ({ icon, children, tone = PALETTE.primary, soft = '#EEF2FF' }: {
    icon: ReactNode;
    children: ReactNode;
    tone?: string;
    soft?: string;
}) => (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-[1rem]"
         style={{ backgroundColor: soft, color: tone }}>
        <span className="shrink-0 mt-0.5">{icon}</span>
        <p className="leading-relaxed">{children}</p>
    </div>
);

/**
 * One fact on the card under the hero.
 *
 * Same shape as `StripCell` on the Application Status screen — the two screens
 * print the same facts and a member moving between them should not have to
 * re-find where each one lives.
 */
const FactCell = ({ icon, label, value, title }: {
    icon: ReactNode;
    label: string;
    value: string;
    title?: string;
}) => (
    <div className="px-5 py-4 min-w-0">
        <div className="flex items-center gap-1.5" style={{ color: PALETTE.muted }}>
            <span className="shrink-0">{icon}</span>
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.06em] truncate">{label}</p>
        </div>
        <p className="font-display text-[1.1875rem] font-bold truncate mt-1"
           style={{ color: PALETTE.ink }}
           title={title || value}>
            {value}
        </p>
    </div>
);
