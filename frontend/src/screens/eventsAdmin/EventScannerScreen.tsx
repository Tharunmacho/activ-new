import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, RADIUS,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleButton, ConsoleChip, ConsoleNote, ConsoleSectionTitle,
  GlassIconButton, PremiumInput, FadeInUp, CONSOLE_LIST, CONSOLE_OVERLAP,
} from '../../ui';
import {
  admitSeat, checkinErrorMessage, extractPassToken, lookupPass, type CheckinSeat,
} from '../../services/eventCheckinApi';
import { SeatResultCard } from './checkinKit';
import { loadVisionCamera, visionCameraError } from './visionCamera';

/**
 * ============================================================================
 * THE SCANNER — events staff at the door
 * ============================================================================
 *
 *   scan  ─► lookup (nothing written) ─► result card ─► "Allow entry" ─► admit
 *
 * The QR is read by react-native-vision-camera's built-in code scanner (ML Kit
 * on Android, AVFoundation on iOS). The camera pauses while a result is on
 * screen, so one pass is one lookup, not thirty a second.
 *
 * Everything that can fail is caught: no camera library in this binary, no
 * camera on the device, permission refused — each leaves MANUAL ENTRY (booking
 * ID or registration number) working, which is also the fallback for a pass
 * that is crumpled, cracked or dimmed.
 *
 * The result is an inline card, never a native Modal (CLAUDE.md Rule 2).
 */

type Props = { navigation: any; route: any };

/** The live camera. Only mounted when the library loaded, so its hooks always run in the same order. */
function LiveScanner({ vc, active, onCode }: { vc: any; active: boolean; onCode: (value: string) => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const { hasPermission, requestPermission } = vc.useCameraPermission();
  const device = vc.useCameraDevice('back');
  const [asked, setAsked] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const codeScanner = vc.useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes: any[]) => {
      const value = String((codes || [])[0]?.value || '');
      if (value) onCodeRef.current(value);
    },
  });

  const ask = useCallback(async () => {
    try {
      if (typeof requestPermission === 'function') await requestPermission();
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    } finally {
      setAsked(true);
    }
  }, [requestPermission]);

  // Ask once on arrival; afterwards only when staff press the button.
  useEffect(() => {
    if (!hasPermission && !asked) ask();
  }, [hasPermission, asked, ask]);

  if (!hasPermission) {
    return (
      <View style={s.cameraMessage}>
        <Icon name="no-photography" size={40} color={PALETTE.white} />
        <Text style={s.cameraTitle} maxFontSizeMultiplier={1.3}>Camera access needed</Text>
        <Text style={s.cameraText} maxFontSizeMultiplier={1.3}>
          Allow the camera to scan entry passes. You can still enter a booking ID below.
        </Text>
        <View style={s.cameraButtons}>
          <ConsoleButton size="sm" kind="soft" icon="photo-camera" label="Allow camera" onPress={ask} />
          {asked ? (
            <ConsoleButton
              size="sm"
              kind="soft"
              icon="settings"
              label="Open settings"
              onPress={() => { Linking.openSettings().catch(() => {}); }}
            />
          ) : null}
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={s.cameraMessage}>
        <Icon name="videocam-off" size={40} color={PALETTE.white} />
        <Text style={s.cameraTitle} maxFontSizeMultiplier={1.3}>No camera found</Text>
        <Text style={s.cameraText} maxFontSizeMultiplier={1.3}>Use manual entry below.</Text>
      </View>
    );
  }

  const Camera = vc.Camera;
  return (
    <View style={s.cameraFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={active && !cameraError}
        codeScanner={codeScanner}
        onError={(err: any) => {
          console.warn('Camera error safely caught:', err);
          setCameraError(String(err?.message || 'The camera stopped.'));
        }}
      />
      {/* The aiming square. */}
      <View pointerEvents="none" style={s.aimWrap}>
        <View style={s.aim}>
          <View style={[s.corner, s.tl]} /><View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} /><View style={[s.corner, s.br]} />
        </View>
        <Text style={s.aimText} maxFontSizeMultiplier={1.2}>
          {cameraError ? cameraError : active ? 'Point at the QR code on the pass' : 'Paused'}
        </Text>
      </View>
    </View>
  );
}

