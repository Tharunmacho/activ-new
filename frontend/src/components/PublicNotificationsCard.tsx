import { useLegacyAppearance } from '../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BRAND, PALETTE, SPACE, TYPE, FitImage, PressableScale } from '../ui';
import { getAuthToken } from '../services/api';
import { getPublicNotice, getPublicNotices, PublicNotice, recordVisitorOpen, visitorPushEnabled } from '../services/visitorNotifications';
import { disableVisitorNotifications, firebaseReady, openPushSettings, pushPermission, syncPushRegistration } from '../services/pushNotifications';
import { PublicShareButton } from './PublicShareButton';

const date = (value: string) => {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PublicNotificationsCard({ visible, noticeId, onClose, navigation }: {
  visible: boolean; noticeId?: string; onClose: () => void; navigation: any;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [items, setItems] = useState<PublicNotice[]>([]);
  const [selected, setSelected] = useState<PublicNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pushError, setPushError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const revision = useRef(0);
  const preferenceRevision = useRef(0);
  const working = useRef(false);

  const preferences = useCallback(async (confirmed?: Awaited<ReturnType<typeof syncPushRegistration>>) => {
    const current = ++preferenceRevision.current;
    setChecking(true); setEnabled(false); setSubscribed(false);
    try {
      const [auth, permission, optedIn] = await Promise.all([getAuthToken(), pushPermission(), visitorPushEnabled()]);
      if (current !== preferenceRevision.current) return;
      setSignedIn(!!auth);
      if (auth) { setPushError(''); return; }
      // Permission and consent are intent. Only a successful API registration
      // confirms this installation is registered for notifications. Passive checks
      // never request permission or opt a new visitor in.
      const result = confirmed ?? (permission === 'enabled' && optedIn ? await syncPushRegistration(false) : undefined);
      const latestAuth = await getAuthToken();
      if (current !== preferenceRevision.current) return;
      if (latestAuth) { setSignedIn(true); setPushError(''); return; }
      setEnabled(result === 'enabled' && permission === 'enabled' && optedIn);
      setSubscribed((result === 'enabled' || result === 'unconfigured') && permission === 'enabled' && optedIn);
      setBlocked(result === 'disabled');
      setPushError(result === 'failed' ? 'This phone is not connected for notifications. Check your connection and try Enable again.'
        : result === 'disabled' ? 'Notifications are off. You can enable them in your phone settings.'
        : result === 'unconfigured' ? 'Notification delivery is not ready. Please try again later.' : '');
    } catch {
      if (current === preferenceRevision.current) setPushError('Could not check notification setup. Please try Enable again.');
    } finally { if (current === preferenceRevision.current) setChecking(false); }
  }, []);
  const read = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true); setError(''); setSelected(null); setPushError(''); setBlocked(false);
    void preferences().catch(() => undefined);
    try {
      const [list, detail] = await Promise.all([getPublicNotices(), noticeId ? getPublicNotice(noticeId) : Promise.resolve(null)]);
      if (current !== revision.current) return;
      setItems(list); setSelected(detail);
    } catch {
      if (current === revision.current) setError('Updates could not be loaded. Check your connection and try again.');
    } finally { if (current === revision.current) setLoading(false); }
  }, [noticeId, preferences]);
  useEffect(() => {
    if (!visible) return;
    void read();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void preferences().catch(() => undefined); });
    return () => { revision.current += 1; preferenceRevision.current += 1; subscription.remove(); };
  }, [visible, read, preferences]);

  const open = async (item: PublicNotice) => {
    const current = ++revision.current;
    setLoading(true); setError('');
    try {
      const detail = await getPublicNotice(item.id);
      const auth = await getAuthToken();
      if (current !== revision.current) return;
      setSelected(detail);
      if (!auth) void recordVisitorOpen(item.id, 'in_app');
    } catch {
      if (current === revision.current) setError('This update is no longer available. Refresh the list to see current updates.');
    } finally { if (current === revision.current) setLoading(false); }
  };
  const toggle = async () => {
    if (working.current || checking) return;
    working.current = true; setBusy(true); setPushError(''); setBlocked(false);
    preferenceRevision.current += 1;
    const current = preferenceRevision.current;
    try {
      const auth = await getAuthToken();
      if (current !== preferenceRevision.current) return;
      if (auth) { onClose(); navigation.navigate('MemberNotifications'); return; }
      let result: Awaited<ReturnType<typeof syncPushRegistration>>;
      if (subscribed) { await disableVisitorNotifications(); result = 'signed-out'; }
      else {
        // The explicit Enable press is the only permission request. A denial
        // stays here; opening phone settings requires a separate user action.
        result = await syncPushRegistration(true);
        if (current !== preferenceRevision.current) return;
      }
      if (current === preferenceRevision.current) await preferences(result);
    } catch {
      if (current === preferenceRevision.current) setPushError('Could not update notifications. Please try again.');
    } finally { working.current = false; setBusy(false); }
  };
  const close = () => { revision.current += 1; preferenceRevision.current += 1; onClose(); };
  const iconButton = (label: string, icon: string, action: () => void) => <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={action} contentStyle={s.iconButton}><Icon name={icon} size={23} color={BRAND.blue} /></PressableScale>;

  if (!visible) return null;
  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
    <View style={[s.overlay, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 12 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss notifications" />
      <View accessibilityViewIsModal style={[s.card, { width: Math.min(width - 24, 420), maxHeight: Math.max(180, height - insets.top - insets.bottom - 88) }]}>
        <View style={s.header}>
          {selected && iconButton('Back to notifications', 'arrow-back', () => { setSelected(null); setError(''); })}
          <Text accessibilityRole="header" style={s.heading}>Notifications</Text>
          {selected && <PublicShareButton path={'/notifications?notice=' + encodeURIComponent(selected.id)} title={selected.title || 'ACTIV update'} compact />}
          {iconButton('Close notifications', 'close', close)}
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={loading || error || (!items.length && !selected) ? s.empty : undefined} keyboardShouldPersistTaps="handled">
          {loading ? <><ActivityIndicator color={BRAND.blue} /><Text style={s.copy}>Loading notifications...</Text></>
            : error ? <><Text accessibilityRole="alert" style={s.copy}>{error}</Text><PressableScale accessibilityRole="button" accessibilityLabel="Try again" onPress={() => void read()} contentStyle={s.action}><Text style={s.actionText}>Try again</Text></PressableScale></>
              : selected ? <View style={s.detail}>
                <Text style={s.date}>{date(selected.createdAt)}</Text><Text style={s.detailTitle}>{selected.title}</Text>
                {!!selected.imageUrl && <FitImage uri={selected.imageUrl} mode="auto" minRatio={0.9} maxRatio={2.6} borderRadius={12} accessibilityLabel={selected.title} />}
                <Text style={s.body}>{selected.body || selected.summary}</Text>
                {selected.kind === 'event' && <PressableScale accessibilityRole="button" accessibilityLabel="View event" onPress={() => { close(); navigation.navigate('PublicEventDetail', { id: selected.sourceId }); }} contentStyle={s.action}><Text style={s.actionText}>View event</Text><Icon name="chevron-right" size={20} color={BRAND.blue} /></PressableScale>}
              </View>
                : items.length ? items.map(item => <PressableScale key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => void open(item)} contentStyle={s.row}>
                  <View style={s.rowText}><Text style={s.title} numberOfLines={2}>{item.title}</Text><Text style={s.summary} numberOfLines={2}>{item.summary}</Text><Text style={s.date}>{date(item.createdAt)}</Text></View>
                  <Icon name="chevron-right" size={20} color={PALETTE.textMuted} />
                </PressableScale>) : <><Text style={s.title}>You're all caught up</Text><Text style={s.copy}>New public events and updates will appear here.</Text></>}
        </ScrollView>
        {firebaseReady() && <View style={s.footer}>
          <PressableScale disabled={busy || checking} accessibilityRole="button" accessibilityLabel={signedIn ? 'Manage notifications' : subscribed ? 'Turn off notifications' : 'Enable notifications'} onPress={() => void toggle()} contentStyle={s.action}>
            <Text style={s.actionText}>{busy ? 'Updating...' : checking ? 'Checking notifications...' : signedIn ? 'Manage notifications' : enabled ? 'Notifications on · Turn off' : subscribed ? 'Turn off notifications' : 'Enable notifications'}</Text>
          </PressableScale>
          {!!pushError && <Text accessibilityRole="alert" style={s.pushError}>{pushError}</Text>}
          {!signedIn && subscribed && !enabled && <PressableScale disabled={busy || checking} accessibilityRole="button" accessibilityLabel="Retry notification connection" onPress={() => void preferences()} contentStyle={s.action}><Text style={s.actionText}>Retry notification connection</Text></PressableScale>}
          {(blocked || subscribed) && <PressableScale accessibilityRole="button" accessibilityLabel="Open phone notification settings" onPress={() => { void openPushSettings(); }} contentStyle={s.action}><Text style={s.actionText}>Sound and pop-up settings</Text></PressableScale>}
        </View>}
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(11,26,69,0.18)' },
  card: { borderRadius: 20, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.divider, overflow: 'hidden', elevation: 16, shadowColor: '#0B1A45', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingLeft: SPACE.md, paddingRight: SPACE.xs, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  heading: { ...TYPE.bodyStrong, flex: 1, color: PALETTE.text, fontSize: 17 }, iconButton: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 }, empty: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.xl }, copy: { ...TYPE.caption, color: PALETTE.textMuted, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, padding: SPACE.md, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  rowText: { flex: 1, minWidth: 0 }, title: { ...TYPE.bodyStrong, fontSize: 17, lineHeight: 24, color: PALETTE.text }, summary: { ...TYPE.caption, fontSize: 16, lineHeight: 24, color: PALETTE.textMuted, marginTop: 3 },
  date: { ...TYPE.caption, fontSize: 14, lineHeight: 21, color: PALETTE.textMuted, marginTop: 5 }, detail: { padding: SPACE.md, gap: SPACE.sm }, detailTitle: { ...TYPE.bodyStrong, fontSize: 18, lineHeight: 25, color: PALETTE.text }, body: { ...TYPE.body, color: PALETTE.textMuted },
  footer: { borderTopWidth: 1, borderTopColor: PALETTE.divider, backgroundColor: PALETTE.blueTint, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }, actionText: { ...TYPE.caption, fontSize: 16, lineHeight: 24, fontWeight: '700', color: BRAND.blue }, pushError: { ...TYPE.caption, color: PALETTE.textMuted, marginBottom: SPACE.xs },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
