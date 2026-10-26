import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SPACE, SIZE, Skeleton, PressableScale, CompanyLogoTile, BrandScrollPage, BrandTopBar, BrandHero, PREMIUM_OVERLAP, LiftCard, ArtEmptyState, Unplugged3D, FitImage } from '../../ui';
import { BusinessTabKey } from './BusinessTabBar';

/**
 * Pieces the business screens share (and nothing else needs). Module-level
 * components only. Visual — no data access here.
 */

/** The in-app routes behind the business tab bar. */
export const BUSINESS_TAB_ROUTES: Record<BusinessTabKey, string> = {
  business: 'BusinessDashboard',
  products: 'ProductsServices',
  discover: 'Discover',
  analytics: 'Analytics',
  settings: 'Settings',
};

/** Colour pairs for gradient icon chips, chosen by meaning. */
export const CHIP = {
  violet: ['#8B5CF6', '#5B21B6'],
  sky: ['#38BDF8', '#0369A1'],
  green: ['#34D399', '#047857'],
  amber: ['#FBBF24', '#B45309'],
  red: ['#F87171', '#B91C1C'],
  plum: ['#7C3AED', '#35126E'],
  gold: ['#FDE68A', '#A16207'],
};

/** Company review status → a label and colours that read on the gradient. */
export function companyStatus(status?: string | null) {
  const raw = String(status || 'pending').trim().toLowerCase() || 'pending';
  if (raw === 'active' || raw === 'approved') return { key: raw, label: 'Published', icon: 'verified', dot: '#34D399' };
  if (raw === 'inactive' || raw === 'rejected') return { key: raw, label: raw === 'rejected' ? 'Rejected' : 'Inactive', icon: 'block', dot: '#F87171' };
  return { key: raw, label: 'Not published', icon: 'schedule', dot: '#FBBF24' };
}

/** A status pill for the gradient header. */
export function GlassStatus({ status, style }: { status?: string | null; style?: StyleProp<ViewStyle> }) {
  const s = useThemeStyles(makeStyles);
  const st = companyStatus(status);
  return (
    <View style={[s.glassStatus, style]} accessibilityLabel={`Status: ${st.label}`}>
      <View style={[s.dot, { backgroundColor: st.dot }]} />
      <Text style={s.glassStatusText} maxFontSizeMultiplier={1.2}>{st.label}</Text>
    </View>
  );
}

