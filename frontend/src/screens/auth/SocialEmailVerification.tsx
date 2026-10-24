import React, { useEffect, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import api from '../../services/api';
import { errorText } from '../../ui/data';
import { GradientButton, PALETTE, SPACE, TYPE } from '../../ui';

export default function SocialEmailVerification({ code, initialEmail, onComplete }: {
  code: string; initialEmail: string; onComplete: (session: any) => Promise<void>;
}) {
  const [email, setEmail] = useState(initialEmail), [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [wait, setWait] = useState(0);
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [wait]);
  const send = async () => {
    setBusy(true); setError('');
    try {
      const response = await api.post('/auth/oauth/verify-email', { code, email: email.trim() });
      const result = response?.data?.data || response?.data || {};
      if (result.sent !== true) throw new Error('We could not send the verification email.');
      setEmail(String(result.email || email).trim()); setSent(true); setWait(60);
    } catch (cause: any) { setError(cause?.response ? errorText(cause, 'Could not send the code. Please try again.') : String(cause?.message || 'Could not send the code. Please try again.')); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError('');
    try {
      const response = await api.post('/auth/oauth/exchange', { code, verificationCode: otp });
      const result = response?.data?.data || response?.data || {};
      if (result.requiresEmailVerification === true || !result.token) throw new Error('Request and enter your email verification code.');
      await onComplete(result);
    } catch (cause: any) { setError(cause?.response ? errorText(cause, 'Could not verify that code. Please try again.') : String(cause?.message || 'Could not verify that code. Please try again.')); }
    finally { setBusy(false); }
  };
  return <View style={s.form}>
    <Text style={s.copy}>Confirm your email once to connect this social account securely. If you already have an ACTIV account, use its email to open the same dashboard.</Text>
    <View>
      <Text style={s.label}>ACTIV account email</Text>
      <TextInput accessibilityLabel="ACTIV account email" style={s.input} value={email} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        onChangeText={value => { setEmail(value); setSent(false); setOtp(''); setError(''); }} />
    </View>
    {sent && <>
      <Text style={s.sent} accessibilityLiveRegion="polite">Verification code sent to {email}.</Text>
      <View>
        <Text style={s.label}>Verification code</Text>
        <TextInput accessibilityLabel="Verification code" style={s.input} value={otp} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6}
          onChangeText={value => setOtp((value || '').replace(/\D/g, '').slice(0, 6))} />
      </View>
    </>}
    {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
    <GradientButton label={sent ? 'Verify and open dashboard' : 'Send verification code'} loading={busy}
      disabled={busy || (sent ? otp.length !== 6 : !email.trim())} onPress={() => { void (sent ? verify() : send()); }} />
    {sent && <GradientButton variant="outline" label={wait ? `Resend code in ${wait}s` : 'Resend code'} disabled={busy || wait > 0} onPress={() => { void send(); }} />}
  </View>;
}
const s = StyleSheet.create({
  form: { gap: SPACE.lg }, copy: { ...TYPE.body, color: PALETTE.textSoft }, label: { ...TYPE.body, color: PALETTE.text, fontWeight: '600', marginBottom: SPACE.sm },
  input: { ...TYPE.body, color: PALETTE.text, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 12, minHeight: 52, paddingHorizontal: SPACE.lg },
  sent: { ...TYPE.body, color: PALETTE.greenDark }, error: { ...TYPE.body, color: PALETTE.redDark },
});
