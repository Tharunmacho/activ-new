import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import {
  BottomActionBar, Skeleton, shortDate, PALETTE, SPACE, TYPE,
  PremiumScreen, PREMIUM_OVERLAP, PremiumHeading, BrandLogo, FloatingIllustration, FadeInUp, PressableScale,
  GradientButton, PremiumCard, PremiumSectionHeader, GradientIconChip, SubmittedPlane3D, BRAND, ChipTone,
} from '../../ui';
import { getMyApplications, getMyProfile, formatApplicationRef, isPaidMember } from '../../services/memberApi';
import { pickMostAdvancedApplication, deriveApprovalFlags, applicantKindLabel } from '../member/dashboard/memberRules';

/** The website's support address on this screen. */
const SUPPORT_EMAIL = 'member@activ.org.in';

/**
 * ============================================================================
 * APPLICATION SUBMITTED (website: pages/member/ApplicationSubmitted.tsx)
 * ============================================================================
 *
 *   GET /applications/my-applications -> the MOST ADVANCED row (approved, then
 *                                         rejected, then newest) — never
 *                                         /applications/user/:id
 *   GET /members/my-profile            -> paid or not, for the dashboard route
 *
 * One review, then payment: the Block, District and State admin receive the
 * file together and the first to decide decides it. The reference number is
 * the one thing a member is asked for, so it leads — on a glass card in the
 * brand header, under a paper plane leaving with a green tick. The full id
 * (what admin queues show) can be shared, as the website lets it be copied.
 */

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ApplicationSubmitted'>;
};

const WHAT_NEXT: { icon: string; title: string; detail: string; tone: ChipTone }[] = [
  {
    icon: 'verified-user',
    title: 'Your local admins review it',
    detail: 'It goes to the Block, District and State admin for your area at the same time. Any one of them can approve it.',
    tone: 'blue',
  },
  {
    icon: 'notifications-none',
    title: 'You hear as soon as it is decided',
    detail: 'A notification arrives the moment it is approved or sent back — nothing here needs watching in the meantime.',
    tone: 'amber',
  },
  {
    icon: 'credit-card',
    title: 'Then you pay and you are in',
    detail: 'Once it is approved, your membership payment unlocks and your profile goes live in ACTIV Network.',
    tone: 'green',
  },
];

