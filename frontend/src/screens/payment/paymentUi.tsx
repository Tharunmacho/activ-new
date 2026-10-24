import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, StyleProp, ViewStyle, TouchableOpacity, Alert } from 'react-native';
import { checkoutLinkKind, openPaymentApp } from '../../services/paymentAppLink';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PALETTE, SPACE, TYPE, BRAND, PREMIUM_OVERLAP, PREMIUM_TYPE,
  FadeInUp, FloatingIllustration, GlassIconButton, GlassBadge, PremiumHeading, PremiumTopBar,
  ResultOrb3D, SecureCard3D, GradientGlyph, GLYPH_COLORS,
} from '../../ui';

/**
 * ============================================================================
 * PAYMENT UI — premium pieces shared by the payment / donation screens only
 * ============================================================================
 *
 *   ResultHeader ... the gradient header of a result / receipt: a floating
 *                    3D orb (tick, cross, clock), heading, the amount in glass
 *   Overlap ........ the first body block, lifted over the header's waves
 *   TotalBar ....... "Amount paid ₹5,000" on a navy strip
 *   TrustLine ...... small reassurance row (lock, receipt)
 *   ReceiptDivider . a dashed tear with notches, as on a paper ticket
 *   WebCheckout .... the gateway page under a fixed brand bar
 *
 * Presentation only — every figure passed in is the server's.
 */

export type PayOutcome = 'success' | 'failed' | 'pending' | 'checking';

