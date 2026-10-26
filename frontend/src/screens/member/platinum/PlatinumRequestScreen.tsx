import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Notice, BottomActionBar, Skeleton, PALETTE, SPACE, TYPE, SIZE, money, errorText,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, PremiumSection, PremiumInput, GradientButton, FadeInUp,
  SurfaceCard, GradientGlyph, GlyphTone, GroupTitle, CardSkeletons, PlatinumCrown3D, WhatsAppMark, CallMark, MailMark, BRAND,
} from '../../../ui';
import { getPlatinumRequest, requestPlatinum, getPlatinumPrice } from '../../../services/memberApi';

/**
 * ============================================================================
 * PLATINUM LIFETIME MEMBERSHIP — website `components/shared/Platinum.tsx`
 * ============================================================================
 *
 *   GET  /membership/plans?include=platinum    the price (the Super Admin's plan row)
 *   GET  /membership/platinum/request          { request, isPlatinum }
 *   POST /membership/platinum/request          { preferredContact, preferredTime?, message? }
 *
 * Nothing is charged online — the office calls, Platinum is paid at the office
 * and granted by the Super Admin. No price is ever hardcoded: a retired or
 * unpriced plan hides the offer entirely, exactly as the website does.
 */

type Contact = 'call' | 'whatsapp' | 'email';

const BENEFITS: { icon: string; tone: GlyphTone; title: string; text: string }[] = [
  { icon: 'all-inclusive', tone: 'navy', title: 'Member for life', text: 'One payment — no renewal, ever.' },
  { icon: 'verified', tone: 'slate', title: 'Lifetime badge', text: 'On your dashboard and your membership certificate.' },
  { icon: 'emoji-events', tone: 'gold', title: 'Recognised at ACTIV', text: 'Acknowledged as a Lifetime member at association conclaves.' },
  { icon: 'event-available', tone: 'blue', title: 'First to hear', text: 'Early word on ACTIV events and business programmes.' },
  { icon: 'support-agent', tone: 'teal', title: 'A direct line', text: 'The ACTIV office looks after your membership personally.' },
  { icon: 'auto-awesome', tone: 'amber', title: 'Everything included', text: 'Every member benefit, for as long as you are a member.' },
];

const CONTACTS: { key: Contact; label: string; detail: string }[] = [
  { key: 'call', label: 'Phone call', detail: 'The office rings you' },
  { key: 'whatsapp', label: 'WhatsApp', detail: 'A message on WhatsApp' },
  { key: 'email', label: 'Email', detail: 'A reply by email' },
];

const STATUS_COPY: Record<string, { title: string; text: string }> = {
  new: { title: 'We have your request', text: 'The ACTIV office will contact you within two working days.' },
  contacted: { title: 'The office has been in touch', text: 'Complete the payment at the office and your membership is upgraded to Lifetime.' },
};

const ContactMarkFor = ({ kind }: { kind: Contact }) =>
  kind === 'whatsapp' ? <WhatsAppMark size={30} /> : kind === 'email' ? <MailMark size={30} /> : <CallMark size={30} />;

const PlatinumRequestScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState<number | null>(null);
  const [request, setRequest] = useState<any>(null);
  const [isPlatinum, setIsPlatinum] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<Contact>('call');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    const [p, r] = await Promise.allSettled([getPlatinumPrice(), getPlatinumRequest()]);
    setPrice(p.status === 'fulfilled' ? p.value : null);
    if (r.status === 'fulfilled') {
      setRequest(r.value?.request || null);
      setIsPlatinum(!!r.value?.isPlatinum);
    } else {
      setLoadError(errorText(r.reason));
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await requestPlatinum({ preferredContact: contact, preferredTime: (time || '').trim(), message: (message || '').trim() });
      setNotice({
        kind: 'success',
        text: res?.existing ? 'We already have your request — the office will contact you' : 'Request received — the ACTIV office will contact you',
      });
      if (res?.request) setRequest(res.request);
      setOpen(false);
    } catch (err) {
      setNotice({ kind: 'danger', text: errorText(err, 'Your request could not be sent') });
    } finally {
      setBusy(false);
    }
  };

  const openRequest = request && (request.status === 'new' || request.status === 'contacted') ? request : null;
  const copy = openRequest ? (STATUS_COPY[String(openRequest.status)] || STATUS_COPY.new) : null;
  const canApply = !loading && !isPlatinum && !!price && !openRequest;

  const header = (
    <PremiumPageHeader
      eyebrow="Lifetime Membership"
      title="Join once. Stay a member for life."
      subtitle={isPlatinum ? 'You hold ACTIV’s highest recognition.' : 'One payment makes your membership permanent.'}
      onBack={() => navigation.goBack()}
      art={<PlatinumCrown3D size={92} />}
      artSize={92}
    >
      {!loading && price && !isPlatinum ? (
        <LinearGradient colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.priceBox}>
          <View style={styles.flexText}>
            <Text style={styles.priceLabel}>ONE PAYMENT</Text>
            <Text style={styles.price} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.7}>{money(price)}</Text>
          </View>
          <View style={styles.lifePill}>
            <Icon name="all-inclusive" size={16} color="#FDE68A" />
            <Text style={styles.lifeText}>Valid for life</Text>
          </View>
        </LinearGradient>
      ) : null}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <View style={[styles.overlap, styles.gutter]}><Skeleton height={120} radius={22} /></View>
        <CardSkeletons rows={3} style={{ marginTop: SPACE.lg }} />
      </PremiumPage>
    );
  }

  const footer = canApply && !open ? (
    <BottomActionBar note="No payment online — the ACTIV office calls you and explains everything.">
      <GradientButton label="Apply for Lifetime" icon="workspace-premium" onPress={() => setOpen(true)} style={styles.grow} />
    </BottomActionBar>
  ) : undefined;

  return (
    <PremiumPage header={header} onRefresh={load} refreshing={false} footer={footer}>
      <FadeInUp delay={200} style={styles.overlap}>
        {isPlatinum ? (
          <SurfaceCard style={styles.gutter} padded={false}>
            <LinearGradient colors={['#c8a04a', '#f8e6b2', '#ccaa58']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.holder}>
              <GradientGlyph icon="diamond" tone="gold" size={48} />
              <View style={styles.flexText}>
                <Text style={styles.holderTitle}>You are a Lifetime Member</Text>
                <Text style={styles.holderText}>Your membership never needs renewing.</Text>
              </View>
            </LinearGradient>
          </SurfaceCard>
        ) : openRequest && copy ? (
          <SurfaceCard style={styles.gutter} accent={PALETTE.blueSoft}>
            <View style={styles.statusRow}>
              <GradientGlyph icon={openRequest.status === 'contacted' ? 'phone-in-talk' : 'schedule'} tone="blue" size={46} />
              <View style={styles.flexText}>
                <Text style={TYPE.heading}>{copy.title}</Text>
                <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>{copy.text}</Text>
              </View>
            </View>
            <View style={styles.steps}>
              {['Requested', 'Office contacts you', 'Pay at the office', 'Lifetime'].map((label, i) => {
                const reached = i === 0 || (i === 1 && openRequest.status === 'contacted');
                return (
                  <View key={label} style={styles.step}>
                    <View style={[styles.stepDot, reached && styles.stepDotOn]}>
                      {reached ? <Icon name="check" size={12} color={PALETTE.white} /> : <Text style={styles.stepNo}>{i + 1}</Text>}
                    </View>
                    <Text style={[styles.stepText, reached && { color: PALETTE.blueDark }]} numberOfLines={2}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </SurfaceCard>
        ) : !price ? (
          <Notice kind="info" style={styles.gutter} text="Lifetime Membership is not being offered right now. The ACTIV office can tell you more." action="Help" onAction={() => navigation.navigate('MemberHelp')} />
        ) : (
          <SurfaceCard style={styles.gutter}>
            <View style={styles.statusRow}>
              <GradientGlyph icon="workspace-premium" tone="gold" size={46} />
              <View style={styles.flexText}>
                <Text style={TYPE.heading}>The association’s highest recognition</Text>
                <Text style={[TYPE.body, { marginTop: SPACE.xs }]}>Upgrade to Lifetime and your membership becomes permanent — nothing to renew, ever.</Text>
              </View>
            </View>
          </SurfaceCard>
        )}
      </FadeInUp>

      {loadError ? <Notice kind="warning" style={styles.block} text={loadError} action="Retry" onAction={load} /> : null}
      {notice ? <Notice kind={notice.kind} style={styles.block} text={notice.text} /> : null}

      {!isPlatinum && price && !openRequest && open ? (
        <FadeInUp delay={60} style={{ marginTop: SPACE.lg }}>
          <PremiumSection icon="support-agent" title="How should the office reach you?" subtitle="Nothing is charged online">
            <View style={styles.contacts} accessibilityRole="radiogroup">
              {CONTACTS.map((c) => {
                const on = contact === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setContact(c.key)}
                    style={[styles.contact, on && styles.contactOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={c.label}
                    activeOpacity={0.85}
                  >
                    <ContactMarkFor kind={c.key} />
                    <View style={styles.flexText}>
                      <Text style={[styles.contactText, on && { color: PALETTE.blueDark }]} numberOfLines={1}>{c.label}</Text>
                      <Text style={styles.contactSub} numberOfLines={1}>{c.detail}</Text>
                    </View>
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <PremiumInput label="Best time to reach you" icon="schedule" value={time} onChangeText={setTime} placeholder="e.g. Weekdays after 6 pm" editable={!busy} />
            <PremiumInput label="Anything to add? (optional)" icon="chat-bubble-outline" value={message} onChangeText={setMessage} placeholder="A question for the office" editable={!busy} multiline />
            <Text style={[TYPE.small, { marginBottom: SPACE.md }]}>
              The office explains the next steps; Lifetime is paid at the office and activated for you once your membership application is approved.
            </Text>
            <GradientButton label="Send my request" icon="send" onPress={submit} loading={busy} />
            <TouchableOpacity onPress={() => setOpen(false)} disabled={busy} style={styles.cancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </PremiumSection>
        </FadeInUp>
      ) : null}

      <GroupTitle title="What Lifetime gives you" count={BENEFITS.length} />
      <View style={styles.grid}>
        {BENEFITS.map((b, i) => (
          <FadeInUp key={b.title} delay={260 + i * 60} style={styles.cell}>
            <SurfaceCard style={styles.fill} contentStyle={styles.benefit}>
              <GradientGlyph icon={b.icon} tone={b.tone} size={40} />
              <Text style={styles.benefitTitle} maxFontSizeMultiplier={1.3}>{b.title}</Text>
              <Text style={styles.benefitText} maxFontSizeMultiplier={1.3}>{b.text}</Text>
            </SurfaceCard>
          </FadeInUp>
        ))}
      </View>

      <FadeInUp delay={640}>
        <SurfaceCard style={styles.block} padded={false}>
          <View style={[styles.cmpRow, styles.cmpDivider]}>
            <View style={[styles.cmpIcon, { backgroundColor: PALETTE.field }]}><Icon name="close" size={SIZE.iconSm} color={PALETTE.textMuted} /></View>
            <Text style={styles.cmpText}><Text style={styles.cmpStrong}>Annual membership</Text> — renew every year</Text>
          </View>
          <View style={styles.cmpRow}>
            <View style={[styles.cmpIcon, { backgroundColor: PALETTE.greenSoft }]}><Icon name="check" size={SIZE.iconSm} color={PALETTE.green} /></View>
            <Text style={styles.cmpText}><Text style={styles.cmpStrong}>Lifetime</Text> — pay once, never renew</Text>
          </View>
        </SurfaceCard>
      </FadeInUp>
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  block: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  grow: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },

  priceBox: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, borderRadius: 20, padding: SPACE.lg,
    borderWidth: 1, borderColor: 'rgba(253,230,138,0.45)', marginBottom: SPACE.sm,
  },
  priceLabel: { ...TYPE.eyebrow, color: BRAND.onBrandFaint },
  price: { fontSize: 30, lineHeight: 36, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'], marginTop: 2 },
  lifePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.18)' },
  lifeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#FDE68A' },

  holder: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  holderTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: '#3e2c0e' },
  holderText: { ...TYPE.caption, color: '#674c1b', marginTop: 2 },

  statusRow: { flexDirection: 'row', gap: SPACE.md, alignItems: 'flex-start' },
  steps: { flexDirection: 'row', marginTop: SPACE.lg, gap: 4 },
  step: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: PALETTE.field, alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { backgroundColor: PALETTE.blue },
  stepNo: { fontSize: 11, fontWeight: '800', color: PALETTE.textMuted },
  stepText: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: PALETTE.textMuted, textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACE.md, paddingHorizontal: SPACE.lg },
  cell: { width: '48.5%' },
  fill: { flex: 1 },
  benefit: { padding: SPACE.lg, minHeight: 150, gap: SPACE.sm },
  benefitTitle: { ...TYPE.bodyStrong, marginTop: SPACE.xs },
  benefitText: { ...TYPE.small },

  cmpRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg, minHeight: SIZE.row },
  cmpDivider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  cmpIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cmpText: { ...TYPE.body, flex: 1 },
  cmpStrong: { fontWeight: '700', color: PALETTE.text },

  contacts: { gap: SPACE.sm, marginBottom: SPACE.lg },
  contact: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 60, paddingHorizontal: SPACE.md, borderRadius: 16,
    borderWidth: 1.5, borderColor: PALETTE.border, backgroundColor: PALETTE.card,
  },
  contactOn: { borderColor: PALETTE.blue, backgroundColor: PALETTE.blueTint },
  contactText: { ...TYPE.bodyStrong, color: PALETTE.textSoft },
  contactSub: { ...TYPE.caption },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: PALETTE.blue },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: PALETTE.blue },
  cancel: { minHeight: SIZE.touch, alignItems: 'center', justifyContent: 'center', marginTop: SPACE.sm },
  cancelText: { fontSize: 15, fontWeight: '700', color: PALETTE.textMuted },
});

export default PlatinumRequestScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_TYPE = TYPE;
