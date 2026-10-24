import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { getAuthToken, getUserRole } from '../../services/api';
import { View, Text, StyleSheet, Linking, Alert, BackHandler } from 'react-native';
import { usePaymentResumeCheck } from './usePaymentResumeCheck';
import {
  BottomActionBar, Notice, PALETTE, SPACE, TYPE, money, errorText,
  PremiumPage, PremiumPageHeader, SecureCard3D, GradientButton, SurfaceCard, LinkRow, StateView, GroupTitle,
  ReceiptLine, HeaderStat, HeaderStatRow, GradientGlyph,
} from '../../ui';
import { Overlap, ResultHeader, TotalBar, TrustLine, WebCheckout } from './paymentUi';
import {
  getPaymentConfig, startHostedPayment, payMembershipMock, payBookingMock, parseReturnUrl, getMyPlans, getUpgradePlans,
  PaymentConfig, checkPaymentOrder,
} from '../../services/paymentFlow';
import { CheckoutContext, findPendingCheckout, getPendingPayment, getPaymentStorageOwner, sameCheckout, setPendingPayment } from '../../services/paymentRecovery';

/*
 * The in-app browser. Required lazily and guarded (RULE 2.4): a build that
 * does not yet carry the native module falls back to the phone's browser
 * instead of crashing.
 */
let WebViewComp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebViewComp = require('react-native-webview').WebView || null;
} catch {
  WebViewComp = null;
}

/**
 * ============================================================================
 * CHECKOUT — one order through the gateway, exactly as the website does it
 * ============================================================================
 *
 *   GET  /payment/config            'gateway' (production) or 'mock' (dev)
 *   gateway:
 *   POST /payment/create-request    { membershipType: planId, orderType:'membership' }
 *                                   { orderType:'event_booking', bookingRef }
 *                                   → payment_url + orderId (NO amount is sent)
 *     The Instamojo page opens in an in-app WebView. When it navigates to the
 *     server-built return URL (…/payment-success?orderId=…) the WebView is
 *     closed and PaymentResult asks the server what happened — the address
 *     bar is never trusted. "Open in browser" is the fallback, followed by a
 *     status check.
 *   mock (dev servers only, refused in production):
 *     membership  POST /payment/order → /payment/mock-authorize → /payment/complete
 *     booking     POST /event-bookings/:ref/authorize → /event-bookings/:ref/pay
 *
 * The server's own sentences (mobile number required, not eligible to renew,
 * order already paid…) are shown verbatim.
 */

type Phase = 'preparing' | 'confirm' | 'webview' | 'browser' | 'paying' | 'error' | 'bookingDone';

