import { membershipValidityLabel } from '../../../utils/membershipDates';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  Badge, Skeleton, PALETTE, SPACE, TYPE, money,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, HeaderStat, HeaderStatRow, FadeInUp, GradientButton,
  SurfaceCard, GradientGlyph, GlyphTone, GLYPH_COLORS, GroupTitle, LinkRow, MeterBar, ReceiptLine, CardSkeletons,
  MembershipPassCard, PremiumPlan3D, PlatinumCrown3D,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import { getMyProfile, getMyApplications } from '../../../services/memberApi';
import { getHeldMembershipPlan, readRenewal, Plan, RenewalInfo } from '../../../services/paymentFlow';
import { isLifetimeTier } from '../../../utils/heldMembershipPlan';
import { pickMostAdvancedApplication, resolveApplicantKind, planLabelFor } from '../dashboard/memberRules';

/**
 * ============================================================================
 * MEMBERSHIP PLAN — website `features/member/pages/MembershipPlanDetails.tsx`
 * ============================================================================
 *
 *   GET /members/my-profile           status, Member ID, dates, what was paid, `renewal`
 *   GET /applications/my-applications the declared kind (plan label fallback)
 *   GET /membership/plans?include=platinum  match the plan actually held
 *
 * NO FALLBACK PRICE. When the rate cannot be read the card says so with a
 * retry — a number invented here would be wrong the moment the Super Admin
 * edits one. What the member PAID comes from their own record, a dash if none.
 */

const longDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

/** The website's renewalMessage. */
const renewalMessage = (r: RenewalInfo | null): string => {
  if (!r) return '';
  const on = membershipValidityLabel(r.expiresAt);
  if (r.state === 'expired') {
    return on
      ? `Your membership ended on ${on}. Renew now to restore every member benefit.`
      : 'Your membership has ended. Renew now to restore every member benefit.';
  }
  if (r.canRenew && r.daysLeft !== null) {
    const days = Math.max(0, r.daysLeft);
    return `Your membership ends ${days === 0 ? 'today' : `in ${days} ${days === 1 ? 'day' : 'days'}`}${on ? ` (${on})` : ''}. `
      + 'Renew now — the new year starts when this one ends, so you lose nothing.';
  }
  return '';
};

