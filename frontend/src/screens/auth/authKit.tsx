import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleProp, ViewStyle, Platform, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Screen, PALETTE, SIZE, SPACE, Tone, toneOf,
  PremiumScreen, PREMIUM_OVERLAP, PremiumSheet, GlassIconButton, GlassBadge, BrandLogo,
  FadeInUp,
} from '../../ui';
import { authStyles as a } from './authStyles';

/**
 * ============================================================================
 * AUTH KIT — the sign-in / recovery building blocks (on top of src/ui)
 * ============================================================================
 *
 * One look for member sign-in, admin sign-in, forgot / reset password and the
 * social sign-in landing. `tone` follows the portal: member = navy→blue,
 * admin = indigo. Module-level components only.
 *
 *   PremiumAuthScreen   the approved sign-in language: brand header (glass
 *                       back, logo, optional portal badge and a compact text heading)
 *                       and a white form sheet. Recovery and social sign-in
 *                       use the same typography as account registration.
 *   StatusPanel         a finished / failed step: gradient icon in a halo,
 *                       title, text, actions stacked below.
 *   TextLink, PortalLink, AuthDivider, AuthHeading, AuthIntro, BrandMark,
 *   AuthScreen          unchanged exports (AdminLogin / Login use some).
 */

/* ------------------------------------------------------------------ premium shell */

/** Shared by sign-in, account recovery and both registration steps. */
export function AuthTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return <View style={k.titleBlock}>
    {!!eyebrow && <Text style={k.eyebrow}>{eyebrow}</Text>}
    <Text accessibilityRole="header" style={k.title}>{title}</Text>
    {!!subtitle && <Text style={k.subtitle}>{subtitle}</Text>}
  </View>;
}


export function PremiumAuthScreen({
  tone = 'member', onBack, eyebrow, title, subtitle, badge, children, below, footer,
}: {
  tone?: Tone;
  onBack?: () => void;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Compatibility with existing callers; headings now use the shared text layout. */
  art?: React.ReactNode;
  /** A glass pill above the heading, e.g. "ADMIN ACCOUNT". */
  badge?: string;
  /** Inside the white sheet. */
  children?: React.ReactNode;
  /** Under the sheet, on the canvas (links, foot notes). */
  below?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <PremiumScreen
      tone={tone}
      waveHeight={44}
      footer={footer}
      header={(
        <View>
          <View style={k.topRow}>
            {onBack ? (
              <GlassIconButton
                icon={Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back'}
                onPress={onBack}
                accessibilityLabel="Go back"
              />
            ) : <View />}
            <BrandLogo size="sm" />
          </View>
          {badge ? (
            <FadeInUp delay={40} distance={8}>
              <GlassBadge label={badge} icon="admin-panel-settings" style={k.badge} />
            </FadeInUp>
          ) : null}
          <View style={k.heroRow}>
            <FadeInUp delay={80} style={k.heroText}>
              <AuthTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
            </FadeInUp>
          </View>
          <View style={{ height: SPACE.md }} />
        </View>
      )}
    >
      {children ? (
        <FadeInUp delay={220} style={k.sheetWrap}>
          <PremiumSheet tone={tone}>{children}</PremiumSheet>
        </FadeInUp>
      ) : <View style={k.sheetWrap} />}
      {below ? <FadeInUp delay={300} style={k.below}>{below}</FadeInUp> : null}
    </PremiumScreen>
  );
}

const k = StyleSheet.create({
  titleBlock: { gap: 8 }, title: { fontSize: 28, lineHeight: 35, fontWeight: '700', color: PALETTE.white }, subtitle: { fontSize: 16, lineHeight: 24, color: '#DCE7FF' }, eyebrow: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#DCE7FF' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { alignSelf: 'flex-start', marginTop: SPACE.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg, gap: SPACE.sm, marginBottom: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
  sheetWrap: { marginTop: -PREMIUM_OVERLAP },
  below: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, alignItems: 'center' },
});

/* ------------------------------------------------------------------ legacy shell */

/**
 * The previous sign-in canvas: kit Screen, content on the 16px gutter in a
 * column capped at 440, centred vertically on tall phones.
 */
export function AuthScreen({
  tone = 'member', header, children, centered = true,
}: {
  tone?: Tone;
  header?: React.ReactNode;
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <Screen tone={tone} avoidKeyboard contentStyle={header ? a.scrollWithHeader : a.scrollContent}>
      {header || null}
      <View style={[a.column, header ? a.columnUnderHeader : null, header && centered ? a.columnCentered : null]}>
        {children}
      </View>
    </Screen>
  );
}