const PaymentCheckoutScreen: React.FC<any> = ({ navigation, route }) => {
  const params = route?.params || {};
  const orderType: 'membership' | 'event_booking' | 'company_listing' = params?.orderType === 'company_listing' ? 'company_listing' : params?.orderType === 'event_booking' ? 'event_booking' : 'membership';
  const companyId = String(params?.companyId || '');
  const planId: string = String(params?.planId || '');
  const upgrade = params?.upgrade === true;
  const commencementYear = params?.commencementYear;
  const bookingRef: string = String(params?.bookingRef || '');
  const eventId: string = String(params?.eventId || '');
  const renew = params?.renew === true;
  /* The website sends the application id with the membership order when it has one. */
  const applicationId: string = String(params?.applicationId || '');
  const resumeOrderId = String(params?.resumeOrderId || '');
  const context = useMemo<CheckoutContext>(() => ({
    orderType, companyId: companyId || undefined, planId: planId || undefined,
    bookingRef: bookingRef || undefined, eventId: eventId || undefined,
    applicationId: applicationId || undefined, upgrade, renew, commencementYear,
  }), [orderType, companyId, planId, bookingRef, eventId, applicationId, upgrade, renew, commencementYear]);

  const [phase, setPhase] = useState<Phase>('preparing');
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [planName, setPlanName] = useState('');

  const handedOff = useRef(false);
  const currentOrderId = useRef('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const startVersion = useRef(0);

  const goResult = useCallback((ret?: { orderId?: string; paymentId?: string; paymentStatus?: string }) => {
    if (handedOff.current) return;
    const id = currentOrderId.current.trim();
    if (ret?.orderId && ret.orderId !== id) {
      Alert.alert('Different payment order', 'This return does not match your checkout. Please check the current order status.');
      return;
    }
    if (!id) {
      setError('The payment order could not be identified. If your bank shows a debit, contact ACTIV with the bank reference before trying again.');
      setPhase('error');
      return;
    }
    handedOff.current = true;
    navigation.replace('PaymentResult', {
      ...context,
      orderId: id,
      paymentId: ret?.paymentId || undefined,
      paymentStatus: ret?.paymentStatus || undefined,
    });
  }, [navigation, context]);

  /** Start the gateway order (or show the mock confirm step). */
  const start = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const version = ++startVersion.current;
    const isCurrent = () => mounted.current && startVersion.current === version;
    setPhase('preparing');
    setError('');
    currentOrderId.current = '';
    setOrderId(''); setPayUrl(''); setAmount(null); setPlanName('');
    handedOff.current = false;
    if (orderType === 'membership' && !planId) {
      setError('Choose a plan first.');
      setPhase('error');
      inFlight.current = false;
      return;
    }
    if (orderType === 'event_booking' && !bookingRef) {
      setError('This booking could not be found.');
      setPhase('error');
      inFlight.current = false;
      return;
    }
    if (orderType === 'company_listing' && !companyId) {
      setError('Choose the company to publish first.'); setPhase('error'); inFlight.current = false; return;
    }
    try {
      const previous = resumeOrderId ? await getPendingPayment('payment', resumeOrderId) : await findPendingCheckout(context);
      if (!isCurrent()) return;
      if (resumeOrderId && (!previous || !sameCheckout(previous, context))) {
        throw new Error('This saved checkout is unavailable. Check the order status before starting another payment.');
      }
      if (previous) {
        currentOrderId.current = previous.orderId;
        setOrderId(previous.orderId); setPayUrl(previous.paymentUrl || '');
        if (typeof previous.amount === 'number') setAmount(previous.amount);
        const found = await checkPaymentOrder(previous.orderId).catch(() => null);
        if (!isCurrent()) return;
        if (found?.status === 'paid' || found?.status === 'failed' || !/^https:\/\//i.test(previous.paymentUrl || '')) {
          goResult(); return;
        }
        // Reopen this order, never create another while its result is unknown.
        setPhase(WebViewComp ? 'webview' : 'browser');
        return;
      }
      const cfg = await getPaymentConfig();
      if (!isCurrent()) return;
      setConfig(cfg);
      if (orderType === 'company_listing') {
        const response = await api.get(`/business-profiles/${encodeURIComponent(companyId)}/publishing`);
        if (!isCurrent()) return;
        const quote = response.data?.data || response.data;
        if (!quote.paymentRequired) throw new Error('This company can already be published. Return to company settings and refresh.');
        setAmount(quote.amount); setPlanName(`Additional company · ${quote.companyName}`);
      }
      if (orderType === 'membership') {
        // Display only — the server prices the order from the key.
        const mine = upgrade ? await getUpgradePlans() : await getMyPlans();
        if (!isCurrent()) return;
        if (mine.failed) throw new Error('The current membership price could not be loaded. Please try again.');
        if (upgrade && mine.canPurchase === false) throw new Error(mine.reason || 'Your plan advances automatically. The new fee applies at renewal.');
        const p = (mine.plans || []).find((x) => x.key === planId);
        if (!p) throw new Error('Your available plans changed. Return to membership plans and refresh your eligibility.');
        if (p) { setPlanName(p.name); setAmount(p.price); }
      }
      if (cfg.mode === 'gateway') {
        if (!cfg.configured) throw new Error('Online payments are temporarily unavailable. Please try again later.');
        const owner = await getPaymentStorageOwner();
        if (!isCurrent()) return;
        const started = await startHostedPayment({ orderType, companyId, planId, bookingRef, applicationId: applicationId || undefined, upgrade, commencementYear });
        await setPendingPayment({ ...context, ...started }, owner);
        if (!isCurrent()) return;
        currentOrderId.current = started.orderId;
        setPayUrl(started.paymentUrl);
        setOrderId(started.orderId);
        if (started.amount !== null) setAmount(started.amount);
        setPhase(WebViewComp ? 'webview' : 'browser');
        if (!WebViewComp) {
          try { await Linking.openURL(started.paymentUrl); } catch { /* the button below retries */ }
        }
      } else {
        setPhase('confirm');
      }
    } catch (err) {
      if (!isCurrent()) return;
      setError(errorText(err, 'The payment could not be started. Please try again.'));
      setPhase('error');
    } finally {
      if (startVersion.current === version) inFlight.current = false;
    }
  }, [orderType, companyId, planId, bookingRef, applicationId, upgrade, commencementYear, context, goResult, resumeOrderId]);

  useEffect(() => {
    mounted.current = true; start();
    return () => { mounted.current = false; startVersion.current += 1; inFlight.current = false; };
  }, [start]);

  const cancel = useCallback(() => {
    Alert.alert(
      'Leave the payment?',
      'Check the current order before leaving so you do not start another payment by mistake.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: orderId ? 'Check status' : 'Leave', onPress: () => (orderId ? goResult() : navigation.goBack()) },
      ],
    );
    return true;
  }, [orderId, goResult, navigation]);

  // Android back inside the gateway = ask, never silently drop the order.
  useEffect(() => {
    if (phase !== 'webview' && phase !== 'browser') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', cancel);
    return () => sub.remove();
  }, [phase, cancel]);

  usePaymentResumeCheck(!!orderId && (phase === 'browser' || phase === 'webview'), async () => {
    const found = await checkPaymentOrder(orderId);
    return found.orderId === orderId && (found.status === 'paid' || found.status === 'failed');
  }, () => { if (navigation.isFocused?.() !== false) goResult(); });

  const payMock = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase('paying');
    try {
      if (orderType === 'company_listing') {
        const order = await payMembershipMock('', undefined, false, undefined, companyId);
        navigation.replace('PaymentResult', { ...context, orderId: order.orderId });
      } else if (orderType === 'membership') {
        const order = await payMembershipMock(planId, applicationId || undefined, upgrade, commencementYear);
        navigation.replace('PaymentSuccess', { orderId: order.orderId, planType: planName || planId, renewed: renew });
      } else {
        await payBookingMock(bookingRef);
        setPhase('bookingDone');
      }
    } catch (err) {
      setError(errorText(err, 'The payment did not go through.'));
      setPhase('error');
    } finally {
      inFlight.current = false;
    }
  };

  const openBrowser = async () => {
    if (!payUrl) return;
    try {
      setPhase('browser');
      await Linking.openURL(payUrl);
    } catch {
      Alert.alert('Could not open the browser', 'Please try the in-app payment page instead.');
    }
  };

  const title = orderType === 'event_booking' ? 'Pay for your booking' : upgrade ? 'Upgrade membership' : renew ? 'Renew membership' : 'Checkout';

  /* ---------------------------------------------------------------- webview */
  if (phase === 'webview' && WebViewComp && payUrl) {
    return (
      <WebCheckout
        WebViewComp={WebViewComp}
        url={payUrl}
        isReturn={parseReturnUrl}
        onReturn={goResult}
        onClose={cancel}
        onError={() => setPhase('browser')}
        onOpenBrowser={openBrowser}
      />
    );
  }

  const goBack = () => navigation.goBack();
  const viewTicket = async () => {
    const [token, role] = await Promise.all([getAuthToken(), getUserRole()]);
    const home = token && role === 'member' ? 'MemberMain' : 'PublicExplore';
    navigation.reset({ index: 1, routes: [{ name: home }, { name: 'EventBooking', params: { eventId, ref: bookingRef } }] });
  };
  const eyebrow = orderType === 'company_listing' ? 'Company publishing' : orderType === 'event_booking' ? 'Event booking' : upgrade ? 'Upgrade' : renew ? 'Renewal' : 'Membership';

  if (phase === 'preparing' || phase === 'paying') {
    const preparing = phase === 'preparing';
    return (
      <PremiumPage
        header={(
          <ResultHeader
            outcome="checking"
            onBack={preparing ? goBack : undefined}
            eyebrow={eyebrow}
            title={preparing ? 'Preparing a secure payment' : 'Processing your payment'}
            subtitle={preparing ? 'Checking your order and current price…' : 'Please keep this screen open.'}
          />
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter}>
            {[
              { icon: 'lock', text: 'Your order uses ACTIV’s current price for this payment.', done: true },
              { icon: 'credit-card', text: 'Card, UPI and net banking are handled by Instamojo.', done: !preparing },
              { icon: 'receipt-long', text: 'Your receipt appears the moment the payment is confirmed.', done: false },
            ].map((row, i) => (
              <View key={row.icon} style={[s.stepRow, i > 0 && { marginTop: SPACE.md }]}>
                <GradientGlyph icon={row.done ? 'check' : row.icon} tone={row.done ? 'green' : 'slate'} size={34} iconSize={17} />
                <Text style={s.stepText} maxFontSizeMultiplier={1.3}>{row.text}</Text>
              </View>
            ))}
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  if (phase === 'error') {
    return (
      <PremiumPage header={<PremiumPageHeader onBack={goBack} eyebrow={eyebrow} title={title} art={<SecureCard3D size={84} />} />}>
        <Overlap>
          <SurfaceCard style={s.gutter}>
            <StateView kind="error" compact title="Unable to continue payment" message={error} onAction={orderId ? () => goResult() : start} action={orderId ? 'Check status' : 'Try again'} secondary="Go back" onSecondary={goBack} />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  if (phase === 'bookingDone') {
    return (
      <PremiumPage
        header={(
          <ResultHeader
            outcome="success"
            eyebrow="Booking"
            title="Your seats are confirmed"
            subtitle={`Booking reference ${bookingRef}`}
          />
        )}
        footer={(
          <BottomActionBar>
            <GradientButton
              label="View your ticket"
              icon="confirmation-number"
              onPress={viewTicket}
              style={s.flex}
            />
          </BottomActionBar>
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter}>
            <ReceiptLine label="Reference" value={bookingRef} selectable />
            <ReceiptLine label="Status" value="Paid" />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  if (phase === 'browser') {
    return (
      <PremiumPage
        header={(
          <PremiumPageHeader
            onBack={cancel}
            eyebrow="Secure payment"
            title="Finish paying in your browser"
            subtitle="Complete the payment on Instamojo, then come back here and check the status."
            art={<SecureCard3D size={88} />}
          />
        )}
        footer={(
          <BottomActionBar note="This reopens the same order. Check its status before starting another payment.">
            <View style={s.stack}>
              <GradientButton label="Open payment page" icon="open-in-new" onPress={openBrowser} disabled={!payUrl} />
              <GradientButton label="I have paid — check status" icon="fact-check" variant="outline" onPress={() => goResult()} disabled={!orderId} />
            </View>
          </BottomActionBar>
        )}
      >
        <Overlap>
          <SurfaceCard style={s.gutter} padded={false}>
            <LinkRow icon="open-in-new" title="Open the payment page" subtitle="Instamojo opens in your phone's browser." />
            <LinkRow icon="lock" tone="green" title="Pay by card, UPI or net banking" subtitle="ACTIV never sees your payment details." />
            <LinkRow icon="fact-check" tone="teal" title="Come back and check the status" subtitle="Your receipt appears the moment it is confirmed." last />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  /* ---------------------------------------------------------------- confirm (mock mode, dev servers) */
  const amountText = money(amount);
  return (
    <PremiumPage
      header={(
        <PremiumPageHeader
          onBack={goBack}
          eyebrow={eyebrow}
          title={orderType === 'event_booking' ? `Booking ${bookingRef}` : planName || 'Your membership'}
          subtitle="Review and confirm your payment."
          art={<SecureCard3D size={88} />}
          artLabel="Secure card payment"
        >
          <HeaderStatRow>
            <HeaderStat icon="payments" value={amountText} label="Amount due" />
            <HeaderStat icon="verified-user" value="Secure" label="Server-priced" />
          </HeaderStatRow>
        </PremiumPageHeader>
      )}
      footer={(
        <BottomActionBar note="The amount is set by ACTIV's server.">
          <GradientButton label={`Pay ${amountText === '—' ? '' : amountText}`.trim()} icon="lock" onPress={payMock} style={s.flex} />
        </BottomActionBar>
      )}
    >
      <Overlap>
        <Notice kind="warning" icon="science" style={s.notice} text={`Test mode (${config?.provider || 'mock'}): this server takes no real money. Production uses Instamojo.`} />
        <GroupTitle title="Order summary" style={{ marginTop: SPACE.sm }} />
        <SurfaceCard style={s.gutter}>
          {orderType === 'event_booking' ? <ReceiptLine label="Booking" value={bookingRef} /> : <ReceiptLine label={orderType === 'company_listing' ? 'Company' : 'Plan'} value={planName || planId} />}
          <ReceiptLine label="Charged by" value="ACTIV" />
          <TotalBar label="Amount" value={amountText} />
          <View style={s.trustGap} />
          <TrustLine icon="lock" tone="green" text="Review the current amount before confirming your payment." />
        </SurfaceCard>
      </Overlap>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  stack: { flex: 1, gap: SPACE.sm },
  gutter: { marginHorizontal: SPACE.lg },
  notice: { marginHorizontal: SPACE.lg },
  trustGap: { height: SPACE.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  stepText: { ...TYPE.body, flex: 1, minWidth: 0, color: PALETTE.textSoft },
});

export default PaymentCheckoutScreen;
