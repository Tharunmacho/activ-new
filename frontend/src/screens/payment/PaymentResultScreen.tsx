import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomActionBar, Notice, PALETTE, SPACE, TYPE, money, dateTime,
  PremiumPage, GradientButton, GlassBadge, SurfaceCard, ReceiptLine, MeterBar,
} from '../../ui';
import { Overlap, ResultHeader, TotalBar, TrustLine } from './paymentUi';

import { checkPaymentOrder, getMyProfile } from '../../services/paymentFlow';
import { clearPendingPayment, getPendingPayment, PendingPayment } from '../../services/paymentRecovery';
import { useAuthStore } from '../../stores/exampleStore';
import { useActiveCompanyStore } from '../../stores/activeCompanyStore';
import { getAuthToken, getUserRole } from '../../services/api';

/**
 * ============================================================================
 * PAYMENT RESULT — the website's /payment-success, asked of the SERVER
 * ============================================================================
 *
 * Nothing in the return URL is trusted (it is editable). The screen polls:
 *
 *   GET /payment/return/:orderId?payment_id&payment_status   public — for an
 *       event booking the server verifies with Instamojo and confirms seats
 *   GET /payment/order/:orderId                              signed-in — the
 *       membership order's own state (the webhook activates the membership)
 *
 * until the order is `paid` or `failed`, for up to ~75 s; then "still
 * confirming" with a retry, because a slow webhook is not a failed payment.
 * A paid membership re-reads GET /members/my-profile for the Member ID and
 * lands on the paid dashboard.
 */

const POLL_EVERY_MS = 3000;
const MAX_TRIES = 25;

type Outcome = 'checking' | 'paid' | 'failed' | 'unconfirmed';

