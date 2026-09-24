import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ChevronRight, Clock, Download, FileBadge, FileText, Lock, ReceiptText, ShieldCheck } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { SectionCard, RowsSkeleton, MembershipGate } from '@/features/member/components/MemberUI';
import { useProfile } from '@/contexts/ProfileContext';
import { getMyApplication } from '@/services/activApi';
import useMembershipGate from '@/features/member/useMembershipGate';
import {
    deriveMemberAccess, membershipCta, formatApplicationRef,
} from '@/features/member/memberAccess';

/**
 * Documents — the same screen before and after payment, saying different things.
 *
 * "Documents" was an upcoming feature with no screen behind it, which meant the
 * two certificates an active membership issues were reachable only from the
 * paid dashboard and were invisible to everyone else. That is backwards: the
 * certificate is the most concrete thing activation produces, and an applicant
 * deciding whether to activate is exactly who should be able to see that it
 * exists.
 *
 * So both kinds of member get the same list. What differs is whether a row is a
 * link or a locked row with the reason on it — never a disabled button, which
 * invites a click that does nothing.
 *
 * There is no document upload here and none is invented. The application forms
 * are records of what the member submitted, held on the application itself; the
 * certificates are issued by the server against an active membership and
 * refused with a 403 otherwise (see `CertificatePage`).
 */

interface CertificateRow {
    key: string;
    label: string;
    detail: string;
    to: string;
    icon: typeof FileBadge;
}

const CERTIFICATES: CertificateRow[] = [
    {
        key: 'membership',
        label: 'Membership Certificate',
        detail: 'Proof of your membership of the association, ready to print or save as PDF.',
        to: '/member/certificate/membership',
        icon: FileBadge,
    },
    {
        key: 'tax-exemption',
        label: 'Tax Exemption Certificate',
        detail: 'Issued against an active membership for use with your filings.',
        to: '/member/certificate/tax-exemption',
        icon: ShieldCheck,
    },
    {
        key: 'receipt',
        label: 'Payment Receipt',
        detail: 'What you paid for your membership, with the transaction reference.',
        to: '/member/payment-success?view=receipt',
        icon: ReceiptText,
    },
];

/**
 * The three sections of the application, in the order the member filled them.
 *
 * `Financial Details` was the third, pointing at `?step=3`. Financial
 * information is asked per company in the Business Creation Account now, so it
 * is not a step of the application at all — and the link would have opened the
 * declaration, which is what step 3 is today.
 */
const APPLICATION_FORMS = [
    { label: 'Personal Details', to: '/member/profile?step=1' },
    { label: 'Business Details', to: '/member/profile?step=2' },
    { label: 'Declaration', to: '/member/profile?step=3' },
];

