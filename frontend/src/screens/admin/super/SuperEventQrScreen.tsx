import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Share, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, ConsoleChip, GlassIconButton,
} from '../../../ui';
import { updateCmsEvent, eventPublicUrl, errorText } from '../../../services/superApi';
import { ToggleRow, openUrl } from './superKit';
import { QrCode } from './events/qr';

/**
 * ============================================================================
 * SUPER ADMIN → EVENTS — one event's QR code (website `EventQrDialog`)
 * ============================================================================
 *
 * Opened from an event's row, and straight after an event is created
 * (`justCreated` — "Event created — QR ready"), as the website does. The code
 * encodes the event's public page (`eventPublicUrl`, slug first, the website's
 * `eventPath`), drawn by the app's own encoder at the website's error level.
 *
 * "Show this QR on the event page" writes `showQrOnPage` alone through
 * PUT /cms/events/:id — an absent field is UNTOUCHED on that path, so nothing
 * else on the event changes.
 *
 * A dedicated Stack screen rather than a popup: the Events list is a tab, and a
 * native Modal inside a tab is exactly what CLAUDE.md Rule 2 forbids.
 *
 * Not ported: the website's printable poster PNG (drawn on an HTML canvas).
 * Sharing sends the link, which opens the same page the code does.
 */

const dateLine = (startAt?: string | null) => {
  const d = startAt ? new Date(startAt) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return `${d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })} IST`;
  } catch {
    return d.toString();
  }
};

const SuperEventQrScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const event = route?.params?.event || {};
  const justCreated = !!route?.params?.justCreated;
  const [showOnPage, setShowOnPage] = useState<boolean>(event?.showQrOnPage !== false);
  const [busy, setBusy] = useState(false);

  const url = eventPublicUrl(event);
  const title = String(event?.title || '') || 'Untitled event';
  const when = dateLine(event?.startAt);

  const share = () => {
    Share.share({ title, message: `${title} — ${url}` }).catch(() => null);
  };

  const toggle = async (next: boolean) => {
    const id = String(event?.id || '');
    if (!id || busy) return;
    setBusy(true);
    const before = showOnPage;
    setShowOnPage(next);
    try {
      await updateCmsEvent(id, { showQrOnPage: next });
    } catch (err) {
      setShowOnPage(before);
      Alert.alert('Could not save the QR setting', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsoleScroll>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · events"
        title={justCreated ? 'Event created — QR ready' : 'Event QR code'}
        subtitle={title}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />}
        right={<GlassIconButton icon="share" accessibilityLabel="Share" onPress={share} />}
      />

      <ConsoleCard style={[s.card, s.first]}>
        {justCreated ? <ConsoleChip label="Saved" kind="approved" icon="check-circle" style={s.saved} /> : null}
        <Text style={s.title} numberOfLines={3}>{title}</Text>
        {when ? <Text style={s.when}>{when}</Text> : null}
        <View style={s.qrFrame}>
          <QrCode value={url} size={248} />
        </View>
        <Text style={s.caption}>Scanning opens this event&apos;s page on the phone.</Text>
        <Text style={s.url} selectable numberOfLines={3}>{url}</Text>
      </ConsoleCard>

      <View style={s.actions}>
        <ConsoleButton icon="share" label="Share" onPress={share} />
        <ConsoleButton kind="soft" icon="open-in-new" label="Open the event page" onPress={() => openUrl(url)} />
      </View>

      <ConsoleCard style={s.card}>
        <ToggleRow label="Show this QR on the event page" value={showOnPage} onChange={toggle} disabled={busy || !event?.id}
          hint="Visitors can scan it from a screen or projector, or download it." last />
      </ConsoleCard>
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  card: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  first: { marginTop: -SPACE.lg },
  saved: { alignSelf: 'center', marginBottom: SPACE.sm },
  title: { ...TYPE.heading, fontSize: 18, textAlign: 'center' },
  when: { fontSize: 13, color: PALETTE.textMuted, textAlign: 'center', marginTop: 4 },
  qrFrame: { alignSelf: 'center', marginTop: SPACE.lg, padding: SPACE.sm, borderRadius: 18, borderWidth: 2, borderColor: PALETTE.indigoSoft, backgroundColor: '#FFFFFF' },
  caption: { fontSize: 13, fontWeight: '700', color: PALETTE.indigoDark, textAlign: 'center', marginTop: SPACE.md },
  url: { fontSize: 12, color: PALETTE.textMuted, textAlign: 'center', marginTop: 4 },
  actions: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg, gap: SPACE.sm },
});

export default SuperEventQrScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
