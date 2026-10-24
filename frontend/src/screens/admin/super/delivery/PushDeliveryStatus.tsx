import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ConsoleCard, ConsoleButton, PALETTE, SPACE, TYPE } from '../../../../ui';
import api from '../../../../services/api';
import NotificationPreferences from '../../../../components/NotificationPreferences';

export default function PushDeliveryStatus() {
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const response = await api.get('/notifications/push/status'); setStatus(response.data?.data || response.data); }
    catch { setMessage('Push status could not be loaded. Please try again.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const test = async () => {
    setBusy(true); setMessage('');
    try { await api.post('/notifications/push/test'); setMessage('The test is waiting to send to devices signed in to your Super Admin account.'); await load(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'The test could not be prepared. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ConsoleCard style={{ marginVertical: SPACE.md }}>
    <Text style={{ ...TYPE.title, color: PALETTE.text }}>Push notifications</Text>
    <Text style={{ ...TYPE.body, color: PALETTE.textMuted, marginVertical: SPACE.sm }}>{status ? status.configured ? 'Push notifications are set up' : 'Push notification setup needed' : 'Loading status…'}</Text>
    {status && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
      {[[status.devices, 'Connected devices'], [status.queued, 'Waiting to send'], [status.broadcasts, 'Updates being prepared'], [status.failed, 'Failed alerts']].map(([value, label]) =>
        <View key={label} style={{ width: '46%', padding: SPACE.sm }}><Text style={{ ...TYPE.number, color: PALETTE.text }}>{value}</Text><Text style={{ ...TYPE.caption, color: PALETTE.textMuted }}>{label}</Text></View>)}
    </View>}
    {status?.workerEnabled === false && <Text>Sending notifications is paused.</Text>}
    <NotificationPreferences />
    <ConsoleButton label="Refresh push status" onPress={() => void load()} />
    <View style={{ height: SPACE.sm }} />
    <ConsoleButton label={busy ? 'Preparing test…' : 'Send test to my devices'} disabled={busy || !status?.configured || !status?.workerEnabled} onPress={() => void test()} />
    {!!message && <Text accessibilityRole="alert" style={{ ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.sm }}>{message}</Text>}
  </ConsoleCard>;
}