/** A translucent pill on the gradient ("12 products", "Listed"). */
export function GlassTag({ icon, label, style }: { icon?: string; label: string; style?: StyleProp<ViewStyle> }) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.glassStatus, style]}>
      {icon ? <Icon name={icon} size={13} color={PALETTE.white} /> : null}
      <Text style={s.glassStatusText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

/**
 * The active company on the gradient: its real logo, name, type and the
 * status, with contact lines under it.
 */
export function CompanyGlassCard({ name, type, logo, status, facts, right, style }: {
  name: string;
  type?: string;
  logo?: string;
  status?: string | null;
  facts?: { icon: string; text: string }[];
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { brand: BRAND } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const list = (facts || []).filter((f) => f && f.text);
  return (
    <View style={[s.glassCard, style]}>
      <View style={s.glassTop}>
        <CompanyLogoTile tone="business" uri={logo} name={name} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.glassName} numberOfLines={2} maxFontSizeMultiplier={1.25}>{name || 'Your company'}</Text>
          {type ? <Text style={s.glassType} numberOfLines={1} maxFontSizeMultiplier={1.25}>{type}</Text> : null}
          {status !== undefined ? <GlassStatus status={status} style={{ marginTop: SPACE.sm }} /> : null}
        </View>
        {right}
      </View>
      {list.length ? (
        <View style={s.glassFacts}>
          {list.map((f, i) => (
            <View key={`${f.icon}-${i}`} style={s.glassFact}>
              <Icon name={f.icon} size={15} color={BRAND.onBrandSoft} style={{ marginTop: 2 }} />
              <Text style={s.glassFactText} numberOfLines={2} maxFontSizeMultiplier={1.25}>{f.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A company's cover (its real banner, or a brand gradient when it has none)
 * with the real logo overlapping its lower edge and the name beneath — for
 * the gradient header. `onPickBanner` / `onPickLogo` make both tappable
 * (the company form).
 */
export function CoverHero({ banner, logo, name, subtitle, badges, onPickBanner, onPickLogo, pickHint }: {
  banner?: string;
  logo?: string;
  name: string;
  subtitle?: string;
  badges?: React.ReactNode;
  onPickBanner?: () => void;
  onPickLogo?: () => void;
  pickHint?: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const [failed, setFailed] = React.useState(false);
  const src = typeof banner === 'string' ? banner.trim() : '';
  React.useEffect(() => { setFailed(false); }, [src]);
  /*
   * The cover takes the UPLOADED IMAGE'S OWN SHAPE (FitImage mode="auto") and
   * shows all of it — a wide web banner stays wide, a square poster gets a
   * taller frame, nothing is zoomed or cropped. It was a fixed 144 px box that
   * cropped every upload not already that shape.
   */
  const cover = (
    <FitImage
      uri={src && !failed ? src : ''}
      mode="auto"
      minRatio={1.6}
      maxRatio={3.4}
      style={s.cover}
      borderRadius={22}
      onError={() => setFailed(true)}
      accessibilityLabel={src ? `${name || 'Company'} cover image` : undefined}
      fallback={(
        <LinearGradient colors={['#A78BFA', '#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill}>
          <View style={s.coverOrbA} />
          <View style={s.coverOrbB} />
        </LinearGradient>
      )}
    >
      <LinearGradient colors={['rgba(46,16,101,0)', 'rgba(46,16,101,0.45)']} style={s.coverFade} pointerEvents="none" />
      {onPickBanner ? (
        <View style={s.coverChip}>
          <Icon name="panorama" size={15} color={PALETTE.white} />
          <Text style={s.coverChipText} maxFontSizeMultiplier={1.2}>{src ? 'Change cover' : 'Add cover'}</Text>
        </View>
      ) : null}
    </FitImage>
  );
  const logoTile = (
    <View>
      <View style={s.logoFrame}>
        <CompanyLogoTile tone="business" uri={logo} name={name} size={76} />
      </View>
      {onPickLogo ? <View style={s.logoCam}><Icon name="photo-camera" size={14} color={PALETTE.white} /></View> : null}
    </View>
  );
  return (
    <View>
      {onPickBanner ? (
        <PressableScale onPress={onPickBanner} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={src ? 'Change cover image' : 'Add a cover image'}>
          {cover}
        </PressableScale>
      ) : cover}
      <View style={s.coverRow}>
        {onPickLogo ? (
          <PressableScale onPress={onPickLogo} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Change logo">{logoTile}</PressableScale>
        ) : logoTile}
        <View style={s.coverBadges}>{badges}</View>
      </View>
      <Text style={s.coverName} accessibilityRole="header" maxFontSizeMultiplier={1.25}>{name || 'Your company'}</Text>
      {subtitle ? <Text style={s.coverSub} maxFontSizeMultiplier={1.25}>{subtitle}</Text> : null}
      {pickHint ? <Text style={s.coverHint} maxFontSizeMultiplier={1.25}>{pickHint}</Text> : null}
    </View>
  );
}

/** A 4:3 product photo well — the picked/real photo, or an inviting empty state. */
export function PhotoWell({ uri, onPress, hint = 'JPG or PNG, up to 5 MB' }: { uri?: string; onPress: () => void; hint?: string }) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  const [failed, setFailed] = React.useState(false);
  const src = typeof uri === 'string' ? uri.trim() : '';
  React.useEffect(() => { setFailed(false); }, [src]);
  const has = !!src && !failed;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={has ? 'Change product photo' : 'Choose product photo'}>
      <View style={[s.well, !has && s.wellEmpty]}>
        {has ? (
          <FitImage uri={src} style={StyleSheet.absoluteFill} onError={() => setFailed(true)} />
        ) : (
          <View style={s.wellInner}>
            <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.wellIcon}>
              <Icon name="add-photo-alternate" size={30} color={PALETTE.white} />
            </LinearGradient>
            <Text style={s.wellTitle} maxFontSizeMultiplier={1.3}>Add a product photo</Text>
            <Text style={s.wellHint} maxFontSizeMultiplier={1.3}>{hint}</Text>
          </View>
        )}
        {has ? (
          <View style={s.wellChip}>
            <Icon name="photo-camera" size={15} color={PALETTE.white} />
            <Text style={s.coverChipText} maxFontSizeMultiplier={1.2}>Change photo</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/** One square shortcut: gradient icon chip over a label (3 a row at 360dp). */
export function ToolTile({ icon, label, colors, onPress, badge }: {
  icon: string; label: string; colors: string[]; onPress: () => void; badge?: string;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  return (
    <View style={s.toolCell}>
      <PressableScale onPress={onPress} contentStyle={[s.tool, { shadowColor: p.shadow }]} accessibilityRole="button" accessibilityLabel={label}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.toolIcon}>
          <View style={s.toolSheen} />
          <Icon name={icon} size={SIZE.icon + 2} color={PALETTE.white} />
        </LinearGradient>
        <Text style={s.toolLabel} numberOfLines={2} maxFontSizeMultiplier={1.25}>{label}</Text>
        {badge ? <View style={s.toolBadge}><Text style={s.toolBadgeText} maxFontSizeMultiplier={1}>{badge}</Text></View> : null}
      </PressableScale>
    </View>
  );
}

export function ToolGrid({ children }: { children: React.ReactNode }) {
  const s = useThemeStyles(makeStyles);
  return <View style={s.toolGrid}>{children}</View>;
}

/** A compact secondary action — soft pill, icon + label, spring press. */
export function SoftAction({ icon, label, onPress, danger, primary, style, accessibilityLabel, disabled }: {
  icon: string; label: string; onPress: () => void; danger?: boolean; primary?: boolean;
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string; disabled?: boolean;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  const fg = danger ? PALETTE.redDark : primary ? PALETTE.white : p.accentDark;
  const inner = (
    <>
      <Icon name={icon} size={17} color={fg} />
      <Text style={[s.softText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{label}</Text>
    </>
  );
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[{ flex: 1, minWidth: 0 }, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {primary ? (
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.soft, disabled && { opacity: 0.5 }]}>{inner}</LinearGradient>
      ) : (
        <View style={[s.soft, danger ? s.softDanger : s.softPlain, disabled && { opacity: 0.5 }]}>{inner}</View>
      )}
    </PressableScale>
  );
}

/** A section heading on the canvas: title, optional caption and action. */
export function BizSectionTitle({ title, caption, action, onAction, style }: {
  title: string; caption?: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  return (
    <View style={[s.secRow, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.secTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{title}</Text>
        {caption ? <Text style={s.secCaption} maxFontSizeMultiplier={1.3}>{caption}</Text> : null}
      </View>
      {action && onAction ? (
        <PressableScale onPress={onAction} contentStyle={s.secAction} accessibilityRole="button" hitSlop={6}>
          <Text style={s.secActionText} maxFontSizeMultiplier={1.2}>{action}</Text>
          <Icon name="chevron-right" size={18} color={PALETTE.violet} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/**
 * A whole screen that is loading or failed: the brand header with its back
 * button, then skeleton cards — or the original "unplugged" art with a retry.
 */
export function BizStatePage({ title, eyebrow, onBack, error, onRetry, footer, rows = 3 }: {
  title: string;
  eyebrow?: string;
  onBack: () => void;
  /** Absent = loading. */
  error?: string;
  onRetry?: () => void;
  footer?: React.ReactNode;
  rows?: number;
}) {
  return (
    <BrandScrollPage tone="business"
      footer={footer}
      header={(
        <View style={{ paddingBottom: SPACE.lg }}>
          <BrandTopBar onBack={onBack} />
          <BrandHero eyebrow={eyebrow} title={title} />
        </View>
      )}
    >
      <View style={{ marginTop: -PREMIUM_OVERLAP }}>
        {typeof error === 'string' ? (
          <LiftCard tone="business" style={{ marginHorizontal: SPACE.lg }}>
            <ArtEmptyState tone="business"
              compact
              art={<Unplugged3D tone="business" size={76} />}
              title="Could not load this"
              message={error || 'Check your connection and try again.'}
              action={onRetry ? 'Try again' : undefined}
              actionIcon="refresh"
              onAction={onRetry}
            />
          </LiftCard>
        ) : (
          <CardSkeletons rows={rows} tall />
        )}
      </View>
    </BrandScrollPage>
  );
}

/** Skeleton shaped like a list of white cards (under an overlapping header). */
export function CardSkeletons({ rows = 3, tall }: { rows?: number; tall?: boolean }) {
  const s = useThemeStyles(makeStyles);
  const n = Math.max(1, Math.min(Number(rows || 3), 8));
  return (
    <View style={s.skWrap} accessibilityLabel="Loading">
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={s.skCard}>
          <View style={{ flexDirection: 'row', gap: SPACE.md, alignItems: 'center' }}>
            <Skeleton width={52} height={52} radius={16} />
            <View style={{ flex: 1, gap: SPACE.sm }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="85%" height={11} />
            </View>
          </View>
          {tall ? <Skeleton height={36} radius={12} style={{ marginTop: SPACE.md }} /> : null}
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  glassStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BRAND.glassStrong,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  glassStatusText: { color: PALETTE.white, fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.3, flexShrink: 1 },

  glassCard: {
    padding: SPACE.md + 2,
    borderRadius: 22,
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },
  glassTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  glassName: { color: PALETTE.white, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.3 },
  glassType: { color: BRAND.onBrandSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },
  glassFacts: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)', gap: SPACE.sm },
  glassFact: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  glassFactText: { flex: 1, minWidth: 0, color: PALETTE.white, fontSize: 13, lineHeight: 18 },

  // No fixed height: FitImage gives the cover the uploaded image's own shape.
  cover: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#4C1D95', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  coverOrbA: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.12)' },
  coverOrbB: { position: 'absolute', width: 120, height: 120, borderRadius: 60, left: -30, bottom: -60, backgroundColor: 'rgba(255,255,255,0.08)' },
  coverFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  coverChip: { position: 'absolute', right: SPACE.md, top: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, minHeight: 32, borderRadius: 999, backgroundColor: 'rgba(46,16,101,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  coverChipText: { color: PALETTE.white, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  coverRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: SPACE.md, marginTop: -40 },
  logoFrame: { padding: 3, borderRadius: 26, backgroundColor: PALETTE.card },
  logoCam: { position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: PALETTE.violet, borderWidth: 2, borderColor: PALETTE.white, alignItems: 'center', justifyContent: 'center' },
  coverBadges: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACE.xs + 2, marginLeft: SPACE.md, paddingBottom: SPACE.xs },
  coverName: { color: PALETTE.white, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4, marginTop: SPACE.md },
  coverSub: { color: BRAND.onBrandSoft, fontSize: 14, lineHeight: 20, marginTop: 2 },
  coverHint: { color: BRAND.onBrandFaint, fontSize: 12, lineHeight: 16, marginTop: SPACE.xs },

  well: { width: '100%', aspectRatio: 4 / 3, borderRadius: 18, overflow: 'hidden', backgroundColor: PALETTE.violetTint },
  wellEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: PALETTE.violetBorder },
  wellInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.lg },
  wellIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  wellTitle: { ...TYPE.subheading, marginTop: SPACE.md, color: PALETTE.violetDark },
  wellHint: { ...TYPE.caption, marginTop: 2 },
  wellChip: { position: 'absolute', right: SPACE.md, bottom: SPACE.md, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, minHeight: 32, borderRadius: 999, backgroundColor: 'rgba(46,16,101,0.6)' },

  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: SPACE.lg },
  toolCell: { width: '31.5%', marginBottom: SPACE.md },
  tool: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xs,
    paddingVertical: SPACE.lg,
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.8)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  toolIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm, overflow: 'hidden' },
  toolSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.14)' },
  toolLabel: { ...TYPE.caption, fontWeight: '700', color: PALETTE.text, textAlign: 'center' },
  toolBadge: { position: 'absolute', top: 8, right: 8, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: PALETTE.red, alignItems: 'center', justifyContent: 'center' },
  toolBadgeText: { color: PALETTE.white, fontSize: 10, fontWeight: '800' },

  soft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: SPACE.md, borderRadius: 999 },
  softPlain: { backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  softDanger: { backgroundColor: PALETTE.dangerSoft, borderWidth: 1, borderColor: PALETTE.dangerSoft },
  softText: { fontSize: 13, lineHeight: 18, fontWeight: '700', flexShrink: 1 },

  secRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md, minHeight: 24 },
  secTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22 },
  secCaption: { ...TYPE.caption, marginTop: 2 },
  secAction: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingLeft: SPACE.sm },
  secActionText: { fontSize: 13, fontWeight: '700', color: PALETTE.violetDark },

  skWrap: { paddingHorizontal: SPACE.lg, gap: SPACE.md },
  skCard: { padding: SPACE.lg, borderRadius: 20, backgroundColor: PALETTE.card, borderWidth: 1, borderColor: PALETTE.border },
});
