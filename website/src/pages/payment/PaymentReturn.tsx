import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getPaymentOrder, resolvePaymentReturn } from '@/services/paymentApi';
import { isMemberSession } from '@/lib/session';
import MemberPageShell from '../member/MemberPageShell';
import NativePaymentReturnLink from '@/components/NativePaymentReturnLink';

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
    const [companyPayment, setCompanyPayment] = useState(false);
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

    // Callback hints go to the server for verification; they are not an outcome.
    const gatewayStatus = params.get('payment_status') || '';
    const gatewayPaymentId = params.get('payment_id') || '';
    const nativeClient = params.get('client') === 'app';

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
        setOutcome(orderId ? 'checking' : 'unknown');
        setAmount(null); setCompanyPayment(false); setReceipt(null); setBooking(null);
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
            let found: Awaited<ReturnType<typeof resolvePaymentReturn>> | null = null;
            try {
                found = await resolvePaymentReturn(orderId, {
                    paymentId: gatewayPaymentId,
                    paymentStatus: gatewayStatus,
                });
            } catch { /* A failed read is not an answer about the payment. */ }
            if ((!found || !['paid', 'failed'].includes(found.status)) && isMemberSession()) {
                try {
                    const order = await getPaymentOrder(orderId);
                    if (order?.status) found = { ...found, ...order, paymentId: order.paymentId || order.gatewayPaymentId || found?.paymentId || '' };
                } catch { /* Keep the public response and retry until the deadline. */ }
            }
            if (cancelled) return;
            if (found) {
                isBooking = found?.orderType === 'event_booking';
                setCompanyPayment(found?.orderType === 'company_listing');
                if (typeof found?.amount === 'number') setAmount(found.amount);

                if (isBooking) {
                    setBooking({ eventId: found.eventId || '', eventSlug: found.eventSlug || '', bookingRef: found.bookingRef || '' });
                    if ((found.eventSlug || found.eventId) && found.bookingRef) {
                        target = { event: found.eventSlug || found.eventId, ref: found.bookingRef };
                    }
                    if (found.status === 'paid' && target && !nativeClient) {
                        try { sessionStorage.removeItem('activ:lastOrderId'); } catch { /* private mode */ }
                        navigate(bookingHref(found.eventSlug || found.eventId, found.bookingRef), { replace: true });
                        return;
                    }
                }
                if (found.status === 'paid') {
                    setReceipt({ planName: found.planName || '', paymentId: found.paymentId || '', paidAt: found.paidAt || null });
                    try { sessionStorage.removeItem('activ:lastOrderId'); } catch { /* private mode */ }
                    if (!isBooking) window.dispatchEvent(new Event('paymentCompleted'));
                    setOutcome('paid');
                    return;
                }
                if (found.status === 'failed') { setOutcome('failed'); return; }
            }

            if (Date.now() - startedAt >= GIVE_UP_AFTER_MS) {
                /*
                 * AN EVENT BOOKING ALWAYS ENDS ON ITS OWN SCREEN. The booking
                 * page shows the payment as it stands (and updates itself), so a
                 * buyer is never left on a "still confirming" card or sent to a
                 * dashboard — the one screen they came back for is their booking.
                 */
                if (isBooking && target && !nativeClient) {
                    navigate(bookingHref(target.event, target.ref), { replace: true });
                    return;
                }
                setOutcome('unconfirmed');
                return;
            }
            timer = setTimeout(ask, POLL_EVERY_MS);
        };

        ask();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [orderId, gatewayStatus, gatewayPaymentId, nativeClient, navigate]);

    const money = (value: number | null) =>
        (typeof value === 'number' && Number.isFinite(value)
            ? `₹${value.toLocaleString('en-IN')}`
            : '');

    const bookingDestination = (booking?.eventSlug || booking?.eventId) && booking?.bookingRef
        ? `${isMemberSession() ? '/member' : ''}/events/${encodeURIComponent(booking.eventSlug || booking.eventId)}/book?ref=${encodeURIComponent(booking.bookingRef)}`
        : '';
    const destination = bookingDestination || (companyPayment ? '/business/settings' : '/payment/member-dashboard');
    const destinationLabel = bookingDestination ? 'View my booking' : companyPayment ? 'Company settings' : 'Go to my dashboard';

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
                                    {booking ? 'Your event booking is confirmed.' : companyPayment ? 'Your additional company publishing payment is confirmed. Open company settings to view its status.' : 'Your ACTIV membership is active.'}
                                </p>
                                <dl className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left space-y-3">
                                    {receipt?.planName && <div><dt className="text-xs uppercase tracking-wide text-slate-500">{companyPayment ? 'Company payment' : 'Membership plan'}</dt><dd className="mt-1 font-semibold text-slate-900">{receipt.planName}</dd></div>}
                                    <div><dt className="text-xs uppercase tracking-wide text-slate-500">Order reference</dt><dd className="mt-1 font-semibold text-slate-900 break-all">{orderId}</dd></div>
                                    {receipt?.paymentId && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Payment reference</dt><dd className="mt-1 font-semibold text-slate-900 break-all">{receipt.paymentId}</dd></div>}
                                    {receipt?.paidAt && !Number.isNaN(Date.parse(receipt.paidAt)) && <div><dt className="text-xs uppercase tracking-wide text-slate-500">Payment confirmed (IST)</dt><dd className="mt-1 font-semibold text-slate-900">{new Date(receipt.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}</dd></div>}
                                </dl>
                                <Button
                                    className="mt-6 bg-green-600 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem] hover:bg-green-700"
                                    onClick={() => navigate(destination)}
                                >
                                    {destinationLabel}
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
                                    The gateway has not confirmed this payment yet. If money was
                                    deducted, <strong>please do not pay again</strong>.
                                    {' '}Check the status again or contact ACTIV with your order reference.
                                </p>
                                {booking?.bookingRef && (
                                    <p className="mt-2 text-[1.125rem] font-semibold text-slate-700">
                                        Booking reference: {booking.bookingRef}
                                    </p>
                                )}
                                <Button
                                    variant="outline"
                                    className="mt-6 w-full sm:w-auto py-5 sm:py-6 text-[1.125rem]"
                                    onClick={() => navigate(destination)}
                                >
                                    {destinationLabel}
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
                                    onClick={() => navigate(bookingDestination || (companyPayment ? '/business/settings' : '/payment/membership-plans'))}
                                >
                                    {booking ? 'Back to booking' : companyPayment ? 'Company settings' : 'Choose a plan'}
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

                        <NativePaymentReturnLink />
                    </CardContent>
                </Card>
            </div>
        </MemberPageShell>
    );
}