const formatDate = (value?: string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function MemberDocuments() {
    const { profileCompletion, formsCompleted } = useProfile();
    const { isPaid, isResolved } = useMembershipGate();

    const [application, setApplication] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        getMyApplication()
            .then((app) => { if (!cancelled) setApplication(app); })
            .catch(() => { /* no application yet is the normal case for a new account */ })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, []);

    const access = useMemo(
        () => deriveMemberAccess(profileCompletion, application, isPaid),
        [profileCompletion, application, isPaid],
    );

    const cta = useMemo(() => membershipCta(access), [access]);
    const appRef = useMemo(() => formatApplicationRef(application), [application]);

    const submittedAt = formatDate(application?.createdAt || application?.submittedAt);

    if (loading || !isResolved) {
        return (
            <MemberPageShell title="Documents" subtitle="Your records and certificates" width="standard">
                <RowsSkeleton rows={4} />
            </MemberPageShell>
        );
    }

    return (
        <MemberPageShell title="Documents" subtitle="Your records and certificates" width="standard">
            <div className="space-y-5">
                {/* ---------------------------------------------- certificates */}
                <SectionCard
                    title="Official Documents"
                    subtitle={access.membershipActive
                        ? 'Issued against your active membership'
                        : 'Issued the moment your membership is activated'}
                    icon={<FileBadge className="w-5 h-5" />}
                >
                    <div className="space-y-3">
                        {CERTIFICATES.map(({ key, label, detail, to, icon: Icon }) => (
                            access.membershipActive ? (
                                <Link
                                    key={key}
                                    to={to}
                                    className="flex items-center justify-between gap-3 rounded-2xl border
                                               border-slate-200 bg-white p-5 transition-all
                                               hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                                >
                                    <span className="flex items-center gap-3 min-w-0">
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center
                                                         rounded-xl bg-blue-50 text-blue-600">
                                            <Icon className="h-6 w-6" />
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate text-[1.1875rem] font-semibold text-slate-900">
                                                {label}
                                            </span>
                                            <span className="mt-0.5 block text-[1.0625rem] text-slate-500">
                                                {detail}
                                            </span>
                                            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full
                                                             bg-emerald-50 px-2.5 py-1 text-[1.0625rem]
                                                             font-bold text-emerald-700">
                                                <BadgeCheck className="h-4 w-4" /> Issued
                                            </span>
                                        </span>
                                    </span>
                                    <Download className="w-5 h-5 text-blue-500 shrink-0" />
                                </Link>
                            ) : (
                                /*
                                 * A locked row, not a disabled link.
                                 *
                                 * The server refuses this certificate with a 403
                                 * until the membership is active, so a link here
                                 * would lead to an error page. The row says what
                                 * the document is and what it waits on, and the
                                 * single call to action below is the way out.
                                 */
                                <div
                                    key={key}
                                    className="flex items-start gap-3 rounded-2xl border border-dashed
                                               border-slate-300 bg-slate-50 p-5"
                                >
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center
                                                     rounded-xl border border-slate-200 bg-white text-slate-400">
                                        <Lock className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[1.1875rem] font-semibold text-slate-700">
                                            {label}
                                        </span>
                                        <span className="mt-1 block text-[1.0625rem] leading-snug text-slate-500">
                                            {detail}
                                        </span>
                                    </span>
                                </div>
                            )
                        ))}
                    </div>
                </SectionCard>

                {/* ---------------------------------------------- application record */}
                <SectionCard
                    title="Application Record"
                    subtitle={appRef.full
                        ? `Application ${appRef.full}${submittedAt ? ` · submitted ${submittedAt}` : ''}`
                        : 'The forms that make up your membership application'}
                    icon={<FileText className="w-5 h-5" />}
                    actionTo={access.applicationSubmitted ? '/member/application-status' : '/member/profile'}
                    actionLabel={access.applicationSubmitted ? 'Track' : 'Continue'}
                >
                    <ul className="divide-y divide-slate-100 -my-1">
                        {APPLICATION_FORMS.map(({ label, to }) => {
                            const done = (formsCompleted || []).includes(label);

                            return (
                                <li key={label} className="flex items-center gap-3 py-3">
                                    <span className={`w-9 h-9 rounded-full flex items-center justify-center
                                                      shrink-0 ${
                                        done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        {done ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[1.1875rem] font-semibold text-slate-900">
                                            {label}
                                        </span>
                                        <span className="block text-[1.0625rem] text-slate-400 mt-0.5">
                                            {done ? 'Submitted' : 'Not submitted yet'}
                                        </span>
                                    </span>

                                    {/*
                                      * Only an unsubmitted form is a link.
                                      *
                                      * Submitting locks the forms, so a link on a
                                      * finished one leads to a read-only screen the
                                      * member cannot act on. Their own record is on
                                      * My Profile, which is where the rail sends them.
                                      */}
                                    {done ? (
                                        <Link
                                            to="/member/profile-view"
                                            className="shrink-0 text-[1.0625rem] font-semibold text-blue-600
                                                       hover:underline"
                                        >
                                            View
                                        </Link>
                                    ) : (
                                        <Link
                                            to={to}
                                            className="shrink-0 inline-flex items-center gap-0.5 text-[1.0625rem]
                                                       font-semibold text-blue-600 hover:underline"
                                        >
                                            Complete <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </SectionCard>

                {/* ---------------------------------------------- the way out */}
                {!access.membershipActive ? (
                    <MembershipGate
                        icon={<FileBadge className="w-5 h-5" />}
                        title="Your certificates are issued on activation"
                        detail={
                            'The membership and tax exemption certificates are generated against your '
                            + 'own record the moment your membership becomes active — there is nothing '
                            + 'further to apply for.'
                        }
                        cta={cta}
                    />
                ) : null}
            </div>
        </MemberPageShell>
    );
}
