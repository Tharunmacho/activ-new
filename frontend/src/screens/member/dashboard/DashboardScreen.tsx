import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert, ScrollView, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';
import {
  PALETTE, SPACE, RADIUS, SIZE, TYPE, GRADIENTS, unwrap, asArray, shortDate,
  PremiumScrollScreen, PREMIUM_OVERLAP, FadeInUp, PressableScale, GradientButton,
  PremiumCard, PremiumSectionHeader, GradientIconChip, AnimatedProgressBar, ActionTile, ActionGrid, StatPill, StatRow,
  PremiumEmptyState, ApprovalJourney3D, ChipTone,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import { GradientPanel, OnGradientButton, onGradient } from './DashboardKit';
import {
  DashboardHeader, GlassChip, ApprovalJourneyCard, PremiumDashboardSkeleton, JourneyNode, greetingFor, greetingEmoji, todayLabel,
} from './DashboardPremium';
import ExploreActiv from './ExploreActiv';
import {
  getMyProfile, getMyApplications, getRecentActivity, getBusinessInfo, getDeclarationInfo, formatApplicationRef,
  isPaidMember,
} from '../../../services/memberApi';
import {
  pickMostAdvancedApplication, deriveApprovalFlags, deriveMemberAccess, profileCompletion, TIERS, ABROAD_TIERS,
  timelineStageStatus, tierDecidedAt, tierDecidedByLabel, applicantKindLabel, membershipCta, nextMilestone, TOTAL_FORMS,
  StageState,
} from './memberRules';
import RenewalBanner from './RenewalBanner';
import { feedUnreadCount } from '../NotificationScreen';
import { invalidateWebsiteContent } from '../../../services/websiteContent';

/**
 * ============================================================================
 * THE UNPAID DASHBOARD — website `features/member/pages/UnpaidDashboard.tsx`
 * ============================================================================
 *
 * Same data (allSettled, so a failed decoration call never hides the status):
 *   getMyApplication · getMyProfile · getRecentActivity(6) · getContactInfo
 *   (+ the ProfileContext completion inputs: business-info, declaration-info)
 *
 * Same sections, same rules — in the premium language:
 *   brand header (greeting, avatar, time of day, member type + status chips)
 *   → the application as a 3D card whose Block → District → State → Payment
 *   track fills in → Renewal banner · stats · quick actions · Complete Your
 *   Profile · Your Business Account · Application Status & Progress (the
 *   website's timeline: submitted → sent to the three admins → each tier →
 *   payment) · What's Next? · Explore ACTIV (the public website) · What your
 *   membership unlocks · Recent Updates · Need Help? · the closing CTA.
 *
 * A paid member never stays here — they are sent to the paid dashboard.
 */

const BUSINESS_BENEFITS: { icon: string; title: string; detail: string; tone: ChipTone }[] = [
  { icon: 'trending-up', title: 'Grow Your Reach', detail: 'Connect with more customers', tone: 'green' },
  { icon: 'verified-user', title: 'Verified & Trusted', detail: 'Build credibility for your business', tone: 'blue' },
  { icon: 'auto-awesome', title: 'Premium Benefits', detail: 'Unlock exclusive business tools', tone: 'amber' },
];

const MEMBERSHIP_BENEFITS: { icon: string; title: string; detail: string; tone: ChipTone }[] = [
  { icon: 'chat', title: 'Message any member', detail: 'Reach members directly from their directory card.', tone: 'blue' },
  { icon: 'handshake', title: 'Business introductions', detail: 'Be introduced to members trading in your own sector.', tone: 'teal' },
  { icon: 'groups', title: 'Listed in ACTIV Network', detail: 'Your name and business visible to the whole association.', tone: 'sky' },
  { icon: 'event', title: 'Members-only events', detail: 'Conclaves and networking meets held for members alone.', tone: 'rose' },
  { icon: 'campaign', title: 'Schemes and tenders', detail: 'Notices the association publishes to active members first.', tone: 'amber' },
  { icon: 'verified', title: 'Your certificates', detail: 'Membership and tax exemption certificates in your name.', tone: 'green' },
  { icon: 'storefront', title: 'Publish your catalogue', detail: 'Put your products in front of every member of the network.', tone: 'navy' },
  { icon: 'insights', title: 'Reach and analytics', detail: 'See how many members view your profile and your catalogue.', tone: 'sky' },
];

/** Website STAGE_CHIP — the stage nodes above the timeline. */
const STAGE_CHIP: Record<StageState, { label: string; fg: string; bg: string }> = {
  approved: { label: 'Approved', fg: PALETTE.successText, bg: PALETTE.successSoft },
  in_progress: { label: 'In Review', fg: PALETTE.warningText, bg: PALETTE.warningSoft },
  rejected: { label: 'Returned', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft },
  pending: { label: 'Pending', fg: PALETTE.textMuted, bg: PALETTE.field },
};

const STAGE_TONE: Record<StageState, { color: string; bg: string; label: string; icon: string; grad: ChipTone }> = {
  approved: { color: PALETTE.successText, bg: PALETTE.successSoft, label: 'Done', icon: 'check', grad: 'green' },
  in_progress: { color: PALETTE.warningText, bg: PALETTE.warningSoft, label: 'In progress', icon: 'more-horiz', grad: 'amber' },
  pending: { color: PALETTE.textMuted, bg: PALETTE.field, label: 'Pending', icon: 'schedule', grad: 'slate' },
  rejected: { color: PALETTE.dangerText, bg: PALETTE.dangerSoft, label: 'Returned', icon: 'close', grad: 'rose' },
};

function StageNode({ label, state, at }: { label: string; state: StageState; at: string }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const chip = STAGE_CHIP[state];
  const t = STAGE_TONE[state];
  return (
    <View style={styles.node}>
      <GradientIconChip icon={t.icon} tone={t.grad} size={36} />
      <Text style={styles.nodeLabel} numberOfLines={2}>{label}</Text>
      <View style={[styles.nodeChip, { backgroundColor: chip.bg }]}><Text style={[styles.nodeChipText, { color: chip.fg }]} numberOfLines={1}>{chip.label}</Text></View>
      <Text style={styles.nodeAt} numberOfLines={1}>{at || ' '}</Text>
    </View>
  );
}

function DetailRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View style={[styles.detailRow, !last && styles.divider]}>
      <GradientIconChip icon={icon} tone="blue" size={32} />
      <Text style={styles.detailLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function TimelineRow({ title, by, at, state, last, index }: { title: string; by: string; at: string | null; state: StageState; last: boolean; index: number }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const t = STAGE_TONE[state];
  return (
    <FadeInUp delay={120 + index * 70} distance={10} style={styles.tlRow}>
      <View style={styles.tlRail}>
        <View style={[styles.tlDot, { backgroundColor: t.bg, borderColor: t.color }]}><Icon name={t.icon} size={13} color={t.color} /></View>
        {!last ? <View style={[styles.tlLine, state === 'approved' && { backgroundColor: PALETTE.success }]} /> : null}
      </View>
      <View style={[styles.tlBody, last && { paddingBottom: 0 }]}>
        <Text style={[styles.tlTitle, state === 'pending' && { fontWeight: '500', color: PALETTE.textFaint }]}>{title}</Text>
        <Text style={[styles.tlMeta, state === 'pending' && { color: PALETTE.textFaint }]}>
          {state === 'pending' ? 'Pending' : [by, at ? shortDate(at) : ''].filter(Boolean).join(' · ') || t.label}
        </Text>
      </View>
    </FadeInUp>
  );
}

function IdTile({ icon, label, value, onPress, actionIcon }: { icon: string; label: string; value: string; onPress?: () => void; actionIcon?: string }) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const body = (
    <>
      <Icon name={icon} size={SIZE.iconSm} color={PALETTE.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.idLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.idValue} numberOfLines={1} selectable>{value || '—'}</Text>
      </View>
      {onPress && actionIcon ? <Icon name={actionIcon} size={18} color={PALETTE.primary} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.idTile}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} contentStyle={styles.idTile} accessibilityRole="button" accessibilityLabel={`${label} ${value}. Share the full application ID.`}>
      {body}
    </PressableScale>
  );
}