const ApplicationSubmittedScreen: React.FC<Props> = ({ navigation }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [application, setApplication] = useState<any>(null);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [apps, profile] = await Promise.allSettled([getMyApplications(), getMyProfile()]);
      setApplication(apps.status === 'fulfilled' ? pickMostAdvancedApplication(apps.value) : null);
      setPaid(profile.status === 'fulfilled' ? isPaidMember(profile.value) : false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flags = deriveApprovalFlags(application);
  const ref = formatApplicationRef(application);
  const fullId = String(application?._id || application?.id || '');
  const cleared = flags.isApproved ? 1 : 0;
  const stages = [
    {
      label: 'Application review',
      caption: flags.isRejected ? 'Sent back' : cleared > 0 ? 'Approved' : 'In progress',
      state: flags.isRejected ? 'rejected' : cleared > 0 ? 'done' : 'active',
    },
    {
      label: 'Membership payment',
      caption: cleared > 0 ? 'In progress' : 'Waiting',
      state: cleared > 0 ? 'active' : 'waiting',
    },
  ];

  const currentStage = Math.min(cleared + 1, stages.length);

  const dashboard = paid ? 'PaidDashboard' : 'MemberMain';

  const writeSupport = async () => {
    const subject = encodeURIComponent(`Application ${ref || ''}`.trim());
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`);
    } catch (err) {
      console.warn('Mail link safely caught:', err);
    }
  };

  const shareRef = async () => {
    if (!ref && !fullId) return;
    try {
      await Share.share({
        message: `My ACTIV application reference: ${ref || fullId}${fullId && ref ? `\nFull application ID: ${fullId}` : ''}`,
      });
    } catch (err) {
      console.warn('Share safely caught:', err);
    }
  };

  const header = (
    <View>
      <View style={s.topRow}>
        <BrandLogo size="sm" />
      </View>
      <View style={s.heroRow}>
        <FadeInUp delay={60} style={s.heroText}>
          <PremiumHeading
            size="md"
            eyebrow="All done"
            title="Application submitted"
            subtitle="Your membership application is in and moving through review."
          />
        </FadeInUp>
        <FadeInUp delay={140} scaleFrom={0.6} distance={16}>
          <FloatingIllustration size={100}>
            <SubmittedPlane3D size={100} />
          </FloatingIllustration>
        </FadeInUp>
      </View>

      {/* ---- the reference — the one thing a member is asked for */}
      <FadeInUp delay={220} style={s.refBox}>
        <Text style={s.refLabel} maxFontSizeMultiplier={1.2}>REFERENCE NUMBER</Text>
        {loading ? (
          <Skeleton width="60%" height={26} style={{ marginTop: SPACE.sm, alignSelf: 'center', opacity: 0.4 }} />
        ) : (
          <Text style={s.refValue} selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>
            {ref || 'Being assigned…'}
          </Text>
        )}
        {fullId ? <Text style={s.fullId} selectable numberOfLines={1} maxFontSizeMultiplier={1.2}>ID {fullId}</Text> : null}
        <Text style={s.refHint} maxFontSizeMultiplier={1.2}>Quote this whenever you contact ACTIV.</Text>
        {ref || fullId ? (
          <PressableScale onPress={shareRef} scaleTo={0.95} contentStyle={s.shareBtn} accessibilityRole="button" accessibilityLabel="Share your application reference">
            <Icon name="ios-share" size={16} color={PALETTE.white} />
            <Text style={s.shareText} maxFontSizeMultiplier={1.2}>Share reference</Text>
          </PressableScale>
        ) : null}
      </FadeInUp>
      <View style={{ height: SPACE.xl }} />
    </View>
  );

  return (
    <PremiumScreen
      header={header}
      waveHeight={60}
      footer={(
        <BottomActionBar>
          <View style={s.actions}>
            <GradientButton label="Track application status" icon="fact-check" onPress={() => navigation.replace('ApplicationStatus')} />
            <GradientButton
              variant="outline"
              label="Go to dashboard"
              icon="dashboard"
              onPress={() => navigation.reset({ index: 0, routes: [{ name: dashboard }] })}
            />
          </View>
        </BottomActionBar>
      )}
    >
      {/* The facts a member quotes alongside the reference (website FactCell row). */}
      <FadeInUp delay={260} style={s.overlap}>
        <PremiumCard style={s.gutter}>
          {loading ? (
            <View style={{ gap: SPACE.md }}>
              <Skeleton width="80%" height={14} />
              <Skeleton width="65%" height={14} />
              <Skeleton width="70%" height={14} />
            </View>
          ) : (
            <View style={s.facts}>
              {[
                { icon: 'event', label: 'Submitted', value: shortDate(application?.submittedAt || application?.createdAt) || '—' },
                { icon: 'badge', label: 'Member type', value: applicantKindLabel(application) || '—' },
                { icon: 'place', label: 'Reviewed in', value: [application?.block, application?.district].filter(Boolean).join(', ') || '—' },
              ].map((f) => (
                <View key={f.label} style={s.fact}>
                  <GradientIconChip icon={f.icon} tone="blue" size={32} />
                  <Text style={s.factLabel} numberOfLines={1}>{f.label}</Text>
                  <Text style={s.factValue} numberOfLines={2}>{f.value}</Text>
                </View>
              ))}
            </View>
          )}
        </PremiumCard>
      </FadeInUp>

      <PremiumSectionHeader title="Approval progress" action={ref ? 'Share' : undefined} onAction={shareRef} />
      <PremiumCard style={s.gutter}>
        <View style={s.pillRow}>
          <View style={s.stagePill}><Text style={s.stagePillText}>Stage {currentStage} of {stages.length}</Text></View>
        </View>
        {stages.map((stage, i) => {
          const tone = stage.state === 'done'
            ? { fg: PALETTE.successText, bg: PALETTE.successSoft, icon: 'check', grad: 'green' as ChipTone }
            : stage.state === 'rejected'
              ? { fg: PALETTE.dangerText, bg: PALETTE.dangerSoft, icon: 'close', grad: 'rose' as ChipTone }
              : stage.state === 'active'
                ? { fg: PALETTE.blueDark, bg: PALETTE.blueSoft, icon: 'hourglass-empty', grad: 'blue' as ChipTone }
                : { fg: PALETTE.textMuted, bg: PALETTE.field, icon: 'schedule', grad: 'slate' as ChipTone };
          return (
            <FadeInUp key={stage.label} delay={320 + i * 80} distance={8} style={[s.stage, i < stages.length - 1 && s.stageDivider]}>
              <GradientIconChip icon={tone.icon} tone={tone.grad} size={38} />
              <Text style={s.stageLabel} numberOfLines={2}>{stage.label}</Text>
              <View style={[s.badge, { backgroundColor: tone.bg }]}><Text style={[s.badgeText, { color: tone.fg }]}>{stage.caption}</Text></View>
            </FadeInUp>
          );
        })}
      </PremiumCard>

      <PremiumSectionHeader title="What happens next" />
      <PremiumCard style={s.gutter}>
        {WHAT_NEXT.map((step, i) => (
          <View key={step.title} style={[s.next, i < WHAT_NEXT.length - 1 && s.stageDivider]}>
            <View>
              <GradientIconChip icon={step.icon} tone={step.tone} size={38} />
              <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.nextTitle}>{step.title}</Text>
              <Text style={s.nextText}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </PremiumCard>

      <View style={[s.gutter, s.note]}>
        <GradientIconChip icon="notifications-active" tone="sky" size={34} />
        <Text style={s.noteText}>You'll be notified as each stage is completed.</Text>
      </View>
      <PressableScale onPress={writeSupport} scaleTo={0.98} style={s.gutter} contentStyle={s.note} accessibilityRole="button" accessibilityLabel="Email support">
        <GradientIconChip icon="mail-outline" tone="blue" size={34} />
        <Text style={s.noteText}>
          Questions? Write to <Text style={s.link}>{SUPPORT_EMAIL}</Text>{ref ? ` and quote ${ref}.` : '.'}
        </Text>
        <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
      </PressableScale>
    </PremiumScreen>
  );
};

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg, gap: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
  refBox: {
    marginTop: SPACE.lg, backgroundColor: BRAND.glass, borderRadius: 20, borderWidth: 1, borderColor: BRAND.glassBorder,
    padding: SPACE.lg, alignItems: 'center',
  },
  refLabel: { ...TYPE.eyebrow, color: BRAND.onBrandFaint },
  refValue: { ...TYPE.number, color: PALETTE.white, marginTop: SPACE.sm - 2, letterSpacing: 1 },
  fullId: { fontSize: 11, lineHeight: 15, color: BRAND.onBrandFaint, marginTop: 2 },
  refHint: { ...TYPE.caption, color: BRAND.onBrandSoft, marginTop: SPACE.sm - 2, textAlign: 'center' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.md, minHeight: 36, paddingHorizontal: SPACE.lg,
    borderRadius: 999, backgroundColor: BRAND.glassStrong, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  shareText: { fontSize: 13, fontWeight: '700', color: PALETTE.white },

  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  facts: { flexDirection: 'row', gap: SPACE.sm },
  fact: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  factLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, marginTop: SPACE.sm },
  factValue: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18, marginTop: 2 },

  pillRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: SPACE.xs },
  stagePill: { backgroundColor: PALETTE.blueSoft, borderRadius: 999, paddingHorizontal: SPACE.sm + 2, paddingVertical: 2 },
  stagePillText: { fontSize: 11.5, fontWeight: '800', color: PALETTE.blueDark },
  stage: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  stageDivider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  stageLabel: { ...TYPE.subheading, flex: 1, minWidth: 0 },
  badge: { borderRadius: 999, paddingHorizontal: SPACE.sm + 2, minHeight: 24, justifyContent: 'center' },
  badgeText: { fontSize: 11.5, fontWeight: '800' },

  next: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.md },
  stepNum: {
    position: 'absolute', right: -6, bottom: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: PALETTE.white,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PALETTE.border,
  },
  stepNumText: { fontSize: 10, fontWeight: '800', color: PALETTE.blueDark },
  nextTitle: { ...TYPE.bodyStrong },
  nextText: { ...TYPE.caption, fontWeight: '400', lineHeight: 17, marginTop: 2 },

  note: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, backgroundColor: PALETTE.white, borderRadius: 18,
    borderWidth: 1, borderColor: PALETTE.border, padding: SPACE.md, marginTop: SPACE.md,
  },
  noteText: { ...TYPE.body, fontSize: 13, lineHeight: 19, flex: 1, minWidth: 0 },
  link: { color: PALETTE.blue, fontWeight: '700' },
  actions: { flex: 1, gap: SPACE.sm },
});

export default ApplicationSubmittedScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
