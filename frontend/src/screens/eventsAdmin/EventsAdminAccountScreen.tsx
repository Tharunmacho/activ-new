import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, ConsoleSectionTitle, ConsoleNote, GradientAvatar,
} from '../../ui';
import { clearSession } from '../../services/session';
import { useAuthStore } from '../../stores/exampleStore';

/**
 * ============================================================================
 * EVENTS ADMIN — Account
 * ============================================================================
 *
 * Who is signed in, what this account does in the app and what stays on the
 * website — stated, so a missing button reads as a decision and not a bug —
 * and sign out.
 *
 * The split follows the server's role gating (event.routes.js):
 *   EVENT_MANAGERS  (events_admin only)  events, categories — written on the website
 *   CHECKIN_STAFF   (attendance_admin ✓)  scan, look up, admit — this app
 *   ATTENDANCE_VIEWERS (attendance_admin ✓)  attendance + CSV — this app
 *
 * The app signs in as `attendance_admin` (Event Attendance Administration),
 * a mobile-only account the Super Admin maintains under Manage Admins.
 *   BOOKING_VIEWERS (super_admin only)  bookings, amounts, record payment, cancel
 */

type Props = { navigation: any };

const IN_APP = [
  { icon: 'qr-code-scanner', text: 'Scan entry passes and admit attendees' },
  { icon: 'keyboard', text: 'Find a booking by ID or registration number' },
  { icon: 'groups', text: 'See each booking’s party and admit seat by seat' },
  { icon: 'fact-check', text: 'Live attendance per event, with Excel export' },
];

const ELSEWHERE = [
  { icon: 'edit-calendar', text: 'Writing and publishing events, categories — ACTIV website' },
  { icon: 'photo-library', text: 'Gallery, news and schemes — ACTIV website' },
  { icon: 'payments', text: 'Amounts, recording payments and cancelling bookings — Super Admin' },
];

function Line({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={s.line}>
      <Icon name={icon} size={18} color={muted ? PALETTE.textMuted : PALETTE.indigo} />
      <Text style={[s.lineText, muted && s.muted]} maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

export default function EventsAdminAccountScreen({ navigation }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const { user } = useAuthStore();
  const name = String((user as any)?.fullName || (user as any)?.name || 'Attendance Admin');
  const email = String((user as any)?.email || '');

  const logout = useCallback(() => {
    Alert.alert('Log out', 'Sign out of the events console on this phone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await useAuthStore.getState().logout();
          } catch (err) {
            console.warn('Logout safely caught:', err);
          }
          await clearSession();
          navigation?.reset?.({ index: 0, routes: [{ name: 'AdminLogin' }] });
        },
      },
    ]);
  }, [navigation]);

  return (
    <ConsoleScroll>
      <ConsoleHeader
        eyebrow="Account"
        title={name}
        subtitle={email || 'Event Attendance Administration'}
        right={<GradientAvatar name={name} size={44} tone="admin" status="online" />}
        badges={[{ icon: 'badge', label: 'Event Attendance Admin' }]}
      />

      <ConsoleSectionTitle title="In this app" icon="smartphone" style={s.section} />
      <ConsoleCard style={s.card}>
        {IN_APP.map((l) => <Line key={l.text} icon={l.icon} text={l.text} />)}
      </ConsoleCard>

      <ConsoleSectionTitle title="Elsewhere" icon="language" style={s.section} />
      <ConsoleCard style={s.card}>
        {ELSEWHERE.map((l) => <Line key={l.text} icon={l.icon} text={l.text} muted />)}
      </ConsoleCard>

      <ConsoleNote
        style={s.note}
        icon="lock-outline"
        text="Attendees’ email and phone numbers are not shown to this account — only the last four digits."
      />

      <View style={s.signout}>
        <ConsoleButton kind="danger" icon="logout" label="Log out" onPress={logout} />
      </View>
    </ConsoleScroll>
  );
}

const s = StyleSheet.create({
  section: { marginTop: SPACE.lg },
  card: { marginHorizontal: SPACE.lg, gap: SPACE.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  lineText: { ...TYPE.body, flex: 1, minWidth: 0 },
  muted: { color: PALETTE.textMuted },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  signout: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
