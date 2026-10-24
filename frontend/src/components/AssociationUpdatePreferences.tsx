import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { PALETTE, SurfaceCard, errorText } from '../ui';
import {
  getAssociationUpdatePreferences, saveAssociationUpdatePreference, UnconfirmedUpdatePreferencesError,
  type AssociationUpdateChannel, type AssociationUpdatePreferences as Preferences,
} from '../services/associationUpdatePreferences';
const preferenceError = (error: unknown, fallback: string) => error instanceof UnconfirmedUpdatePreferencesError ? error.message : errorText(error, fallback);

export default function AssociationUpdatePreferences() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const mounted = useRef(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true; setLoading(true); setError(''); setSaved(false);
    try {
      const result = await getAssociationUpdatePreferences();
      if (mounted.current) setPreferences(result);
    } catch (err) {
      if (mounted.current) setError(preferenceError(err, 'Could not load your update preferences.'));
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);

  const change = async (channel: AssociationUpdateChannel, enabled: boolean) => {
    if (pending.current || !preferences || preferences[channel] === enabled) return;
    if (channel === 'whatsapp' && enabled && !(preferences.whatsappNumber || '').trim()) return;
    pending.current = true; setSaving(true); setError(''); setSaved(false);
    try {
      const result = await saveAssociationUpdatePreference(channel, enabled);
      if (mounted.current) { setPreferences(result); setSaved(true); }
    } catch (err) {
      if (mounted.current) setError(preferenceError(err, 'Could not save your preference. Please reload and try again.'));
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const phone = String(preferences?.whatsappNumber || '').trim();
  return <SurfaceCard style={styles.card}>
    <Text style={styles.heading} accessibilityRole="header">Association updates</Text>
    <Text style={styles.description}>Choose how ACTIV sends updates for your membership and region.</Text>
    {loading ? <View style={styles.loading} accessibilityRole="progressbar"><ActivityIndicator color={PALETTE.indigo} /><Text style={styles.hint}>Loading your preferences…</Text></View> : null}
    {!loading && preferences ? <>
      <View style={styles.row}>
        <View style={styles.copy}><Text style={styles.label}>Email updates</Text><Text style={styles.hint}>Receive association updates at your account email.</Text></View>
        <Switch accessibilityLabel="Email association updates" value={preferences.email} disabled={saving || !!error}
          onValueChange={enabled => void change('email', enabled)} trackColor={{ false: '#CBD5E1', true: '#2563EB' }} />
      </View>
      <View style={[styles.row, styles.divider]}>
        <View style={styles.copy}><Text style={styles.label}>WhatsApp updates</Text><Text style={styles.hint}>
          {phone ? `By turning this on, you agree to receive association updates on WhatsApp at ${phone}. You can turn it off at any time.`
            : 'Save a WhatsApp number in your profile before enabling these updates.'}
        </Text></View>
        <Switch accessibilityLabel="WhatsApp association updates" value={preferences.whatsapp} disabled={saving || !!error || (!phone && !preferences.whatsapp)}
          onValueChange={enabled => void change('whatsapp', enabled)} trackColor={{ false: '#CBD5E1', true: '#2563EB' }} />
      </View>
    </> : null}
    {saving ? <Text style={styles.hint} accessibilityLiveRegion="polite">Saving your preference…</Text> : null}
    {saved ? <Text style={styles.success} accessibilityLiveRegion="polite">Your update preferences have been saved.</Text> : null}
    {error ? <View style={styles.errorBox}>
      <Text style={styles.error} accessibilityRole="alert">{error}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void load()} disabled={loading || saving} style={styles.retry}>
        <Text style={styles.retryText}>Reload preferences</Text>
      </TouchableOpacity>
    </View> : null}
    <Text style={styles.footnote}>These choices apply to association updates. Your in-app updates and essential account messages remain available.</Text>
  </SurfaceCard>;
}
const styles = StyleSheet.create({
  card: { marginVertical: 16 }, heading: { fontSize: 20, lineHeight: 27, fontWeight: '600', color: PALETTE.text },
  description: { fontSize: 16, lineHeight: 23, color: PALETTE.textMuted, marginTop: 6, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }, copy: { flex: 1, minWidth: 0 },
  label: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: PALETTE.text }, hint: { fontSize: 14, lineHeight: 21, color: PALETTE.textMuted, marginTop: 4 },
  divider: { borderTopWidth: 1, borderTopColor: '#E2E8F0' }, loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18 },
  errorBox: { borderRadius: 12, backgroundColor: '#FFF1F2', padding: 12, marginTop: 8 }, error: { fontSize: 14, lineHeight: 21, color: '#9F1239' },
  retry: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, retryText: { fontSize: 14, fontWeight: '600', color: '#1D4ED8' },
  success: { fontSize: 14, lineHeight: 21, color: '#047857', paddingBottom: 8 }, footnote: { fontSize: 14, lineHeight: 21, color: PALETTE.textMuted, marginTop: 8 },
});
