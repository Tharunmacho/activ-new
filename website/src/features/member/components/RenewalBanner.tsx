import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, RefreshCw } from 'lucide-react';
import { RENEW_PATH, renewalDate, renewalMessage, type RenewalInfo } from '@/features/member/useRenewal';

/**
 * THE RENEW BUTTON, wherever a member might look for it.
 *
 * Drawn only when the server says the member CAN renew (`renewal.canRenew`):
 * expired, or inside the last 30 days. Anywhere else it renders nothing, so a
 * screen can mount it unconditionally. The button goes to the one payment
 * screen; the server prices the plan and decides where the new year starts.
 *
 *   expired  -> amber alert card, "Renew membership"
 *   due soon -> blue card, "Renew now", with the days left
 */
export default function RenewalBanner({ renewal, className = '' }: { renewal: RenewalInfo | null; className?: string }) {
    if (!renewal || !renewal.canRenew) return null;

    const expired = renewal.state === 'expired';
    const days = renewal.daysLeft !== null ? Math.max(0, renewal.daysLeft) : null;

    return (
        <section
            role={expired ? 'alert' : 'status'}
            className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 text-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.55)] ${
                expired
                    ? 'bg-gradient-to-br from-[#0b1f4d] via-[#12306f] to-[#1e3a8a]'
                    : 'bg-gradient-to-br from-[#0b1f4d] to-blue-600'} ${className}`}
        >
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <span className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl ${
                    expired ? 'bg-amber-400 text-amber-950' : 'bg-white/15 text-white ring-1 ring-white/25'}`}>
                    {expired ? <AlertTriangle className="h-6 w-6" /> : <CalendarClock className="h-6 w-6" />}
                </span>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-200">
                        {expired ? 'Membership expired' : 'Renewal open'}
                    </p>
                    <p className="mt-1 text-ui-body sm:text-[1.5rem] font-extrabold leading-tight">
                        {expired
                            ? 'Renew your membership'
                            : days === 0 ? 'Your membership ends today' : `${days} ${days === 1 ? 'day' : 'days'} left on your membership`}
                    </p>
                    <p className="mt-1 text-base sm:text-ui-caption leading-relaxed text-blue-100">
                        {renewalMessage(renewal)}
                    </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <Link
                        to={RENEW_PATH}
                        className={`inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 text-ui-caption font-extrabold shadow-sm transition hover:brightness-105 ${
                            expired ? 'bg-amber-400 text-amber-950' : 'bg-white text-blue-800'}`}
                    >
                        <RefreshCw className="h-5 w-5" />
                        {expired ? 'Renew membership' : 'Renew now'}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    {renewal.expiresAt ? (
                        <span className="text-center sm:text-right text-sm font-medium text-blue-200">
                            {expired ? 'Ended' : 'Ends'} {renewalDate(renewal.expiresAt)}
                        </span>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
