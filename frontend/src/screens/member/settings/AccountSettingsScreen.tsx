import NotificationPreferences from '../../../components/NotificationPreferences';
import AssociationUpdatePreferences from '../../../components/AssociationUpdatePreferences';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Notice, PALETTE, SPACE, SHADOW, TYPE, SIZE, errorText,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, PremiumSection, PremiumInput, GradientButton, GradientAvatar, FadeInUp,
  SurfaceCard, GradientGlyph, GroupTitle, LinkRow, MeterBar, GLYPH_COLORS, CardSkeletons, SettingsGear3D,
} from '../../../ui';
import {
  getMyProfile, getMyApplications, changePassword, uploadProfilePhoto, isPaidMember, logoutOnServer,
} from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { WEBSITE_PATHS } from '../../../config/website.config';
import { clearSession } from '../../../services/session';
import { useAuthStore } from '../../../stores/exampleStore';
import { pickMostAdvancedApplication } from '../dashboard/memberRules';
import { sharePublicPage } from '../../../services/contentShare';
import { accountPasswordStatus, linkedProviderNames } from '../../../utils/authCapabilities';

/**
 * ============================================================================
 * SETTINGS — website `features/member/pages/AccountSettings.tsx`
 * ============================================================================
 *
 *   GET  /members/my-profile · /applications/my-applications   the account at a glance
 *   POST /members/profile-photo      multipart `profilePhoto` → { profilePhoto }
 *   POST /auth/change-password       { oldPassword, newPassword }
 *
 * Contact and region are SHOWN here and edited in My Profile, as on the
 * website — the region decides which admins review the application.
 */

const prettyPhone = (value: unknown) => {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : String(value || '');
};

function Detail({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.detailDivider]}>
      <GradientGlyph icon={icon} tone="navy" size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, !value && { color: PALETTE.textFaint, fontWeight: '500' }]} selectable>{value || 'Not given'}</Text>
      </View>
    </View>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <PremiumInput
      label={label}
      value={value}
      onChangeText={onChange}
      secureTextEntry={!shown}
      autoCapitalize="none"
      autoCorrect={false}
      icon="lock-outline"
      right={(
        <TouchableOpacity onPress={() => setShown((v) => !v)} accessibilityLabel={shown ? 'Hide password' : 'Show password'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name={shown ? 'visibility-off' : 'visibility'} size={20} color={PALETTE.textFaint} />
        </TouchableOpacity>
      )}
    />
  );
}

