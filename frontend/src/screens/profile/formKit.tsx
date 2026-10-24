import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BottomActionBar,
  PALETTE,
  RADIUS,
  SPACE,
  SHADOW,
  SIZE,
  TYPE,
  Tone,
  toneOf,
  PremiumScreen,
  PremiumStepper,
  PremiumSection,
  PremiumSelect,
  PremiumFooter,
  PremiumLabel,
  GlassIconButton,
  BrandLogo,
  FadeInUp,
  PressableScale,
  premiumTone,
} from '../../ui';

/**
 * ============================================================================
 * REGISTRATION FORM KIT — the pieces the sign-up and application steps share
 * ============================================================================
 *
 * The premium look (the approved registration language): every step opens on
 * the navy→blue brand header — glass back button, logo, the step's heading
 * beside its own floating illustration, and the white stepper — and the form
 * sections lift over the waves as rounded cards. Module-level components only
 * (a component declared inside a screen remounts its inputs on every keystroke).
 *
 * Dropdowns are INLINE expandable lists, never a native <Modal> (CLAUDE.md
 * Rule 2): these screens are reachable from inside the member tabs.
 *
 * Layout contract:
 *   - FormScreen = PremiumScreen (gradient under the status bar, scrim, iOS
 *     keyboard lift; Android resizes natively) with the step's actions pinned
 *     in a <BottomActionBar>. Header and form scroll together, so the keyboard
 *     never covers a field.
 *   - Everything inside sits on the 16px gutter: FormSection, a Notice, the
 *     Platinum card all carry their own marginHorizontal.
 *   - Same exports and props as before; FormScreen additionally takes
 *     `step` / `steps` (the stepper) and `art` (the header illustration).
 */

const CAP = 1.3;

/* ------------------------------------------------------------------ screen */

export function FormScreen({
  title, subtitle, onBack, children, footer, footerNote, tone = 'member', step, steps,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
  /** The step's actions — usually a <FormFooter>. Pinned above the keyboard. */
  footer?: React.ReactNode;
  /** A short line above the footer buttons (e.g. why the primary is disabled). */
  footerNote?: string;
  tone?: Tone;
  /** Which step this is (1-based) — shows the white stepper in the header. */
  step?: number;
  /** The step names, in order. */
  steps?: string[];
  /** The step's illustration (original SVG art), floating beside the heading. */
  art?: React.ReactNode;
}) {
  const showStepper = !!step && Array.isArray(steps) && steps.length > 1;
  return (
    <PremiumScreen
      tone={tone}
      waveHeight={20}
      footer={footer ? <BottomActionBar note={footerNote}>{footer}</BottomActionBar> : undefined}
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
          <View style={k.heroRow}>
            <FadeInUp delay={60} style={k.heroText}>
              <Text style={k.pageTitle} accessibilityRole="header">{title}</Text>
              {!!subtitle && <Text style={k.pageSubtitle}>{subtitle}</Text>}
            </FadeInUp>
          </View>
          {showStepper ? (
            <FadeInUp delay={200} distance={10}>
              <PremiumStepper step={Number(step)} labels={steps || []} tone={tone} style={k.stepper} />
            </FadeInUp>
          ) : <View style={{ height: SPACE.lg }} />}
        </View>
      )}
    >
      {/* One wrapper lifts the whole form over the waves; its children stay inside it (touchable on Android). */}
      <FadeInUp delay={240} style={k.overlap}>{children}</FadeInUp>
    </PremiumScreen>
  );
}

/** Back + primary, side by side, at the foot of a step (premium gradient buttons). */
export function FormFooter({
  primaryLabel, onPrimary, loading, disabled, secondaryLabel, onSecondary, primaryIcon = 'arrow-forward',
}: {
  primaryLabel: string;
  onPrimary: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryIcon?: string;
}) {
  return (
    <PremiumFooter
      primaryLabel={primaryLabel}
      onPrimary={onPrimary}
      loading={loading}
      disabled={disabled}
      secondaryLabel={secondaryLabel}
      onSecondary={onSecondary}
      primaryIcon={primaryIcon}
    />
  );
}

/* ------------------------------------------------------------------ progress */

/**
 * The in-body step tracker (kept for any caller that renders it inside the
 * form; the premium screens pass `step`/`steps` to FormScreen instead, which
 * draws the white stepper on the header).
 */
