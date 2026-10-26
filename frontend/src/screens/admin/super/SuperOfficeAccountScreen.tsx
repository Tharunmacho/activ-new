import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, ConsoleNote, GlassIconButton, PremiumInput, PremiumSelect, SPACE } from '../../../ui';
import { createPlatinumAccount, errorText } from '../../../services/superApi';
import useRegionCascade from '../../../hooks/useRegionCascade';

const EMPTY = { fullName: '', email: '', password: '', phoneNumber: '', whatsappNumber: '', state: '', district: '', block: '' };
const LABELS = { fullName: 'Full name', email: 'Email', password: 'Password', phoneNumber: 'Mobile', whatsappNumber: 'WhatsApp number', state: 'State', district: 'District', block: 'Block' };
export default function SuperOfficeAccountScreen() {
  const s = useLegacyAppearance(legacyAppearance_s);
  const navigation = useNavigation<any>();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(true);
  const region = useRegionCascade();
  const submit = async () => {
    const account = { ...form, state: region.state, district: region.district, block: region.block };
    if (existing ? !form.email.trim() && !form.phoneNumber.trim() : !form.fullName.trim() || !form.email.trim() || !form.password || !form.phoneNumber.trim() || !region.state || !region.district) { setError(existing ? 'Enter the existing member email or mobile.' : 'Complete all new account and region fields.'); return; }
    if (!existing && (region.error || region.loading || region.refreshing)) { setError('Wait for locations to load, or retry the location request.'); return; }
    if (!existing && form.password.length < 6) { setError('Password must contain at least 6 characters.'); return; }
    setBusy(true); setError('');
    try {
      const member = await createPlatinumAccount(account);
      if (!member?.id) throw new Error('The account response is incomplete.');
      setForm(EMPTY);
      if (member.blockedReason) {
        Alert.alert(member.existingAccount ? 'Application required' : 'Account created', 'The member must sign in, complete Personal, Business and Declaration, submit the application and receive approval before office payment can activate Lifetime.');
        navigation.goBack(); return;
      }
      Alert.alert('Existing account selected', 'Record the office payment to upgrade this eligible member. Existing login credentials stay the same.');
      navigation.replace('SuperPlatinumGrant', { member });
    } catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  };
  return <ConsoleScroll avoidKeyboard>
    <ConsoleHeader compact title="Member account for Lifetime" subtitle="Complete registration before initial membership" left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />} />
    <ConsoleNote style={s.card} text="Existing members keep the same email, password and mobile. Enter their email or mobile to continue. Create a new account only for someone who has not registered. New members must sign in and submit all required forms for approval." />
    <ConsoleCard style={s.card}>
      <ConsoleButton label={existing ? 'Create a new member instead' : 'Use an existing member instead'} onPress={() => { setExisting(!existing); setError(''); }} />
      {(existing ? ['email', 'phoneNumber'] as const : ['fullName', 'email', 'password', 'phoneNumber', 'whatsappNumber'] as const).map(key => <PremiumInput key={key} tone="admin" label={LABELS[key]} value={form[key]} onChangeText={value => setForm(f => ({ ...f, [key]: value }))} secureTextEntry={key === 'password'} autoCapitalize={key === 'email' || key === 'password' ? 'none' : 'words'} keyboardType={key === 'email' ? 'email-address' : key === 'phoneNumber' || key === 'whatsappNumber' ? 'phone-pad' : 'default'} />)}
      {!existing && <>
      {region.error ? <ConsoleNote kind="red" text={region.error} action="Retry" onAction={region.reload} /> : null}
      <PremiumSelect tone="admin" label="State" value={region.state} options={region.states.map(n => n.name)} onChange={region.setState} placeholder={region.loading ? 'Loading regions…' : 'Choose state'} disabled={busy || region.loading} />
      <PremiumSelect tone="admin" label="District" value={region.district} options={region.districts.map(n => n.name)} onChange={region.setDistrict} placeholder="Choose district" disabled={busy || !region.state || region.refreshing} />
      <PremiumSelect tone="admin" label="Block" value={region.block} options={region.blocks.map(n => n.name)} onChange={region.setBlock} placeholder={region.district && !region.refreshing && !region.blocks.length ? 'No development blocks — district only' : 'Choose block'} disabled={busy || !region.district || region.refreshing || !region.blocks.length} />
      </>}
      <View style={{ marginTop: SPACE.md }}><ConsoleButton label="Create or select account" icon="diamond" onPress={submit} loading={busy} disabled={busy} /></View>
    </ConsoleCard>
    {error ? <ConsoleNote style={s.card} kind="red" text={error} /> : null}
  </ConsoleScroll>;
}
const s = StyleSheet.create({ card: { marginHorizontal: SPACE.lg, marginTop: SPACE.md } });

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