/** The result header content (pass as PremiumPage `header`). */
export function ResultHeader({
  outcome, eyebrow, title, subtitle, amount, amountLabel = 'Amount paid', amountNote, onBack, backIcon, right, children,
}: {
  outcome: PayOutcome;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Already formatted (money()). Omit to hide the amount pill. */
  amount?: string;
  amountLabel?: string;
  amountNote?: string;
  onBack?: () => void;
  backIcon?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const art = outcome === 'checking'
    ? <SecureCard3D size={120} />
    : <ResultOrb3D size={120} kind={outcome === 'failed' ? 'failed' : outcome === 'pending' ? 'pending' : 'success'} />;
  return (
    <View>
      {onBack || right ? (
        <View style={s.topRow}>
          {onBack ? (
            <GlassIconButton
              icon={backIcon || (Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back')}
              onPress={onBack}
              accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
            />
          ) : <View />}
          {right || null}
        </View>
      ) : null}
      <View style={s.center}>
        <FadeInUp scaleFrom={0.7} distance={8}>
          <FloatingIllustration size={120} accessibilityLabel={title}>{art}</FloatingIllustration>
        </FadeInUp>
        {outcome === 'checking' ? <ActivityIndicator color={PALETTE.white} style={{ marginTop: SPACE.xs }} /> : null}
        <FadeInUp delay={80} style={s.fullWidth}>
          {eyebrow ? <GlassBadge label={eyebrow} style={s.badge} /> : null}
          <PremiumHeading size="md" align="center" title={title} subtitle={subtitle} style={{ marginTop: SPACE.md }} />
        </FadeInUp>
        {amount ? (
          <FadeInUp delay={160}>
            <View style={s.amountPill} accessible accessibilityLabel={`${amountLabel} ${amount}`}>
              <Text style={s.amountLabel} maxFontSizeMultiplier={1.2}>{amountLabel}</Text>
              <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.2}>{amount}</Text>
            </View>
            {amountNote ? <Text style={s.amountNote} numberOfLines={2} maxFontSizeMultiplier={1.3}>{amountNote}</Text> : null}
          </FadeInUp>
        ) : null}
        {children ? <FadeInUp delay={200} style={s.extra}>{children}</FadeInUp> : null}
      </View>
    </View>
  );
}

/** The first body block, lifted over the header waves. */
export function Overlap({ children, delay = 180, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  return <FadeInUp delay={delay} style={[{ marginTop: -PREMIUM_OVERLAP }, style]}>{children}</FadeInUp>;
}

/** "Amount paid ₹5,000" — the highlighted total at the foot of a receipt card. */
export function TotalBar({ label, value }: { label: string; value: string }) {
  return (
    <LinearGradient colors={[BRAND.navy, BRAND.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.total}>
      <Text style={s.totalLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={s.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>{value}</Text>
    </LinearGradient>
  );
}

/** A small reassurance row. */
export function TrustLine({ icon, text, tone = 'blue', style }: { icon: string; text: string; tone?: keyof typeof GLYPH_COLORS; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.trust, style]}>
      <GradientGlyph icon={icon} tone={tone} size={34} iconSize={17} />
      <Text style={s.trustText} maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

/** A dashed tear across a receipt with half-circle notches in the canvas colour. */
export function ReceiptDivider({ notch = PALETTE.canvas, inset = SPACE.lg }: { notch?: string; inset?: number }) {
  return (
    <View style={[s.divider, { marginHorizontal: -inset }]}>
      <View style={[s.notch, { left: -11, backgroundColor: notch }]} />
      <View style={[s.dash, { marginHorizontal: inset }]} />
      <View style={[s.notch, { right: -11, backgroundColor: notch }]} />
    </View>
  );
}

/**
 * The hosted gateway page, full height under a fixed brand bar. Every URL the
 * page moves to is offered to `isReturn`; a match closes it and calls
 * `onReturn` (the address bar is never trusted — the result screen asks the
 * server). UPI / bank-app links are handed to the phone.
 */
export function WebCheckout({
  WebViewComp, url, isReturn, onReturn, onClose, onError, onOpenBrowser, title = 'Secure payment',
}: {
  WebViewComp: any;
  url: string;
  isReturn: (u: string) => any;
  onReturn: (ret: any) => void;
  onClose: () => void;
  onError?: () => void;
  onOpenBrowser?: () => void;
  title?: string;
}) {
  const insets = useSafeAreaInsets();
  const [pageLoading, setPageLoading] = useState(true);
  const launching = useRef(false);
  const navigateCheckout = (next: string) => {
    const ret = isReturn(next);
    if (ret) { onReturn(ret); return false; }
    const kind = checkoutLinkKind(next);
    if (kind === 'web') return true;
    if (kind === 'app' && !launching.current) {
      launching.current = true;
      setPageLoading(false);
      openPaymentApp(next).catch(() => Alert.alert('Payment app unavailable', 'Choose another payment method, or open this same checkout in your browser.', [
        { text: 'Choose another method', style: 'cancel' },
        ...(onOpenBrowser ? [{ text: 'Open browser', onPress: onOpenBrowser }] : []),
      ])).finally(() => { launching.current = false; });
    }
    return false;
  };
  const Web = WebViewComp;
  return (
    <View style={s.webScreen}>
      <PremiumTopBar
        title={title}
        subtitle="Instamojo · secure checkout"
        leading={<GradientGlyph icon="lock" tone="green" size={38} iconSize={19} />}
        right={<GlassIconButton icon="close" onPress={onClose} accessibilityLabel="Cancel payment" />}
      />
      <View style={s.webWrap}>
        <Web
          source={{ uri: url }}
          startInLoadingState
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => setPageLoading(false)}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(req: any) => navigateCheckout(String(req?.url || ''))}
          onNavigationStateChange={(nav: any) => {
            const ret = isReturn(nav?.url || '');
            if (ret) onReturn(ret);
          }}
          onError={() => { setPageLoading(false); onError?.(); }}
          onHttpError={(event: any) => {
            if (event?.nativeEvent?.url === url && event?.nativeEvent?.statusCode >= 400) {
              setPageLoading(false); onError?.();
            }
          }}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically
          javaScriptEnabled
          domStorageEnabled
        />
        {pageLoading ? (
          <View style={s.webLoading} pointerEvents="none">
            <ActivityIndicator color={PALETTE.blue} />
            <Text style={s.webLoadingText}>Opening secure page…</Text>
          </View>
        ) : null}
      </View>
      <View style={[s.webFoot, { paddingBottom: Math.max(Number(insets?.bottom || 0), SPACE.md) }]}>
        <Icon name="verified-user" size={16} color={PALETTE.green} />
        <Text style={s.webFootText} maxFontSizeMultiplier={1.3}>Card, UPI and net banking are handled by Instamojo.</Text>
        {onOpenBrowser ? (
          <TouchableOpacity onPress={onOpenBrowser} hitSlop={8} accessibilityRole="button" style={s.webFootBtn}>
            <Text style={s.webFootLink} maxFontSizeMultiplier={1.3}>Open in browser</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.xs },
  center: { alignItems: 'center', paddingBottom: SPACE.md },
  fullWidth: { alignSelf: 'stretch', alignItems: 'center' },
  badge: { alignSelf: 'center', marginTop: SPACE.sm },
  amountPill: {
    marginTop: SPACE.lg, flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, maxWidth: '100%',
    paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm + 2, borderRadius: 18,
    backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  amountLabel: { ...PREMIUM_TYPE.eyebrow, fontSize: 10, color: BRAND.onBrandSoft },
  amount: { fontSize: 26, lineHeight: 32, fontWeight: '900', color: PALETTE.white, fontVariant: ['tabular-nums'], flexShrink: 1 },
  amountNote: { ...TYPE.caption, color: BRAND.onBrandSoft, textAlign: 'center', marginTop: SPACE.sm },
  extra: { marginTop: SPACE.md, alignItems: 'center' },

  total: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md,
    marginTop: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, borderRadius: 16,
  },
  totalLabel: { ...TYPE.bodyStrong, color: BRAND.onBrandSoft },
  totalValue: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: PALETTE.white, flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },

  trust: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  trustText: { ...TYPE.body, fontSize: 13, lineHeight: 19, color: PALETTE.textMuted, flex: 1, minWidth: 0 },

  divider: { height: 22, justifyContent: 'center', marginVertical: SPACE.sm },
  notch: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11 },
  dash: { borderTopWidth: 2, borderStyle: 'dashed', borderTopColor: PALETTE.border },

  webScreen: { flex: 1, backgroundColor: PALETTE.canvas },
  webWrap: { flex: 1, backgroundColor: PALETTE.white, marginTop: SPACE.sm },
  webLoading: {
    position: 'absolute', top: SPACE.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: SPACE.sm,
    backgroundColor: PALETTE.white, borderRadius: 999, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.lg,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  webLoadingText: { ...TYPE.caption, color: PALETTE.textSoft },
  webFoot: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md,
    borderTopWidth: 1, borderTopColor: PALETTE.border, backgroundColor: PALETTE.white,
  },
  webFootText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  webFootBtn: { minHeight: 36, justifyContent: 'center' },
  webFootLink: { ...TYPE.caption, fontWeight: '800', color: PALETTE.blue },
});
