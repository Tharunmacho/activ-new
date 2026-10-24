import React, { useLayoutEffect, useState } from 'react';
import { Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { SPACE, Tone, toneOf, PremiumInput, GradientButton, KeyMail3D } from '../../ui';
import { authStyles as styles } from './authStyles';
import { PremiumAuthScreen, StatusPanel, TextLink } from './authKit';

/**
 * Ask for a password reset link.
 *
 * The "Forget password?" link on the login screen used to open an `Alert`
 * telling the member to enter their email — with nowhere to enter it. This is
 * the screen that was missing.
 *
 * The server answers the same way whether or not the address is registered, and
 * so does this screen. Saying "no account with that email" would turn the form
 * into a way of discovering which addresses have accounts, which is worth more
 * to someone guessing than the small convenience is to a member who mistyped.
 *
 * TWO SCREENS IN ONE, like the website's /forgot-password and
 * /admin/forgot-password: `route.params.portal` ('member' | 'admin') is sent to
 * the server, which then looks the address up ONLY among the accounts that
 * screen serves — an admin reset reaches only active admins the Super Admin
 * created; a member reset only members.
 */

type Nav = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: Nav;
  route: RouteProp<RootStackParamList, 'ForgotPassword'>;
}

const ForgotPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const portal: 'member' | 'admin' = route?.params?.portal === 'admin' ? 'admin' : 'member';
  const forAdmins = portal === 'admin';
  const signIn = forAdmins ? 'AdminLogin' : 'Login';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // The stack registers this route with the default native header; the screen
  // draws its own brand header, so the native one is hidden (no double back bar).
  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }); } catch { /* not in a stack */ }
  }, [navigation]);

  const handleSubmit = async () => {
    const address = email.trim().toLowerCase();

    // The website's rule and sentences (pages/auth/ForgotPassword.tsx).
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      setError(address.includes('@')
        ? 'That email address is not complete — check for a typo.'
        : 'Enter the email address on your account.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.post(ENDPOINTS.AUTH.FORGOT_PASSWORD, { email: address, portal });
      setSent(true);
    } catch (err: any) {
      // A network failure is the member's problem to act on; anything else the
      // server chose to say is deliberately generic already.
      setError(
        err?.response?.data?.message ||
          'Could not reach the server. Check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const tone: Tone = forAdmins ? 'admin' : 'member';
  const eyebrow = `Account recovery · ${forAdmins ? 'Administrator' : 'Member'} account`;
  const art = <KeyMail3D size={100} admin={forAdmins} />;

  // ---- sent ---------------------------------------------------------------
  if (sent) {
    return (
      <PremiumAuthScreen
        tone={tone}
        onBack={() => navigation.goBack()}
        eyebrow={eyebrow}
        title="Check your email"
        subtitle="Your reset request has been received."
        art={art}
        badge={forAdmins ? 'Admin account' : undefined}
      >
        <StatusPanel
          icon="mark-email-read"
          kind={forAdmins ? 'admin' : 'info'}
          title="Request received"
          actions={(
            <>
              <GradientButton
                tone={tone}
                label="I have a reset link"
                icon="vpn-key"
                size="lg"
                onPress={() => navigation.navigate('ResetPassword', { portal })}
              />
              <TextLink tone={tone} muted label="Back to sign in" onPress={() => navigation.navigate(signIn)} />
            </>
          )}
        >
          <Text style={styles.statusText}>
            If <Text style={styles.statusStrong}>{email.trim().toLowerCase()}</Text> matches{' '}
            {forAdmins ? 'an active administrator account' : 'an active member account'}, check the account recovery
            inbox for an email with a reset link. The link expires in one hour and can be used once.
          </Text>
          <Text style={[styles.statusText, { marginTop: SPACE.md }]}>
            Nothing arrived? Check your spam folder, or{' '}
            <Text style={[styles.statusStrong, { color: toneOf(tone).accent }]} onPress={() => setSent(false)} accessibilityRole="link">
              try another address
            </Text>.
          </Text>
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  // ---- form ---------------------------------------------------------------
  return (
    <PremiumAuthScreen
      tone={tone}
      onBack={() => navigation.goBack()}
      eyebrow={eyebrow}
      title={forAdmins ? 'Reset your password' : 'Set or reset your ACTIV password'}
      subtitle={forAdmins
        ? 'Enter the email of your administrator account. Only admin accounts created by the ACTIV Super Admin can be reset here.'
        : 'Enter the email address you registered with and we will send you a link to set a new password.'}
      art={art}
      badge={forAdmins ? 'Admin account' : undefined}
      below={(
        <>
          {!forAdmins && <Text style={styles.footNote}>Signed up with Google, LinkedIn or Facebook? Keep using that sign-in option. An ACTIV password is optional; use this email verification flow only if you want to set or reset one.</Text>}
          <TextLink tone={tone} label="I already have a reset link" onPress={() => navigation.navigate('ResetPassword', { portal })} />
          <TextLink tone={tone} muted label="Back to sign in" onPress={() => navigation.navigate(signIn)} />
          {forAdmins ? <Text style={styles.footNote}>Member accounts cannot be reset here.</Text> : null}
          <Text style={styles.footNote}>Reset links expire in one hour and work only once.</Text>
        </>
      )}
    >
      <PremiumInput
        tone={tone}
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (error) setError('');
        }}
        placeholder={forAdmins ? 'admin@activ.org.in' : 'you@example.com'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!loading}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        icon="mail-outline"
        error={error}
      />
      <GradientButton tone={tone} label="Send reset link" icon="send" size="lg" onPress={handleSubmit} loading={loading} style={{ marginTop: SPACE.xs }} />
    </PremiumAuthScreen>
  );
};

export default ForgotPasswordScreen;
