import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BottomActionBar, Notice, Skeleton, PALETTE, SPACE, TYPE, BRAND, PREMIUM_TYPE, money, dateTime,
  PremiumPage, PremiumPageHeader, Receipt3D, GradientButton, GlassIconButton, BrandLogo, SurfaceCard, LinkRow,
  GroupTitle, ReceiptLine, TornEdge, FadeInUp,
} from '../../ui';
import { Overlap, ResultHeader, TotalBar, ReceiptDivider } from './paymentUi';
import { getOrder, getMyProfile } from '../../services/paymentFlow';
import { getMyApplications, formatApplicationRef } from '../../services/memberApi';
import { pickMostAdvancedApplication } from '../member/dashboard/memberRules';

const longDate = (value?: string | Date | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const titleCase = (v: string) => (v || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * ============================================================================
 * PAYMENT RECEIPT — every figure is the server's
 * ============================================================================
 *
 *   GET /payment/order/:orderId   amount, plan, status, paidAt of THIS order
 *   GET /members/my-profile       name, Member ID (membershipNumber)
 *
 * A receipt is the page a member screenshots, so nothing is guessed: an amount
 * the server did not record prints as a dash, never a plausible number. (This
 * screen used to fall back to ₹2,000 and a random member ID.)
 *
 * Route: `PaymentSuccess { orderId?, planType? … }` — the legacy params are
 * accepted, but only `orderId` is trusted.
 *
 * WITHOUT an orderId (the Plan / Documents screens' "Payment receipt") it is
 * the website's `/member/payment-success?view=receipt`: the member's own
 * latest paid order when available. Older records without an order use
 * lastPaymentAmount ?? paymentAmount, lastPaymentDate and paymentId.
 */
const PaymentSuccessScreen: React.FC<any> = ({ navigation, route }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const orderId: string = String(route?.params?.orderId || '');
  const renewed: boolean = route?.params?.renewed === true;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [receiptError, setReceiptError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setReceiptError('');
    const [pr, apps] = await Promise.all([
      getMyProfile().catch(() => null),
      getMyApplications().catch(() => [] as any[]),
    ]);
    setProfile(pr);
    setApplication(pickMostAdvancedApplication(apps || []));
    const requested = orderId || pr?.paidMembership?.orderId;
    if (requested) {
      try {
        const receipt = await getOrder(requested);
        if (receipt?.status !== 'paid' || receipt?.orderType !== 'membership') throw new Error('Unconfirmed membership receipt');
        setOrder(receipt);
      } catch {
        setOrder(null);
        setReceiptError('This receipt could not be loaded. Check that you are signed in to the account that made this payment.');
      }
    } else {
      setOrder(null);
      if (!pr) setReceiptError('Your membership payment record could not be loaded. Please try again.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [orderId]);

  useEffect(() => { void load(); }, [load]);

  /* Pull-to-refresh re-reads quietly (the receipt stays on screen). */
  const refresh = useCallback(() => load(true), [load]);


  // No order to read → the receipt is the member's own payment record.
  const fromProfile = !order;
  const profilePaid = ['active', 'completed'].includes(String(profile?.membershipStatus || '').toLowerCase());
  const profileAmount = profile?.lastPaymentAmount ?? profile?.paymentAmount;
  const amount = typeof order?.amount === 'number'
    ? order.amount
    : fromProfile && profileAmount !== null && profileAmount !== undefined && Number.isFinite(Number(profileAmount)) ? Number(profileAmount) : null;
  const status = String(order?.status || (orderId ? 'pending' : profilePaid ? 'paid' : '')).toLowerCase();
  const paid = status === 'paid';
  /* The website's receipt: Member ID falls back to memberCode, then the application reference. */
  const memberNo = String(profile?.membershipNumber || profile?.memberCode || formatApplicationRef(application) || '');
  const name = String(profile?.fullName || application?.fullName || '');
  const paidAt = order?.paidAt || (fromProfile ? (profile?.lastPaymentDate || profile?.membershipActivatedAt || '') : '');
  const txnRef = String(order?.gatewayPaymentId || (fromProfile ? profile?.paymentId || '' : ''));
  /* Plan wording, period and validity — the website's PaymentSuccess rules. */
  const kind = String(order ? order.planAudience || '' : profile?.memberType || application?.memberType || '').toLowerCase();
  const kindLabel = kind === 'student' ? 'Student' : kind === 'aspirant' ? 'Aspirant' : kind === 'business' ? 'Business' : '';
  const platinum = order ? kind === 'platinum' || String(order.planId || '').toLowerCase() === 'platinum' : String(profile?.membershipTier || '').toLowerCase() === 'platinum';
  const typeRaw = String(order ? order.membershipType || '' : profile?.membershipType || '').toLowerCase();
  const lifetime = platinum || typeRaw === 'lifetime';
  const derivedPlan = platinum ? 'Lifetime Membership' : [kindLabel, 'membership'].filter(Boolean).join(' ') || 'ACTIV membership';
  const planName = platinum ? 'Lifetime Membership' : String(order?.planName || (fromProfile ? profile?.paidMembership?.planName : '') || derivedPlan);
  const period = lifetime ? 'Lifetime' : typeRaw === 'annual' ? 'Annual' : '';
  const method = String(order ? order.paymentMethod || '' : profile?.paymentMethod || '');
  const receiptOrderId = String(order?.orderId || orderId);
  const validUntil = (() => {
    if (lifetime) return 'Lifetime — no renewal';
    // Later renewals or Platinum upgrades must not change an older receipt.
    if (order && !(order.orderId && order.orderId === profile?.paidMembership?.orderId)
      && ![order.orderId, order.gatewayPaymentId].some(ref => !!ref && ref === profile?.paymentId)) return '';
    if (profile?.membershipExpiresAt) return longDate(profile.membershipExpiresAt);
    const start = profile?.membershipActivatedAt || paidAt;
    if (!start) return '';
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return '';
    d.setFullYear(d.getFullYear() + 1);
    return longDate(d);
  })();
  const firstName = name.split(' ').filter(Boolean)[0] || 'member';

  const shareRef = async () => {
    try { await Share.share({ message: txnRef }); } catch (err) { console.warn('Share safely caught:', err); }
  };

  const share = async () => {
    if (!paid || receiptError) return;
    try {
      await Share.share({
        message: [
          'ACTIV membership payment receipt',
          name ? `Member: ${name}` : '',
          memberNo ? `Member ID: ${memberNo}` : '',
          `Paid for: ${planName || '—'}${period && !lifetime ? ` · ${period}` : ''}`,
          validUntil ? `Valid until: ${validUntil}` : '',
          method ? `Payment method: ${titleCase(method)}` : '',
          `Amount: ${money(amount)}`,
          receiptOrderId ? `Order: ${receiptOrderId}` : '',
          txnRef ? `Transaction: ${txnRef}` : '',
          paidAt ? `Paid on: ${dateTime(paidAt)}` : '',
        ].filter(Boolean).join('\n'),
      });
    } catch (err) {
      console.warn('Share safely caught:', err);
    }
  };

  const onBack = navigation.canGoBack() ? () => navigation.goBack() : undefined;
  const shareButton = !loading && paid && !receiptError ? <GlassIconButton icon="share" onPress={share} accessibilityLabel="Share receipt" /> : undefined;

  if (loading) {
    return (
      <PremiumPage header={<PremiumPageHeader onBack={onBack} eyebrow="Payment" title="Your receipt" art={<Receipt3D size={88} />} />}>
        <Overlap>
          <View style={s.skel}>
            <Skeleton height={380} radius={22} />
            <Skeleton height={140} radius={22} />
          </View>
        </Overlap>
      </PremiumPage>
    );
  }

  if (receiptError) return (
    <PremiumPage header={<PremiumPageHeader onBack={onBack} eyebrow="Payment" title="Your receipt" art={<Receipt3D size={88} />} />}>
      <SurfaceCard style={s.notice}>
        <Notice kind="warning" text={receiptError} />
        <GradientButton label="Retry loading receipt" icon="refresh" onPress={() => void load()} />
      </SurfaceCard>
    </PremiumPage>
  );

  const paidFor = [planName, period && !lifetime ? `· ${period}` : ''].filter(Boolean).join(' ');
  const stamp = paid ? 'PAID' : status ? status.toUpperCase() : 'PENDING';

  return (
    <PremiumPage
      refreshing={refreshing}
      onRefresh={refresh}
      header={(
        <ResultHeader
          outcome={paid ? 'success' : 'pending'}
          onBack={onBack}
          right={shareButton}
          eyebrow={paid ? 'Payment received' : 'Payment'}
          title={paid ? (orderId ? (renewed ? `Thank you for renewing, ${firstName}!` : `Welcome to ACTIV, ${firstName}!`) : 'Payment receipt') : 'Payment status'}
          subtitle={paid
            ? (orderId
              ? (renewed
                ? `Your ${planName.toLowerCase()} is renewed${validUntil ? ` until ${validUntil}` : ''}. Every member benefit carries on.`
                : `Your ${planName.toLowerCase()} is now active. Everything a member gets is open to you.`)
              : 'Your membership fee, as recorded')
            : 'This order has not been confirmed as paid yet.'}
          amount={money(amount)}
          amountNote={paidFor}
        />
      )}
      footer={(
        <BottomActionBar>
          {paid ? (
            <GradientButton variant="outline" label="Plan details" icon="workspace-premium" onPress={() => navigation.navigate('MembershipPlanDetails')} style={s.flex} />
          ) : (
            <GradientButton variant="outline" label="Share" icon="share" onPress={share} style={s.flex} />
          )}
          <GradientButton
            label="Dashboard"
            icon="dashboard"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: paid ? 'PaidDashboard' : 'MemberMain' }] })}
            style={s.flex}
          />
        </BottomActionBar>
      )}
    >
      <Overlap>
        {!orderId && !profilePaid ? <Notice kind="warning" style={s.notice} text="No payment is recorded on your membership yet. Your payments and certificates appear here once it is active." /> : null}

        {/* ------------------------------------------------ the paper receipt */}
        <View style={s.paperWrap} accessibilityLabel="Payment receipt">
          <TornEdge color={PALETTE.white} height={10} />
          <View style={s.paper}>
            <View style={s.paperHead}>
              <BrandLogo size="sm" />
              <View style={s.paperHeadText}>
                <Text style={s.paperEyebrow} maxFontSizeMultiplier={1.2}>Payment receipt</Text>
                <Text style={s.paperOrg} numberOfLines={2} maxFontSizeMultiplier={1.2}>Adidravidar Confederation of Trade and Industrial Vision</Text>
              </View>
            </View>

            <View style={s.idRow}>
              <View style={s.flexMin}>
                <Text style={s.idLabel} maxFontSizeMultiplier={1.2}>Your member ID</Text>
                <Text style={s.idValue} selectable numberOfLines={2} maxFontSizeMultiplier={1.2}>{memberNo || '—'}</Text>
              </View>
              <View style={[s.stamp, paid ? s.stampPaid : s.stampWait]} accessibilityLabel={`Status ${stamp}`}>
                <Text style={[s.stampText, { color: paid ? PALETTE.greenDark : PALETTE.amberDark }]} maxFontSizeMultiplier={1.1}>{stamp}</Text>
              </View>
            </View>

            <ReceiptDivider notch={PALETTE.canvas} />

            <ReceiptLine label="Paid for" value={paidFor} />
            {validUntil ? <ReceiptLine label="Valid until" value={validUntil} /> : null}
            <ReceiptLine label="Member name" value={name} />
            <ReceiptLine label="Paid on" value={longDate(paidAt) || dateTime(paidAt)} />
            {method ? <ReceiptLine label="Payment method" value={titleCase(method)} /> : null}
            {receiptOrderId ? <ReceiptLine label="Order" value={receiptOrderId} selectable /> : null}

            <TotalBar label="Amount paid" value={money(amount)} />

            {txnRef ? (
              <View style={s.ref}>
                <View style={s.flexMin}>
                  <Text style={s.idLabel} maxFontSizeMultiplier={1.2}>Transaction reference</Text>
                  <Text style={s.refValue} selectable maxFontSizeMultiplier={1.2}>{txnRef}</Text>
                </View>
                <TouchableOpacity onPress={shareRef} style={s.copyBtn} accessibilityRole="button" accessibilityLabel="Copy or share the transaction reference">
                  <Icon name="content-copy" size={16} color={PALETTE.blue} />
                  <Text style={s.copyText} maxFontSizeMultiplier={1.3}>Copy</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={s.paperFoot} maxFontSizeMultiplier={1.3}>
              {paid && orderId
                ? 'Sent to your registered email and WhatsApp. This is a computer-generated receipt.'
                : 'This is a computer-generated receipt.'}
            </Text>
          </View>
          <TornEdge color={PALETTE.white} height={10} flip />
        </View>
      </Overlap>

      {paid ? (
        <FadeInUp delay={200}>
          <GroupTitle title="Your documents" subtitle="Ready now — open or share." />
          <SurfaceCard style={s.gutter} padded={false}>
            {[
              { icon: 'workspace-premium', title: 'Membership certificate', note: 'With your Member ID', kind: 'membership', tone: 'gold' as const },
              { icon: 'receipt-long', title: '80G tax certificate', note: 'For your income-tax filing', kind: 'tax-exemption', tone: 'green' as const },
            ].map((d, i, arr) => (
              <LinkRow
                key={d.kind}
                icon={d.icon}
                tone={d.tone}
                title={d.title}
                subtitle={d.note}
                onPress={() => navigation.navigate('MemberCertificate', { kind: d.kind })}
                last={i === arr.length - 1}
              />
            ))}
          </SurfaceCard>

          <GroupTitle title="What you can do now" />
          <SurfaceCard style={s.gutter} padded={false}>
            <LinkRow icon="dashboard" title="Your member dashboard" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] })} />
            <LinkRow icon="groups" tone="teal" title="Find and message members" onPress={() => navigation.navigate('MemberDirectory')} />
            <LinkRow icon="event" tone="sky" title="Members-only events" onPress={() => navigation.navigate('MemberEvents')} last />
          </SurfaceCard>
        </FadeInUp>
      ) : null}

      <View style={s.shareWrap}>
        <GradientButton variant="outline" label="Share receipt" icon="share" onPress={share} />
      </View>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexMin: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: SPACE.lg },
  notice: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  skel: { paddingHorizontal: SPACE.lg, gap: SPACE.md },
  paperWrap: {
    marginHorizontal: SPACE.lg,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 0,
  },
  paper: { backgroundColor: PALETTE.white, paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  paperHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  paperHeadText: { flex: 1, minWidth: 0 },
  paperEyebrow: { ...PREMIUM_TYPE.eyebrow, fontSize: 10, color: PALETTE.blue },
  paperOrg: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: 2 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg },
  idLabel: { ...PREMIUM_TYPE.eyebrow, fontSize: 10, color: PALETTE.textFaint },
  idValue: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: 1.5, color: BRAND.navy, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },
  stamp: { borderWidth: 2.5, borderRadius: 10, paddingHorizontal: SPACE.sm + 2, paddingVertical: 4, transform: [{ rotate: '-10deg' }] },
  stampPaid: { borderColor: PALETTE.green, backgroundColor: '#ECFDF5' },
  stampWait: { borderColor: PALETTE.amber, backgroundColor: '#FFFBEB' },
  stampText: { fontSize: 16, lineHeight: 20, fontWeight: '900', letterSpacing: 2 },
  ref: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md, padding: SPACE.md, borderRadius: 14, backgroundColor: PALETTE.field },
  refValue: { ...TYPE.bodyStrong, fontSize: 13, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: 999, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  copyText: { ...TYPE.label, color: PALETTE.blue, fontWeight: '700' },
  paperFoot: { ...TYPE.caption, fontSize: 11, textAlign: 'center', marginTop: SPACE.lg, color: PALETTE.textFaint },
  shareWrap: { paddingHorizontal: SPACE.lg, marginTop: SPACE.xl },
});

export default PaymentSuccessScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
