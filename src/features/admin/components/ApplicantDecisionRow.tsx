import { useState } from 'react';
import { Check, X, Clock, CheckCircle2, XCircle, ArrowRight, Eye } from 'lucide-react';

/**
 * One applicant in a drill-down, with the decision it is waiting for.
 *
 * Shared by the super admin's Hub and the district/state Hub, so a decision is
 * made the same way wherever the file was found. The workflow is not
 * re-implemented here and must not be: WHETHER this admin may act is `canAct`,
 * computed on the server, and acting goes through the tier-agnostic
 * `/applications/:id/approve`.
 *
 * --------------------------------------------- what changed under this screen
 *
 * The question a row answers is HAVE **YOU** DECIDED THIS YET — not "has
 * anybody", which is what it asked briefly and which produced the bug that
 * ended it: a State admin approved two applicants and the District admin's Hub
 * showed both rows as Approved, buttons gone. The District had decided nothing.
 *
 * The three tiers hold three separate verdicts. The badge is YOUR tier's, the
 * buttons are drawn while YOUR verdict is outstanding, and what the other two
 * have recorded is the line underneath.
 *
 * ONLY THE STATE'S APPROVAL ENROLS THE APPLICANT. A Block or District verdict
 * is an endorsement on the record — it changes no membership — and the row says
 * so rather than letting an Approve button imply otherwise.
 *
 * ---------------------------------------------------------------- reading it
 *
 * Colour carries the state — amber is waiting, green is approved, red is
 * rejected — because "Pending" and "Approved" as identical grey text is a list
 * you have to read word by word. The left edge of the row carries the same
 * colour, so a column of rows reads as a status column without any one of them
 * being read.
 *
 * A decided file stays in the list rather than vanishing from it. Two admins
 * can be looking at the same applicant, and one of them is going to refresh
 * into a decision they did not make; a row that disappeared would leave them
 * with no way to find out what happened to it.
 */
export interface DecidableApplicant {
    id?: string;
    _id?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    /** The application's own status: `Pending`, `Approved` or `Rejected`. */
    status?: string;
    /**
     * The server's `classifyForLevel` FOR THIS TIER, and only this tier.
     *
     * `approved` means the tier reading the row approved it. It does NOT mean
     * the applicant is a member — that is `outcome`, which only the State
     * writes. The two were one field once, and a District admin's screen read
     * "Approved" because the State had approved.
     */
    stage?: 'pending' | 'approved' | 'rejected';
    /** The server's answer: has THIS tier's verdict still to be given? */
    canAct?: boolean;
    /**
     * The APPLICATION's outcome — whether this person is a member.
     *
     * Separate from `stage` on purpose. A block admin looking at a pending row
     * needs to tell an applicant nobody has looked at from one the State has
     * already enrolled, and those call for different attention.
     */
    outcome?: string;
    /** Would this tier's approval grant the membership, or only be recorded? */
    decidesOutcome?: boolean;
    /** "State approved", "Block objected" — what the OTHER tiers recorded. */
    endorsementLine?: string;
    otherTierReviews?: { tier: string; label: string; decision: string }[];
    /**
     * Named only when nobody in the region can act - no admin at any tier, so
     * the Super Admin is the only route in. It is not "whose turn it is": on a
     * pending file it is everybody's turn.
     */
    waitingOn?: string;
}

interface Props {
    applicant: DecidableApplicant;
    busy: boolean;
    onDecide: (id: string, approve: boolean, reason?: string) => void | Promise<void>;
    /**
     * Open the four forms this applicant submitted.
     *
     * Offered on EVERY row, decided or not: "what did they actually put on the
     * form" is asked long after the verdict. Omitted, the button is not drawn —
     * a caller with nowhere to show the detail should not advertise it.
     */
    onView?: (applicant: DecidableApplicant) => void;
}

type Tone = 'pending' | 'approved' | 'rejected';

/**
 * The verdict, and what it is called.
 *
 * Driven by `stage` - the server's answer - not by the raw status, so the
 * classification lives in one place. Three entries, because there are three
 * answers; `upstream` ("waiting on a tier below you") and `closed` ("somebody
 * else's rejection") described positions in a relay that no longer exists.
 */
const VERDICT: Record<string, { tone: Tone; label: string }> = {
    pending: { tone: 'pending', label: 'Pending' },
    approved: { tone: 'approved', label: 'Approved' },
    rejected: { tone: 'rejected', label: 'Rejected' },
};

/**
 * A stage from the raw status, for a payload that carries no stage.
 *
 * Matched on text rather than an enum because the collection holds several
 * spellings of every status - `Pending`, `Pending-District`,
 * `pending_block_approval` and bare `approved` all reach this component, and
 * every one of the pending ones means the same thing.
 */
const stageFromStatus = (status: string): keyof typeof VERDICT => {
    const s = String(status || '').toLowerCase();
    if (s.includes('reject')) return 'rejected';
    if (s.includes('approved') && !s.includes('pending')) return 'approved';
    return 'pending';
};

