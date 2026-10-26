import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, Alert, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Skeleton, PALETTE, SPACE, TYPE, SIZE,
  PremiumScreen, PremiumCard, GradientIconChip, GradientAvatar, GradientButton, GlassIconButton,
  BrandLogo, FadeInUp, PressableScale, BRAND, PREMIUM_TYPE, ChipTone,
} from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { GlassChip } from './dashboard/DashboardPremium';
import { useMemberAccess, useLockedCta, runMembershipCta } from './useMemberAccess';
import { useAuthStore } from '../../stores/exampleStore';
import { clearSession } from '../../services/session';
import { logoutOnServer, getMyApplications } from '../../services/memberApi';

/**
 * ============================================================================
 * THE MEMBER MENU — every member feature, grouped like the website sidebar
 * ============================================================================
 *
 *   Overview      Dashboard (paid or unpaid)
 *   My account    Profile · Business account · Application status (until paid)
 *                 · Plan & renewal · Certificates · Documents
 *   Association   Member Directory* · Events · Updates · Messages*
 *   Support       Help & Support · Settings · Sign out
 *
 * * paid members only (website memberAccess `unlock: 'membershipActive'`);
 *   an unpaid member sees them with a lock and is taken to activation.
 *
 * Application Status follows MEMBER_NAV exactly: it unlocks once an
 * application is submitted (`unlock: 'applicationSubmitted'`) and retires the
 * moment the membership is active (`retires: 'membershipActive'`).
 */


type Item = {
  key: string; label: string; sub: string; icon: string; tone: ChipTone;
  paidOnly?: boolean; onlyUnpaid?: boolean; go: () => void;
  /** Locked for a reason other than payment: the requirement, and where it is met. */
  lockedBy?: string; lockedGo?: () => void;
};

function MenuGroup({ title, items, paid, delay }: { title: string; items: Item[]; paid: boolean; delay: number }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const shown = items.filter((i) => !(i.onlyUnpaid && paid));
  if (!shown.length) return null;
  return (
    <FadeInUp delay={delay} style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">{title}</Text>
      <PremiumCard padded={false}>
        {shown.map((i, idx) => {
          const paidLock = !!i.paidOnly && !paid;
          const locked = paidLock || !!i.lockedBy;
          return (
            <PressableScale
              key={i.key}
              onPress={!paidLock && i.lockedBy ? (i.lockedGo || i.go) : i.go}
              scaleTo={0.985}
              contentStyle={[styles.row, idx < shown.length - 1 && styles.divider]}
              accessibilityRole="button"
              accessibilityLabel={`${i.label}${locked ? ', locked' : ''}`}
            >
              <GradientIconChip icon={locked ? 'lock-outline' : i.icon} tone={locked ? 'slate' : i.tone} size={40} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, locked && { color: PALETTE.textSoft }]}>{i.label}</Text>
                <Text style={styles.rowSub}>
                  {paidLock ? 'Complete your membership' : i.lockedBy ? `${i.lockedBy} to unlock` : i.sub}
                </Text>
              </View>
              {locked ? (
                <View style={styles.lockPill}><Icon name="workspace-premium" size={12} color={PALETTE.blueDark} /><Text style={styles.lockText}>Unlock</Text></View>
              ) : <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />}
            </PressableScale>
          );
        })}
      </PremiumCard>
    </FadeInUp>
  );
}

const MemberMenuScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const { profile, paid, loading } = useMemberAccess();
  const { logout } = useAuthStore();
  const [submitted, setSubmitted] = useState<boolean | null>(null);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    getMyApplications()
      .then((list) => { if (!cancelled) setSubmitted((list || []).length > 0); })
      .catch(() => { if (!cancelled) setSubmitted(null); });
    return () => { cancelled = true; };
  }, []));

  // A locked entry leads to the member's actual next step (website membershipCta),
  // not straight to payment — which the server refuses before approval.
  const cta = useLockedCta(paid, profile);
  const activate = () => runMembershipCta(navigation, cta.target, profile);
  const gated = (route: string, params?: any) => () => (paid ? navigation.navigate(route, params) : activate());
  const home = () => navigation.reset({ index: 0, routes: [{ name: paid ? 'PaidDashboard' : 'MemberMain' }] });

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await logoutOnServer();
          await clearSession();
          try { await logout(); } catch { /* storage already cleared */ }
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const overview: Item[] = [
    { key: 'dash', label: 'Dashboard', sub: paid ? 'Your membership at a glance' : 'Your application and next step', icon: 'dashboard', tone: 'blue', go: home },
  ];
  const account: Item[] = [
    { key: 'profile', label: 'My Profile', sub: 'Personal, business and financial details', icon: 'person-outline', tone: 'blue', go: () => navigation.navigate(paid ? 'PaidProfile' : 'MemberMain', paid ? undefined : { screen: 'Profile' }) },
    { key: 'business', label: 'Business Account', sub: 'Companies, products and analytics', icon: 'storefront', tone: 'teal', go: () => navigation.navigate('BusinessDashboard') },
    {
      key: 'application', label: 'Application Status', sub: 'Track your review', icon: 'fact-check', tone: 'amber', onlyUnpaid: true,
      go: () => navigation.navigate('ApplicationStatus'),
      // Unknown (the call failed) is not "not submitted" — leave it open.
      lockedBy: submitted === false ? 'Submit your application' : undefined,
      lockedGo: () => navigation.navigate('PersonalDetailsForm', {}),
    },
    { key: 'plan', label: 'Plan & Renewal', sub: 'Your plan, validity and renewal', icon: 'workspace-premium', tone: 'green', go: () => navigation.navigate('MembershipPlanDetails') },
    { key: 'cert', label: 'Membership Certificate', sub: 'View and share', icon: 'verified', tone: 'blue', paidOnly: true, go: gated('MemberCertificate', { kind: 'membership' }) },
    { key: 'tax', label: '80G Tax Certificate', sub: 'For your tax filing', icon: 'receipt-long', tone: 'green', paidOnly: true, go: gated('MemberCertificate', { kind: 'tax-exemption' }) },
    { key: 'docs', label: 'Documents', sub: 'What you have submitted', icon: 'folder-open', tone: 'amber', go: () => navigation.navigate('MemberDocuments') },
  ];
  const association: Item[] = [
    { key: 'dir', label: 'ACTIV Network', sub: 'Find members and their businesses', icon: 'groups', tone: 'sky', paidOnly: true, go: gated('MemberDirectory') },
    { key: 'events', label: 'Events', sub: 'Upcoming events and your tickets', icon: 'event', tone: 'rose', go: () => navigation.navigate('MemberEvents') },
    { key: 'updates', label: 'Association Updates', sub: 'News for your region', icon: 'campaign', tone: 'amber', go: () => navigation.navigate('AssociationUpdates') },
    { key: 'msgs', label: 'Messages', sub: 'Talk to other members', icon: 'chat-bubble-outline', tone: 'green', paidOnly: true, go: gated('MemberMessages') },
    { key: 'donate', label: 'Donate', sub: 'Support ACTIV · 80G receipts', icon: 'volunteer-activism', tone: 'rose', go: () => navigation.navigate('MemberDonations') },
    { key: 'gallery', label: 'Gallery', sub: 'Community albums and photographs', icon: 'collections', tone: 'sky', go: () => navigation.navigate('PublicContent', { path: '/gallery', title: 'Gallery' }) },
    { key: 'news', label: 'News', sub: 'Stories from the ACTIV community', icon: 'newspaper', tone: 'navy', go: () => navigation.navigate('PublicContent', { path: '/news', title: 'News' }) },
    { key: 'zones', label: 'Zones & States', sub: 'Leadership and local updates', icon: 'public', tone: 'green', go: () => navigation.navigate('PublicContent', { path: '/zones', title: 'Zones & States' }) },
    { key: 'schemes', label: 'Government Schemes', sub: 'Benefits, eligibility and application steps', icon: 'account-balance', tone: 'amber', go: () => navigation.navigate('PublicContent', { path: '/schemes', title: 'Schemes' }) },
  ];
  const support: Item[] = [
    { key: 'notif', label: 'Notifications', sub: 'Everything we have sent you', icon: 'notifications-none', tone: 'blue', go: () => navigation.navigate('MemberNotifications') },
    { key: 'help', label: 'Help & Support', sub: 'Write to the ACTIV office', icon: 'support-agent', tone: 'sky', go: () => navigation.navigate('MemberHelp') },
    { key: 'settings', label: 'Settings', sub: 'Password, photo and account', icon: 'settings', tone: 'slate', go: () => navigation.navigate('AccountSettings') },
  ];

  const name = String(profile?.fullName || '').trim() || 'ACTIV Member';
  const platinum = String(profile?.membershipTier || '').trim().toLowerCase() === 'platinum';
  const photo = resolveMediaUrl(profile?.profilePhoto || profile?.profileImage || '');

  const header = (
    <View>
      <View style={styles.top}>
        <GlassIconButton
          icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.topTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>Menu</Text>
        <BrandLogo size="sm" />
      </View>
      <FadeInUp delay={60} style={styles.identity}>
        <GradientAvatar name={name} uri={photo || undefined} size={64} status={paid ? 'verified' : 'pending'} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow} numberOfLines={1} maxFontSizeMultiplier={1.2}>{paid ? 'Active member' : 'Membership pending'}</Text>
          <Text style={styles.name} maxFontSizeMultiplier={1.25}>{name}</Text>
          <Text style={styles.sub} maxFontSizeMultiplier={1.2}>
            {paid ? `Member ID ${profile?.membershipNumber || '—'}` : 'Complete your membership to unlock everything'}
          </Text>
        </View>
      </FadeInUp>
      {paid || platinum ? (
        <FadeInUp delay={120} style={styles.chips}>
          {paid ? <GlassChip label="Active" dot="#34D399" /> : null}
          {platinum ? <GlassChip label="Lifetime" icon="diamond" /> : null}
        </FadeInUp>
      ) : null}
      {!paid ? (
        <FadeInUp delay={160}>
          <GradientButton variant="glass" label={cta.label} icon="bolt" onPress={activate} style={styles.cta} />
        </FadeInUp>
      ) : null}
      <View style={{ height: SPACE.xl }} />
    </View>
  );

  return (
    <PremiumScreen header={header} waveHeight={56}>
      {loading && !profile ? (
        <View style={styles.group}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={150} radius={22} style={{ marginBottom: SPACE.lg }} />)}
        </View>
      ) : (
        <>
          <MenuGroup title="OVERVIEW" items={overview} paid={paid} delay={120} />
          <MenuGroup title="MY ACCOUNT" items={account} paid={paid} delay={180} />
          <MenuGroup title="ASSOCIATION" items={association} paid={paid} delay={240} />
          <MenuGroup title="SUPPORT" items={support} paid={paid} delay={300} />

          <FadeInUp delay={340} style={styles.group}>
            <PremiumCard padded={false}>
              <PressableScale onPress={signOut} scaleTo={0.985} contentStyle={styles.row} accessibilityRole="button" accessibilityLabel="Sign out">
                <GradientIconChip icon="logout" tone="rose" size={40} />
                <Text style={[styles.rowTitle, { color: PALETTE.redDark, flex: 1 }]}>Sign out</Text>
              </PressableScale>
            </PremiumCard>
          </FadeInUp>
        </>
      )}
    </PremiumScreen>
  );
};

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  topTitle: { ...TYPE.title, color: PALETTE.white, flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.xl },
  eyebrow: { ...PREMIUM_TYPE.eyebrow, color: BRAND.onBrandFaint },
  name: { ...PREMIUM_TYPE.heroMd, fontSize: 22, lineHeight: 28, color: PALETTE.white, marginTop: 2 },
  sub: { ...TYPE.caption, color: BRAND.onBrandSoft, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  cta: { marginTop: SPACE.lg },
  // Plain section headings stay below the waves; only surfaced cards overlap.
  group: { marginTop: SPACE.lg, paddingHorizontal: SPACE.lg },
  groupTitle: { ...TYPE.eyebrow, fontSize: 13, lineHeight: 18, fontWeight: '800', color: PALETTE.blueDeep, marginBottom: SPACE.sm, marginLeft: SPACE.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: SIZE.row + 8 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...TYPE.subheading },
  rowSub: { ...TYPE.caption, fontWeight: '400', marginTop: 2 },
  lockPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PALETTE.blueSoft, borderRadius: 999, paddingHorizontal: SPACE.sm, minHeight: 24 },
  lockText: { fontSize: 11, fontWeight: '800', color: PALETTE.blueDark },
});

export default MemberMenuScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
