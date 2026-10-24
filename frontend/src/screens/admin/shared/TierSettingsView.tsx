import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  BottomActionBar, PALETTE, SPACE, TYPE, SIZE,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, ConsolePill, ConsoleChip, ConsoleNote,
  GradientAvatar, GlassIconButton, PremiumSection, PremiumInput, PressableScale, FadeInUp, ProfileGear3D,
  premiumTone,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import { AdminTier, TIER_LABEL } from './TierMenu';

/**
 * ============================================================================
 * TIER SETTINGS — the presentational half of the Block / District / State
 * Settings tabs. Each tier screen keeps its own state, API calls and
 * validation; this only draws them, so the three can never drift apart.
 * ============================================================================
 *
 * Premium: the indigo wave header, a profile card lifted over the waves
 * (gradient avatar with a camera badge, role, email), the profile form in a
 * premium section (read-only until Edit), the optional password change while
 * editing, a sticky Save bar while editing, and Log Out otherwise. Photo
 * picking stays in the screen (native module, try/catch there — Rule 2).
 */

export interface SettingsField {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  icon?: string;
}

interface Props {
  tier: AdminTier;
  name: string;
  email: string;
  /** e.g. "Coimbatore District Admin". */
  roleLine: string;
  photo?: string | null;
  isEditing: boolean;
  isSaving: boolean;
  photoBusy?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onBack: () => void;
  onPickImage: () => void;
  onLogout: () => void;
  fields: SettingsField[];
  passwordFields: SettingsField[];
}

const ADMIN = premiumTone('admin');

const photoOf = (photo?: string | null) => {
  const p = String(photo || '');
  if (!p) return '';
  return p.startsWith('/uploads') || p.startsWith('uploads') ? resolveMediaUrl(p) : p;
};

export default function TierSettingsView({
  tier, name, email, roleLine, photo, isEditing, isSaving, onEdit, onSave, onBack, onPickImage, onLogout,
  fields, passwordFields, photoBusy = false,
}: Props) {
  // Keyed by label, so revealing one password never reveals the one beside it.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const renderField = (f: SettingsField, secure: boolean, last: boolean) => {
    const shown = secure && !!revealed[f.label];
    return (
      <PremiumInput
        key={f.label}
        tone="admin"
        label={f.label}
        icon={f.icon}
        value={f.value || ''}
        onChangeText={f.onChangeText}
        placeholder={f.placeholder}
        secureTextEntry={secure && !shown}
        editable={isEditing}
        keyboardType={f.keyboardType || 'default'}
        autoCorrect={false}
        autoCapitalize={secure || f.keyboardType === 'email-address' ? 'none' : 'sentences'}
        style={last ? styles.lastField : undefined}
        right={secure ? (
          <TouchableOpacity
            onPress={() => setRevealed(prev => ({ ...prev, [f.label]: !prev[f.label] }))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.reveal}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          >
            <Icon name={shown ? 'visibility-off' : 'visibility'} size={SIZE.icon} color={PALETTE.textFaint} />
          </TouchableOpacity>
        ) : undefined}
      />
    );
  };

  const footer = isEditing ? (
    <BottomActionBar safeBottom={false}>
      <ConsoleButton icon="check" label="Save changes" loading={isSaving} onPress={onSave} style={styles.flex} />
    </BottomActionBar>
  ) : undefined;

  const list = fields || [];
  const pw = passwordFields || [];

  return (
    <ConsoleScroll footer={footer} avoidKeyboard>
      <ConsoleHeader
        left={<GlassIconButton icon="arrow-back" onPress={onBack} accessibilityLabel="Back to dashboard" />}
        topCenter={`${TIER_LABEL[tier]} Admin`}
        right={isEditing ? undefined : <GlassIconButton icon="edit" onPress={onEdit} accessibilityLabel="Edit profile" />}
        eyebrow="Your account"
        title="Settings"
        subtitle="Profile, password and sign out"
        art={<ProfileGear3D size={92} />}
        waveHeight={62}
      />

      <FadeInUp style={styles.overlap}>
        <ConsoleCard>
          <View style={styles.profileRow}>
            <PressableScale onPress={onPickImage} disabled={photoBusy} scaleTo={0.94} accessibilityRole="button" accessibilityLabel={photoBusy ? 'Saving photo' : 'Change photo'}>
              <GradientAvatar name={name} uri={photoOf(photo)} size={AVATAR} tone="admin" />
              <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cameraBadge}>
                <Icon name="camera-alt" size={14} color={PALETTE.white} />
              </LinearGradient>
            </PressableScale>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={2}>{name || 'Admin'}</Text>
              <Text style={styles.profileRole} numberOfLines={2}>{roleLine}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{email || 'No email on record'}</Text>
              <View style={styles.chips}>
                <ConsoleChip label={`${TIER_LABEL[tier]} Admin`} kind="info" icon="verified-user" />
                <ConsoleChip label="Active" kind="approved" />
              </View>
            </View>
          </View>
          <View style={styles.photoRow}>
            <ConsolePill icon="photo-camera" label={photoBusy ? 'Saving photo…' : 'Change photo'} onPress={photoBusy ? undefined : onPickImage} />
          </View>
        </ConsoleCard>
      </FadeInUp>

      {isEditing ? (
        <ConsoleNote icon="edit" text="You are editing your profile. Nothing changes until you tap Save changes." style={styles.note} />
      ) : null}

      <FadeInUp delay={120}>
        <PremiumSection
          tone="admin"
          icon="badge"
          title="Profile Information"
          subtitle={isEditing ? 'Update your details below' : 'Tap the pencil above to change your details'}
        >
          {list.map((f, i) => renderField(f, false, i === list.length - 1))}
        </PremiumSection>
      </FadeInUp>

      {isEditing ? (
        <FadeInUp delay={60}>
          <PremiumSection tone="admin" icon="lock-reset" title="Change Password (Optional)" subtitle="Leave blank to keep your current password">
            {pw.map((f, i) => renderField(f, true, i === pw.length - 1))}
          </PremiumSection>
        </FadeInUp>
      ) : (
        <FadeInUp delay={180} style={styles.logout}>
          <ConsoleButton kind="danger" icon="logout" label="Log Out" onPress={onLogout} />
          <Text style={styles.logoutHint}>Signs you out of the {TIER_LABEL[tier]} Admin console on this phone.</Text>
        </FadeInUp>
      )}
    </ConsoleScroll>
  );
}

const AVATAR = 76;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlap: { marginTop: -30, marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  note: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: PALETTE.card,
  },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { ...TYPE.title },
  profileRole: { ...TYPE.label, color: PALETTE.indigo, marginTop: SPACE.xxs },
  profileEmail: { ...TYPE.caption, marginTop: SPACE.xxs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm },
  photoRow: { flexDirection: 'row', marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  reveal: { paddingLeft: SPACE.sm, minHeight: SIZE.touch, justifyContent: 'center' },
  lastField: { marginBottom: 0 },
  logout: { marginHorizontal: SPACE.lg, marginTop: SPACE.xs },
  logoutHint: { ...TYPE.caption, textAlign: 'center', marginTop: SPACE.sm, color: PALETTE.textFaint },
});