function Benefit({ icon, title, detail, tone, last }: { icon: string; title: string; detail: string; tone: ChipTone; last?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View style={[styles.benefit, !last && styles.divider]}>
      <GradientIconChip icon={icon} tone={tone} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function SupportRow({ icon, tone, label, onPress, link }: { icon: string; tone: ChipTone; label: string; onPress?: () => void; link?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const body = (
    <>
      <GradientIconChip icon={icon} tone={tone} size={34} />
      <Text style={[styles.supportText, link && styles.link]} numberOfLines={1}>{label}</Text>
      {onPress ? <Icon name="chevron-right" size={20} color={PALETTE.textFaint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.support}>{body}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} contentStyle={styles.support} accessibilityRole="button" accessibilityLabel={label}>
      {body}
    </PressableScale>
  );
}

const DashboardScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const scrollRef = useRef<ScrollView>(null);
  const [statusY, setStatusY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [contact, setContact] = useState<any>(null);
  const [completion, setCompletion] = useState({ percent: 0, completed: [] as string[] });
  const [hasBusiness, setHasBusiness] = useState(false);
  const [bell, setBell] = useState(0);
  const [exploreKey, setExploreKey] = useState(0);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    const [apps, prof, acts, info, biz, decl, bizProfile] = await Promise.allSettled([
      getMyApplications(),
      getMyProfile(),
      getRecentActivity(6),
      api.get('/cms/contact-info'),
      getBusinessInfo(),
      getDeclarationInfo(),
      api.get('/business-profiles/me'),
    ]);
    const app = apps.status === 'fulfilled' ? pickMostAdvancedApplication(apps.value) : null;
    const p = prof.status === 'fulfilled' ? prof.value : null;

    // A paid member belongs on the paid dashboard (website dashboardPathFor).
    if (p && isPaidMember(p)) {
      navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] });
      return;
    }

    setApplication(app);
    setProfile(p);
    setActivity(acts.status === 'fulfilled' ? acts.value : []);
    setContact(info.status === 'fulfilled' ? unwrap<any>(info.value, null) : null);
    setCompletion(profileCompletion(
      p || {},
      biz.status === 'fulfilled' ? biz.value : null,
      decl.status === 'fulfilled' ? decl.value : null,
      app,
    ));
    setHasBusiness(bizProfile.status === 'fulfilled' && !!unwrap<any>(bizProfile.value, null));
    setLoading(false);
    setRefreshing(false);
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    load();
    let cancelled = false;
    feedUnreadCount().then((n) => { if (!cancelled) setBell(n); });
    return () => { cancelled = true; };
  }, [load]));

  const refresh = () => {
    invalidateWebsiteContent();
    setExploreKey((k) => k + 1);
    load('refresh');
  };

  const paid = isPaidMember(profile);
  const access = useMemo(() => deriveMemberAccess(completion.percent, application, paid), [completion.percent, application, paid]);
  const flags = useMemo(() => deriveApprovalFlags(application), [application]);
  const renewal = profile?.renewal || null;
  const cta = useMemo(() => membershipCta(access, renewal), [access, renewal]);
  const appRef = useMemo(() => formatApplicationRef(application), [application]);
  const fullAppId = String(application?._id || application?.id || '');
  const memberType = applicantKindLabel(application) || 'Applicant';
  const name = String(profile?.fullName || '').trim();
  const firstName = name.split(' ').filter(Boolean)[0] || '';
  const isAbroad = profile?.isInternational === true || application?.isInternational === true;
  const tiers = isAbroad ? ABROAD_TIERS : TIERS;

  const stagesDone = useMemo(() => {
    if (!application) return 0;
    return tiers.filter((t) => timelineStageStatus(t.key, application) === 'approved').length + (access.membershipActive ? 1 : 0);
  }, [application, tiers, access.membershipActive]);
  const overallPercent = Math.round((stagesDone / (tiers.length + 1)) * 100);

  const currentTier = useMemo(() => {
    if (!application) return '';
    if (access.membershipActive) return 'Your membership is active.';
    if (flags.isRejected) return 'Your application was returned. See the reviewer note below.';
    if (flags.isApproved) return 'Approved by your State Admin. You can now complete the membership payment.';
    const waiting = tiers.filter((t) => timelineStageStatus(t.key, application) !== 'approved').map((t) => t.label);
    if (!waiting.length) return 'All three admins have reviewed your application.';
    return `With your ${waiting.join(', ').replace(/, ([^,]*)$/, ' and $1')}. Your State Admin’s approval is what grants the membership.`;
  }, [application, flags, access.membershipActive, tiers]);

  const timeline = useMemo(() => {
    if (!application) return [];
    const submittedAt = application.createdAt || application.submittedAt || null;
    const rows: { title: string; by: string; at: string | null; state: StageState }[] = [
      { title: 'Application Submitted', by: `by ${name || 'you'}`, at: submittedAt, state: 'approved' },
      { title: 'Sent to your Block, District and State Admin', by: 'by System', at: submittedAt, state: 'approved' },
    ];
    tiers.forEach((tier) => {
      const state = timelineStageStatus(tier.key, application);
      const who = tierDecidedByLabel(application, tier.key);
      rows.push({
        title: state === 'approved' ? `Approved by your ${tier.label}` : state === 'rejected' ? `Returned by your ${tier.label}` : `With your ${tier.label}`,
        by: who ? `by ${who}` : '',
        at: tierDecidedAt(application, tier.key),
        state,
      });
    });
    rows.push({
      title: access.membershipActive ? 'Membership payment received' : 'Membership payment',
      by: '', at: null,
      state: access.membershipActive ? 'approved' : flags.isApproved ? 'in_progress' : 'pending',
    });
    return rows;
  }, [application, flags, name, access.membershipActive, tiers]);

  /** The 3D card's track: each tier, then payment. */
  const journey: JourneyNode[] = useMemo(() => {
    const nodes: JourneyNode[] = tiers.map((tier) => {
      const state: StageState = application ? timelineStageStatus(tier.key, application) : 'pending';
      const at = application && state !== 'pending' && state !== 'in_progress' ? shortDate(tierDecidedAt(application, tier.key)) : '';
      return { key: tier.key, label: tier.label.replace(/\s*Admin$/i, ''), state, at };
    });
    nodes.push({
      key: 'payment',
      label: 'Payment',
      state: access.membershipActive ? 'approved' : flags.isApproved ? 'in_progress' : 'pending',
    });
    return nodes;
  }, [application, tiers, access.membershipActive, flags.isApproved]);

  const whatsNext = [
    { icon: 'search', title: 'Application Under Review', detail: 'Your Block, District and State Admin can all see your application from the moment it is submitted, and each records their own decision.', active: !!application && !flags.isApproved && !flags.isRejected },
    { icon: 'notifications-none', title: 'You Will Be Notified', detail: 'You will receive notifications for every update.', active: false },
    { icon: 'check-circle-outline', title: 'State Admin Approval', detail: 'Your Block and District Admin record their view; your State Admin’s approval is what grants the membership and opens the payment step.', active: !!application && flags.isApproved && !access.membershipActive },
    { icon: 'credit-card', title: 'Activate Membership', detail: 'Complete payment to activate your membership and unlock all benefits.', active: access.applicationApproved && !access.membershipActive },
  ];

  /* ---------------- navigation targets (website paths → app routes) */
  const openForms = (step: 1 | 3) => {
    const userData = { email: profile?.email || '', fullName: profile?.fullName || '', phoneNumber: profile?.phoneNumber || '', memberId: profile?.memberId || '' };
    navigation.navigate(step === 3 ? 'DeclarationForm' : 'PersonalDetailsForm', { userData });
  };
  const runCta = (target: string) => {
    if (target === 'Renew') navigation.navigate('MembershipPlans', { renew: true });
    else if (target === 'Activate') navigation.navigate('MembershipPlans');
    else if (target === 'ApplicationStatus') navigation.navigate('ApplicationStatus');
    else if (target === 'Submit') openForms(3);
    else if (target === 'PaidDashboard') navigation.reset({ index: 0, routes: [{ name: 'PaidDashboard' }] });
    else openForms(1);
  };
  const scrollToStatus = () => scrollRef.current?.scrollTo({ y: Math.max(0, statusY - 12), animated: true });

  const supportEmail = String(contact?.email || '');
  const supportPhone = String(contact?.phone || '');
  const supportHours = asArray<string>(contact?.workingHours).filter(Boolean);
  const emailSupport = () => {
    const subject = encodeURIComponent(application ? `Support request - application ${appRef}` : 'Support request');
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}`).catch(() => Alert.alert('Email', supportEmail));
  };
  /** Website parity: admins' queues show the FULL id, so the member can hand it over (share sheet; no clipboard module). */
  const shareFullId = async () => {
    if (!fullAppId) return;
    try {
      await Share.share({ message: `My ACTIV application ID: ${fullAppId}${appRef ? ` (${appRef})` : ''}` });
    } catch (err) {
      console.warn('Share safely caught:', err);
    }
  };

  const photoUri = resolveMediaUrl(profile?.profilePhoto || profile?.profileImage || '');
  const hour = new Date().getHours();

  const profileDone = access.applicationSubmitted;
  const profileCardCopy = renewal?.state === 'expired'
    ? 'Your details are on file — renewing needs no new application.'
    : access.applicationSubmitted && access.applicationApproved
      ? 'Your application is approved. One payment activates your membership.'
      : access.applicationSubmitted
        ? 'Your application is submitted and under review.'
        : completion.percent >= 100
          ? 'Your profile is complete. Submit to start the review.'
          : `${completion.completed.length} of ${TOTAL_FORMS} forms done. Unlock all features by completing your profile.`;

  const statusLabel = application
    ? (flags.isApproved ? 'Approved' : flags.isRejected ? 'Returned' : 'Under review')
    : 'Not submitted';
  const statusDot = application ? (flags.isApproved ? '#34D399' : flags.isRejected ? '#F87171' : '#FBBF24') : '#CBD5E1';
  const formsDone = access.applicationSubmitted ? TOTAL_FORMS : completion.completed.length;

  const header = (
    <DashboardHeader
      name={name || 'Member'}
      photo={photoUri}
      status={flags.isApproved ? 'verified' : 'pending'}
      eyebrow={`${greetingFor(hour)} ${greetingEmoji(hour)} · ${todayLabel()}`}
      title={firstName ? `Hi, ${firstName} 👋` : 'Welcome back 👋'}
      subtitle={renewal?.state === 'expired'
        ? 'Your membership has ended — renew to continue'
        : nextMilestone(access) ? "Let's complete your membership journey" : "You're all set."}
      art={<ApprovalJourney3D size={92} />}
      onMenu={() => navigation.navigate('MemberMenu')}
      onMessages={() => navigation.navigate('MemberMessages')}
      onBell={() => navigation.navigate('MemberNotifications')}
      bell={bell}
    >
      <View style={styles.headChips}>
        <GlassChip label={memberType} icon="badge" />
        <GlassChip label={statusLabel} dot={statusDot} />
      </View>
    </DashboardHeader>
  );

  return (
    <PremiumScrollScreen ref={scrollRef} header={header} refreshing={refreshing} onRefresh={refresh}>
      {loading ? <PremiumDashboardSkeleton style={styles.overlap} /> : (
        <>
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['events']} showEmpty />

          <PremiumSectionHeader title="Quick actions" subtitle="Everything you need on the way to membership" />
          <ActionGrid>
            <ActionTile
              icon={access.applicationSubmitted ? 'fact-check' : 'edit-note'}
              label={access.applicationSubmitted ? 'Application status' : 'Continue profile'}
              detail={access.applicationSubmitted ? statusLabel : `${completion.percent}% complete`}
              tone="blue"
              onPress={() => (access.applicationSubmitted ? navigation.navigate('ApplicationStatus') : openForms(completion.percent >= 100 ? 3 : 1))}
            />
            <ActionTile icon="storefront" label="Business account" detail={hasBusiness ? 'Created' : 'Draft mode'} tone="teal" onPress={() => navigation.navigate(hasBusiness ? 'BusinessDashboard' : 'BusinessProfile')} />
            <ActionTile icon="event" label="Events" detail="Upcoming & your tickets" tone="rose" onPress={() => navigation.navigate('MemberEvents')} />
            <ActionTile icon="campaign" label="Updates" detail="News for your region" tone="amber" onPress={() => navigation.navigate('AssociationUpdates')} />
          </ActionGrid>

          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['gallery']} showEmpty />
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['news']} showEmpty />
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['schemes', 'zones', 'nav']} />

          <PremiumSectionHeader title="My Documents" subtitle="Your application records and certificates" />
          <PremiumCard style={styles.gutter} onPress={() => navigation.navigate('MemberDocuments')} accessibilityLabel="View documents and application records">
            <Text style={styles.documentTitle}>Application records</Text>
            <Text style={styles.documentHint}>Review your submitted forms. Membership certificates and your payment receipt become available after activation.</Text>
            <GradientButton label="View documents" variant="outline" icon="folder-open" onPress={() => navigation.navigate('MemberDocuments')} style={{ marginTop: SPACE.md }} />
          </PremiumCard>

          {/* ---------------- the application, as a card */}
          <FadeInUp delay={200} style={[styles.gutter, { marginTop: SPACE.xl }]}>
            <ApprovalJourneyCard
              name={name}
              reference={access.applicationSubmitted ? appRef : ''}
              memberType={memberType}
              statusLabel={statusLabel}
              statusDot={statusDot}
              nodes={journey}
              done={stagesDone}
              percent={overallPercent}
              headline={application ? currentTier : 'Complete your profile and your application enters the review chain.'}
              onPress={() => (application ? navigation.navigate('ApplicationStatus') : openForms(1))}
            />
          </FadeInUp>

          <RenewalBanner renewal={renewal} onRenew={() => navigation.navigate('MembershipPlans', { renew: true })} />

          {/* ---------------- stats */}
          <FadeInUp delay={260}>
            <StatRow style={{ marginTop: SPACE.lg }}>
              <StatPill value={`${completion.percent}%`} label="Profile complete" icon="person" tone="blue" onPress={() => openForms(completion.percent >= 100 ? 3 : 1)} />
              <StatPill value={`${stagesDone}/${tiers.length + 1}`} label="Stages cleared" icon="verified" tone="green" onPress={scrollToStatus} />
              <StatPill value={`${formsDone}/${TOTAL_FORMS}`} label="Forms done" icon="assignment-turned-in" tone="amber" onPress={() => openForms(1)} />
            </StatRow>
          </FadeInUp>

          {/* ---------------- Complete Your Profile / Profile Complete */}
          <FadeInUp delay={80}>
            <GradientPanel colors={profileDone ? GRADIENTS.success : GRADIENTS.member} lifted style={{ marginTop: SPACE.sm }}>
              <View style={styles.bigHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={onGradient.eyebrow}>{profileDone ? 'All set' : 'Your profile'}</Text>
                  <Text style={onGradient.title}>{profileDone ? 'Profile Complete' : 'Complete Your Profile'}</Text>
                </View>
                <Text style={styles.bigPercent} maxFontSizeMultiplier={1.3}>{completion.percent}%</Text>
              </View>
              <AnimatedProgressBar percent={completion.percent} onDark style={{ marginTop: SPACE.md }} />
              <Text style={onGradient.body}>{profileCardCopy}</Text>
              <View style={styles.formList}>
                {['Personal Details', 'Business Details', 'Declaration'].map((form) => {
                  const done = access.applicationSubmitted || completion.completed.includes(form);
                  return (
                    <View key={form} style={[styles.formPill, done && styles.formPillDone]}>
                      <Icon name={done ? 'check-circle' : 'radio-button-unchecked'} size={15} color={PALETTE.white} />
                      <Text style={[styles.formPillText, !done && { opacity: 0.78 }]} numberOfLines={1}>{form}</Text>
                    </View>
                  );
                })}
              </View>
              <OnGradientButton
                label={access.applicationSubmitted ? 'View Status' : completion.percent >= 100 ? 'Submit Application' : 'Continue Profile'}
                color={profileDone ? PALETTE.successText : PALETTE.blueDeep}
                onPress={() => (access.applicationSubmitted ? navigation.navigate('ApplicationStatus') : openForms(completion.percent >= 100 ? 3 : 1))}
                style={{ marginTop: SPACE.lg }}
              />
            </GradientPanel>
          </FadeInUp>

          {/* ---------------- Your Business Account */}
          <PremiumSectionHeader title="Your Business Account" subtitle="Build your profile and catalogue before approval" />
          <PremiumCard style={styles.gutter}>
            <View style={styles.rowBetween}>
              <View style={styles.rowStart}>
                <GradientIconChip icon="storefront" tone="teal" />
                <Text style={styles.cardTitle} numberOfLines={2}>Business profile</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: hasBusiness ? PALETTE.successSoft : PALETTE.warningSoft }]}>
                <View style={[styles.pillDot, { backgroundColor: hasBusiness ? PALETTE.success : PALETTE.warning }]} />
                <Text style={[styles.pillText, { color: hasBusiness ? PALETTE.successText : PALETTE.warningText }]}>{hasBusiness ? 'Created' : 'Draft Mode'}</Text>
              </View>
            </View>
            <Text style={styles.cardCopy}>Start building your business profile, catalogue and manage products before approval.</Text>
            <View style={styles.bizBenefits}>
              {BUSINESS_BENEFITS.map((b, i) => <Benefit key={b.title} {...b} last={i === BUSINESS_BENEFITS.length - 1} />)}
            </View>
            <GradientButton
              label="Manage Business Account"
              icon="storefront"
              onPress={() => navigation.navigate(hasBusiness ? 'BusinessDashboard' : 'BusinessProfile')}
              style={{ marginTop: SPACE.lg }}
            />
          </PremiumCard>

          {/* ---------------- Application Status & Progress */}
          <View onLayout={(e) => setStatusY(Number(e?.nativeEvent?.layout?.y || 0))}>
            <PremiumSectionHeader
              title="Application Status"
              subtitle="Track your membership approval progress"
              action="Details"
              onAction={() => navigation.navigate('ApplicationStatus')}
            />
            <PremiumCard style={styles.gutter}>
              <View style={styles.overall}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cardTitle}>Overall Progress</Text>
                    <Text style={styles.small}>{stagesDone} of {tiers.length + 1} stages completed</Text>
                  </View>
                  <View style={styles.pctPill}><Text style={styles.pctText} maxFontSizeMultiplier={1.3}>{overallPercent}%</Text></View>
                </View>
                <AnimatedProgressBar percent={overallPercent} style={styles.overallBar} colors={['#059669', '#34D399']} />
                <View style={styles.nodes}>
                  {tiers.map((tier) => (
                    <StageNode
                      key={tier.key}
                      label={tier.label}
                      state={application ? timelineStageStatus(tier.key, application) : 'pending'}
                      at={application ? shortDate(tierDecidedAt(application, tier.key)) : ''}
                    />
                  ))}
                  <StageNode label="Payment" state={access.membershipActive ? 'approved' : flags.isApproved ? 'in_progress' : 'pending'} at="" />
                </View>
              </View>
              {application ? (
                <>
                  <View style={styles.idGrid}>
                    <IdTile icon="tag" label="Application ID" value={appRef} onPress={fullAppId ? shareFullId : undefined} actionIcon="ios-share" />
                    <IdTile icon="badge" label="Member type" value={memberType} />
                    {fullAppId ? <Text style={styles.fullId} selectable numberOfLines={1}>Full ID · {fullAppId}</Text> : null}
                  </View>
                  {flags.isRejected && application?.rejectionReason ? (
                    <View style={styles.reject}>
                      <Icon name="info-outline" size={18} color={PALETTE.dangerText} />
                      <Text style={styles.rejectText}>Reviewer note: {application.rejectionReason}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.subHead}>Timeline</Text>
                  <View>
                    {timeline.map((r, i) => <TimelineRow key={`${r.title}-${i}`} {...r} index={i} last={i === timeline.length - 1} />)}
                  </View>
                </>
              ) : (
                <PremiumEmptyState
                  icon="description"
                  title="Not submitted yet"
                  text="Complete your profile forms and your application will enter the review chain."
                  action="Continue profile"
                  onAction={() => openForms(1)}
                />
              )}
              <View style={styles.info}>
                <Icon name="info-outline" size={SIZE.iconSm} color={PALETTE.primaryDark} />
                <Text style={styles.infoText}>You will be notified at each stage of the review process.</Text>
              </View>

              {/* ---- Current Status (website right-hand panel) */}
              <View style={styles.current}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>Current Status</Text>
                  <View style={[styles.pill, { backgroundColor: application ? (flags.isRejected ? PALETTE.dangerSoft : PALETTE.warningSoft) : PALETTE.field }]}>
                    <View style={[styles.pillDot, { backgroundColor: application ? (flags.isRejected ? PALETTE.danger : PALETTE.warning) : PALETTE.textFaint }]} />
                    <Text style={[styles.pillText, { color: application ? (flags.isRejected ? PALETTE.dangerText : PALETTE.warningText) : PALETTE.textMuted }]}>
                      {application ? (flags.isRejected ? 'Returned' : 'In Review') : 'Not Submitted'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardCopy, { marginBottom: SPACE.sm }]}>
                  {application ? currentTier : 'Your application has not been submitted yet. It will appear here the moment it is.'}
                </Text>
                <DetailRow
                  icon="place"
                  label="Location"
                  value={(isAbroad
                    ? [application?.place || profile?.place || profile?.city, application?.country || profile?.country]
                    : [application?.block, application?.district, application?.state]).filter(Boolean).join(', ')}
                />
                <DetailRow icon="groups" label="Member Type" value={memberType} />
                <DetailRow icon="event" label="Submitted On" value={shortDate(application?.createdAt || application?.submittedAt)} />
                <DetailRow icon="schedule" label="Estimated Time" value="2 – 5 Working Days" last />
              </View>
            </PremiumCard>
          </View>

          {/* ---------------- What's Next? */}
          <PremiumSectionHeader title="What's Next?" />
          <PremiumCard style={styles.gutter}>
            {whatsNext.map((w, i) => (
              <View key={w.title} style={[styles.next, i < whatsNext.length - 1 && !w.active && !whatsNext[i + 1]?.active && styles.divider, w.active && styles.nextActive]}>
                <GradientIconChip icon={w.icon} tone={w.active ? 'blue' : 'slate'} size={36} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.nextTitle}>{w.title}</Text>
                    {w.active ? <View style={[styles.pill, { backgroundColor: PALETTE.warningSoft }]}><Text style={[styles.pillText, { color: PALETTE.warningText }]}>Now</Text></View> : null}
                  </View>
                  <Text style={styles.small}>{w.detail}</Text>
                </View>
              </View>
            ))}
          </PremiumCard>

          {/* ---------------- Explore ACTIV (the public website) */}
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['contact', 'legal']} />

          {/* ---------------- What your membership unlocks */}
          <PremiumSectionHeader title="What your membership unlocks" />
          <PremiumCard style={styles.gutter}>
            <Text style={[styles.cardCopy, { marginTop: 0, marginBottom: SPACE.xs }]}>
              ACTIV is a network before it is anything else. Activating your membership puts you in touch with every other member — and puts your business in front of them.
            </Text>
            {MEMBERSHIP_BENEFITS.map((b, i) => <Benefit key={b.title} {...b} last={i === MEMBERSHIP_BENEFITS.length - 1} />)}
            <View style={styles.ctaBlock}>
              {cta.detail ? <Text style={[styles.cardCopy, { marginTop: 0 }]}>{cta.detail}</Text> : null}
              <GradientButton
                label={cta.label}
                iconRight="arrow-forward"
                onPress={() => (cta.target === 'ApplicationStatus' && application ? scrollToStatus() : runCta(cta.target))}
                style={{ marginTop: SPACE.md }}
              />
            </View>
          </PremiumCard>

          {/* ---------------- Recent Updates */}
          <PremiumSectionHeader title="Recent Updates" action="View all" onAction={() => navigation.navigate('ApplicationStatus')} />
          <PremiumCard style={styles.gutter}>
            {activity.length ? activity.slice(0, 3).map((a, i, arr) => (
              <FadeInUp key={String(a?.id || i)} delay={i * 60} distance={8}>
                <View style={[styles.act, i < arr.length - 1 && styles.divider, i === 0 && { paddingTop: 0 }, i === arr.length - 1 && { paddingBottom: 0 }]}>
                  <GradientIconChip icon="notifications-none" tone="sky" size={36} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.actText}>{a?.description || 'Update'}</Text>
                    <Text style={styles.small}>{shortDate(a?.at)}</Text>
                  </View>
                </View>
              </FadeInUp>
            )) : (
              <PremiumEmptyState icon="notifications-none" title="Nothing yet" text="Updates about your application will appear here." />
            )}
          </PremiumCard>

          {/* ---------------- Need Help? */}
          <PremiumSectionHeader title="Need Help?" />
          <PremiumCard style={styles.gutter}>
            <Text style={[styles.cardCopy, { marginTop: 0 }]}>Our support team is here to help you at every step of your membership journey.</Text>
            {supportHours.map((hrs) => <SupportRow key={hrs} icon="schedule" tone="slate" label={hrs} />)}
            {supportPhone ? (
              <SupportRow icon="call" tone="blue" label={supportPhone} link onPress={() => { Linking.openURL(`tel:${supportPhone.replace(/[^\d+]/g, '')}`).catch(() => null); }} />
            ) : null}
            {supportPhone ? (
              <SupportRow icon="chat" tone="green" label="WhatsApp us" link onPress={() => { Linking.openURL(`https://wa.me/${supportPhone.replace(/\D/g, '')}`).catch(() => null); }} />
            ) : null}
            {supportEmail ? <SupportRow icon="mail-outline" tone="sky" label={supportEmail} link onPress={emailSupport} /> : null}
            {!supportHours.length && !supportEmail && !supportPhone ? (
              // Website parity: the fallback line when the office has published no channel.
              <Text style={styles.small}>Open Help &amp; Support to send a message to the ACTIV team.</Text>
            ) : null}
            <View style={styles.helpBtns}>
              {supportEmail ? <GradientButton label="Email Support" icon="mail-outline" onPress={emailSupport} /> : null}
              <GradientButton label="Help & Support" icon="support-agent" variant="outline" onPress={() => navigation.navigate('MemberHelp')} />
            </View>
          </PremiumCard>

          {/* ---------------- closing CTA */}
          <FadeInUp delay={60}>
            <GradientPanel style={{ marginTop: SPACE.xl }}>
              <Text style={onGradient.eyebrow}>Next step</Text>
              <Text style={onGradient.title}>Complete Your Profile & Unlock Full Benefits</Text>
              <Text style={onGradient.body}>Finish your profile, get verified and access all features designed to grow your business with ACTIV.</Text>
              <OnGradientButton
                label={access.applicationApproved ? 'Activate Membership' : 'Continue Your Journey'}
                onPress={() => (access.applicationApproved ? navigation.navigate('MembershipPlans') : openForms(1))}
                style={{ marginTop: SPACE.lg }}
              />
            </GradientPanel>
          </FadeInUp>
        </>
      )}
    </PremiumScrollScreen>
  );
};

