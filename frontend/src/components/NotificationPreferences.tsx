import { useLegacyAppearance } from '../ui/legacyAppearance';
import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { SurfaceCard, LinkRow, PALETTE } from '../ui';
import { enablePushFromSettings, openPushSettings } from '../services/pushNotifications';
import { analyticsAllowed, setAnalyticsAllowed } from '../services/analytics';
export default function NotificationPreferences() {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [analytics, setAnalytics] = useState(false);
  useEffect(() => { void analyticsAllowed().then(setAnalytics); }, []);
  return <SurfaceCard style={{ marginVertical: 16 }}>
    <LinkRow icon="notifications-active" title="Enable push notifications" subtitle="Events, updates, membership and messages" onPress={() => void enablePushFromSettings()} />
    <LinkRow icon="settings" title="Notification settings" subtitle="Choose sound and pop-up alerts in your phone settings" onPress={() => void openPushSettings()} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '700', color: PALETTE.text }}>Share usage analytics</Text><Text style={{ color: PALETTE.textMuted, marginTop: 5, lineHeight: 19 }}>Help improve ACTIV by sharing screen usage. Names, contact details and message contents are excluded.</Text></View>
      <Switch accessibilityLabel="Share usage analytics" value={analytics} onValueChange={v => { setAnalytics(v); void setAnalyticsAllowed(v); }} />
    </View>
  </SurfaceCard>;
}

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