const MembershipPlanDetailsScreen = ({ navigation }: any) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [priceFailed, setPriceFailed] = useState(false);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    const [p, a] = await Promise.allSettled([getMyProfile(), getMyApplications()]);
    setProfile(p.status === 'fulfilled' ? p.value : null);
    if (a.status === 'fulfilled') setApplication(pickMostAdvancedApplication(a.value));
    try {
      const selected = await getHeldMembershipPlan(p.status === 'fulfilled' ? p.value : null);
      setPlan(selected);
      setPriceFailed(!selected);
    } catch {
      setPlan(null);
      setPriceFailed(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renewal = useMemo(() => readRenewal(profile), [profile]);
  const membershipType = String(profile?.membershipType || '').trim();
  const platinum = isLifetimeTier(profile);
  const lifetime = platinum || membershipType.toLowerCase() === 'lifetime';
  const status = String(profile?.membershipStatus || 'active');
  const activeNow = status.toLowerCase() === 'active';
  const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';
  const expiresAt = useMemo(() => {
    if (lifetime) return '';
    if (profile?.membershipExpiresAt) return profile.membershipExpiresAt;
    if (membershipType.toLowerCase() === 'annual' && memberSince) {
      const d = new Date(memberSince);
      if (!Number.isNaN(d.getTime())) { d.setFullYear(d.getFullYear() + 1); return d.toISOString(); }
    }
    return '';
  }, [lifetime, profile?.membershipExpiresAt, membershipType, memberSince]);
  const paidAmount = profile?.lastPaymentAmount ?? profile?.paymentAmount;
  const paidAt = profile?.lastPaymentDate || memberSince;
  const txnRef = String(profile?.paymentId || '');
  const region = [profile?.block, profile?.district, profile?.state]
    .map((v: any) => String(v || '').trim()).filter(Boolean).join(' · ');
  const planName = platinum
    ? 'Lifetime Membership'
    : (profile?.currentMembership?.planName || profile?.paidMembership?.planName || plan?.name || planLabelFor(resolveApplicantKind(profile?.paidMembership?.kind ? { memberType: profile.paidMembership.kind } : application), false) || 'Membership');

  const name = String(profile?.fullName || profile?.name || '').trim() || 'Member';
  const photo = resolveMediaUrl(profile?.profilePhoto || profile?.profileImage || '');
  const validValue = lifetime ? 'Lifetime' : (membershipValidityLabel(expiresAt) || '');

  // How far through the current term — a live figure, from the member's own dates.
  const term = useMemo(() => {
    if (lifetime || !memberSince || !expiresAt) return null;
    const a = new Date(memberSince).getTime();
    const b = new Date(expiresAt).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    const ratio = Math.max(0, Math.min(1, (Date.now() - a) / (b - a)));
    const left = Math.max(0, Math.ceil((b - Date.now()) / 86400000));
    return { ratio, left };
  }, [lifetime, memberSince, expiresAt]);
  const daysLeft = typeof renewal?.daysLeft === 'number' ? Math.max(0, renewal.daysLeft) : term ? term.left : null;

  const header = (
    <PremiumPageHeader
      eyebrow="Your membership"
      title="Membership plan"
      subtitle="What your membership is, what it cost and when it renews."
      onBack={() => navigation.goBack()}
      art={platinum ? <PlatinumCrown3D size={88} /> : <PremiumPlan3D size={88} />}
    >
      {!loading ? (
        <HeaderStatRow>
          <HeaderStat icon={activeNow ? 'verified' : 'schedule'} label="Status" value={status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '—'} />
          <HeaderStat icon="hourglass-bottom" label={lifetime ? 'Term' : 'Days left'} value={lifetime ? 'Lifetime' : daysLeft === null ? '—' : daysLeft} />
        </HeaderStatRow>
      ) : null}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <View style={[styles.overlap, styles.gutter]}><Skeleton height={196} radius={24} /></View>
        <CardSkeletons rows={3} style={{ marginTop: SPACE.lg }} />
      </PremiumPage>
    );
  }

  const facts = [
    profile?.membershipNumber ? { icon: 'verified-user', label: 'Member ID', value: String(profile.membershipNumber) } : null,
    memberSince ? { icon: 'event', label: 'Member since', value: longDate(memberSince) } : null,
    { icon: 'autorenew', label: lifetime ? 'Renewal' : 'Valid until', value: lifetime ? 'No renewal needed' : (membershipValidityLabel(expiresAt) || 'Not recorded') },
    region ? { icon: 'place', label: 'Region', value: region } : null,
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  const docs: { icon: string; tone: GlyphTone; label: string; sub: string; go: () => void }[] = [
    { icon: 'verified', tone: 'blue', label: 'Membership Certificate', sub: 'View · share', go: () => navigation.navigate('MemberCertificate', { kind: 'membership' }) },
    { icon: 'shield', tone: 'green', label: 'Tax Exemption Certificate', sub: 'Section 80G', go: () => navigation.navigate('MemberCertificate', { kind: 'tax-exemption' }) },
    { icon: 'receipt-long', tone: 'amber', label: 'Payment Receipt', sub: 'What you paid, and when', go: () => navigation.navigate('PaymentSuccess', {}) },
  ];

  return (
    <PremiumPage header={header} onRefresh={() => load('refresh')} refreshing={refreshing}>
      {/* ---------------- the plan, as the member's card */}
      <FadeInUp delay={200} style={[styles.overlap, styles.gutter]}>
        <MembershipPassCard
          name={name}
          memberId={profile?.membershipNumber || ''}
          planName={planName}
          status={status}
          validLabel={lifetime ? 'Renewal' : 'Valid till'}
          validValue={validValue}
          photoUri={photo}
          platinum={platinum}
        />
      </FadeInUp>

      <FadeInUp delay={260}>
        <SurfaceCard style={styles.block}>
          {membershipType ? (
            <View style={styles.termRow}>
              <Badge label={`${membershipType.charAt(0).toUpperCase()}${membershipType.slice(1)} term`} icon="event-repeat" color={PALETTE.blueDark} bg={PALETTE.blueSoft} size="sm" />
              {lifetime ? <Badge label="Lifetime" icon="all-inclusive" color={PALETTE.goldDark} bg={PALETTE.goldSoft} size="sm" /> : null}
            </View>
          ) : null}
          <View style={styles.factGrid}>
            {facts.map((f) => (
              <View key={f.label} style={styles.fact}>
                <GradientGlyph icon={f.icon} tone="navy" size={34} />
                <View style={styles.flexText}>
                  <Text style={styles.factLabel} maxFontSizeMultiplier={1.3}>{f.label}</Text>
                  <Text style={styles.factValue} selectable maxFontSizeMultiplier={1.3}>{f.value}</Text>
                </View>
              </View>
            ))}
          </View>
          {term ? (
            <View style={styles.termMeter}>
              <View style={styles.termHead}>
                <Text style={styles.factLabel}>This term</Text>
                <Text style={styles.termPct}>{Math.round(term.ratio * 100)}% used · {term.left} {term.left === 1 ? 'day' : 'days'} left</Text>
              </View>
              <MeterBar value={Math.max(term.ratio, 0.03)} colors={term.ratio > 0.9 ? GLYPH_COLORS.amber : GLYPH_COLORS.blue} />
            </View>
          ) : null}
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- what this plan costs */}
      <GroupTitle title="What this plan costs" subtitle="The association's current rate for your plan" />
      <FadeInUp delay={300}>
        {priceFailed || !plan ? (
          <SurfaceCard style={styles.gutter} accent={PALETTE.amber}>
            <View style={styles.warnTop}>
              <GradientGlyph icon="warning-amber" tone="amber" size={40} />
              <View style={styles.flexText}>
                <Text style={styles.warnTitle}>The current rate could not be loaded</Text>
                <Text style={styles.warnText}>Your recorded payment is shown below. Please retry to load this membership's current rate.</Text>
              </View>
            </View>
            <GradientButton label="Try again" icon="refresh" variant="outline" onPress={() => { setLoading(true); load(); }} style={{ marginTop: SPACE.lg }} />
          </SurfaceCard>
        ) : (
          <SurfaceCard style={styles.gutter} padded={false}>
            <LinearGradient colors={platinum ? ['#F7E6B5', '#FFFCF3'] : ['#EAF1FE', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.priceHead}>
              <Text style={TYPE.eyebrow}>Current rate</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{money(plan.price)}</Text>
                <Text style={styles.per}>{lifetime || plan.membershipType === 'lifetime' ? 'one-time · lifetime' : 'per year'}</Text>
              </View>
              {plan.description ? <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>{plan.description}</Text> : null}
            </LinearGradient>
            {(plan.features || []).length ? (
              <View style={styles.features}>
                {(plan.features || []).map((feat, i) => (
                  <View key={`${feat}-${i}`} style={styles.feature}>
                    <View style={styles.tick}><Icon name="check" size={14} color={PALETTE.white} /></View>
                    <Text style={styles.featureText}>{feat}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </SurfaceCard>
        )}
      </FadeInUp>

      {/* ---------------- what you paid */}
      <GroupTitle title="What you paid" subtitle="The payment this membership was issued against" />
      <FadeInUp delay={340}>
        <SurfaceCard style={styles.gutter}>
          <View style={styles.paidTop}>
            <GradientGlyph icon="payments" tone="green" size={44} />
            <View style={styles.flexText}>
              <Text style={TYPE.eyebrow}>Amount paid</Text>
              <Text style={styles.paid}>{money(paidAmount)}</Text>
            </View>
          </View>
          <View style={styles.paidLines}>
            <ReceiptLine label="Paid on" value={paidAt ? longDate(paidAt) : ''} />
            {txnRef ? <ReceiptLine label="Transaction reference" value={txnRef} selectable /> : null}
          </View>
          <GradientButton label="View payment receipt" icon="receipt-long" variant="outline" onPress={() => navigation.navigate('PaymentSuccess', {})} style={{ marginTop: SPACE.md }} />
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- documents */}
      <GroupTitle title="Documents for this plan" subtitle="Issued against your active membership" action="All" onAction={() => navigation.navigate('MemberDocuments')} />
      <FadeInUp delay={380}>
        <SurfaceCard style={styles.gutter} padded={false}>
          {docs.map((d, i) => (
            <LinkRow key={d.label} icon={d.icon} tone={d.tone} title={d.label} subtitle={d.sub} onPress={d.go} last={i === docs.length - 1} />
          ))}
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- renewal */}
      <GroupTitle title="Renewal" />
      <FadeInUp delay={420}>
        <SurfaceCard style={styles.gutter} padded={false}>
          <LinearGradient colors={['#EAF1FE', '#FFFFFF', '#EAF1FE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.renew}>
            <View style={styles.renewTop}>
              <GradientGlyph icon="auto-awesome" tone="blue" size={44} />
              <View style={styles.flexText}>
                <Text style={TYPE.heading}>{lifetime ? 'This membership does not expire' : 'Keep your membership active'}</Text>
                <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>
                  {lifetime
                    ? 'Nothing to renew — your benefits continue for life.'
                    : renewal?.canRenew
                      ? renewalMessage(renewal)
                      : expiresAt
                        ? `Your plan runs to ${membershipValidityLabel(expiresAt)}.${renewal?.opensAt ? ` Renewal opens on ${longDate(renewal.opensAt)}.` : ''}`
                        : 'Your renewal date is not recorded yet.'}
                </Text>
              </View>
            </View>
            {!lifetime && renewal?.canRenew ? (
              <GradientButton label="Renew now" icon="autorenew" iconRight="arrow-forward" onPress={() => navigation.navigate('MembershipPlans', { renew: true })} style={{ marginTop: SPACE.lg }} />
            ) : (
              <GradientButton label="Ask about renewal" icon="support-agent" variant="outline" onPress={() => navigation.navigate('MemberHelp')} style={{ marginTop: SPACE.lg }} />
            )}
          </LinearGradient>
        </SurfaceCard>
      </FadeInUp>

      {!platinum ? (
        <FadeInUp delay={460}>
          <SurfaceCard style={styles.block} onPress={() => navigation.navigate('PlatinumRequest')} accessibilityLabel="Lifetime Membership. Learn more" padded={false}>
            <LinearGradient colors={['#111827', '#374151', '#6B7280']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.platinum}>
              <PlatinumCrown3D size={64} />
              <View style={styles.flexText}>
                <Text style={styles.platTitle}>Go Lifetime</Text>
                <Text style={styles.platText}>One payment makes your membership permanent — no renewals.</Text>
              </View>
              <Icon name="chevron-right" size={24} color={PALETTE.white} />
            </LinearGradient>
          </SurfaceCard>
        </FadeInUp>
      ) : null}
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  block: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  flexText: { flex: 1, minWidth: 0 },

  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.md },
  factGrid: { gap: SPACE.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  factLabel: { ...TYPE.caption },
  factValue: { ...TYPE.bodyStrong, marginTop: 1 },
  termMeter: { marginTop: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  termHead: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm, marginBottom: SPACE.sm },
  termPct: { ...TYPE.caption, fontWeight: '700', color: PALETTE.blueDark, flexShrink: 1, textAlign: 'right' },

  priceHead: { padding: SPACE.lg },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, flexWrap: 'wrap', marginTop: SPACE.xs },
  price: { ...TYPE.display, color: '#0B1A45', fontVariant: ['tabular-nums'] },
  per: { ...TYPE.label, color: PALETTE.textMuted },
  features: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, paddingTop: SPACE.sm, gap: SPACE.sm + 2 },
  feature: { flexDirection: 'row', gap: SPACE.sm + 2, alignItems: 'flex-start' },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: PALETTE.green, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  featureText: { ...TYPE.body, flex: 1 },
  warnTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  warnTitle: { ...TYPE.bodyStrong, color: PALETTE.warningText },
  warnText: { ...TYPE.caption, fontSize: 13, lineHeight: 18, color: PALETTE.warningText, marginTop: SPACE.xs },

  paidTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  paid: { ...TYPE.number, color: '#0B1A45' },
  paidLines: { marginTop: SPACE.md, paddingTop: SPACE.xs, borderTopWidth: 1, borderTopColor: PALETTE.divider },

  renew: { padding: SPACE.lg },
  renewTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  platinum: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, paddingRight: SPACE.lg },
  platTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: PALETTE.white },
  platText: { ...TYPE.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
});

export default MembershipPlanDetailsScreen;
