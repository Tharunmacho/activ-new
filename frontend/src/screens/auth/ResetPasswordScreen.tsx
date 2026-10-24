import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import {
  Notice, PALETTE, RADIUS, SIZE, SPACE, TYPE, Tone, toneOf, PremiumInput, GradientButton, NewPassword3D,
} from '../../ui';
import { EyeToggle } from '../profile/formKit';
import { authStyles as styles } from './authStyles';
import { PremiumAuthScreen, StatusPanel, TextLink } from './authKit';

/**
 * Set a new password using the code from the reset email.
 *
 * The reset email carries the WEBSITE's https link (unchanged), which the app
 * does not claim — so the member pastes the link or code here. An
 * activ://reset-password?token=… (or activ://admin/reset-password?token=…)
 * link fills it in automatically (navigation/deepLinks.ts), including when this
 * screen is already open.
 *
 * `route.params.portal` ('member' | 'admin') is sent with the reset, as the
 * website's /reset-password and /admin/reset-password do: the server looks the
 * code up only among the accounts that side serves. The whole reset LINK may
 * be pasted too — the code is read out of its `token=` parameter.
 */

/** A pasted link or a bare code → the code. */
const extractToken = (raw: string) => {
  const text = (raw || '').trim();
  const m = /[?&]token=([^&\s#]+)/.exec(text);
  try { return m ? decodeURIComponent(m[1]) : text; } catch { return m ? m[1] : text; }
};

type Nav = NativeStackNavigationProp<RootStackParamList, 'ResetPassword'>;
type Route = RouteProp<RootStackParamList, 'ResetPassword'>;

interface Props {
  navigation: Nav;
  route?: Route;
}

const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const portal: 'member' | 'admin' = route?.params?.portal === 'admin' ? 'admin' : 'member';
  const signIn = portal === 'admin' ? 'AdminLogin' : 'Login';
  const [token, setToken] = useState(route?.params?.token || '');
  // A reset link opened while this screen is already showing (activ://reset-password?token=…).
  const linkToken = route?.params?.token || '';
  useEffect(() => {
    if (linkToken) setToken(linkToken);
  }, [linkToken]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  /*
   * The website checks the link the moment the page opens and names the
   * account it is for, or says it has expired. The app does the same as soon
   * as it has a code — from a deep link, or when the pasted field loses focus.
   */
  const [account, setAccount] = useState('');
  const [expired, setExpired] = useState(false);
  const [checking, setChecking] = useState(false);

  // The stack registers this route with the default native header; the screen
  // draws its own brand header, so the native one is hidden (no double back bar).
  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }); } catch { /* not in a stack */ }
  }, [navigation]);

  const verify = async (raw: string) => {
    const code = extractToken(raw);
    if (!code) { setAccount(''); setExpired(false); return; }
    setChecking(true);
    try {
      const res = await api.get(ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, { params: { token: code, portal } });
      const payload = res?.data?.data || res?.data || {};
      setExpired(!payload?.valid);
      setAccount(payload?.valid ? String(payload?.email || '') : '');
    } catch {
      setExpired(true);
      setAccount('');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (linkToken) verify(linkToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken, portal]);

  // The website's strength meter (pages/auth/ResetPassword.tsx), rule for rule.
  const rules = useMemo(() => {
    const p = password || '';
    return {
      length: p.length >= 8,
      mixed: /[a-z]/.test(p) && /[A-Z]/.test(p),
      number: /\d/.test(p),
      symbol: /[^A-Za-z0-9]/.test(p),
    };
  }, [password]);
  const score = Object.values(rules).filter(Boolean).length;
  const strength = !password ? '' : score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const barColour = score <= 1 ? PALETTE.red : score === 2 ? PALETTE.amberDark : score === 3 ? PALETTE.blue : PALETTE.green;
  const matches = !!confirm && password === confirm;

  const handleSubmit = async () => {
    const code = extractToken(token);

    if (!code) {
      setError('Paste the reset link from your email.');
      return;
    }
    // The website asks for 8 (the server's own floor is 6).
    if ((password || '').length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Checked first so an expired or other-side code gets a clear answer.
      const check = await api.get(ENDPOINTS.AUTH.VERIFY_RESET_TOKEN, { params: { token: code, portal } });
      const verdict = check?.data?.data || check?.data || {};
      if (!verdict?.valid) {
        setExpired(true);
        return;
      }
      await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, { token: code, password, portal });
      setDone(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          'That link is no longer valid. Request a new one.',
      );
    } finally {
      setLoading(false);
    }
  };

  const tone: Tone = portal === 'admin' ? 'admin' : 'member';
  const t = toneOf(tone);
  const forAdmins = portal === 'admin';
  const eyebrow = `Account recovery · ${forAdmins ? 'Administrator' : 'Member'} account`;
  const art = <NewPassword3D size={100} admin={forAdmins} />;
  const shell = {
    tone,
    onBack: () => navigation.goBack(),
    eyebrow,
    art,
    badge: forAdmins ? 'Admin account' : undefined,
  };

  // ---- done ---------------------------------------------------------------
  if (done) {
    return (
      <PremiumAuthScreen {...shell} title="Password changed" subtitle="You are all set.">
        <StatusPanel
          icon="check-circle"
          kind="success"
          title="Password updated"
          actions={(
            <GradientButton
              tone={tone}
              label="Sign in"
              iconRight="arrow-forward"
              size="lg"
              onPress={() => navigation.reset({ index: 0, routes: [{ name: signIn }] })}
            />
          )}
        >
          Your password has been updated. Sign in with your new password.
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  // ---- expired ------------------------------------------------------------
  if (expired) {
    return (
      <PremiumAuthScreen {...shell} title="Link expired" subtitle="Reset links last one hour and work once.">
        <StatusPanel
          icon="link-off"
          kind="warning"
          title="This link no longer works"
          actions={(
            <>
              <GradientButton
                tone={tone}
                label="Request a new link"
                icon="send"
                size="lg"
                onPress={() => navigation.navigate('ForgotPassword', { portal })}
              />
              <GradientButton tone={tone} variant="outline" label="Paste a different link" onPress={() => { setExpired(false); setToken(''); }} />
              <TextLink tone={tone} muted label="Back to sign in" onPress={() => navigation.navigate(signIn)} />
            </>
          )}
        >
          Request a new one and it will work straight away.
        </StatusPanel>
      </PremiumAuthScreen>
    );
  }

  // ---- form ---------------------------------------------------------------
  return (
    <PremiumAuthScreen
      {...shell}
      title="Set a new password"
      subtitle={account
        ? `For the account ${account}.`
        : 'Paste the link from your reset email, then choose a new password.'}
      below={(
        <>
          <TextLink tone={tone} label="Send me a new link" onPress={() => navigation.navigate('ForgotPassword', { portal })} />
          <TextLink tone={tone} muted label="Back to sign in" onPress={() => navigation.navigate(signIn)} />
          <Text style={styles.footNote}>Your new password is stored encrypted. Nobody at ACTIV can read it.</Text>
        </>
      )}
    >
      <PremiumInput
        tone={tone}
        label="Reset link"
        value={token}
        onChangeText={(text) => {
          setToken(text);
          if (error) setError('');
        }}
        placeholder="Paste the link from your email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        onBlur={() => { verify(token); }}
        icon="vpn-key"
        right={checking
          ? <ActivityIndicator size="small" color={t.accent} />
          : account ? <Icon name="check-circle" size={SIZE.icon} color={PALETTE.green} /> : null}
      />

      <PremiumInput
        tone={tone}
        label="New password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          if (error) setError('');
        }}
        placeholder="At least 8 characters"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        editable={!loading}
        icon="lock-outline"
        right={<EyeToggle shown={show} onToggle={() => setShow(!show)} />}
        style={password ? { marginBottom: SPACE.sm } : undefined}
      />

      {password ? (
        <View style={local.meter}>
          <View style={local.meterRow}>
            <View style={local.meterBars}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[local.meterBar, { backgroundColor: i <= score ? barColour : PALETTE.disabled }]} />
              ))}
            </View>
            <Text style={[local.meterLabel, { color: barColour }]}>{strength}</Text>
          </View>
          <View style={local.rules}>
            {([
              [rules.length, 'At least 8 characters'],
              [rules.mixed, 'Upper and lower case'],
              [rules.number, 'A number'],
              [rules.symbol, 'A symbol'],
            ] as [boolean, string][]).map(([ok, text]) => (
              <View key={text} style={local.ruleRow}>
                <Icon name={ok ? 'check-circle' : 'radio-button-unchecked'} size={15} color={ok ? PALETTE.greenDark : PALETTE.textFaint} />
                <Text style={[local.ruleText, ok && { color: PALETTE.greenDark }]}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PremiumInput
        tone={tone}
        label="Confirm new password"
        value={confirm}
        onChangeText={(text) => {
          setConfirm(text);
          if (error) setError('');
        }}
        placeholder="Type it again"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        icon="lock-outline"
        right={confirm ? (
          <Icon name={matches ? 'check-circle' : 'error-outline'} size={SIZE.icon} color={matches ? PALETTE.green : PALETTE.amber} />
        ) : null}
        hint={confirm ? (matches ? 'Passwords match.' : 'Passwords do not match yet.') : undefined}
      />

      {error ? <Notice kind="danger" text={error} style={local.error} /> : null}

      <GradientButton tone={tone} label="Change password" icon="check" size="lg" onPress={handleSubmit} loading={loading} style={{ marginTop: SPACE.xs }} />
    </PremiumAuthScreen>
  );
};

const local = StyleSheet.create({
  meter: { marginBottom: SPACE.md },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  meterBars: { flex: 1, flexDirection: 'row', gap: SPACE.xs },
  meterBar: { flex: 1, height: 6, borderRadius: RADIUS.pill },
  meterLabel: { ...TYPE.caption, minWidth: 52, textAlign: 'right', fontWeight: '700' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', marginTop: SPACE.sm, rowGap: SPACE.xs },
  ruleRow: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: SPACE.xs },
  ruleText: { ...TYPE.caption, flexShrink: 1 },
  error: { marginHorizontal: 0, marginTop: 0, marginBottom: SPACE.md },
});

export default ResetPasswordScreen;
