import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE, SIZE, BRAND,
  ConsoleScroll, ConsoleHeader, ConsoleButton, ConsoleNote, BrandLogo, GradientAvatar, PressableScale, FadeInUp,
  AdminConsole3D, CONSOLE_ACCENTS, ConsoleAccent,
} from '../../../ui';
import { clearSession } from '../../../services/session';
import { useAuthStore } from '../../../stores/exampleStore';
import { resolveMediaUrl } from '../../../config/api.config';
import { useSuperAdminData } from './context/SuperAdminContext';
import { confirm } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — "More": every feature of the website's Super Admin sidebar
 * ============================================================================
 *
 * FULL PARITY WITH THE WEBSITE SUPER ADMIN (decided 2026-09-30), except the CMS
 * content pages: applications and members; membership plans, Platinum,
 * bookings and revenue, donations; events, categories and attendance; member
 * updates and notifications (Automation delivery log, raw log, setup,
 * routing). Events also has its own tab. Stack screens: routes/superRoutes.tsx.
 *
 * Premium: the indigo wave header with the admin console art, and a grid of
 * gradient tiles that spring when pressed.
 */

export type Item = { key: string; icon: string; label: string; hint: string; accent: ConsoleAccent; go: (nav: any) => void };

const tab = (name: string) => (nav: any) => nav.navigate(name);
const stack = (name: string, params?: any) => (nav: any) => nav.navigate(name, params);

/** Also the ☰ side menu on every Super Admin tab (SuperMenuDrawer) — one list, two views. */
export const SUPER_MENU_SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Applications & members',
    items: [
      { key: 'hub', icon: 'space-dashboard', label: 'Hub', hint: 'Every tier, every region', accent: 'indigo', go: tab('Hub') },
      { key: 'approvals', icon: 'fact-check', label: 'Approvals', hint: 'Decide in the State seat', accent: 'sky', go: stack('SuperApprovals') },
      { key: 'members', icon: 'groups', label: 'Members', hint: 'Active, expired, reminders', accent: 'green', go: stack('SuperMembers') },
      { key: 'admins', icon: 'admin-panel-settings', label: 'Admins', hint: 'Block, district, state', accent: 'amber', go: tab('Admins') },
    ],
  },
  {
    title: 'Membership & money',
    items: [
      { key: 'registrations', icon: 'how-to-reg', label: 'Registrations & payments', hint: 'Members, receipts, manual confirmation', accent: 'indigo', go: stack('SuperMembershipRegistrations') },
      { key: 'membership-ids', icon: 'badge', label: 'Membership IDs', hint: 'Member records and corrections', accent: 'indigo', go: stack('SuperMembershipIds') },
      { key: 'plans', icon: 'card-membership', label: 'Membership plans', hint: 'Prices, bands, show-all', accent: 'indigo', go: stack('SuperMembership', { tab: 'plans' }) },
      { key: 'platinum', icon: 'workspace-premium', label: 'Lifetime', hint: 'Grant, requests', accent: 'gold', go: stack('SuperMembership', { tab: 'platinum' }) },
      { key: 'bookings', icon: 'confirmation-number', label: 'Bookings & revenue', hint: 'Seats sold, paid, unpaid', accent: 'green', go: stack('SuperBookings') },
      { key: 'donations', icon: 'volunteer-activism', label: 'Donations', hint: 'Donors, receipts, totals', accent: 'red', go: stack('SuperDonors') },
    ],
  },
  {
    title: 'Events',
    items: [
      { key: 'events', icon: 'event', label: 'Events', hint: 'Create, edit, QR, targets', accent: 'sky', go: tab('Events') },
      { key: 'categories', icon: 'category', label: 'Event categories', hint: 'Names, order, mode', accent: 'slate', go: stack('SuperEventCategories') },
      { key: 'people', icon: 'person-search', label: 'Booking people', hint: 'Everyone who has booked', accent: 'indigo', go: stack('SuperBookingPeople') },
      { key: 'attendance', icon: 'how-to-reg', label: 'Event attendance', hint: 'Who came · read-only', accent: 'gold', go: stack('SuperEventAttendance') },
    ],
  },
  {
    title: 'Communication',
    items: [
      { key: 'updates', icon: 'campaign', label: 'Member updates', hint: 'Announcements to members', accent: 'amber', go: stack('SuperUpdates') },
      { key: 'automation', icon: 'mark-email-read', label: 'Message delivery', hint: 'Delivered, read, failed', accent: 'green', go: stack('SuperNotifications', { view: 'automation' }) },
      { key: 'notifications', icon: 'notifications-active', label: 'Notifications', hint: 'Log, setup, test send', accent: 'sky', go: stack('SuperNotifications', { view: 'log' }) },
      { key: 'settings', icon: 'settings', label: 'Settings & audit', hint: 'Profile, password, audit log', accent: 'slate', go: tab('Settings') },
    ],
  },
];