const PaymentResultScreen: React.FC<any> = ({ navigation, route }) => {
  const p = route?.params || {};
  const orderId: string = String(p?.orderId || '');
  const paymentId: string = String(p?.paymentId || '');
  const paymentStatus: string = String(p?.paymentStatus || '');
  const [orderType, setOrderType] = useState<string>(String(p?.orderType || 'membership'));
  const [bookingRef, setBookingRef] = useState<string>(String(p?.bookingRef || ''));
  const [eventId, setEventId] = useState<string>(String(p?.eventId || ''));
  const [companyId, setCompanyId] = useState<string>(String(p?.companyId || ''));
  const [retryContext, setRetryContext] = useState<any>(p);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [revision, setRevision] = useState(0);
  const signedIn = useAuthStore(state => state.isAuthenticated);

  const [outcome, setOutcome] = useState<Outcome>('checking');
  const [amount, setAmount] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [memberNo, setMemberNo] = useState('');
  const [tries, setTries] = useState(0);
  useEffect(() => {
    // Each order/retry owns one polling loop. Late responses from an old order
    // cannot display a receipt or schedule another loop on the new screen.
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setOutcome('checking');
    setAmount(null); setPlanName(''); setPaidAt(null); setReference(''); setMemberNo('');
    setOrderType(String(p.orderType || 'membership'));
    setBookingRef(String(p.bookingRef || '')); setEventId(String(p.eventId || ''));
    setCompanyId(String(p.companyId || '')); setRetryContext(p); setPending(null);
    getPendingPayment('payment', orderId).then(saved => {
      if (!active || !saved) return;
      setPending(saved);
      setRetryContext((current: any) => ({ ...saved, ...current }));
      if (saved.companyId) setCompanyId(current => current || saved.companyId || '');
    });
    const check = async (attempt: number) => {
      if (!active) return;
      setTries(attempt);
      if (!orderId) { setOutcome('unconfirmed'); return; }
      try {
        const found = await checkPaymentOrder(orderId, { paymentId, paymentStatus });
        if (!active) return;
        if (found.orderId !== orderId) throw new Error('The payment record did not match this order.');
        if (found.orderType) setOrderType(found.orderType);
        if (found.bookingRef) setBookingRef(found.bookingRef);
        if (found.eventId) setEventId(found.eventId);
        if (found.companyId) setCompanyId(found.companyId);
        if (found.amount !== null) setAmount(found.amount);
        setPlanName(found.planName); setPaidAt(found.paidAt); setReference(found.paymentId);
        if (found.status === 'paid' || found.status === 'failed') {
          await clearPendingPayment(orderId);
          if (!active) return;
          setOutcome(found.status);
          if (found.status === 'paid' && (found.orderType || p.orderType || 'membership') === 'membership') {
            await getMyProfile().then(profile => {
              if (active && profile?.membershipNumber) setMemberNo(String(profile.membershipNumber));
            }).catch(() => undefined);
            if (active && signedIn && p.returnToDashboard === true) {
              navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] });
            }
          }
          return;
        }
      } catch { /* A failed status read is never a failed payment. */ }
      if (!active) return;
      if (attempt >= MAX_TRIES) { setOutcome('unconfirmed'); return; }
      timer = setTimeout(() => { check(attempt + 1); }, POLL_EVERY_MS);
    };
    check(1);
    return () => { active = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, paymentId, paymentStatus, revision]);

  const retry = () => setRevision(value => value + 1);
  const toDashboard = () => navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] });
  const home = signedIn ? 'MemberMain' : 'PublicExplore';
  const bookingHome = async () => {
    const [token, role] = await Promise.all([getAuthToken(), getUserRole()]);
    return token && role === 'member' ? 'MemberMain' : 'PublicExplore';
  };
  const toEvents = async () => {
    const destination = await bookingHome();
    navigation.reset(destination === 'MemberMain'
      ? { index: 1, routes: [{ name: destination }, { name: 'MemberEvents' }] }
      : { index: 0, routes: [{ name: 'PublicExplore', params: { section: 'events' } }] });
  };
  /* The ticket stays public unless the saved session belongs to a member. */
  const toTicket = async () => {
    if (!bookingRef) return toEvents();
    const destination = await bookingHome();
    navigation.reset({ index: 1, routes: [{ name: destination }, { name: 'EventBooking', params: { eventId: eventId || undefined, ref: bookingRef } }] });
  };
  const booking = orderType === 'event_booking';
  const companyPayment = orderType === 'company_listing';
  const orderShort = orderId ? `Order ${orderId.slice(-8).toUpperCase()}` : '';
  const toCompany = async () => {
    const store = useActiveCompanyStore.getState();
    const companies = await store.loadCompanies({ force: true });
    if (companyId && companies.some(company => company._id === companyId)) store.setActiveCompany(companyId);
    navigation.reset({ index: 1, routes: [{ name: 'MemberMain' }, { name: 'Settings' }] });
  };
  const toPlans = () => navigation.navigate('MembershipPlans', { renew: !!retryContext.renew, upgrade: !!retryContext.upgrade });
  const startAgain = () => {
    if (booking) { toTicket(); return; }
    if (!companyPayment && !retryContext.planId) { toPlans(); return; }
    navigation.replace('PaymentCheckout', {
      orderType, companyId: companyId || undefined,
      planId: retryContext.planId, applicationId: retryContext.applicationId,
      upgrade: retryContext.upgrade, renew: retryContext.renew, commencementYear: retryContext.commencementYear,
    });
  };

  if (outcome === 'checking') {
    return (
      <PremiumPage
        header={(
          <ResultHeader
            outcome="checking"
            eyebrow={orderShort || 'Payment'}
            title="Confirming your payment"
            subtitle={tries > 3 ? 'Still confirming with the bank… this can take a minute.' : 'Checking your payment securely. Please keep this screen open.'}
          />
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter}>
            <Text style={s.progressLabel} maxFontSizeMultiplier={1.3}>{`Checking with the gateway · attempt ${Math.max(1, tries)} of ${MAX_TRIES}`}</Text>
            <MeterBar value={Math.min(1, Math.max(1, tries) / MAX_TRIES)} height={6} style={{ marginTop: SPACE.sm }} />
            <View style={s.gap} />
            <TrustLine icon="verified-user" tone="green" text="Your receipt will appear once the payment is confirmed." />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  if (outcome === 'paid') {
    return (
      <PremiumPage
        header={(
          <ResultHeader
            outcome="success"
            eyebrow="Payment successful"
            title={companyPayment ? 'Company payment confirmed' : booking ? 'Your seats are confirmed' : retryContext.renew ? 'Membership renewed' : retryContext.upgrade ? 'Membership upgraded' : 'Welcome to ACTIV!'}
            subtitle={companyPayment ? 'Your additional company payment is recorded. Open company settings to view its publishing status.' : booking ? 'Your booking is paid. Open your ticket for entry details and confirmation.' : 'Your membership is active. Your receipt and certificates are ready.'}
            amount={money(amount)}
          >
            {memberNo ? <GlassBadge label={`Member ID ${memberNo}`} icon="badge" /> : null}
          </ResultHeader>
        )}
        footer={(
          <BottomActionBar>
            {companyPayment ? <GradientButton label="Company settings" icon="store" onPress={toCompany} style={s.flex} /> : booking ? (
              <GradientButton label="View your ticket" icon="confirmation-number" onPress={toTicket} style={s.flex} />
            ) : (
              <>
                <GradientButton variant="outline" label="Receipt" icon="receipt-long" onPress={() => navigation.navigate('PaymentSuccess', { orderId, planType: planName, renewed: !!retryContext.renew })} style={s.flex} />
                <GradientButton label="Dashboard" icon="dashboard" onPress={toDashboard} style={s.flex} />
              </>
            )}
          </BottomActionBar>
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter}>
            {booking ? <ReceiptLine label="Booking" value={bookingRef} selectable /> : planName ? <ReceiptLine label={companyPayment ? 'Company payment' : 'Plan'} value={planName} /> : null}
            <ReceiptLine label="Order" value={orderId} selectable />
            {reference ? <ReceiptLine label="Payment reference" value={reference} selectable /> : null}
            {paidAt ? <ReceiptLine label="Paid on" value={dateTime(paidAt)} /> : null}
            <TotalBar label="Amount paid" value={money(amount)} />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  if (outcome === 'failed') {
    return (
      <PremiumPage
        header={(
          <ResultHeader
            outcome="failed"
            eyebrow="Payment not completed"
            title="The payment did not go through"
            subtitle="The payment provider reported that this order was not completed. Check any bank debit before trying again."
          />
        )}
        footer={(
          <BottomActionBar>
            <GradientButton variant="outline" label={companyPayment ? 'Company settings' : booking ? 'Back to events' : 'Back to plans'} onPress={companyPayment ? toCompany : booking ? toEvents : toPlans} style={s.flex} />
            <GradientButton label={booking ? 'View booking' : 'Try again'} icon="refresh" onPress={startAgain} style={s.flex} />
          </BottomActionBar>
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter}>
            {orderId ? <ReceiptLine label="Order" value={orderId} selectable /> : null}
            <TrustLine icon="support-agent" tone="amber" text="If money left your account, contact ACTIV with this order number and your bank reference before paying again." style={orderId ? { marginTop: SPACE.md } : undefined} />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  return (
    <PremiumPage
      header={(
        <ResultHeader
          outcome="pending"
          eyebrow="Still confirming"
          title="We have not heard back yet"
          subtitle="Payments can take a few minutes to be confirmed. Keep this order number and check again before making another payment."
        />
      )}
      footer={(
        <BottomActionBar note={`Order ${orderId || '—'}`}>
          <GradientButton
            variant="outline"
            label={companyPayment ? 'Company settings' : booking ? 'View booking' : 'Dashboard'}
            onPress={companyPayment ? toCompany : booking ? toTicket : () => navigation.reset({ index: 0, routes: [{ name: home }] })}
            style={s.flex}
          />
          <GradientButton label="Check again" icon="refresh" onPress={retry} style={s.flex} />
        </BottomActionBar>
      )}
    >
      <Overlap>
        <Notice kind="info" style={s.gutter} text="Please do not pay again for the same order. Check again in a minute, or look at your dashboard — it updates on its own." />
        {!booking && pending?.paymentUrl ? <SurfaceCard style={[s.gutter, { marginTop: SPACE.md }]}>
          <TrustLine icon="open-in-new" text="If you have not paid yet, you can return to the same payment page." />
          <GradientButton label="Return to payment page" variant="outline" onPress={() => navigation.replace('PaymentCheckout', { ...pending, resumeOrderId: orderId })} style={{ marginTop: SPACE.md }} />
        </SurfaceCard> : null}
      </Overlap>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { marginHorizontal: SPACE.lg },
  gap: { height: SPACE.lg },
  progressLabel: { ...TYPE.caption, color: PALETTE.textSoft },
});

export default PaymentResultScreen;
