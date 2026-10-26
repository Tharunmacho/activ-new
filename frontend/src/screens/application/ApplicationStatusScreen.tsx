import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import {
  BottomActionBar, Skeleton, PALETTE, SIZE, SPACE, TYPE, shortDate,
  PremiumScrollScreen, PREMIUM_OVERLAP, PremiumHeading, GlassIconButton, FloatingIllustration, FadeInUp,
  GradientButton, PremiumCard, PremiumSectionHeader, GradientIconChip, PremiumEmptyState, AnimatedProgressBar,
  StatusTracker3D, BRAND, ChipTone,
} from '../../ui';
import { errorText } from '../../ui/data';
import { getMyApplications, getMyProfile, formatApplicationRef, isPaidMember } from '../../services/memberApi';
import {
  pickMostAdvancedApplication, deriveApprovalFlags, timelineStageStatus, tierDecidedByLabel, tierDecidedAt,
  applicantKindLabel, StageState, Tier,
} from '../member/dashboard/memberRules';
import { JourneyTrack, JourneyNode } from '../member/dashboard/DashboardPremium';

/**
 * ============================================================================
 * APPLICATION STATUS (website: pages/member/ApplicationStatus.tsx)
 * ============================================================================
 *
 *   GET /applications/my-applications   the MOST ADVANCED row — approved, then
 *                                       rejected, then the newest — so a
 *                                       duplicate untouched row can never hide
 *                                       a decision (pickMostAdvancedApplication)
 *   GET /members/my-profile             paid? A paid member has nothing
 *                                       outstanding and is sent to their dashboard.
 *
 * All three reviews run at the same time; the State Admin's approval is the one
 * that grants the membership, then payment. Each tier row names who signed it
 * (`tierReviews`, resolved by the server). Members abroad: head office only.
 *
 * Premium: the brand header carries the verdict, a document-and-dial
 * illustration and — as the website's hero does — the stage track (Block →
 * District → State → Payment) with the percentage. Pull to refresh.
 */

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ApplicationStatus'>;
};

type StageKey = Tier | 'payment';

const STAGES: { key: StageKey; name: string; short: string; grants: boolean }[] = [
  { key: 'block', name: 'Block Admin Review', short: 'Block', grants: false },
  { key: 'district', name: 'District Admin Review', short: 'District', grants: false },
  { key: 'state', name: 'State Admin Approval', short: 'State', grants: true },
  { key: 'payment', name: 'Membership Payment', short: 'Payment', grants: false },
];

const ABROAD_STAGES: typeof STAGES = [
  { key: 'state', name: 'ACTIV Head Office Approval', short: 'Head Office', grants: true },
  { key: 'payment', name: 'Membership Payment', short: 'Payment', grants: false },
];

const STATE_UI: Record<StageState, { fg: string; bg: string; label: string; icon: string; grad: ChipTone }> = {
  approved: { fg: PALETTE.successText, bg: PALETTE.successSoft, label: 'Approved', icon: 'check', grad: 'green' },
  in_progress: { fg: PALETTE.blueDark, bg: PALETTE.blueSoft, label: 'In review', icon: 'hourglass-empty', grad: 'blue' },
  rejected: { fg: PALETTE.dangerText, bg: PALETTE.dangerSoft, label: 'Rejected', icon: 'close', grad: 'rose' },
  pending: { fg: PALETTE.textMuted, bg: PALETTE.field, label: 'Waiting', icon: 'schedule', grad: 'slate' },
};

/** The website's per-stage copy: Block/District endorse, the State admits. */
const stageMessage = (key: StageKey, grants: boolean, status: StageState, reason?: string): string => {
  const tier = key === 'block' ? 'Block' : key === 'district' ? 'District' : 'State';
  if (status === 'approved') {
    return grants ? 'Approved. Your membership has been granted.' : `Your ${tier} Admin has approved your application.`;
  }
  if (status === 'rejected') {
    return reason || (grants
      ? 'Your application was not approved.'
      : `Your ${tier} Admin did not approve your application. The State Admin decides the outcome.`);
  }
  if (status === 'in_progress') {
    return grants
      ? 'Your State Admin has still to review your application. Theirs is the approval that grants the membership.'
      : `Your ${tier} Admin has still to review your application.`;
  }
  return '';
};

function InfoLine({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return (
    <View style={[s.info, !last && s.divider]}>
      <GradientIconChip icon={icon} tone="blue" size={32} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.infoLabel} numberOfLines={1}>{label}</Text>
        <Text style={s.infoValue} selectable>{value || '—'}</Text>
      </View>
    </View>
  );
}