/** One grid tile. Equal heights per row: the cell stretches, the tile fills it. */
function Tile({ item, onPress, delay }: { item: Item; onPress: () => void; delay: number }) {
  const a = CONSOLE_ACCENTS[item.accent] || CONSOLE_ACCENTS.indigo;
  return (
    <FadeInUp delay={delay} style={s.cellInner}>
      <PressableScale onPress={onPress} style={s.flex} contentStyle={s.flex} accessibilityRole="button" accessibilityLabel={`${item.label}, ${item.hint}`}>
        <View style={s.tileShadow}>
        <View style={s.tile}>
          <View pointerEvents="none" style={[s.tileGlow, { backgroundColor: a.soft }]} />
          <View style={s.tileHead}>
            <LinearGradient colors={a.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tileIcon}>
              <Icon name={item.icon} size={SIZE.icon + 2} color={PALETTE.white} />
            </LinearGradient>
            <Icon name="arrow-outward" size={16} color={PALETTE.textFaint} />
          </View>
          <Text style={s.tileLabel}>{item.label}</Text>
          <Text style={s.tileHint}>{item.hint}</Text>
        </View>
        </View>
      </PressableScale>
    </FadeInUp>
  );
}

const SuperMenuScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { logout } = useAuthStore();
  const { adminName, adminEmail, adminProfilePhoto } = useSuperAdminData() as any;

  const signOut = async () => {
    if (!(await confirm('Sign out', 'Sign out of the Super Admin account on this phone?', 'Sign out', true))) return;
    try { await logout(); } catch { /* storage */ }
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
  };

  let n = 0;

  return (
    <ConsoleScroll>
      <ConsoleHeader
        left={<BrandLogo size="sm" />}
        right={<GradientAvatar name={adminName || 'Super Admin'} uri={adminProfilePhoto ? resolveMediaUrl(adminProfilePhoto) : ''} size={44} tone="admin" status="online" />}
        eyebrow="Super Admin"
        title={adminName ? String(adminName) : 'Everything, in one place'}
        subtitle={adminEmail ? String(adminEmail) : 'The whole association, built for your phone.'}
        art={<AdminConsole3D size={100} />}
        badges={[{ icon: 'public', label: 'All India' }, { icon: 'verified-user', label: 'Full access' }]}
        waveHeight={62}
      />

      {SUPER_MENU_SECTIONS.map((sec, si) => (
        <View key={sec.title} style={si === 0 ? s.firstSection : undefined}>
          <Text style={s.section} accessibilityRole="header">{sec.title}</Text>
          <View style={s.grid}>
            {sec.items.map((it) => {
              n += 1;
              return (
                <View key={it.key} style={s.cell}>
                  <Tile item={it} delay={Math.min(60 * n, 480)} onPress={() => it.go(navigation)} />
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <ConsoleNote
        icon="language"
        style={s.note}
        text="Everything the website Super Admin can do is here, except editing the CMS content pages — those stay on the ACTIV website."
      />

      <FadeInUp delay={420} style={s.signout}>
        <ConsoleButton kind="danger" icon="logout" label="Sign out" onPress={signOut} />
        <Text style={s.signoutHint}>End the Super Admin session on this phone</Text>
      </FadeInUp>
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  firstSection: { marginTop: 0 },
  section: { ...TYPE.eyebrow, fontSize: 13, lineHeight: 18, fontWeight: '800', color: PALETTE.indigoDark, marginHorizontal: SPACE.lg, marginTop: SPACE.lg, marginBottom: SPACE.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', paddingHorizontal: SPACE.lg },
  cell: { width: '48.4%', marginBottom: SPACE.md },
  cellInner: { flex: 1 },
  tileShadow: {
    flex: 1, borderRadius: 22, backgroundColor: PALETTE.card,
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
  },
  tile: {
    flex: 1, backgroundColor: PALETTE.card, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    padding: SPACE.lg, minHeight: 136, overflow: 'hidden',
  },
  tileGlow: { position: 'absolute', width: 110, height: 110, borderRadius: 55, top: -50, right: -40 },
  tileHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACE.md },
  tileIcon: { width: SIZE.touch, height: SIZE.touch, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...TYPE.subheading, fontWeight: '800' },
  tileHint: { ...TYPE.caption, marginTop: SPACE.xxs },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
  signout: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  signoutHint: { ...TYPE.caption, textAlign: 'center', marginTop: SPACE.sm, color: PALETTE.textFaint },
});

export default SuperMenuScreen;
