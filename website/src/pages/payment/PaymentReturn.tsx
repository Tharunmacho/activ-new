import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getPaymentOrder, resolvePaymentReturn } from '@/services/paymentApi';
import { isMemberSession } from '@/lib/session';
import MemberPageShell from '../member/MemberPageShell';

/**
 * Instamojo returns here with browser-supplied payment identifiers. The server
 * verifies the stored order through the signed webhook or Instamojo's API.
 * Keep polling that verification endpoint until the payment is confirmed.
 */
const POLL_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 30000;

type Outcome = 'checking' | 'paid' | 'unconfirmed' | 'failed' | 'unknown';

export default function PaymentReturn() {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const [outcome, setOutcome] = useState<Outcome>('checking');
    const [amount, setAmount] = useState<number | null>(null);
    const [receipt, setReceipt] = useState<{ planName: string; paymentId: string; paidAt: string | null } | null>(null);
    const stopped = useRef(false);

    /*
     * `orderId` is handed over by the checkout before it redirects, and kept
     * in session storage because this page is a FRESH LOAD — the browser has
     * been to Instamojo and back, so nothing is left in React state or in the
     * history entry's `state`.
     *
     * Session storage rather than local: it belongs to this tab and this
     * purchase, and a stale order id surviving into next week's visit would
     * have the page report an old payment as if it were this one.
     */
    const orderId = params.get('orderId')
        || (() => {
            try { return sessionStorage.getItem('activ:lastOrderId') || ''; } catch { return ''; }
        })();

    /* Instamojo's own verdict. Used ONLY to tell a cancelled payment from one
       that is still settling — never to decide that a payment succeeded. */
    const gatewayStatus = params.get('payment_status') || '';
    const gatewaySaysFailed = gatewayStatus.toLowerCase() === 'failed';
    const gatewayPaymentId = params.get('payment_id') || '';

    /*
     * WHICH PURCHASE THIS WAS — a membership, or seats at an event.
     *
     * Asked of the PUBLIC `/payment/return/:orderId` first, because a guest who
     * booked seats has no token: the signed-in order lookup answered them 401,
     * and the interceptor sent a buyer whose money had just left their account
     * to the login screen. For an event booking the server also verifies the
     * payment with Instamojo and confirms the booking, and this page then hands
     * over to the booking's own confirmation screen.
     */
    const [booking, setBooking] = useState<{ eventId: string; eventSlug: string; bookingRef: string } | null>(null);

    useEffect(() => {
        if (!orderId) { setOutcome('unknown'); return; }

        let cancelled = false;
        const startedAt = Date.now();
        let timer: ReturnType<typeof setTimeout>;
        let isBooking: boolean | null = null;
        /** The booking this order is for, once the server has said: where every exit goes. */
        let target: { event: string; ref: string } | null = null;

        const bookingHref = (eventKey: string, ref: string) => {
            // A MEMBER returns into the member area; anyone else — a guest, or
            // an admin who booked — to the public booking page. "Signed in"
            // alone sent a super admin into the member area after paying.
            return `${isMemberSession() ? '/member' : ''}/events/${encodeURIComponent(eventKey)}/book`
                + `?ref=${encodeURIComponent(ref)}`;
        };

        const ask = async () => {
            if (cancelled || stopped.current) return;
            try {
                const found = await resolvePaymentReturn(orderId, {
                    paymentId: gatewayPaymentId,
                    paymentStatus: gatewayStatus,
                });
                if (cancelled) return;

                isBooking = found?.orderType === 'event_booking';
                if (typeof found?.amount === 'number') setAmount(found.amount);

                if (isBooking) {
                    setBooking({ eventId: found.eventId || '', eventSlug: found.eventSlug || '', bookingRef: found.bookingRef || '' });
                    if ((found.eventSlug || found.eventId) && found.bookingRef) {
                        target = { event: found.eventSlug || found.eventId, ref: found.bookingRef };
                    }
                    if (found.status === 'paid' && (found.eventSlug || found.eventId) && found.bookingRef) {
                        try { sessionStorage.removeItem('activ:lastOrderId'); } catch { /* private mode */ }
                        navigate(bookingHref(found.eventSlug || found.eventId, found.bookingRef), { replace: true });
                        return;
                    }
                    if (found.status === 'failed' || gatewaySaysFailed) { setOutcome('failed'); return; }
                } else {
                    if (found.status === 'paid') {
                        setReceipt({ planName: found.planName || '', paymentId: found.paymentId || '', paidAt: found.paidAt || null });
                        try { sessionStorage.removeItem('activ:lastOrderId'); } catch { /* private mode */ }
                        window.dispatchEvent(new Event('paymentCompleted'));
                        setOutcome('paid');
                        return;
                    }
                    if (found.status === 'failed') { setOutcome('failed'); return; }
                }
            } catch {
                /* A failed read is not an answer about the payment. Keep
                   asking; the deadline below is what ends it. An older server
                   without the public route falls back to the membership read. */
                if (isMemberSession() && isBooking !== true) {
                    try {
                        const order = await getPaymentOrder(orderId);
                        if (cancelled) return;
                        if (typeof order?.amount === 'number') setAmount(order.amount);
                        if (order?.status === 'paid') {
                            window.dispatchEvent(new Event('paymentCompleted'));
                            setOutcome('paid'); return;
                        }
                        if (order?.status === 'failed') { setOutcome('failed'); return; }
                    } catch { /* Keep waiting for a verified answer. */ }
                }
            }

            if (Date.now() - startedAt >= GIVE_UP_AFTER_MS) {
                /*
                 * AN EVENT BOOKING ALWAYS ENDS ON ITS OWN SCREEN. The booking
                 * page shows the payment as it stands (and updates itself), so a
                 * buyer is never left on a "still confirming" card or sent to a
                 * dashboard — the one screen they came back for is their booking.
                 */
                if (isBooking && target && !gatewaySaysFailed) {
                    try { sessionStorage.removeItem('activ:lastOrderId'); } catch { /* private mode */ }
                    navigate(bookingHref(target.event, target.ref), { replace: true });
                    return;
                }
                setOutcome(gatewaySaysFailed ? 'failed' : 'unconfirmed');
                return;
            }
            timer = setTimeout(ask, POLL_EVERY_MS);
        };

        ask();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [orderId, gatewaySaysFailed, gatewayStatus, gatewayPaymentId, navigate]);

    const money = (value: number | null) =>
        (typeof value === 'number' && Number.isFinite(value)
            ? `₹${value.toLocaleString('en-IN')}`
            : '');

    return (
        <MemberPageShell title="Payment" sidebar={false}>
            <div className="mx-auto max-w-2xl px-0 sm:px-4 py-4 sm:py-12">
                <Card>
                    <CardContent className="p-5 sm:p-8 text-center">

                        {outcome === 'checking' && (
                            <>
                                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
                                <h1 className="text-xl sm:text-[1.75rem] font-bold text-slate-900">
                                    Confirming your payment
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    This takes a few seconds. Please do not close this page or
                                    pay again.
                                </p>
                            </>
                        )}

                        {outcome === 'paid' && (
                            <>
                                <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-600" />
                                <h1 className="text-xl sm:text-[1.75rem] font-bold text-slate-900">
                                    Payment received
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    {money(amount) ? `We have received ${money(amount)}. ` : ''}
                                    Your ACTIV membership is active.
                                </p>
                                <dl className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                                    {receipt?.planName && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Membership plan</dt><dd className="mt-1 font-semibold text-slate-900">{receipt.planName}</dd></div>}
                                    <div><dt className="text-xs uppercase tracking-wide text-slate-500">Order reference</dt><dd className="mt-1 font-semibold text-slate-900 break-all">{orderId}</dd></div>
                                    {receipt?.paymentId && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Payment reference</dt><dd className="mt-1 font-semibold text-slate-900 break-all">{receipt.paymentId}</dd></div>}
                                    {receipt?.paidAt && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Payment confirmed</dt><dd className="mt-1 font-semibold text-slate-900">{new Date(receipt.paidAt).toLocaleString('en-IN')}</dd></div>}
                                </dl>
                                <Button
                                    className="mt-6 bg-green-600 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem] hover:bg-green-700"
                                    onClick={() => navigate('/payment/member-dashboard')}
                                >
                                    Go to my dashboard
                                </Button>
                            </>
                        )}

                        {/*
                          * NOT "your payment failed".
                          *
                          * The webhook has not arrived yet, which is not the
                          * same as the money not leaving. Telling somebody
                          * their payment failed when it did not is what makes
                          * them pay a second time.
                          */}
                        {outcome === 'unconfirmed' && (
                            <>
                                <Clock className="mx-auto mb-4 h-12 w-12 text-amber-500" />
                                <h1 className="text-xl sm:text-[1.75rem] font-bold text-slate-900">
                                    We are still confirming your payment
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    If money has left your account it has reached us and your
                                    {booking ? ' booking will be confirmed' : ' membership will go live'}
                                    {' '}shortly — <strong>please do not pay again</strong>.
                                    {booking
                                        ? ' You will receive the confirmation by email and WhatsApp.'
                                        : ' Check your dashboard in a few minutes, or contact us with your payment reference.'}
                                </p>
                                {booking?.bookingRef && (
                                    <p className="mt-2 text-[1.125rem] font-semibold text-slate-700">
                                        Booking reference: {booking.bookingRef}
                                    </p>
                                )}
                                <Button
                                    variant="outline"
                                    className="mt-6 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem]"
                                    onClick={() => navigate((booking?.eventSlug || booking?.eventId) && booking?.bookingRef
                                        ? `/events/${encodeURIComponent(booking.eventSlug || booking.eventId)}/book?ref=${encodeURIComponent(booking.bookingRef)}`
                                        : '/payment/member-dashboard')}
                                >
                                    {booking ? 'View my booking' : 'Go to my dashboard'}
                                </Button>
                            </>
                        )}

                        {outcome === 'failed' && (
                            <>
                                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
                                <h1 className="text-xl sm:text-[1.75rem] font-bold text-slate-900">
                                    The payment did not go through
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    The gateway reported an unsuccessful payment. If money was
                                    deducted, check its status or contact us before paying again.
                                </p>
                                <Button
                                    className="mt-6 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem]"
                                    onClick={() => navigate((booking?.eventSlug || booking?.eventId)
                                        ? `/events/${encodeURIComponent(booking.eventSlug || booking.eventId)}/book`
                                        : '/payment/membership-plans')}
                                >
                                    {booking ? 'Book again' : 'Choose a plan'}
                                </Button>
                            </>
                        )}

                        {outcome === 'unknown' && (
                            <>
                                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                                <h1 className="text-xl sm:text-[1.75rem] font-bold text-slate-900">
                                    We could not match this to a payment
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    Your dashboard shows the current state of your membership.
                                    If money has left your account, contact us rather than
                                    paying again.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-6 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem]"
                                    onClick={() => navigate('/payment/member-dashboard')}
                                >
                                    Go to my dashboard
                                </Button>
                            </>
                        )}

                    </CardContent>
                </Card>
            </div>
        </MemberPageShell>
    );
}
