import { useLegacyAppearance } from '../../ui/legacyAppearance';
import { membershipValidityLabel } from '../../utils/membershipDates';
import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BottomActionBar, Notice, PALETTE, SPACE, TYPE, BRAND, money, shortDate,
  PremiumPage, PremiumPageHeader, PremiumPlan3D, GlassBadge, GradientButton, PressableScale, FadeInUp,
  SurfaceCard, GradientGlyph, GroupTitle, StateView, CardSkeletons, ReceiptLine, PREMIUM_TYPE, PremiumSelect,
} from '../../ui';
import {
  getMyPlans, getUpgradePlans, getMyProfile, getHeldMembershipPlan, readRenewal, bandLabel, Plan, MyPlans, RenewalInfo,
} from '../../services/paymentFlow';
import { getMyApplications } from '../../services/memberApi';
import { pickMostAdvancedApplication } from '../member/dashboard/memberRules';
import { Overlap, TotalBar, TrustLine } from './paymentUi';

/**
 * ============================================================================
 * MEMBERSHIP PLANS — the website's /payment/membership-plans, mobile-native
 * ============================================================================
 *
 *   GET /membership/plans/mine   the plans THIS member is offered. The server
 *                                resolves the band from the member's own
 *                                business record (or the aspirant/student
 *                                kind); one plan unless the Super Admin turned
 *                                on "show all plans". Platinum never appears.
 *   GET /members/my-profile      `renewal` — whether a Renew is allowed, the
 *                                same rule the payment order enforces.
 *
 * No price lives in the app: every figure on this screen is the server's, and
 * the checkout sends only the plan key. A failed load says "could not load the
 * prices" (retry); an empty list from a healthy server says "no plans".
 *
 * Also rendered for the legacy `CompleteMembership` route (ApplicationStatus
 * still navigates there), so its params are read defensively.
 */

const PAID = ['active', 'completed'];

/* The website's AFTER_PAYMENT (pages/member/Payment.tsx). */
const AFTER_PAYMENT = [
  { icon: 'bolt', title: 'Instant activation', text: 'Your membership goes live the moment payment clears.' },
  { icon: 'description', title: 'Digital certificates', text: 'Membership and 80G certificates, ready to download.' },
  { icon: 'mark-email-read', title: 'Email & WhatsApp receipt', text: 'A confirmation with your Member ID, on both.' },
  { icon: 'dashboard', title: 'Full member dashboard', text: 'Directory, messages, events and every benefit.' },
];

/* The website's KIND_BENEFITS — per kind, so a student reads a student's reasons. */
const KIND_BENEFITS: Record<'student' | 'aspirant' | 'business', { icon: string; title: string; text: string }[]> = {
  student: [
    { icon: 'handshake', title: 'Mentorship', text: 'Guidance from established ACTIV entrepreneurs while you study.' },
    { icon: 'event', title: 'Events & workshops', text: 'Invitations to conclaves, seminars and skill workshops.' },
    { icon: 'groups', title: 'Learn and participate', text: 'Attend events and learning programmes. Upgrade to connect and chat with business members.' },
    { icon: 'account-balance', title: 'Schemes & funding', text: 'Updates on government schemes for first-generation entrepreneurs.' },
    { icon: 'workspace-premium', title: 'Membership certificate', text: 'An official ACTIV certificate for your résumé and portfolio.' },
    { icon: 'trending-up', title: 'Grow into business', text: 'Move to a Business membership the day you start trading.' },
  ],
  aspirant: [
    { icon: 'handshake', title: 'Start-up guidance', text: 'Mentors who have built businesses, for the one you are planning.' },
    { icon: 'account-balance', title: 'Schemes & funding', text: 'Stand-Up India, MSME and state schemes explained and announced.' },
    { icon: 'groups', title: 'Member network', text: 'Suppliers, partners and customers in the ACTIV Network.' },
    { icon: 'event', title: 'Events & workshops', text: 'Invitations to conclaves, seminars and business programmes.' },
    { icon: 'storefront', title: 'Business account', text: 'Draft your company page and catalogue before you launch.' },
    { icon: 'workspace-premium', title: 'Membership certificate', text: 'An official ACTIV certificate with your Member ID.' },
  ],
  business: [
    { icon: 'groups', title: 'B2B network', text: 'Find and message members across every region.' },
    { icon: 'storefront', title: 'Company page & catalogue', text: 'Showcase your company and products to the association.' },
    { icon: 'bar-chart', title: 'Reach analytics', text: 'See who views your company and products.' },
    { icon: 'event', title: 'Members-only events', text: 'Conclaves, trade programmes and business meets.' },
    { icon: 'account-balance', title: 'Schemes & tenders', text: 'Updates on schemes and opportunities for SC/ST enterprises.' },
    { icon: 'workspace-premium', title: 'Certificates', text: 'Membership certificate and your 80G receipt.' },
  ],
};

