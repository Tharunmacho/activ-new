import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getPaymentOrder, resolvePaymentReturn } from '@/services/paymentApi';
import { STORAGE_KEYS } from '@/config/api.config';
import MemberPageShell from '../member/MemberPageShell';

/**
 * ==========================================================================
 * WHERE INSTAMOJO SENDS THE MEMBER BACK TO
 * ==========================================================================
 *
 * `redirect_url` on every payment request this server creates is
 * `${FRONTEND_URL}/payment-success`, and Instamojo appends its own query
 * string: `payment_id`, `payment_request_id`, `payment_status`.
 *
 * THIS PAGE ACTIVATES NOTHING, AND THAT IS THE WHOLE POINT.
 *
 * Every one of those query values is in the member's own address bar. A page
 * that read `payment_status=Credit` and granted a membership would be handing
 * one to anybody who could type. The membership is activated by the WEBHOOK —
 * a server-to-server POST that carries an HMAC-SHA1 signed with the account's
 * private salt, verified in `payment.service.verifyWebhookSignature`. That is
 * the only thing on this flow that can be trusted about a payment.
 *
 * So all this page does is ask OUR server about OUR order, and report the
 * answer. The query string is used for exactly one thing: knowing which order
 * to ask about — and even that is checked, because `GET /payment/order/:id`
 * refuses an order that is not the caller's.
 *
 * ----------------------------------------------------------------- polling
 *
 * The member's browser usually arrives before the webhook does. Both leave
 * Instamojo at the same moment and the webhook has a round trip to make, so
 * "your payment did not go through" shown on arrival would be wrong most of
 * the time. The page waits, briefly, and says what it is doing while it
 * waits. After that it stops claiming anything either way: an unconfirmed
 * payment is reported as "we are still confirming", never as a failure,
 * because the money may well have left the member's account.
 */
const POLL_EVERY_MS = 2000;
const GIVE_UP_AFTER_MS = 30000;

type Outcome = 'checking' | 'paid' | 'unconfirmed' | 'failed' | 'unknown';

export default function PaymentReturn() {
    const navigate = useNavigate();
    const [params] = useSearchParams();

    const [outcome, setOutcome] = useState<Outcome>('checking');
    const [amount, setAmount] = useState<number | null>(null);
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
            let signedIn = false;
            try { signedIn = localStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN) === 'true'; } catch { /* guest */ }
            return `${signedIn ? '/member' : ''}/events/${encodeURIComponent(eventKey)}/book`
                + `?ref=${encodeURIComponent(ref)}`;
        };

        const ask = async () => {
            if (cancelled || stopped.current) return;
            try {
                if (isBooking !== false) {
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
                    }
                }

                if (isBooking === false) {
                    const order = await getPaymentOrder(orderId);
                    if (cancelled) return;

                    if (order && typeof order.amount === 'number') setAmount(order.amount);

                    if (order?.status === 'paid') { setOutcome('paid'); return; }
                    if (order?.status === 'failed') { setOutcome('failed'); return; }
                }
            } catch {
                /* A failed read is not an answer about the payment. Keep
                   asking; the deadline below is what ends it. An older server
                   without the public route falls back to the membership read. */
                if (isBooking === null) isBooking = false;
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
            <div className="mx-auto max-w-2xl px-4 py-12">
                <Card>
                    <CardContent className="p-8 text-center">

                        {outcome === 'checking' && (
                            <>
                                <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
                                <h1 className="text-[1.75rem] font-bold text-slate-900">
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
                                <h1 className="text-[1.75rem] font-bold text-slate-900">
                                    Payment received
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    {money(amount) ? `We have received ${money(amount)}. ` : ''}
                                    Your ACTIV membership is active.
                                </p>
                                <Button
                                    className="mt-6 bg-green-600 py-6 text-[1.125rem] hover:bg-green-700"
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
                                <h1 className="text-[1.75rem] font-bold text-slate-900">
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
                                    className="mt-6 py-6 text-[1.125rem]"
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
                                <h1 className="text-[1.75rem] font-bold text-slate-900">
                                    The payment did not go through
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    Nothing has been taken. You can try again whenever you are
                                    ready.
                                </p>
                                <Button
                                    className="mt-6 py-6 text-[1.125rem]"
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
                                <h1 className="text-[1.75rem] font-bold text-slate-900">
                                    We could not match this to a payment
                                </h1>
                                <p className="mt-2 text-[1.125rem] text-slate-600">
                                    Your dashboard shows the current state of your membership.
                                    If money has left your account, contact us rather than
                                    paying again.
                                </p>
                                <Button
                                    variant="outline"
                                    className="mt-6 py-6 text-[1.125rem]"
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
