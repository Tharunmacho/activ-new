import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BRAND, PALETTE, SPACE, TYPE, SurfaceCard, PremiumInput, GradientButton,
  GradientGlyph, Notice, money, errorText,
} from '../../../ui';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../config/api.config';
import { sanitizeUser } from '../../../services/session';
import { rememberEventBooking } from '../../../services/publicNavigation';
import { useAuthStore } from '../../../stores/exampleStore';
import { UserRole } from '../../../types';
import { EyeToggle } from '../../profile/formKit';

type Props = {
  event: any;
  navigation: any;
  onGuest: () => void;
  onMember: () => Promise<void>;
};

/** The website's two booking paths, in the app's native form components. */
export default function EventBookingChoice({ event, navigation, onGuest, onMember }: Props) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const authenticated = useRef(false);
  const login = useAuthStore(state => state.login);
  const price = Number(event?.price ?? event?.amount ?? 0);
  const memberPrice = event?.hasMemberRate ? Number(event?.memberPrice ?? price) : price;
  const rate = (amount: number) => amount > 0 ? money(amount) + ' per seat' : 'Free';
  const remember = () => rememberEventBooking(String(event?.id || ''));

  const signIn = async () => {
    if (busy.current) return;
    if (!authenticated.current && (!email.trim() || !password)) {
      setError('Enter your email address and password.');
      return;
    }
    busy.current = true; setSigningIn(true); setError('');
    try {
      if (!authenticated.current) {
        const response = await api.post(ENDPOINTS.AUTH.LOGIN, { email: email.trim().toLowerCase(), password, portal: 'member' });
        const payload = response?.data?.data || response?.data || {};
        const role = String(payload?.role || payload?.user?.role || 'member');
        if (!payload?.token) throw new Error('Sign-in could not be completed. Please try again.');
        if (role !== 'member') throw new Error('Use your ACTIV member account to receive membership pricing. You can also continue as a guest.');
        await login(sanitizeUser(payload?.user || {}), String(payload.token), UserRole.MEMBER);
        authenticated.current = true;
        setPassword('');
      }
      // Re-read eligibility, price and availability with the member's token
      // before allowing review or payment at a rate shown for a guest.
      await onMember();
    } catch (err: any) { setError(!err?.isAxiosError && err instanceof Error ? err.message : errorText(err)); }
    finally { busy.current = false; setSigningIn(false); }
  };

  return <View style={styles.cards}>
    <SurfaceCard>
      <View style={styles.heading}><GradientGlyph icon="person-outline" tone="sky" size={40} /><Text style={styles.title}>Book as a guest</Text></View>
      <Text style={styles.copy}>No account or password needed. Enter your booking and participant details, then review before paying.</Text>
      <View style={styles.rate}><Text style={styles.caption}>GUEST RATE</Text><Text style={styles.price}>{rate(price)}</Text><Text style={styles.copy}>Your booking reference and confirmation are sent to your email.</Text></View>
      <GradientButton label="Continue as guest" icon="arrow-forward" disabled={signingIn} onPress={onGuest} />
      <Text style={styles.hint}>You can join ACTIV later.</Text>
    </SurfaceCard>
    <SurfaceCard>
      <View style={styles.heading}><GradientGlyph icon="verified-user" tone="sky" size={40} /><Text style={styles.title}>Sign in &amp; checkout</Text></View>
      <Text style={styles.copy}>Paid ACTIV members receive the eligible membership rate automatically after sign-in.</Text>
      <View style={[styles.rate, styles.memberRate]}><Text style={styles.caption}>MEMBER RATE</Text><Text style={styles.price}>{rate(memberPrice)}</Text><Text style={styles.copy}>{memberPrice < price ? 'For active paid memberships. Your current eligibility is checked when you sign in.' : 'The same rate as a guest for this event.'}</Text></View>
      {!authenticated.current ? <>
        <PremiumInput label="Member email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" icon="mail-outline" editable={!signingIn} />
        <PremiumInput label="Member password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" icon="lock-outline" editable={!signingIn} right={<EyeToggle shown={showPassword} onToggle={() => setShowPassword(value => !value)} />} />
      </> : null}
      {error ? <Notice kind="danger" text={error} style={{ marginBottom: SPACE.md }} /> : null}
      <GradientButton label={authenticated.current ? 'Continue with membership rate' : 'Sign in & checkout'} icon="login" loading={signingIn} onPress={signIn} />
      <GradientButton label="Forgot password?" variant="outline" disabled={signingIn} onPress={() => { remember(); navigation.navigate('ForgotPassword', { portal: 'member' }); }} style={{ marginTop: SPACE.sm }} />
      <Text style={styles.hint}>No account? <Text style={styles.link} accessibilityRole="link" onPress={() => { if (!signingIn) { remember(); navigation.navigate('RegistrationStep1'); } }}>Join ACTIV</Text></Text>
    </SurfaceCard>
  </View>;
}

const styles = StyleSheet.create({
  cards: { gap: SPACE.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  title: { ...TYPE.heading, fontSize: 20, lineHeight: 26, color: BRAND.navyDeep, flex: 1, minWidth: 0 },
  copy: { ...TYPE.body, color: PALETTE.textSoft, marginTop: SPACE.sm },
  rate: { backgroundColor: PALETTE.canvas, borderRadius: 14, padding: SPACE.md, marginVertical: SPACE.md },
  memberRate: { backgroundColor: '#ECFDF5' },
  caption: { ...TYPE.eyebrow, color: PALETTE.textSoft },
  price: { ...TYPE.heading, color: BRAND.navy, marginTop: SPACE.xs },
  hint: { ...TYPE.caption, textAlign: 'center', marginTop: SPACE.md },
  link: { color: PALETTE.blue, fontWeight: '700' },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