const TONES: Record<Tone, { pill: string; edge: string; icon: typeof Clock }> = {
    pending: { pill: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', edge: 'bg-amber-400', icon: Clock },
    approved: { pill: 'bg-green-50 text-green-700 ring-1 ring-green-200', edge: 'bg-green-500', icon: CheckCircle2 },
    rejected: { pill: 'bg-red-50 text-red-700 ring-1 ring-red-200', edge: 'bg-red-500', icon: XCircle },
};

export default function ApplicantDecisionRow({ applicant, busy, onDecide, onView }: Props) {
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');

    const id = String(applicant.id || applicant._id || '');

    /*
     * `canAct` still wins over the stage, and now they cannot disagree: the
     * server computes both from the same one question. Kept as a belt for a
     * cached payload written by an older build, where a stale `upstream` beside
     * a live Approve button would be the screen contradicting itself.
     */
    const stage = applicant.canAct ? 'pending' : (applicant.stage || stageFromStatus(applicant.status || ''));
    const verdict = VERDICT[stage] || VERDICT.pending;
    const { pill, edge, icon: Icon } = TONES[verdict.tone];

    /*
     * The APPLICATION's outcome, which is not this row's badge.
     *
     * Falls back to `status` for a payload from an older build that has no
     * `outcome` key — under which a decided status WAS the shared verdict, so
     * reading it as the outcome is right for exactly those rows.
     */
    const outcome = String(applicant.outcome || applicant.status || '');
    const enrolled = outcome === 'Approved';
    const declined = outcome === 'Rejected';

    return (
        <div className="relative">
            {/* The status as a colour, down the edge of the row. */}
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${edge}`} aria-hidden="true" />

            <div className="pl-5 pr-5 py-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                            {applicant.fullName || applicant.email || 'Applicant'}
                        </p>
                        <p className="text-[1.1875rem] text-slate-500 mt-0.5 truncate">
                            {applicant.email}{applicant.phone ? ` · ${applicant.phone}` : ''}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <span
                            className={`inline-flex items-center gap-1.5 text-[1.1875rem] font-semibold px-2.5 py-1
                                        rounded-full ${pill}`}
                            /* The whole truth on hover: the badge is this level's
                               verdict, the title is the application's own state. */
                            title={applicant.status || ''}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {verdict.label}
                        </span>

                        {/*
                          * WHETHER THIS PERSON IS A MEMBER, which the badge
                          * beside it does not answer.
                          *
                          * Only drawn when the two differ — a District admin
                          * whose own verdict is outstanding on somebody the
                          * State has already enrolled. Drawn on every row, it
                          * would be a second green pill next to the first
                          * saying the same thing.
                          */}
                        {enrolled && stage !== 'approved' && (
                            <span className="inline-flex items-center gap-1.5 text-[1.1875rem] font-semibold
                                             px-2.5 py-1 rounded-full bg-slate-100 text-slate-600
                                             ring-1 ring-slate-200 whitespace-nowrap"
                                title="The State Admin has approved this application — the member profile exists">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Member
                            </span>
                        )}
                        {declined && stage !== 'rejected' && (
                            <span className="inline-flex items-center gap-1.5 text-[1.1875rem] font-semibold
                                             px-2.5 py-1 rounded-full bg-slate-100 text-slate-600
                                             ring-1 ring-slate-200 whitespace-nowrap"
                                title="The State Admin has rejected this application">
                                <XCircle className="w-3.5 h-3.5" /> Not admitted
                            </span>
                        )}

                        {/*
                          The one case left worth a sentence: nobody at any tier
                          covers this region, so it will sit here until the Super
                          Admin clears it or somebody is appointed.
                        */}
                        {!applicant.canAct && applicant.waitingOn && stage === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[1.1875rem] text-slate-500 whitespace-nowrap">
                                <ArrowRight className="w-3.5 h-3.5" />
                                No admin in this region — with the Super Admin
                            </span>
                        )}

                        {/*
                          * READ IT BEFORE DECIDING IT.
                          *
                          * Before the Approve button, because that is the order
                          * the work happens in, and outside the `canAct` guard
                          * because a decided application still has four forms
                          * behind it.
                          */}
                        {!!onView && (
                            <button
                                type="button"
                                onClick={() => onView(applicant)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border
                                           border-slate-300 text-slate-700 text-[1.1875rem] font-semibold
                                           hover:bg-slate-50 transition-colors"
                            >
                                <Eye className="w-3.5 h-3.5" /> View
                            </button>
                        )}

                        {applicant.canAct && (
                            <>
                                <button
                                    disabled={busy}
                                    onClick={() => onDecide(id, true)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-green-600
                                               text-white text-[1.1875rem] font-semibold hover:bg-green-700
                                               disabled:opacity-50 transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                    disabled={busy}
                                    onClick={() => { setRejecting(v => !v); setReason(''); }}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border
                                               border-red-200 text-red-600 text-[1.1875rem] font-semibold hover:bg-red-50
                                               disabled:opacity-50 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" /> Reject
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/*
                  * WHAT THE OTHER TWO TIERS SAID, and what your own verdict
                  * will do.
                  *
                  * Under the badge rather than beside it: it is context for the
                  * decision, not the decision. A District admin deciding an
                  * applicant their Block has already objected to should see
                  * that before they click, and a Block admin should not be left
                  * thinking their Approve button grants a membership.
                  */}
                {(applicant.endorsementLine || (applicant.canAct && applicant.decidesOutcome === false)) && (
                    <p className="mt-2 text-[1.1875rem] text-slate-500">
                        {applicant.endorsementLine}
                        {applicant.endorsementLine && applicant.canAct && applicant.decidesOutcome === false && ' · '}
                        {applicant.canAct && applicant.decidesOutcome === false
                            && 'Your decision is recorded for the file; the State Admin grants the membership'}
                    </p>
                )}

                {rejecting && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <input
                            autoFocus
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Why is this being rejected?"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-[1.25rem]
                                       focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                        <button
                            disabled={busy}
                            onClick={async () => { await onDecide(id, false, reason); setRejecting(false); setReason(''); }}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white text-[1.25rem] font-medium
                                       hover:bg-red-700 disabled:opacity-50"
                        >
                            Confirm rejection
                        </button>
                        <button
                            onClick={() => { setRejecting(false); setReason(''); }}
                            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-[1.25rem] hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
