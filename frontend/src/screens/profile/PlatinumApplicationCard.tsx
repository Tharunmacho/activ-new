import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, RADIUS, SIZE, SPACE, TYPE, BRAND, PressableScale, FadeInUp, DiamondGem3D } from '../../ui';
import { getPlatinumPrice, getPlatinumRequest } from '../../services/memberApi';

/**
 * The website's `PlatinumNotice` (PlatinumShowcase, context="application") —
 * shown at the foot of the business step to anyone joining as a business.
 *
 *   GET /membership/plans?include=platinum   the price; no price → not shown
 *   GET /membership/platinum/request         an open request, or already Platinum
 *
 * Applying happens on the app's own PlatinumRequest screen (POST
 * /membership/platinum/request), reached through `onApply`.
 */

const BENEFITS: { icon: string; title: string }[] = [
  { icon: 'all-inclusive', title: 'Member for life' },
  { icon: 'verified', title: 'Lifetime badge' },
  { icon: 'emoji-events', title: 'Recognised at ACTIV' },
  { icon: 'event-available', title: 'First to hear' },
  { icon: 'support-agent', title: 'A direct line' },
  { icon: 'auto-awesome', title: 'Everything included' },
];

const STATUS_COPY: Record<string, { title: string; text: string }> = {
  new: { title: 'We have your request', text: 'The ACTIV office will contact you within two working days.' },
  contacted: { title: 'The office has been in touch', text: 'Complete the payment at the office and your membership is upgraded to Lifetime.' },
};

export default function PlatinumApplicationCard({ onApply }: { onApply: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [price, setPrice] = useState<number | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [isPlatinum, setIsPlatinum] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlatinumPrice()
      .then((p) => { if (!cancelled) setPrice(p); })
      .catch(() => { if (!cancelled) setPrice(null); });
    getPlatinumRequest()
      .then((r) => {
        if (cancelled) return;
        setRequest(r?.request || null);
        setIsPlatinum(!!r?.isPlatinum);
      })
      .catch(() => { /* a member without a request is the normal case */ });
    return () => { cancelled = true; };
  }, []);

  if (!price || isPlatinum) return null;

  const status = String(request?.status || '');
  const open = status === 'new' || status === 'contacted' ? STATUS_COPY[status] : null;

  return (
    // Shadow on the wrapper: a shadow on the clipped gradient is invisible on iOS (kit rule 6).
    <FadeInUp delay={80} style={s.wrap}>
      <LinearGradient
        colors={[BRAND.navyDeep, BRAND.navy, BRAND.blue900, BRAND.blue]}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        <View style={s.orb} />
        <View style={s.crown}><DiamondGem3D size={40} /></View>
        <View style={s.eyebrow}>
          <Icon name="workspace-premium" size={14} color={PALETTE.gold} />
          <Text style={s.eyebrowText} numberOfLines={1} maxFontSizeMultiplier={1.3}>LIFETIME MEMBERSHIP</Text>
        </View>
        <Text style={s.title}>Join once. Stay an ACTIV member for life.</Text>
        <Text style={s.text}>
          Building a business? Lifetime makes your membership permanent — one payment, no renewals, and the
          association’s highest recognition.
        </Text>

        <View style={s.priceBox}>
          <Text style={s.priceLabel}>ONE PAYMENT</Text>
          <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            ₹{Number(price || 0).toLocaleString('en-IN')}
          </Text>
          <Text style={s.priceHint}>Valid for life · never renew</Text>
        </View>

        <View style={s.chips}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={s.chip}>
              <Icon name={b.icon} size={13} color={PALETTE.white} />
              <Text style={s.chipText} maxFontSizeMultiplier={1.3}>{b.title}</Text>
            </View>
          ))}
        </View>

        {open ? (
          <View style={s.status}>
            <View style={s.statusIcon}><Icon name="schedule" size={SIZE.icon} color={PALETTE.blueDark} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.statusTitle}>{open.title}</Text>
              <Text style={s.statusText}>{open.text}</Text>
            </View>
          </View>
        ) : (
          <PressableScale onPress={onApply} contentStyle={s.cta} accessibilityRole="button" accessibilityLabel="Apply for Lifetime">
            <Icon name="workspace-premium" size={18} color={PALETTE.blueDeep} />
            <Text style={s.ctaText}>Apply for Lifetime</Text>
          </PressableScale>
        )}
      </LinearGradient>
    </FadeInUp>
  );
}

const ON_DARK = 'rgba(255,255,255,0.82)';
const GLASS = 'rgba(255,255,255,0.12)';

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: SPACE.lg, marginBottom: SPACE.lg, borderRadius: 24, backgroundColor: BRAND.navy,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.25, shadowRadius: 22, elevation: 8,
  },
  card: { borderRadius: 24, padding: SPACE.xl, overflow: 'hidden' },
  orb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90, backgroundColor: 'rgba(96,165,250,0.18)' },
  crown: { position: 'absolute', right: SPACE.lg, top: SPACE.lg },
  eyebrow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '78%',
    backgroundColor: GLASS, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs,
  },
  eyebrowText: { ...TYPE.eyebrow, fontSize: 10, color: PALETTE.white, flexShrink: 1 },
  title: { ...TYPE.title, color: PALETTE.white, marginTop: SPACE.md, paddingRight: SPACE.xxl },
  text: { ...TYPE.body, fontSize: 13, lineHeight: 19, color: ON_DARK, marginTop: SPACE.xs },
  priceBox: { backgroundColor: GLASS, borderRadius: RADIUS.md, padding: SPACE.lg, marginTop: SPACE.lg },
  priceLabel: { ...TYPE.eyebrow, color: ON_DARK },
  price: { ...TYPE.number, color: PALETTE.white, marginTop: 2 },
  priceHint: { ...TYPE.caption, color: ON_DARK, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm - 2, marginTop: SPACE.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, backgroundColor: GLASS,
    borderRadius: RADIUS.pill, paddingHorizontal: SPACE.sm + 2, paddingVertical: SPACE.xs + 1,
  },
  chipText: { ...TYPE.caption, color: PALETTE.white, fontWeight: '700' },
  status: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, backgroundColor: PALETTE.card,
    borderRadius: RADIUS.md, padding: SPACE.md, marginTop: SPACE.lg,
  },
  statusIcon: {
    width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: PALETTE.blueSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  statusTitle: { ...TYPE.bodyStrong },
  statusText: { ...TYPE.caption, color: PALETTE.textSoft, marginTop: 2, lineHeight: 17 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: SIZE.control,
    backgroundColor: PALETTE.card, borderRadius: RADIUS.pill, marginTop: SPACE.lg,
  },
  ctaText: { ...TYPE.subheading, fontWeight: '700', color: PALETTE.blueDeep },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