/** The ACTIV logo on its white disc — the brand mark, unchanged. */
export function BrandMark() {
  return (
    <View style={a.brandWrap}>
      <View style={a.brandCircle}>
        <Image
          source={require('../../assets/images/activlogo.png')}
          style={a.brandLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel="ACTIV"
        />
      </View>
    </View>
  );
}

/** Centered title block with an optional portal badge ("ADMIN PORTAL"). */
export function AuthHeading({ title, subtitle, badge, badgeIcon = 'admin-panel-settings', tone = 'member' }: {
  title: string; subtitle?: string; badge?: string; badgeIcon?: string; tone?: Tone;
}) {
  const t = toneOf(tone);
  return (
    <View style={a.header}>
      {badge ? (
        <View style={[a.badge, { backgroundColor: t.accentSoft }]}>
          <Icon name={badgeIcon} size={14} color={t.accentDark} />
          <Text style={[a.badgeText, { color: t.accentDark }]} maxFontSizeMultiplier={1.3}>{badge}</Text>
        </View>
      ) : null}
      <Text style={a.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={a.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Left-aligned icon tile + heading + explanation — the top of a recovery step. */
export function AuthIntro({ icon, title, text, tone = 'member', badge }: {
  icon: string; title: string; text?: string; tone?: Tone; badge?: string;
}) {
  const t = toneOf(tone);
  return (
    <View style={{ marginBottom: SPACE.xl }}>
      <View style={[a.introIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name={icon} size={28} color={t.accent} />
      </View>
      {badge ? (
        <View style={[a.badge, { alignSelf: 'flex-start', backgroundColor: t.accentSoft }]}>
          <Icon name="admin-panel-settings" size={14} color={t.accentDark} />
          <Text style={[a.badgeText, { color: t.accentDark }]} maxFontSizeMultiplier={1.3}>{badge}</Text>
        </View>
      ) : null}
      <Text style={a.introTitle} accessibilityRole="header">{title}</Text>
      {text ? <Text style={a.introText}>{text}</Text> : null}
    </View>
  );
}

/** A text link with a full 44px hit area. `muted` for "Back to sign in". */
export function TextLink({ label, onPress, tone = 'member', muted, disabled, style }: {
  label: string; onPress: () => void; tone?: Tone; muted?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = toneOf(tone);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="link"
      style={[a.link, disabled && { opacity: 0.5 }, style]}
    >
      <Text style={[a.linkText, { color: muted ? PALETTE.textMuted : t.accent }]} maxFontSizeMultiplier={1.3}>{label}</Text>
    </TouchableOpacity>
  );
}

/** "OR SIGN IN WITH" */
export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={a.dividerRow} accessibilityRole="text">
      <View style={a.dividerLine} />
      <Text style={a.dividerText} maxFontSizeMultiplier={1.3}>{label}</Text>
      <View style={a.dividerLine} />
    </View>
  );
}

/** The quiet pill that switches between the member and admin sign-in. */
export function PortalLink({ icon, label, onPress, disabled, accessibilityLabel }: {
  icon: string; label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string;
}) {
  return (
    <View style={a.portalRow}>
      <TouchableOpacity
        style={[a.portalPill, disabled && { opacity: 0.5 }]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        <Icon name={icon} size={SIZE.iconSm + 2} color={PALETTE.textMuted} />
        <Text style={a.portalText} numberOfLines={2} maxFontSizeMultiplier={1.3}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const STATUS_KIND = {
  success: { grad: ['#047857', '#34D399'], halo: PALETTE.successSoft },
  info: { grad: ['#1E3A8A', '#3B82F6'], halo: PALETTE.blueSoft },
  admin: { grad: ['#3B2DB0', '#6D5AE6'], halo: PALETTE.indigoSoft },
  warning: { grad: ['#B45309', '#FBBF24'], halo: PALETTE.amberSoft },
};

/**
 * A step that has finished or failed: a gradient icon in a soft halo, title,
 * explanation and the actions stacked full-width below (primary first).
 */
export function StatusPanel({ icon, kind = 'info', title, children, actions }: {
  icon: string;
  kind?: keyof typeof STATUS_KIND;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const c = STATUS_KIND[kind] || STATUS_KIND.info;
  return (
    <View>
      <FadeInUp scaleFrom={0.7} distance={0}>
        <View style={[a.statusHalo, { backgroundColor: c.halo }]}>
          <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={a.statusIcon}>
            <Icon name={icon} size={34} color={PALETTE.white} />
          </LinearGradient>
        </View>
      </FadeInUp>
      <Text style={a.statusTitle} accessibilityRole="header">{title}</Text>
      {typeof children === 'string' ? <Text style={a.statusText}>{children}</Text> : children}
      {actions ? <View style={a.statusActions}>{actions}</View> : null}
    </View>
  );
}