const ApplicationStatusScreen: React.FC<Props> = ({ navigation }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [application, setApplication] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [apps, me] = await Promise.all([getMyApplications(), getMyProfile().catch(() => null)]);
      setApplication(pickMostAdvancedApplication(apps));
      setProfile(me);
      setError('');
    } catch (err) {
      setError(errorText(err, 'Failed to load application status. Please try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isPaid = isPaidMember(profile);

  // A full member has no application outstanding.
  useEffect(() => {
    if (isPaid) navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] });
  }, [isPaid, navigation]);

  const flags = useMemo(() => deriveApprovalFlags(application), [application]);
  const isAbroad = profile?.isInternational === true || application?.isInternational === true;

  const stages = useMemo(() => (isAbroad ? ABROAD_STAGES : STAGES).map((stage) => {
    const isPayment = stage.key === 'payment';
    const status: StageState = isPayment
      ? (isPaid ? 'approved' : flags.isApproved ? 'in_progress' : 'pending')
      : (application ? timelineStageStatus(stage.key as Tier, application) : 'pending');
    return {
      ...stage,
      status,
      badge: isPayment && status === 'in_progress' ? 'Action needed' : '',
      reviewer: isPayment ? 'ACTIV System' : tierDecidedByLabel(application, stage.key as Tier),
      date: isPayment ? '' : shortDate(tierDecidedAt(application, stage.key as Tier)),
      message: isPayment
        ? (isPaid
          ? 'Your membership payment has been received.'
          : flags.isApproved
            ? 'Your application is approved. Please proceed with membership payment.'
            : 'This opens once your State Admin has approved your application.')
        : stageMessage(stage.key, stage.grants, status, application?.rejectionReason),
    };
  }), [application, flags.isApproved, isPaid, isAbroad]);

  const completed = stages.filter((st) => st.status === 'approved').length;
  const progress = stages.length ? Math.round((completed / stages.length) * 100) : 0;
  const track: JourneyNode[] = stages.map((st) => ({ key: st.key, label: st.short, state: st.status, at: st.date || undefined }));

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'MemberMain' }] }));
  const toDashboard = () => navigation.reset({ index: 0, routes: [{ name: 'MemberMain' }] });

  const heroTitle = !application
    ? (loading ? 'Application Status' : 'No application yet')
    : flags.isRejected ? 'Application Rejected' : flags.isApproved ? 'Application Approved' : 'Under Review';
  const heroSub = !application
    ? (loading ? 'Fetching your latest status…' : 'Complete your profile to submit it.')
    : flags.isRejected
      ? 'See the reviewer note below for details.'
      : flags.isApproved
        ? 'You can now complete your membership payment.'
        : `${completed} of ${stages.length} stages completed`;

  const header = (
    <View>
      <View style={s.topRow}>
        <GlassIconButton icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'} onPress={goBack} accessibilityLabel="Go back" />
        <Text style={s.topTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>Track your membership approval</Text>
        <GlassIconButton icon="refresh" onPress={() => load(true)} accessibilityLabel="Refresh" />
      </View>
      <View style={s.heroRow}>
        <FadeInUp delay={60} style={s.heroText}>
          <PremiumHeading
            size="md"
            eyebrow={application ? String(application?.status || 'Pending') : 'Application status'}
            title={heroTitle}
            subtitle={heroSub}
          />
        </FadeInUp>
        <FadeInUp delay={140} scaleFrom={0.85} distance={10}>
          <FloatingIllustration size={92}>
            <StatusTracker3D size={92} />
          </FloatingIllustration>
        </FadeInUp>
      </View>
      {application ? (
        <FadeInUp delay={200} style={s.trackBox}>
          <JourneyTrack nodes={track} />
          <View style={s.trackFoot}>
            <AnimatedProgressBar percent={progress} onDark style={{ flex: 1 }} />
            <Text style={s.pct} maxFontSizeMultiplier={1.2}>{progress}%</Text>
          </View>
          <Text style={s.trackNote} maxFontSizeMultiplier={1.2}>
            {isAbroad ? 'Reviewed by the ACTIV head office' : 'All three reviews run at the same time'}
          </Text>
        </FadeInUp>
      ) : null}
      <View style={{ height: SPACE.xl }} />
    </View>
  );

  const needsPayment = !!application && flags.isApproved && !isPaid;
  const personal = application?.data?.personalDetails || application?.data?.personal || {};
  const regionText = isAbroad
    ? String(application?.place || profile?.place || application?.country || 'Outside India')
    : [application?.block || personal?.block, application?.district || personal?.district, application?.state || personal?.state]
      .filter(Boolean).join(', ');

  return (
    <PremiumScrollScreen
      header={header}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      footer={needsPayment ? (
        <BottomActionBar note="Your application is approved — one step left.">
          <GradientButton
            label="Proceed to payment"
            icon="credit-card"
            style={{ flex: 1 }}
            onPress={() => navigation.navigate('MembershipPlans')}
          />
        </BottomActionBar>
      ) : undefined}
    >
      {loading ? (
        <View style={[s.overlap, s.gutter]}>
          <Skeleton width="100%" height={180} radius={22} />
          <Skeleton width="100%" height={260} radius={22} style={{ marginTop: SPACE.lg }} />
        </View>
      ) : !application ? (
        <FadeInUp delay={200} style={[s.overlap, s.gutter]}>
          <PremiumCard>
            {error ? (
              <PremiumEmptyState icon="cloud-off" title="Could not load this" text={error} action="Try again" onAction={() => load()} />
            ) : (
              <PremiumEmptyState
                art={(
                  <View style={s.emptyArt}>
                    <FloatingIllustration size={96} halo={false}><StatusTracker3D size={96} /></FloatingIllustration>
                  </View>
                )}
                title="No application found"
                text="You haven't submitted an application yet. Complete your profile to get started."
              />
            )}
            {!error ? (
              <GradientButton label="Complete your profile" iconRight="arrow-forward" onPress={() => navigation.navigate('PersonalDetailsForm', { userData: {} })} />
            ) : null}
            <GradientButton label="Back to dashboard" variant="outline" icon="dashboard" onPress={toDashboard} style={{ marginTop: SPACE.sm }} />
          </PremiumCard>
        </FadeInUp>
      ) : (
        <>
          <View style={s.overlap} />
          {error ? (
            <FadeInUp style={s.gutter}>
              <PremiumCard style={s.errorCard}>
                <Icon name="error-outline" size={20} color={PALETTE.dangerText} />
                <Text style={s.errorText}>{error}</Text>
                <GradientButton label="Try again" variant="outline" onPress={() => load(true)} />
              </PremiumCard>
            </FadeInUp>
          ) : null}

          {flags.isRejected && application?.rejectionReason ? (
            <FadeInUp delay={200} style={s.gutter}>
              <View style={s.reviewer}>
                <GradientIconChip icon="rate-review" tone="rose" size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.reviewerTitle}>Reviewer note</Text>
                  <Text style={s.reviewerText}>{String(application.rejectionReason)}</Text>
                </View>
              </View>
            </FadeInUp>
          ) : null}

          <FadeInUp delay={240}>
            <PremiumSectionHeader title="Application details" style={{ marginTop: flags.isRejected || error ? SPACE.xl : SPACE.sm }} />
            <PremiumCard style={s.gutter}>
              <InfoLine icon="tag" label="Application ID" value={formatApplicationRef(application) || '—'} />
              <InfoLine icon="event" label="Submitted" value={shortDate(application?.createdAt || application?.submittedAt) || '—'} />
              <InfoLine icon="badge" label="Member type" value={applicantKindLabel(application) || '—'} />
              <InfoLine icon={isAbroad ? 'public' : 'place'} label={isAbroad ? 'Place' : 'Region'} value={regionText || '—'} last />
            </PremiumCard>
          </FadeInUp>

          <PremiumSectionHeader title="Review timeline" subtitle={`${completed} of ${stages.length} complete`} />
          <PremiumCard style={s.gutter}>
            {stages.map((stage, i) => {
              const ui = STATE_UI[stage.status] || STATE_UI.pending;
              const last = i === stages.length - 1;
              return (
                <FadeInUp key={stage.key} delay={280 + i * 80} distance={10} style={s.stepRow}>
                  <View style={s.rail}>
                    <GradientIconChip icon={ui.icon} tone={ui.grad} size={32} />
                    {!last ? <View style={[s.line, stage.status === 'approved' && { backgroundColor: PALETTE.green }]} /> : null}
                  </View>
                  <View style={[s.stepBody, !last && { paddingBottom: SPACE.lg }]}>
                    <View style={s.stepHead}>
                      <Text style={s.stepName} numberOfLines={2}>{stage.name}</Text>
                      <View style={[s.badge, { backgroundColor: ui.bg }]}><Text style={[s.badgeText, { color: ui.fg }]}>{stage.badge || ui.label}</Text></View>
                    </View>
                    {stage.grants ? (
                      <View style={s.grantsRow}>
                        <Icon name="workspace-premium" size={13} color={PALETTE.goldDark} />
                        <Text style={s.grants}>Grants the membership</Text>
                      </View>
                    ) : null}
                    {stage.message ? <Text style={s.stepMsg}>{stage.message}</Text> : null}
                    {stage.reviewer || stage.date ? (
                      <Text style={s.stepMeta}>{[stage.reviewer, stage.date].filter(Boolean).join(' · ')}</Text>
                    ) : null}
                  </View>
                </FadeInUp>
              );
            })}
          </PremiumCard>

          {/* ---------------- the applicant (website "Applicant" panel) */}
          <PremiumSectionHeader title="Applicant" />
          <PremiumCard style={s.gutter}>
            <InfoLine icon="person-outline" label="Full name" value={application?.fullName || personal?.fullName || '—'} />
            <InfoLine icon="mail-outline" label="Email" value={application?.email || personal?.email || '—'} />
            <InfoLine icon="phone" label="Phone" value={application?.phone || personal?.phoneNumber || personal?.phone || '—'} />
            <InfoLine icon={isAbroad ? 'public' : 'place'} label={isAbroad ? 'Place' : 'Location'} value={regionText || '—'} last />
          </PremiumCard>

          {/* ---------------- what happens next — a different sentence per outcome */}
          <PremiumSectionHeader title="What happens next" />
          <View style={s.gutter}>
            <View style={s.nextCard}>
              <GradientIconChip icon="info-outline" tone="blue" size={34} />
              <Text style={s.nextText}>
                {flags.isRejected
                  ? 'Your application was not approved. The reviewer note above explains why — you can correct your details and speak to your Block Admin.'
                  : flags.isApproved
                    ? (isPaid
                      ? 'Your membership is active. Your certificate and ACTIV Network entry are available from the dashboard.'
                      : 'Your State Admin has approved you. Complete the membership payment to activate your account.')
                    : isAbroad
                      ? 'The ACTIV head office holds your file and is reviewing it. Their approval grants the membership.'
                      : "Your Block, District and State Admins each hold your file and are reviewing it at the same time — nobody is queued behind anybody. Only the State Admin's approval grants the membership; the other two are recorded as endorsements."}
              </Text>
            </View>

            <GradientButton
              label="Back to dashboard"
              variant="outline"
              icon="dashboard"
              style={{ marginTop: SPACE.md }}
              onPress={toDashboard}
            />
          </View>
        </>
      )}
    </PremiumScrollScreen>
  );
};

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  topTitle: { ...TYPE.label, color: BRAND.onBrandSoft, flex: 1, textAlign: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg, gap: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
  trackBox: {
    marginTop: SPACE.lg, padding: SPACE.md, paddingTop: 0, borderRadius: 20, backgroundColor: BRAND.glass,
    borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  trackFoot: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md },
  pct: { fontSize: 15, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
  trackNote: { ...TYPE.caption, color: BRAND.onBrandSoft, marginTop: SPACE.xs },

  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  emptyArt: { width: 128, height: 128, borderRadius: 64, backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' },
  errorCard: { gap: SPACE.sm, marginBottom: SPACE.md },
  errorText: { ...TYPE.body, color: PALETTE.dangerText },
  reviewer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, backgroundColor: PALETTE.dangerSoft, borderRadius: 20,
    padding: SPACE.lg, borderWidth: 1, borderColor: '#FECACA',
  },
  reviewerTitle: { ...TYPE.bodyStrong, color: PALETTE.dangerText },
  reviewerText: { ...TYPE.body, fontSize: 13, lineHeight: 19, color: PALETTE.dangerText, marginTop: 2 },

  info: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm + 2, minHeight: SIZE.touch + 8 },
  infoLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  infoValue: { ...TYPE.bodyStrong, marginTop: 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },

  stepRow: { flexDirection: 'row' },
  rail: { width: 34, alignItems: 'center' },
  line: { flex: 1, width: 2, backgroundColor: PALETTE.border, marginVertical: SPACE.xs, borderRadius: 999 },
  stepBody: { flex: 1, minWidth: 0, marginLeft: SPACE.md },
  stepHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, minHeight: 32 },
  stepName: { ...TYPE.subheading, flex: 1, minWidth: 0 },
  badge: { borderRadius: 999, paddingHorizontal: SPACE.sm + 2, minHeight: 24, justifyContent: 'center' },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  grantsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: 2 },
  grants: { ...TYPE.caption, fontWeight: '700', color: PALETTE.goldDark },
  stepMsg: { ...TYPE.body, fontSize: 13, lineHeight: 19, marginTop: SPACE.xs },
  stepMeta: { ...TYPE.caption, color: PALETTE.textFaint, marginTop: SPACE.xs },

  nextCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, backgroundColor: PALETTE.blueTint, borderRadius: 20,
    padding: SPACE.lg, borderWidth: 1, borderColor: PALETTE.blueSoft,
  },
  nextText: { ...TYPE.body, flex: 1, minWidth: 0, fontSize: 13, lineHeight: 19 },
});

export default ApplicationStatusScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