const TILE_TONES = ['blue', 'teal', 'sky', 'amber', 'green', 'navy'] as const;

function BenefitTile({ icon, title, text, tone, muted }: { icon: string; title: string; text: string; tone: typeof TILE_TONES[number]; muted?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return (
    <View style={s.tileCell}>
      <View style={[s.tile, muted && s.tileMuted]}>
        <GradientGlyph icon={icon} tone={tone} size={38} iconSize={19} />
        <Text style={s.tileTitle} maxFontSizeMultiplier={1.3}>{title}</Text>
        <Text style={s.tileText} maxFontSizeMultiplier={1.3}>{text}</Text>
      </View>
    </View>
  );
}

/** A premium, selectable plan: gradient frame + glow when chosen, radio mark, big price, ticked features. */
function PlanCard({ plan, selected, ribbon, onSelect, delay }: {
  plan: Plan; selected: boolean; ribbon: string; onSelect: () => void; delay: number;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const band = bandLabel(plan);
  const lifetime = String(plan?.membershipType || '').toLowerCase() === 'lifetime';
  const features = plan?.features || [];
  const inner = (
    <View style={s.planInner}>
      <View style={s.planTop}>
        <GradientGlyph icon={lifetime ? 'all-inclusive' : 'workspace-premium'} tone={selected ? 'navy' : 'blue'} size={46} />
        <View style={s.planHeadText}>
          <Text style={s.planName} numberOfLines={2} maxFontSizeMultiplier={1.3}>{plan?.name || 'Membership'}</Text>
          {band || plan?.experience ? (
            <View style={s.bandPill}><Text style={s.bandText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{band || plan?.experience}</Text></View>
          ) : null}
        </View>
        <View style={[s.radio, selected && s.radioOn]}>
          {selected ? <Icon name="check" size={16} color={PALETTE.white} /> : null}
        </View>
      </View>

      {ribbon ? (
        <View style={s.ribbon}>
          <Icon name="star" size={13} color={PALETTE.amber} />
          <Text style={s.ribbonText} maxFontSizeMultiplier={1.2}>{ribbon}</Text>
        </View>
      ) : null}

      <View style={s.priceRow}>
        <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>{money(plan?.price)}</Text>
        <Text style={s.per} maxFontSizeMultiplier={1.2}>{lifetime ? 'one-time · lifetime' : '/ year'}</Text>
      </View>
      {plan?.description ? <Text style={s.desc} maxFontSizeMultiplier={1.3}>{plan.description}</Text> : null}

      {features.length ? (
        <>
          <View style={s.planRule} />
          <View style={s.features}>
            {features.map((f, i) => (
              <View key={`${plan?.key || 'plan'}-f-${i}`} style={s.feature}>
                <View style={[s.featureTick, selected && s.featureTickOn]}>
                  <Icon name="check" size={12} color={selected ? PALETTE.white : PALETTE.blue} />
                </View>
                <Text style={s.featureText} maxFontSizeMultiplier={1.3}>{f}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={[s.pickPill, selected && s.pickPillOn]}>
        {selected ? <Icon name="check-circle" size={16} color={PALETTE.white} /> : null}
        <Text style={[s.pickText, selected && { color: PALETTE.white }]} maxFontSizeMultiplier={1.3}>{selected ? 'Selected' : 'Choose this plan'}</Text>
      </View>
    </View>
  );
  return (
    <FadeInUp delay={delay}>
      <PressableScale
        onPress={onSelect}
        scaleTo={0.98}
        style={[s.planShadow, selected && s.planShadowOn]}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${plan?.name || 'Membership'}, ${money(plan?.price)}${ribbon ? `, ${ribbon}` : ''}`}
      >
        {selected ? (
          <LinearGradient colors={[BRAND.navy, BRAND.blue, '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.planFrame}>{inner}</LinearGradient>
        ) : (
          <View style={[s.planFrame, s.planFrameIdle]}>{inner}</View>
        )}
      </PressableScale>
    </FadeInUp>
  );
}

const MembershipPlansScreen: React.FC<any> = ({ navigation, route }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const renewParam = route?.params?.renew === true;
  const upgrading = route?.params?.upgrade === true;
  const [upgradeReason, setUpgradeReason] = useState('');
  const [commencementYear, setCommencementYear] = useState('');
  const [data, setData] = useState<MyPlans | null>(null);
  const [heldPlan, setHeldPlan] = useState<Plan | null>(null);
  const [renewal, setRenewal] = useState<RenewalInfo | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState('');
  /* '' = none on file, else the (lower-cased) status of the most advanced one. */
  const [appStatus, setAppStatus] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const [plans, profile, apps] = await Promise.all([
        upgrading ? getUpgradePlans() : getMyPlans(),
        getMyProfile().catch(() => null),
        getMyApplications().catch(() => [] as any[]),
      ]);
      /* The application id travels with the order, as on the website (optional). */
      const app = pickMostAdvancedApplication(apps || []);
      setApplicationId(String(app?.applicationId || app?._id || app?.id || ''));
      setAppStatus(app ? String(app?.status || '').toLowerCase() : '');
      setData(plans);
      // Display the membership actually held, never an unpurchased upgrade.
      setHeldPlan(upgrading && (plans.canPurchase === false || !plans.plans.length)
        ? plans.currentPlanDetails || (profile ? await getHeldMembershipPlan(profile).catch(() => null) : null) : null);
      if (upgrading && (!quiet || plans.canPurchase === false)) setCommencementYear(plans.commencementYear || '');
      if (upgrading) setUpgradeReason(plans.reason || 'The full plan fee is charged. The new annual membership starts after successful payment and is valid for one year.');
      setRenewal(readRenewal(profile));
      setStatus(String(profile?.membershipStatus || '').toLowerCase());
      // Pre-select the server's match, else the only plan — never a guess.
      const list = plans?.plans || [];
      const pick = plans?.matched?.key && list.some((p) => p.key === plans.matched?.key)
        ? plans.matched.key
        : list.length === 1 ? list[0].key : null;
      setSelectedKey((prev) => (quiet && prev && list.some((p) => p.key === prev) ? prev : pick));
    } catch {
      setData({ plans: [], matched: null, years: null, reason: '', showAllPlans: false, failed: true });
      setSelectedKey(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [upgrading]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const plans = useMemo(() => data?.plans || [], [data]);
  const selected = useMemo(() => plans.find((p) => p.key === selectedKey) || null, [plans, selectedKey]);

  const isPaid = PAID.includes(status) && renewal?.state !== 'expired';
  const renewing = !upgrading && (renewParam || renewal?.state === 'expired' || (isPaid && renewal?.canRenew === true));
  /* A paid member may only pay again when the SERVER says they can renew —
     never offer a button the order would refuse. */
  const blocked = upgrading ? data?.canPurchase === false : isPaid && renewal?.canRenew !== true;
  const viewingCurrentPlan = upgrading && !loading && !data?.failed && (blocked || !plans.length);
  /* The website's PaymentRegistration gate: a first payment needs an
     application, and that application must be approved. */
  const notApproved = !upgrading && !isPaid && !renewing && appStatus !== null
    && (appStatus === '' || !/approved/.test(appStatus) || /reject/.test(appStatus));

  /* Whose plan this is — the server's audience on the offered rows. */
  const audience = plans[0]?.audience || 'business';
  const kindKey: 'student' | 'aspirant' | 'business' = audience === 'student' ? 'student' : audience === 'aspirant' ? 'aspirant' : 'business';
  const kindLabel = kindKey === 'business' ? 'Business' : kindKey === 'student' ? 'Student' : 'Aspirant';
  const journey = upgrading
    ? [{ label: 'Profile', state: 'done' }, { label: 'Plan', state: 'now' }, { label: 'Payment', state: 'next' }, { label: 'Active', state: 'next' }]
    : renewing
    ? [{ label: renewal?.state === 'expired' ? 'Expired' : 'Member', state: 'done' }, { label: 'Renew', state: 'now' }, { label: 'Active', state: 'next' }]
    : [{ label: 'Application', state: 'done' }, { label: 'Approved', state: 'done' }, { label: 'Payment', state: 'now' }, { label: 'Active', state: 'next' }];
  const selectedLifetime = String(selected?.membershipType || '').toLowerCase() === 'lifetime';

  const onContinue = () => {
    if (!selected || blocked) return;
    if (upgrading && selected.audience === 'business') {
      if (!selected.commencementYears?.includes(commencementYear)) { Alert.alert('Business commencement year', 'Choose the year your business started from the available plan range.'); return; }
    }
    navigation.navigate('PaymentCheckout', {
      orderType: 'membership', planId: selected.key, renew: renewing,
      upgrade: upgrading,
      commencementYear: upgrading && selected.audience === 'business' ? commencementYear : undefined,
      ...(applicationId ? { applicationId } : {}),
    });
  };

  const onBack = navigation.canGoBack() ? () => navigation.goBack() : undefined;

  const header = (
    <PremiumPageHeader
      onBack={onBack}
      right={<GlassBadge label="Secure" icon="lock" />}
      eyebrow={viewingCurrentPlan ? 'Your ACTIV membership' : upgrading ? 'Membership upgrade' : renewing ? 'Renewal' : notApproved ? 'ACTIV membership' : 'Application approved'}
      title={viewingCurrentPlan ? 'Your plan & benefits' : upgrading ? 'Upgrade membership' : renewing ? 'Keep your benefits going' : plans.length === 1 && !loading ? 'One step away' : 'Choose your membership'}
      subtitle={viewingCurrentPlan ? 'Explore what is included in your membership and how it grows with you.' : loading ? 'Prices are set by ACTIV.' : upgrading
        ? 'Choose your new plan using the same email, password and mobile. Your profile updates after verified payment.'
        : renewing
        ? 'Your new year starts when the current one ends — renewing early loses nothing.'
        : plans.length > 1
          ? 'Pick the plan that fits you. The price is confirmed by ACTIV at payment.'
          : 'This is the plan for your membership, based on what you declared in your application.'}
      art={<PremiumPlan3D size={88} />}
      artLabel="Membership card"
    >
      {!viewingCurrentPlan && <View style={s.journey} accessibilityLabel="Your progress">
        {journey.map((step, i) => (
          <React.Fragment key={step.label}>
            <View style={[s.step, step.state === 'now' ? s.stepNow : step.state === 'done' ? s.stepDone : s.stepNext]}>
              {step.state === 'done' ? <Icon name="check-circle" size={13} color={PALETTE.white} /> : null}
              <Text style={[s.stepText, step.state === 'now' && { color: BRAND.navy }]} maxFontSizeMultiplier={1.2}>{step.label}</Text>
            </View>
            {i < journey.length - 1 ? <View style={s.stepLine} /> : null}
          </React.Fragment>
        ))}
      </View>}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <Overlap><CardSkeletons rows={2} variant="media" /></Overlap>
      </PremiumPage>
    );
  }

  if (data?.failed) {
    return (
      <PremiumPage header={header} refreshing={refreshing} onRefresh={() => load(true)}>
        <Overlap>
          <SurfaceCard style={s.gutter}>
            <StateView kind="error" compact title="Could not load the prices" message="Nothing has been charged. Check your connection and try again." onAction={() => load()} />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  const showBar = !blocked && !notApproved && plans.length > 0;
  const payLabel = selected
    ? `${renewing ? 'Renew' : 'Pay'} ${money(selected.price)}`
    : 'Choose a plan';

  if (viewingCurrentPlan) {
    return (
      <PremiumPage header={header} refreshing={refreshing} onRefresh={() => load(true)}>
        <Overlap>
          <SurfaceCard style={s.gutter}>
            {heldPlan ? <>
              <View style={s.planTop}>
                <GradientGlyph icon="workspace-premium" tone="blue" size={48} />
                <View style={s.planHeadText}>
                  <Text style={s.bandText}>CURRENT PLAN</Text>
                  <Text style={s.planName}>{heldPlan.name}</Text>
                  <Text style={s.desc}>{heldPlan.membershipType === 'lifetime' ? 'Lifetime membership' : 'Annual membership'}</Text>
                </View>
              </View>
              {heldPlan.description ? <Text style={s.desc}>{heldPlan.description}</Text> : null}
              {data?.kind === 'business' && <View style={{ marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 16, backgroundColor: PALETTE.blueSoft }}>
                <Text style={s.bandText}>BUSINESS COMMENCEMENT YEAR</Text>
                <Text accessibilityLabel="Business commencement year" style={s.planName}>{commencementYear || 'Not recorded'}</Text>
                <Text style={s.desc}>{heldPlan.commencementYearLabel ? `${heldPlan.name}: businesses started ${heldPlan.commencementYearLabel}.` : 'Your plan follows your saved business commencement year.'}</Text>
                <Text style={s.desc}>Your plan advances automatically as your business reaches the next year range. The new fee applies at renewal.</Text>
              </View>}
              <View style={s.planRule} />
              <Text style={s.planName}>Included in your plan</Text>
              <View style={[s.features, { marginTop: SPACE.md }]}>
                {(heldPlan.features || []).map((feature, i) => <View key={i} style={s.feature}>
                  <View style={s.featureTick}><Icon name="check" size={12} color={PALETTE.blue} /></View>
                  <Text style={s.featureText}>{feature}</Text>
                </View>)}
                {!heldPlan.features?.length ? <Text style={s.desc}>View your membership details for your plan and validity.</Text> : null}
              </View>
              <GradientButton label="View membership details" iconRight="arrow-forward"
                style={{ marginTop: SPACE.lg }} onPress={() => navigation.navigate('MembershipPlanDetails')} />
            </> : <StateView kind="error" compact title="Your plan details could not be loaded"
              message="Refresh to see your current membership and its benefits."
              onAction={() => load()} />}
          </SurfaceCard>
        </Overlap>
        {data?.reason ? <View style={[s.notice, { marginTop: SPACE.lg }]}><Notice kind="info" text={data.reason} /></View> : null}
      </PremiumPage>
    );
  }

  return (
    <PremiumPage
      header={header}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      footer={showBar ? (
        <BottomActionBar>
          <View style={s.barText}>
            <Text style={s.barLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>{selected ? selected.name : 'No plan selected'}</Text>
            <View style={s.barSecure}>
              <Icon name="lock" size={12} color={PALETTE.green} />
              <Text style={s.barNote} numberOfLines={1} maxFontSizeMultiplier={1.2}>Confirmed by ACTIV at payment</Text>
            </View>
          </View>
          <GradientButton
            label={payLabel}
            iconRight="arrow-forward"
            onPress={onContinue}
            disabled={!selected}
            style={s.barBtn}
          />
        </BottomActionBar>
      ) : undefined}
    >
      <Overlap>
        {upgrading && <View style={s.notice}><Notice kind="info" text={upgradeReason} />{selected?.audience === 'business' && data?.canPurchase !== false && <SurfaceCard style={{ marginTop: SPACE.md }}>
          <Text style={s.planName}>When did your business start?</Text>
          <Text style={[s.desc, { marginBottom: SPACE.md }]}>Select the actual year of commencement. {selected.name} covers businesses started {selected.commencementYearLabel || 'within the configured year range'}.</Text>
          <PremiumSelect label="Business commencement year" value={commencementYear} options={selected.commencementYears || []} onChange={setCommencementYear} placeholder="Select a year" hint="Required before payment. Your business profile updates after verified payment." />
        </SurfaceCard>}</View>}
        {notApproved ? (
          <Notice
            kind="warning"
            style={s.notice}
            text={appStatus === ''
              ? 'We could not find your application. Please submit it before paying.'
              : 'Your application must be approved before payment.'}
            action={appStatus === '' ? 'Apply' : 'Track'}
            onAction={() => navigation.navigate(appStatus === '' ? 'PersonalDetailsForm' : 'ApplicationStatus', appStatus === '' ? {} : undefined)}
          />
        ) : null}

        {blocked && !upgrading ? (
          <Notice
            kind="success"
            icon="verified"
            style={s.notice}
            text={renewal?.lifetime
              ? 'Your membership is lifetime — there is nothing to renew.'
              : `Your membership is active${renewal?.expiresAt ? ` until ${membershipValidityLabel(renewal.expiresAt)}` : ''}.${renewal?.opensAt ? ` Renewal opens on ${shortDate(renewal.opensAt)}.` : ''}`}
          />
        ) : !upgrading && renewal?.state === 'expired' ? (
          <Notice kind="warning" style={s.notice} text={`Your membership ended${renewal?.expiresAt ? ` on ${membershipValidityLabel(renewal.expiresAt)}` : ''}. Renew now to restore every member benefit.`} />
        ) : !upgrading && renewal?.canRenew && renewal?.daysLeft !== null ? (
          <Notice kind="info" icon="event" style={s.notice} text={`Your membership ends in ${Math.max(0, Number(renewal?.daysLeft || 0))} days${renewal?.expiresAt ? ` (${membershipValidityLabel(renewal.expiresAt)})` : ''}.`} />
        ) : null}

        {plans.length === 0 ? (
          <SurfaceCard style={s.gutter}>
            <StateView
              compact
              art={<PremiumPlan3D size={64} />}
              title={upgrading ? 'No different plan is available yet' : 'No plans are available right now'}
              message={upgrading ? upgradeReason : 'ACTIV has not published a membership plan for you yet. Please check again later or contact your regional office.'}
              action="Refresh"
              actionIcon="refresh"
              onAction={() => load()}
            />
          </SurfaceCard>
        ) : (
          <View style={s.plans}>
            {plans.map((p, i) => (
              <PlanCard
                key={p.key}
                plan={p}
                delay={220 + i * 80}
                selected={p.key === selectedKey}
                ribbon={!!data?.matched && data.matched.key === p.key && plans.length > 1
                  ? 'Recommended for you'
                  : plans.length === 1 ? 'Your plan' : p?.popular ? 'Most popular' : ''}
                onSelect={() => setSelectedKey(p.key)}
              />
            ))}
          </View>
        )}
      </Overlap>

      {selected ? (
        <FadeInUp delay={120}>
          <GroupTitle title="Order summary" subtitle={`${kindLabel} membership`} />
          <SurfaceCard style={s.gutter}>
            <Text style={s.sumTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>{selected.name}</Text>
            <ReceiptLine label="Member type" value={kindLabel} />
            <ReceiptLine label="Billing" value={selectedLifetime ? 'One-time · lifetime' : 'Yearly'} />
            <ReceiptLine label="Subtotal" value={money(selected.price)} />
            <ReceiptLine label="Tax" value="₹0 · included" muted />
            <TotalBar label="Total" value={money(selected.price)} />
          </SurfaceCard>
        </FadeInUp>
      ) : null}

      {plans.length > 0 ? (
        <>
          <GroupTitle
            title={`Why join as ${kindKey === 'business' ? 'a Business member' : kindKey === 'student' ? 'a Student' : 'an Aspirant'}`}
            subtitle={`What your ${kindLabel.toLowerCase()} membership opens up`}
          />
          <View style={s.tiles}>
            {KIND_BENEFITS[kindKey].map((b, i) => <BenefitTile key={b.title} icon={b.icon} title={b.title} text={b.text} tone={TILE_TONES[i % TILE_TONES.length]} />)}
          </View>

          <GroupTitle title="What happens after you pay" style={{ marginTop: SPACE.sm }} />
          <View style={s.tiles}>
            {AFTER_PAYMENT.map((b) => <BenefitTile key={b.title} icon={b.icon} title={b.title} text={b.text} tone="green" muted />)}
          </View>
        </>
      ) : null}

      <SurfaceCard style={[s.gutter, { marginTop: SPACE.sm }]}>
        <TrustLine icon="lock" tone="green" text="Payments are processed securely by Instamojo. ACTIV never sees your card or UPI details." />
        <TrustLine icon="receipt-long" text="You get a receipt and your ACTIV Member ID the moment the payment is confirmed." style={{ marginTop: SPACE.md }} />
      </SurfaceCard>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  notice: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  plans: { paddingHorizontal: SPACE.lg, gap: SPACE.lg },

  planShadow: {
    borderRadius: 26, backgroundColor: PALETTE.white,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4,
  },
  planShadowOn: { shadowColor: PALETTE.blue, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 10 },
  planFrame: { borderRadius: 26, padding: 2 },
  planFrameIdle: { backgroundColor: PALETTE.border },
  planInner: { borderRadius: 24, backgroundColor: PALETTE.white, padding: SPACE.lg + 2 },
  planTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  planHeadText: { flex: 1, minWidth: 0 },
  planName: { ...TYPE.heading, fontSize: 18, lineHeight: 24 },
  bandPill: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: PALETTE.field, maxWidth: '100%' },
  bandText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: PALETTE.textSoft },
  radio: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.white },
  radioOn: { borderColor: PALETTE.blue, backgroundColor: PALETTE.blue },
  ribbon: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: SPACE.md,
    paddingHorizontal: SPACE.sm + 2, paddingVertical: 4, borderRadius: 999, backgroundColor: PALETTE.amberSoft, borderWidth: 1, borderColor: '#FDE68A',
  },
  ribbonText: { fontSize: 12, lineHeight: 15, fontWeight: '800', color: PALETTE.amberDark },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: SPACE.lg },
  price: { fontSize: 38, lineHeight: 42, fontWeight: '900', letterSpacing: -1, color: BRAND.navy, fontVariant: ['tabular-nums'], flexShrink: 1 },
  per: { ...TYPE.caption, fontSize: 13, paddingBottom: 5 },
  desc: { ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.sm },
  planRule: { height: 1, backgroundColor: PALETTE.divider, marginVertical: SPACE.lg },
  features: { gap: SPACE.sm + 2 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm + 2 },
  featureTick: { width: 20, height: 20, borderRadius: 10, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  featureTickOn: { backgroundColor: PALETTE.blue },
  featureText: { ...TYPE.body, color: PALETTE.textSoft, flex: 1, minWidth: 0 },
  pickPill: { marginTop: SPACE.lg, minHeight: 44, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: PALETTE.field },
  pickPillOn: { backgroundColor: BRAND.navy },
  pickText: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: PALETTE.textSoft },

  barText: { flex: 1, minWidth: 0, justifyContent: 'center' },
  barLabel: { ...TYPE.bodyStrong },
  barSecure: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  barNote: { ...TYPE.caption, fontSize: 11, lineHeight: 14, color: PALETTE.textMuted, flexShrink: 1 },
  barBtn: { minWidth: 150, maxWidth: '62%' },

  journey: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: SPACE.sm - 2 },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stepDone: { backgroundColor: 'rgba(255,255,255,0.2)' },
  stepNow: { backgroundColor: PALETTE.white },
  stepNext: { backgroundColor: 'rgba(255,255,255,0.1)' },
  stepText: { ...PREMIUM_TYPE.eyebrow, fontSize: 10, letterSpacing: 0.6, color: PALETTE.white },
  stepLine: { width: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 3 },

  sumTitle: { ...TYPE.heading, marginBottom: SPACE.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: SPACE.lg },
  tileCell: { width: '48.5%', marginBottom: SPACE.md },
  tile: {
    flex: 1, backgroundColor: PALETTE.white, borderRadius: 20, borderWidth: 1, borderColor: PALETTE.border, padding: SPACE.md,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  tileMuted: { backgroundColor: PALETTE.fieldBg, shadowOpacity: 0, elevation: 0 },
  tileTitle: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18, marginTop: SPACE.sm },
  tileText: { ...TYPE.caption, fontWeight: '400', marginTop: 2, lineHeight: 17 },
});

export default MembershipPlansScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