const AccountSettingsScreen = ({ navigation }: any) => {
  const { logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [appStatus, setAppStatus] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [useExistingPassword, setUseExistingPassword] = useState(false);

  const load = useCallback(async () => {
    const [p, a] = await Promise.allSettled([getMyProfile(), getMyApplications()]);
    setProfile(p.status === 'fulfilled' ? (p.value || {}) : {});
    setUseExistingPassword(false);
    const app = a.status === 'fulfilled' ? pickMostAdvancedApplication(a.value) : null;
    setAppStatus(String(app?.status || ''));
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const paid = isPaidMember(profile);
  const name = String(profile?.fullName || profile?.name || '');
  const memberId = String(profile?.membershipNumber || profile?.memberCode || '');
  const photo = resolveMediaUrl(profile?.profilePhoto);
  const passwordStatus = accountPasswordStatus(profile);
  const showPasswordForm = passwordStatus === 'set' || passwordStatus === 'legacy_unknown' && useExistingPassword;
  const providers = linkedProviderNames(profile).join(', ') || 'your linked provider';
  const status = (() => {
    if (paid) return memberId ? `Active member · ${memberId}` : 'Active member';
    const st = appStatus.toLowerCase();
    if (st.includes('approved')) return 'Approved · payment due';
    if (st.includes('reject')) return 'Application not approved';
    if (st) return 'Application under review';
    return 'Applicant · application not submitted';
  })();

  const pickPhoto = () => {
    setPhotoMsg(null);
    try {
      if (typeof launchImageLibrary !== 'function') {
        setPhotoMsg({ kind: 'danger', text: 'The photo picker is not available on this device.' });
        return;
      }
      launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200, selectionLimit: 1 }, async (res: any) => {
        try {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            setPhotoMsg({ kind: 'danger', text: res?.errorMessage || 'Could not open your photos.' });
            return;
          }
          const asset = (res?.assets || [])[0];
          if (!asset?.uri) return;
          if (Number(asset?.fileSize || 0) > 5 * 1024 * 1024) {
            setPhotoMsg({ kind: 'danger', text: 'The photo must be under 5 MB.' });
            return;
          }
          setPhotoBusy(true);
          const url = await uploadProfilePhoto(asset.uri, asset?.type || 'image/jpeg', asset?.fileName || 'profile.jpg');
          setProfile((prev: any) => ({ ...(prev || {}), profilePhoto: url }));
          setPhotoMsg({ kind: 'success', text: 'Profile photo updated' });
        } catch (err) {
          setPhotoMsg({ kind: 'danger', text: errorText(err, 'Could not upload the photo. Please try again.') });
        } finally {
          setPhotoBusy(false);
        }
      });
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const savePassword = async () => {
    if (!showPasswordForm) return;
    setPwMsg(null);
    if (!pw.old) { setPwMsg({ kind: 'danger', text: 'Enter your current password' }); return; }
    if ((pw.next || '').length < 6) { setPwMsg({ kind: 'danger', text: 'The new password needs at least 6 characters' }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ kind: 'danger', text: 'The two new passwords do not match' }); return; }
    if (pw.next === pw.old) { setPwMsg({ kind: 'danger', text: 'Choose a password different from the current one' }); return; }
    setPwBusy(true);
    try {
      await changePassword(pw.old, pw.next);
      setProfile((previous: any) => ({ ...previous, hasPassword: true, passwordStatus: 'set' }));
      setPw({ old: '', next: '', confirm: '' });
      setPwMsg({ kind: 'success', text: 'Your password has been changed' });
    } catch (err) {
      setPwMsg({ kind: 'danger', text: errorText(err, 'Could not change the password') });
    } finally {
      setPwBusy(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await logoutOnServer();
          await clearSession();
          try { await logout(); } catch { /* storage already cleared */ }
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const profileRoute = () => navigation.navigate(paid ? 'PaidProfile' : 'MemberMain', paid ? undefined : { screen: 'Profile' });

  const header = (
    <PremiumPageHeader
      eyebrow="Account"
      title="Settings"
      subtitle="Your account, password and sign-in."
      onBack={() => navigation.goBack()}
      art={<SettingsGear3D size={84} />}
      artSize={84}
    >
      {!loading ? (
        <View style={styles.idRow}>
          <View>
            <GradientAvatar name={name || 'Member'} uri={photo || undefined} size={68} status={paid ? 'verified' : undefined} />
            <TouchableOpacity onPress={pickPhoto} disabled={photoBusy} style={styles.camera} accessibilityLabel="Change profile photo" accessibilityRole="button" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              {photoBusy ? <ActivityIndicator size="small" color={PALETTE.blue} /> : <Icon name="photo-camera" size={SIZE.iconSm} color={PALETTE.blue} />}
            </TouchableOpacity>
          </View>
          <View style={styles.flexText}>
            <Text style={styles.heroName} numberOfLines={2} maxFontSizeMultiplier={1.25}>{name || 'Your account'}</Text>
            {profile?.email ? <Text style={styles.heroEmail} numberOfLines={1} maxFontSizeMultiplier={1.25}>{String(profile?.email || '')}</Text> : null}
            <View style={[styles.statusPill, { backgroundColor: paid ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.2)' }]}>
              <View style={[styles.statusDot, { backgroundColor: paid ? PALETTE.greenSoft : PALETTE.white }]} />
              <Text style={styles.statusText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{status}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <CardSkeletons rows={4} style={styles.overlap} />
      </PremiumPage>
    );
  }

  const pwStrength = (() => {
    const v = pw.next || '';
    if (!v) return 0;
    let n = v.length >= 6 ? 1 : 0.4;
    if (v.length >= 10) n += 1;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) n += 0.5;
    if (/\d/.test(v)) n += 0.5;
    if (/[^A-Za-z0-9]/.test(v)) n += 1;
    return Math.min(1, n / 4);
  })();
  const strengthLabel = pwStrength >= 0.75 ? 'Strong' : pwStrength >= 0.4 ? 'Fair' : 'Weak';

  return (
    <PremiumPage header={header} onRefresh={load} refreshing={false}>
      {photoMsg ? <Notice kind={photoMsg.kind} text={photoMsg.text} style={[styles.gutter, styles.overlap, { marginBottom: SPACE.md }]} /> : null}

      <FadeInUp delay={200} style={photoMsg ? undefined : styles.overlap}>
        <SurfaceCard style={styles.gutter}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Your details</Text>
            <TouchableOpacity onPress={profileRoute} hitSlop={8} style={styles.edit} accessibilityRole="button" accessibilityLabel="Edit your details">
              <Icon name="edit" size={16} color={PALETTE.blue} />
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <Detail icon="mail-outline" label="Email" value={String(profile?.email || '')} />
          <Detail icon="call" label="Mobile" value={prettyPhone(profile?.phoneNumber)} />
          <Detail icon="chat" label="WhatsApp" value={prettyPhone(profile?.whatsappNumber || profile?.phoneNumber)} />
          {profile?.isInternational ? (
            <Detail icon="place" label="Place" value={String(profile?.place || profile?.city || '')} last />
          ) : (
            <>
              <Detail icon="place" label="Block" value={String(profile?.block || '')} />
              <Detail icon="map" label="District" value={String(profile?.district || '')} />
              <Detail icon="public" label="State" value={String(profile?.state || '')} last />
            </>
          )}
          <View style={styles.footNote}>
            <Icon name="info-outline" size={SIZE.iconSm} color={PALETTE.textMuted} />
            <Text style={styles.footNoteText}>Your region decides which Block, District and State Admins review your application. Edit it in My Profile.</Text>
          </View>
        </SurfaceCard>
      </FadeInUp>

      <FadeInUp delay={260} style={{ marginTop: SPACE.lg }}>
        <PremiumSection icon="lock-outline" title={passwordStatus === 'set' ? 'Password' : 'Sign-in methods'} subtitle={passwordStatus === 'set' ? 'Use at least 6 characters.' : undefined}>
          {passwordStatus !== 'set' && <>
            <Text style={TYPE.body}>You sign in with {providers}. No ACTIV password is needed to continue using that sign-in option.</Text>
            <Text style={[TYPE.body, { marginVertical: SPACE.md }]}>{passwordStatus === 'not_set' ? 'This account does not have an ACTIV password.' : 'If you want to use email and password, you can set or reset your ACTIV password securely by email.'}</Text>
            <GradientButton label={passwordStatus === 'not_set' ? 'Set an ACTIV password (optional)' : 'Set or reset an ACTIV password (optional)'} variant="outline" onPress={() => navigation.navigate('ForgotPassword', { portal: 'member' })} />
            {passwordStatus === 'legacy_unknown' && !useExistingPassword && <GradientButton label="I know my ACTIV password" variant="outline" onPress={() => setUseExistingPassword(true)} style={{ marginTop: SPACE.md }} />}
          </>}
          {showPasswordForm && <>
          <PasswordField label="Current password" value={pw.old} onChange={(v) => setPw((p) => ({ ...p, old: v }))} />
          <PasswordField label="New password" value={pw.next} onChange={(v) => setPw((p) => ({ ...p, next: v }))} />
          {pw.next ? (
            <View style={styles.strength}>
              <MeterBar
                value={Math.max(pwStrength, 0.08)}
                height={6}
                colors={pwStrength >= 0.75 ? GLYPH_COLORS.green : pwStrength >= 0.4 ? GLYPH_COLORS.amber : GLYPH_COLORS.red}
                style={styles.flexText}
              />
              <Text style={styles.strengthText}>{strengthLabel}</Text>
            </View>
          ) : null}
          <PasswordField label="Confirm new password" value={pw.confirm} onChange={(v) => setPw((p) => ({ ...p, confirm: v }))} />
          {pwMsg ? <Notice kind={pwMsg.kind} text={pwMsg.text} style={styles.inlineNotice} /> : null}
          <GradientButton label="Update password" icon="verified-user" onPress={savePassword} loading={pwBusy} />
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', { portal: 'member' })} style={styles.forgot} accessibilityRole="link">
            <Text style={styles.forgotText}>Forgot your password?</Text>
          </TouchableOpacity>
          </>}
        </PremiumSection>
      </FadeInUp>

      <View style={styles.gutter}>
        <AssociationUpdatePreferences />
        <NotificationPreferences />
      </View>
      <GroupTitle title="Account" />
      <FadeInUp delay={340}>
        <SurfaceCard style={styles.gutter} padded={false}>
          <LinkRow icon="person-outline" tone="blue" title="My Profile" subtitle="Your application details" onPress={profileRoute} />
          <LinkRow icon="storefront" tone="teal" title="Business Account" subtitle="Companies, catalogue and reach" onPress={() => navigation.navigate('BusinessDashboard')} />
          <LinkRow icon="support-agent" tone="green" title="Help & Support" subtitle="Contact your regional office" onPress={() => navigation.navigate('MemberHelp')} />
          <LinkRow icon="share" tone="blue" title="Share ACTIV" subtitle="Invite others to explore the community" onPress={() => { void sharePublicPage({ path: '/', title: 'ACTIV' }); }} />
          <LinkRow icon="person-remove" title="Delete account" subtitle="Request account and data deletion" danger onPress={() => navigation.navigate('PublicInfo', { path: WEBSITE_PATHS.deleteAccount, title: 'Delete account' })} />
          <LinkRow icon="logout" title="Sign out" subtitle="You can sign back in any time" danger onPress={signOut} last />
        </SurfaceCard>
      </FadeInUp>
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  flexText: { flex: 1, minWidth: 0 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginBottom: SPACE.sm },
  camera: { position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
  heroName: { ...TYPE.title, color: PALETTE.white, fontWeight: '800' },
  heroEmail: { ...TYPE.caption, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: SPACE.xxs },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: SPACE.xs, marginTop: SPACE.sm, maxWidth: '100%' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...TYPE.caption, color: PALETTE.white, fontWeight: '700', flexShrink: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs },
  cardTitle: { ...TYPE.heading, fontSize: 17 },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: SIZE.touch, paddingHorizontal: SPACE.sm },
  editText: { fontSize: 14, fontWeight: '700', color: PALETTE.blue },
  detail: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  detailLabel: { ...TYPE.caption },
  detailValue: { ...TYPE.bodyStrong, marginTop: SPACE.xxs },
  footNote: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginTop: SPACE.md, padding: SPACE.md, borderRadius: 14, backgroundColor: PALETTE.fieldBg },
  footNoteText: { ...TYPE.small, flex: 1 },
  strength: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: -SPACE.sm, marginBottom: SPACE.lg },
  strengthText: { ...TYPE.caption, fontWeight: '700', width: 48, textAlign: 'right' },
  inlineNotice: { marginHorizontal: 0, marginTop: 0, marginBottom: SPACE.md },
  forgot: { minHeight: SIZE.touch, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.xs },
  forgotText: { fontSize: 14, fontWeight: '700', color: PALETTE.blue },
});

export default AccountSettingsScreen;