export default function EventScannerScreen({ navigation, route }: Props) {
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const eventId: string = String(route?.params?.eventId || '');
  const eventTitle: string = String(route?.params?.eventTitle || '');

  const vc = loadVisionCamera();
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(true);

  const [looking, setLooking] = useState(false);
  const [seats, setSeats] = useState<CheckinSeat[]>([]);
  const [selected, setSelected] = useState<CheckinSeat | null>(null);
  const [outcome, setOutcome] = useState<'admitted' | 'already_checked_in' | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [admitError, setAdmitError] = useState('');
  const [admitting, setAdmitting] = useState(false);
  const [admittedCount, setAdmittedCount] = useState(0);

  const [manualOpen, setManualOpen] = useState(!vc);
  const [manual, setManual] = useState('');

  // What was scanned, for the admit call: a pass token, or null for manual entry.
  const sourceRef = useRef<{ token: string } | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ value: string; at: number }>({ value: '', at: 0 });
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => { try { sub?.remove?.(); } catch { /* older RN */ } };
  }, []);

  const showing = !!selected || seats.length > 1 || !!lookupError;
  const cameraActive = focused && foreground && !showing && !looking;

  const reset = useCallback(() => {
    setSeats([]);
    setSelected(null);
    setOutcome(null);
    setLookupError('');
    setAdmitError('');
    sourceRef.current = null;
    busyRef.current = false;
  }, []);

  const runLookup = useCallback(async (input: { token?: string; registrationNo?: string }) => {
    setLooking(true);
    setLookupError('');
    setAdmitError('');
    setOutcome(null);
    try {
      const result = await lookupPass({ ...input, ...(eventId ? { eventId } : {}) });
      const list = result?.seats || [];
      setSeats(list);
      setSelected(list.length === 1 ? list[0] : null);
      if (!list.length) setLookupError('No seats were found on this booking.');
    } catch (err: any) {
      setSeats([]);
      setSelected(null);
      setLookupError(checkinErrorMessage(err, 'This pass could not be checked.'));
    } finally {
      setLooking(false);
      busyRef.current = false;
      setTimeout(() => scrollRef.current?.scrollTo?.({ y: 0, animated: true }), 50);
    }
  }, [eventId]);

  const onCode = useCallback((value: string) => {
    if (busyRef.current) return;
    const now = Date.now();
    // The same code held in front of the lens after "Scan next" is not a new scan.
    if (value === lastRef.current.value && now - lastRef.current.at < 2500) return;
    lastRef.current = { value, at: now };
    busyRef.current = true;
    const token = extractPassToken(value);
    sourceRef.current = token ? { token } : null;
    // Not a pass: let the server say so in one place (it knows every reason).
    runLookup({ token: token || value });
  }, [runLookup]);

  const onManualFind = useCallback(() => {
    const text = String(manual || '').trim();
    if (!text) return;
    const token = extractPassToken(text);
    sourceRef.current = token ? { token } : null;
    runLookup(token ? { token } : { registrationNo: text });
  }, [manual, runLookup]);

  const onAdmit = useCallback(async () => {
    if (!selected || admitting) return;
    setAdmitting(true);
    setAdmitError('');
    try {
      const token = sourceRef.current?.token || '';
      const result = await admitSeat(token
        ? { token, eventId: eventId || undefined, method: 'qr' }
        : { registrationNo: selected.registrationNo, eventId: eventId || undefined, method: 'manual' });
      setOutcome(result.outcome);
      if (result.seat) {
        setSelected(result.seat);
        setSeats((list) => (list || []).map((x) => (x?.registrationNo === result.seat?.registrationNo ? (result.seat as CheckinSeat) : x)));
      }
      if (result.outcome === 'admitted') setAdmittedCount((n) => n + 1);
    } catch (err: any) {
      setAdmitError(checkinErrorMessage(err, 'Entry could not be recorded. Try again.'));
    } finally {
      setAdmitting(false);
    }
  }, [selected, admitting, eventId]);

  const onNext = useCallback(() => {
    lastRef.current = { value: lastRef.current.value, at: Date.now() };
    reset();
    setManual('');
  }, [reset]);

  const backToList = useCallback(() => {
    setSelected(null);
    setOutcome(null);
    setAdmitError('');
  }, []);

  /*
   * NO EVENT, NO SCANNER. A pass is only valid at its own event's door and the
   * server refuses a scan without one, so the camera never opens here.
   */
  if (!eventId) {
    return (
      <ConsoleFrame>
        <ScrollView contentContainerStyle={CONSOLE_LIST}>
          <ConsoleHeader
            compact
            eyebrow="Event check-in"
            title="Choose an event"
            left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
          />
          <View style={{ paddingHorizontal: SPACE.lg }}>
            <ConsoleNote icon="event" text="Open the scanner from the event you are checking in. A pass only works at its own event." />
            <ConsoleButton icon="event" label="Go to events" onPress={() => navigation?.navigate?.('EventsAdminHome', { screen: 'Events' })} />
          </View>
        </ScrollView>
      </ConsoleFrame>
    );
  }

  return (
    <ConsoleFrame avoidKeyboard>
      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={CONSOLE_LIST}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ConsoleHeader
          compact
          eyebrow="Event check-in"
          title="Scan passes"
          subtitle={eventTitle || 'Event'}
          left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
          badges={admittedCount ? [{ icon: 'how-to-reg', label: `${admittedCount} let in on this phone` }] : []}
        />

        <View style={s.gutter}>
          {/* ------------------------------------------------ the result */}
          {looking ? (
            <ConsoleCard style={s.overlap}>
              <View style={s.lookingRow}>
                <ActivityIndicator color={PALETTE.indigo} />
                <Text style={TYPE.bodyStrong} maxFontSizeMultiplier={1.3}>Checking the pass…</Text>
              </View>
            </ConsoleCard>
          ) : null}

          {!looking && lookupError ? (
            <FadeInUp style={s.overlap}>
              <ConsoleCard accent={PALETTE.red}>
                <View style={s.lookingRow}>
                  <Icon name="error-outline" size={28} color={PALETTE.redDark} />
                  <View style={s.flexText}>
                    <Text style={[TYPE.heading, { color: PALETTE.redDark }]} maxFontSizeMultiplier={1.3}>Not admitted</Text>
                    <Text style={TYPE.body} maxFontSizeMultiplier={1.3}>{lookupError}</Text>
                  </View>
                </View>
                <ConsoleButton icon="qr-code-scanner" label="Scan next" onPress={onNext} style={s.topGap} />
              </ConsoleCard>
            </FadeInUp>
          ) : null}

          {!looking && !selected && seats.length > 1 ? (
            <FadeInUp style={s.overlap}>
              <ConsoleCard>
                <Text style={TYPE.heading} maxFontSizeMultiplier={1.3}>Who is at the door?</Text>
                <Text style={[TYPE.body, s.smallGap]} maxFontSizeMultiplier={1.3}>
                  Booking {seats[0]?.bookingRef} has {seats.length} participants. Choose the person in front of you.
                </Text>
                {seats.map((seat, i) => (
                  <TouchableOpacity
                    key={String(seat?.registrationNo || i)}
                    style={s.seatRow}
                    onPress={() => { setSelected(seat); setOutcome(null); setAdmitError(''); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Participant ${seat?.participantNumber}: ${seat?.attendee?.name}`}
                  >
                    <View style={s.flexText}>
                      <Text style={TYPE.bodyStrong} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                        {seat?.participantNumber}. {seat?.attendee?.name || 'Attendee'}
                      </Text>
                      <Text style={TYPE.caption} numberOfLines={1} maxFontSizeMultiplier={1.3}>{seat?.registrationNo}</Text>
                    </View>
                    <ConsoleChip
                      label={seat?.checkedIn ? 'Checked in' : seat?.admissible ? 'Not yet' : 'Refused'}
                      kind={seat?.checkedIn ? 'warning' : seat?.admissible ? 'info' : 'rejected'}
                    />
                    <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
                  </TouchableOpacity>
                ))}
                <ConsoleButton kind="ghost" icon="qr-code-scanner" label="Scan next" onPress={onNext} style={s.topGap} />
              </ConsoleCard>
            </FadeInUp>
          ) : null}

          {!looking && selected ? (
            <View style={s.overlap}>
              <SeatResultCard
                seat={selected}
                outcome={outcome}
                busy={admitting}
                error={admitError}
                onAdmit={onAdmit}
                onNext={onNext}
              />
              {seats.length > 1 ? (
                <ConsoleButton kind="ghost" icon="people" label="Other participants on this booking" onPress={backToList} style={s.smallGap} />
              ) : null}
            </View>
          ) : null}

          {/* ------------------------------------------------ the camera */}
          {!showing && !looking ? (
            <View style={[s.cameraBox, s.overlap]}>
              {vc ? (
                <LiveScanner vc={vc} active={cameraActive} onCode={onCode} />
              ) : (
                <View style={s.cameraMessage}>
                  <Icon name="qr-code-scanner" size={40} color={PALETTE.white} />
                  <Text style={s.cameraTitle} maxFontSizeMultiplier={1.3}>Scanner unavailable</Text>
                  <Text style={s.cameraText} maxFontSizeMultiplier={1.3}>
                    {visionCameraError() ? 'This app build has no camera scanner. Update the app, or use manual entry below.' : 'Use manual entry below.'}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* ------------------------------------------------ manual entry */}
          <ConsoleSectionTitle
            title="Manual entry"
            subtitle="Pass will not scan? Type the booking ID or registration number."
            icon="keyboard"
            action={manualOpen ? 'Hide' : 'Open'}
            onAction={() => setManualOpen((v) => !v)}
            style={s.sectionGap}
          />
          {manualOpen ? (
            <ConsoleCard>
              <PremiumInput
                tone="admin"
                label="Booking ID or registration no."
                placeholder="ACTIVB-XXXXXX-XXXX-P1"
                value={manual}
                onChangeText={(t: string) => setManual(t)}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={onManualFind}
                icon="confirmation-number"
              />
              <ConsoleButton icon="search" label="Find booking" onPress={onManualFind} disabled={!String(manual || '').trim() || looking} />
            </ConsoleCard>
          ) : null}

          <ConsoleNote
            icon="verified-user"
            text="Scanning only shows the booking. Nobody is checked in until you press Allow entry. Always match the name to a photo ID."
            style={s.sectionGap}
          />
        </View>
      </ScrollView>
    </ConsoleFrame>
  );
}

const CORNER = 26;
const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  gutter: { paddingHorizontal: SPACE.lg },
  overlap: { marginTop: -CONSOLE_OVERLAP + SPACE.xs },
  topGap: { marginTop: SPACE.md },
  smallGap: { marginTop: SPACE.sm },
  sectionGap: { marginTop: SPACE.xl, marginHorizontal: 0, paddingHorizontal: 0 },
  lookingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  seatRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: PALETTE.border, paddingVertical: SPACE.sm,
  },
  cameraBox: {
    height: 340, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: '#0B1020',
  },
  cameraFill: { flex: 1 },
  cameraMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl, gap: SPACE.sm },
  cameraTitle: { ...TYPE.heading, color: PALETTE.white, textAlign: 'center' },
  cameraText: { ...TYPE.body, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  cameraButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  aimWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  aim: { width: 220, height: 220 },
  aimText: {
    ...TYPE.label, color: PALETTE.white, marginTop: SPACE.md, backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill, overflow: 'hidden',
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: PALETTE.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
const legacyAppearance_TYPE = TYPE;