const styles = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  documentTitle: { ...TYPE.subheading },
  documentHint: { ...TYPE.caption, marginTop: SPACE.sm },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  headChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.xl },

  bigHead: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md },
  bigPercent: { ...TYPE.display, color: PALETTE.white },
  formList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  formPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, paddingHorizontal: SPACE.md - 2, minHeight: 30, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  formPillDone: { backgroundColor: 'rgba(255,255,255,0.24)', borderColor: 'rgba(255,255,255,0.32)' },
  formPillText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.white },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  rowStart: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 },
  cardTitle: { ...TYPE.heading, flexShrink: 1 },
  cardCopy: { ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.sm },
  small: { ...TYPE.small, marginTop: SPACE.xxs },
  subHead: { ...TYPE.eyebrow, marginTop: SPACE.xl, marginBottom: SPACE.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  bizBenefits: { marginTop: SPACE.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: SPACE.sm + 2, minHeight: 24 },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },

  overall: { backgroundColor: PALETTE.blueTint, borderRadius: 18, padding: SPACE.lg, borderWidth: 1, borderColor: PALETTE.primarySoft },
  overallBar: { marginTop: SPACE.md, backgroundColor: PALETTE.primarySoft },
  pctPill: { backgroundColor: PALETTE.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, minHeight: 36, justifyContent: 'center' },
  pctText: { ...TYPE.heading, fontSize: 17, color: PALETTE.white, fontVariant: ['tabular-nums'] },
  nodes: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACE.lg, rowGap: SPACE.lg },
  node: { width: '50%', alignItems: 'center', paddingHorizontal: SPACE.xs },
  nodeLabel: { ...TYPE.label, color: PALETTE.text, fontWeight: '700', marginTop: SPACE.sm - 2, textAlign: 'center' },
  nodeChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, marginTop: SPACE.xs },
  nodeChipText: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  nodeAt: { fontSize: 11, lineHeight: 15, color: PALETTE.textFaint, marginTop: SPACE.xxs },

  idGrid: { gap: SPACE.sm, marginTop: SPACE.lg },
  idTile: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, backgroundColor: PALETTE.field, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, minHeight: SIZE.row - 4 },
  idLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  idValue: { ...TYPE.bodyStrong, color: PALETTE.blueDeep, marginTop: 1 },
  fullId: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint, marginLeft: SPACE.xs },
  reject: { flexDirection: 'row', gap: SPACE.sm, backgroundColor: PALETTE.dangerSoft, borderRadius: RADIUS.md, padding: SPACE.md, marginTop: SPACE.md },
  rejectText: { ...TYPE.label, flex: 1, minWidth: 0, color: PALETTE.dangerText },

  tlRow: { flexDirection: 'row' },
  tlRail: { width: 28, alignItems: 'center' },
  tlDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tlLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: PALETTE.border, marginVertical: SPACE.xxs },
  tlBody: { flex: 1, minWidth: 0, paddingLeft: SPACE.md, paddingBottom: SPACE.lg },
  tlTitle: { ...TYPE.bodyStrong, lineHeight: 24 },
  tlMeta: { ...TYPE.caption, marginTop: SPACE.xxs },

  info: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start', marginTop: SPACE.lg, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: PALETTE.primarySoft },
  infoText: { ...TYPE.caption, flex: 1, minWidth: 0, color: PALETTE.primaryDark },
  current: { marginTop: SPACE.lg, padding: SPACE.lg, borderRadius: 18, borderWidth: 1, borderColor: PALETTE.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm, minHeight: SIZE.touch + 4 },
  detailLabel: { ...TYPE.label, color: PALETTE.textMuted, fontWeight: '500', width: 92 },
  detailValue: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18, flex: 1, minWidth: 0, textAlign: 'right' },

  next: { flexDirection: 'row', gap: SPACE.md, paddingVertical: SPACE.md, borderRadius: RADIUS.md },
  nextActive: { backgroundColor: PALETTE.primarySoft, paddingHorizontal: SPACE.md, marginHorizontal: -SPACE.sm },
  nextTitle: { ...TYPE.bodyStrong, flexShrink: 1 },

  benefit: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  benefitTitle: { ...TYPE.bodyStrong },
  benefitDetail: { ...TYPE.small, marginTop: 1 },
  ctaBlock: { marginTop: SPACE.sm, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.border },

  act: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  actText: { ...TYPE.bodyStrong, fontWeight: '500' },

  support: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md, minHeight: SIZE.touch },
  supportText: { ...TYPE.body, flex: 1, minWidth: 0 },
  link: { color: PALETTE.primary, fontWeight: '700' },
  helpBtns: { gap: SPACE.sm, marginTop: SPACE.lg },
});

export default DashboardScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
