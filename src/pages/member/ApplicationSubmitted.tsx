/**
 * Application Submitted — the website's version of the mobile screen.
 *
 * Ported from `frontend/src/screens/application/ApplicationSubmittedScreen.tsx`:
 * a pulsing success mark, the statement, an "Approval Progress" card carrying a
 * "Stage 1 of 3" pill and the numbered review rail, the notification notice, and
 * the two actions in mobile's order — View Application Status, then Go to
 * Dashboard.
 *
 * What changes for the web is the frame. This is a confirmation: a mark, a
 * sentence, one card and one action. It is a single line of reading whatever the
 * window is, so it keeps mobile's column and centres it rather than stretching a
 * three-stage list across a monitor because the room is there.
 *
 * The reference and the stage states are read from the application itself, not
 * from localStorage. The screen previously showed
 * `localStorage.getItem('applicationId') || 'ACTV2024001'` — a hardcoded
 * placeholder that every member saw whenever that key was missing, which is
 * always, because nothing writes it any more.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { Bell, Loader2, Copy, Check } from 'lucide-react';
import { getUserApplication } from '@/services/applicationApi';
import { deriveApprovalFlags } from '@/services/activApi';
import { formatApplicationRef } from '@/lib/applicationRef';
import { dashboardPathFor } from '@/features/member/memberAccess';
import useMembershipGate from '@/features/member/useMembershipGate';
import {
    PALETTE, SuccessMark, ScreenTitle, ScreenSubtitle, KitCard, KitCardHeader,
    StageRail, NoticeRow, PrimaryAction, GhostAction, type KitStage,
} from '@/features/member/memberScreenKit';

/** Mobile's three review stages, with its captions. */
const STAGE_LABELS = [
    { key: 'block', label: 'Block Admin Review' },
    { key: 'district', label: 'District Admin Review' },
    { key: 'state', label: 'State Admin Review' },
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
     * Mobile hardcodes "Stage 1 of 3" because it only ever reaches this screen
     * the moment an application is created. That is true here too — but a member
     * can come back to this URL later, and telling someone whose district review
     * is under way that they are at stage 1 is worse than doing the small amount
     * of work to look.
     */
    const cleared = [flags.isBlockApproved, flags.isDistrictApproved, flags.isStateApproved]
        .filter(Boolean).length;
    const currentStage = Math.min(cleared + 1, STAGE_LABELS.length);

    const stages: KitStage[] = STAGE_LABELS.map((stage, i) => {
        const done = i < cleared;
        const active = i === cleared;
        return {
            key: stage.key,
            label: stage.label,
            caption: done ? 'Approved' : active ? 'In progress' : 'Waiting',
            done,
            active,
        };
    });

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
        <MemberPageShell
            title="Application Submitted"
            subtitle="Your application is in and moving through review"
            width="wide"
            sidebar={false}
            backTo={dashboard}
        >
            <div className="mx-auto w-full max-w-[1400px]">
                <SuccessMark />

                <ScreenTitle>Application Submitted</ScreenTitle>
                <ScreenSubtitle>
                    Your membership application is in and moving through review.
                </ScreenSubtitle>

                <div className="grid gap-6 lg:grid-cols-3 items-start mt-2">

                <div className="lg:col-span-2 space-y-4">
                {/*
                  * The reference, on the screen that creates it.
                  *
                  * This is the one moment a member is most likely to write it
                  * down, so it is shown here rather than only on the status
                  * screen — same short form as everywhere else, with the full
                  * `_id` one click away for support.
                  */}
                {appRef.short ? (
                    <KitCard>
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.06em]"
                                   style={{ color: PALETTE.muted }}>
                                    Application Reference
                                </p>
                                <p className="font-display text-lg font-extrabold mt-0.5"
                                   style={{ color: PALETTE.ink }} title={appRef.full}>
                                    {appRef.short}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={copyRef}
                                title={`Copy full ID: ${appRef.full}`}
                                aria-label="Copy full application ID"
                                className="shrink-0 h-9 px-3 rounded-lg border text-xs font-semibold
                                           flex items-center gap-1.5 hover:bg-slate-50 transition-colors"
                                style={{ borderColor: PALETTE.border, color: PALETTE.muted }}
                            >
                                {copied
                                    ? <><Check className="w-3.5 h-3.5" style={{ color: PALETTE.success }} /> Copied</>
                                    : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                            </button>
                        </div>
                    </KitCard>
                ) : null}

                <KitCard>
                    <KitCardHeader
                        title="Approval Progress"
                        pill={`Stage ${currentStage} of ${STAGE_LABELS.length}`}
                    />
                    <StageRail stages={stages} />
                </KitCard>

                <NoticeRow icon={<Bell className="w-4 h-4" />}>
                    You&apos;ll be notified as each stage is completed.
                </NoticeRow>
                </div>

                {/*
                  * The two ways on, beside the progress rather than under it.
                  *
                  * On a narrow screen they stack in mobile's order — status
                  * first, dashboard second. On a wide one they sit level with
                  * the card they follow from, so the member is not scrolling
                  * past a three-item list to find the button.
                  */}
                <div className="lg:sticky lg:top-6">
                    <PrimaryAction onClick={() => navigate('/member/application-status')}>
                        View Application Status
                    </PrimaryAction>
                    <GhostAction onClick={() => navigate(dashboard)}>
                        Go to Dashboard
                    </GhostAction>
                </div>

                </div>
            </div>
        </MemberPageShell>
    );
}