export function StepProgress({ step, labels, tone = 'member' }: { step: number; labels: string[]; tone?: Tone }) {
  const t = toneOf(tone);
  const list = labels || [];
  const total = list.length || 1;
  const current = Math.max(1, Math.min(step || 1, total));
  return (
    <View
      style={[k.progress, SHADOW.xs]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${total}: ${list[current - 1] || ''}`}
    >
      <View style={k.progressHead}>
        <Text style={[k.progressEyebrow, { color: t.accent }]} maxFontSizeMultiplier={CAP}>
          STEP {current} OF {total}
        </Text>
      </View>
      <View style={k.progressRow}>
        {list.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          const railLeftOn = n <= current;
          const railRightOn = n < current;
          return (
            <View key={`${label}-${i}`} style={k.progressCell}>
              <View style={k.progressNodeRow}>
                <View style={[k.rail, i === 0 && k.railHidden, railLeftOn && { backgroundColor: t.accent }]} />
                <View
                  style={[
                    k.node,
                    done && { backgroundColor: t.accent, borderColor: t.accent },
                    active && { backgroundColor: t.accent, borderColor: t.accent, ...k.nodeActive },
                  ]}
                >
                  {done ? (
                    <Icon name="check" size={16} color={PALETTE.white} />
                  ) : (
                    <Text style={[k.nodeText, active && { color: PALETTE.white }]} maxFontSizeMultiplier={1}>{n}</Text>
                  )}
                </View>
                <View style={[k.rail, i === list.length - 1 && k.railHidden, railRightOn && { backgroundColor: t.accent }]} />
              </View>
              <Text
                style={[k.progressLabel, (done || active) && { color: PALETTE.text }, active && k.progressLabelOn]}
                numberOfLines={1}
                maxFontSizeMultiplier={CAP}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ intro */

/** A page-level heading + one line of context, on the gutter above the first section. */
export function FormIntro({ title, text, large }: { title: string; text?: string; large?: boolean }) {
  return (
    <View style={k.intro}>
      <Text style={large ? TYPE.display : TYPE.title} accessibilityRole="header">{title}</Text>
      {text ? <Text style={k.introText}>{text}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ section */

/** A titled card: gradient icon chip + heading (the premium section). */
export function FormSection({
  icon, title, subtitle, children, style, tone = 'member',
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: Tone;
}) {
  return (
    <PremiumSection icon={icon} title={title} subtitle={subtitle} style={style} tone={tone}>
      {children}
    </PremiumSection>
  );
}

/** A field label with the required mark — the premium input's label. */
export function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return <PremiumLabel label={label} required={required} />;
}

/** The error / hint line under a control — identical to the premium input's. */
export function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return (
      <View style={k.msgRow} accessibilityLiveRegion="polite">
        <Icon name="error-outline" size={14} color={PALETTE.red} />
        <Text style={k.error}>{error}</Text>
      </View>
    );
  }
  return hint ? <Text style={k.hint}>{hint}</Text> : null;
}

/** Show / hide for a password field's `right` slot — a full 44px target. */
export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={k.eye}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={shown ? 'Hide password' : 'Show password'}
    >
      <Icon name={shown ? 'visibility' : 'visibility-off'} size={SIZE.icon} color={PALETTE.textFaint} />
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ select */

/**
 * Pick one from a list — the premium select (inline expandable list, search
 * past 8 options, no native Modal). `options` may be empty; the field then
 * says so instead of opening onto nothing. `icon` is a leading icon; the old
 * default ('expand-more', the chevron) is ignored — the chevron is built in.
 */
export function SelectField({
  label, value, options, onChange, placeholder = 'Select', required, disabled, hint, error, icon, emptyText, tone = 'member', iconBadge,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string;
  icon?: string;
  emptyText?: string;
  tone?: Tone;
  iconBadge?: boolean;
}) {
  return (
    <PremiumSelect
      label={label}
      value={value || ''}
      options={options || []}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      hint={hint}
      error={error}
      icon={icon && icon !== 'expand-more' ? icon : undefined}
      emptyText={emptyText}
      tone={tone}
      iconBadge={iconBadge}
    />
  );
}

/* ------------------------------------------------------------------ pills, checks */

/** Exactly-one-of, as a row of equal-width pills (radio semantics); the chosen one fills with the brand gradient. */
export function ChoicePills<T extends string>({
  options, value, onChange, disabled, tone = 'member',
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T | '';
  onChange: (value: T) => void;
  disabled?: boolean;
  tone?: Tone;
}) {
  const p = premiumTone(tone);
  return (
    <View style={k.pills} accessibilityRole="radiogroup">
      {(options || []).map((o) => {
        const on = o.value === value;
        const fg = on ? PALETTE.white : disabled ? PALETTE.textFaint : PALETTE.textSoft;
        const inner = (
          <>
            <View style={[k.radio, on && k.radioOn]}>
              {on ? <View style={[k.radioDot, { backgroundColor: p.accent }]} /> : null}
            </View>
            {o.icon ? <Icon name={o.icon} size={SIZE.iconSm + 2} color={fg} /> : null}
            <Text style={[k.pillText, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={CAP}>{o.label}</Text>
          </>
        );
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            disabled={disabled}
            scaleTo={0.96}
            style={k.pillCell}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            accessibilityLabel={o.label}
          >
            {on ? (
              <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[k.pill, k.pillOnShadow, { shadowColor: p.shadow }]}>
                {inner}
              </LinearGradient>
            ) : (
              <View style={[k.pill, { backgroundColor: disabled ? PALETTE.field : p.inputFill }]}>{inner}</View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** One on/off answer — the box fills with the brand gradient when ticked. */
export function CheckRow({
  checked, onToggle, children, disabled, tone = 'member',
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: Tone;
}) {
  const p = premiumTone(tone);
  return (
    <TouchableOpacity
      onPress={onToggle}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      style={[k.check, disabled && { opacity: 0.5 }]}
    >
      {checked ? (
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[k.box, k.boxOn]}>
          <Icon name="check" size={16} color={PALETTE.white} />
        </LinearGradient>
      ) : (
        <View style={k.box} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {typeof children === 'string' ? <Text style={k.checkText}>{children}</Text> : children}
      </View>
    </TouchableOpacity>
  );
}

/* ------------------------------------------------------------------ styles */

export const k = StyleSheet.create({
  scroll: { paddingTop: SPACE.lg, paddingBottom: SPACE.xxl },
  footerRow: { flex: 1, flexDirection: 'row', gap: SPACE.md },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.lg, gap: SPACE.sm },
  heroText: { flex: 1, minWidth: 0 },
  pageTitle: { color: PALETTE.white, fontSize: 28, lineHeight: 35, fontWeight: '700' },
  pageSubtitle: { color: '#DCE7FF', fontSize: 16, lineHeight: 24, marginTop: 8 },
  stepper: { marginTop: SPACE.lg, marginBottom: SPACE.md },
  overlap: { marginTop: 4 },

  progress: {
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md,
    backgroundColor: PALETTE.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  progressHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm,
    paddingHorizontal: SPACE.xs, marginBottom: SPACE.md,
  },
  progressEyebrow: { ...TYPE.eyebrow },
  progressRow: { flexDirection: 'row' },
  progressCell: { flex: 1, minWidth: 0, alignItems: 'center' },
  progressNodeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  rail: { flex: 1, height: 2, borderRadius: 1, backgroundColor: PALETTE.border },
  railHidden: { backgroundColor: 'transparent' },
  node: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: PALETTE.borderStrong,
    backgroundColor: PALETTE.card, alignItems: 'center', justifyContent: 'center',
  },
  nodeActive: {
    shadowColor: PALETTE.blue, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  nodeText: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: PALETTE.textMuted },
  progressLabel: { ...TYPE.caption, color: PALETTE.textFaint, marginTop: SPACE.sm - 2, textAlign: 'center', paddingHorizontal: SPACE.xxs },
  progressLabelOn: { fontWeight: '700' },

  intro: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  introText: { ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.xs },

  fieldWrap: { marginBottom: SPACE.lg },
  label: { ...TYPE.label, marginBottom: 6 },

  msgRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: 6, marginLeft: 2 },
  error: { flex: 1, color: PALETTE.redDark, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  hint: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 16, marginTop: 6, marginLeft: 2 },

  eye: { width: SIZE.touch, height: SIZE.touch, marginRight: -SPACE.md + 2, alignItems: 'center', justifyContent: 'center' },

  pills: { flexDirection: 'row', gap: SPACE.sm },
  pillCell: { flex: 1, minWidth: 0 },
  pill: {
    minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    paddingHorizontal: SPACE.sm,
  },
  pillOnShadow: { shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 },
  pillText: { fontSize: 14, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: PALETTE.borderStrong,
    backgroundColor: PALETTE.card, alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: PALETTE.white, backgroundColor: PALETTE.white },
  radioDot: { width: 8, height: 8, borderRadius: 4 },

  check: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.sm + 2, minHeight: SIZE.touch },
  box: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: PALETTE.borderStrong,
    alignItems: 'center', justifyContent: 'center', marginTop: -1, backgroundColor: PALETTE.card,
  },
  boxOn: { borderWidth: 0 },
  checkText: { ...TYPE.body },
});
