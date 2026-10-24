import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Linking, Alert, BackHandler,
} from 'react-native';
import { usePaymentResumeCheck } from './usePaymentResumeCheck';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BottomActionBar, Notice, PALETTE, SPACE, TYPE, BRAND, errorText,
  PremiumPage, PremiumPageHeader, PremiumSection, PremiumInput, GradientButton, GlassIconButton, PressableScale, FadeInUp,
  DonateHeart3D, SecureCard3D, HeaderStat, HeaderStatRow, SurfaceCard, LinkRow, GroupTitle,
} from '../../ui';
import { Overlap, WebCheckout } from './paymentUi';
import { createDonation, mockCompleteDonation, parseDonationReturnUrl, getDonationReturn, DonorType } from '../../services/paymentFlow';
import { getAuthToken } from '../../services/api';
import { getPendingPayment, getPaymentStorageOwner, setPendingPayment, PendingPayment } from '../../services/paymentRecovery';
import { getMyProfile } from '../../services/memberApi';
import { readSavedDonor, writeSavedDonor, forgetSavedDonor } from './donationStore';

let WebViewComp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebViewComp = require('react-native-webview').WebView || null;
} catch {
  WebViewComp = null;
}

/**
 * ============================================================================
 * DONATE — website `pages/donate/DonatePage.tsx`, from the app
 * ============================================================================
 *
 * POST /donations { amount, fullName, email, phone, pan?, donorType, address, message? }
 *   → gateway: paymentUrl, opened in the in-app WebView (same approach as the
 *     membership checkout). The gateway returns to `…/donate/thank-you?orderId=`,
 *     which closes the WebView and hands over to DonationResult — the server is
 *     asked what happened; the address bar is never trusted.
 *   → mock servers: POST /donations/mock-complete/:orderId, then DonationResult.
 *
 * The amount is only what the donor CHOSE (the suggestions are the website's
 * own); the server validates the range and builds the order. Same validation
 * rules and messages as the website.
 */

const PRESETS = [500, 1000, 2500, 5000, 10000];
const MIN = 100;
const MAX = 1000000;
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

type Form = {
  fullName: string; email: string; phone: string; pan: string;
  line1: string; city: string; district: string; state: string; pincode: string; message: string;
};
type Errors = Partial<Record<keyof Form | 'amount', string>>;
const EMPTY: Form = { fullName: '', email: '', phone: '', pan: '', line1: '', city: '', district: '', state: '', pincode: '', message: '' };

const validate = (form: Form, amount: number): Errors => {
  const e: Errors = {};
  if (!amount || amount < MIN) e.amount = `The smallest donation is ${inr(MIN)}.`;
  else if (amount > MAX) e.amount = `For more than ${inr(MAX)}, please contact the ACTIV office.`;
  if ((form.fullName || '').trim().length < 2) e.fullName = 'Enter the name to print on the receipt.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((form.email || '').trim())) e.email = 'Enter a valid email — your receipts are sent here.';
  const digits = (form.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) e.phone = 'Enter a 10-digit mobile number.';
  const pan = (form.pan || '').trim().toUpperCase();
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) e.pan = 'A PAN looks like ABCDE1234F.';
  if ((form.line1 || '').trim().length < 3) e.line1 = 'Enter your address.';
  if (!(form.city || '').trim()) e.city = 'Enter your city or town.';
  if (!(form.state || '').trim()) e.state = 'Enter your state.';
  if (!/^\d{6}$/.test((form.pincode || '').trim())) e.pincode = 'Enter the 6-digit PIN code.';
  return e;
};

const DonateScreen = ({ navigation }: any) => {
  const [preset, setPreset] = useState<number | null>(1000);
  const [custom, setCustom] = useState('');
  const [donorType, setDonorType] = useState<DonorType>('individual');
  const [form, setForm] = useState<Form>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [orderId, setOrderId] = useState('');
  const [browserMode, setBrowserMode] = useState(false);
  const [pending, setPending] = useState<PendingPayment | null>(null);

  const handedOff = useRef(false);
  const hydrated = useRef(false);
  const currentOrderId = useRef('');
  const submitting = useRef(false);
  const mounted = useRef(true);

  // Saved details first; otherwise the member's own profile.
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    getPendingPayment('donation').then(saved => {
      if (cancelled || !saved) return;
      setPending(saved); setOrderId(saved.orderId); currentOrderId.current = saved.orderId;
    });
    (async () => {
      const saved = await readSavedDonor();
      if (cancelled) return;
      if (saved && (saved.fullName || saved.email)) {
        setForm((f) => ({
          ...f,
          fullName: String(saved.fullName || ''), email: String(saved.email || ''), phone: String(saved.phone || ''),
          pan: String(saved.pan || ''), line1: String(saved.line1 || ''), city: String(saved.city || ''),
          district: String(saved.district || ''), state: String(saved.state || ''), pincode: String(saved.pincode || ''),
        }));
        setDonorType(saved.donorType === 'organisation' ? 'organisation' : 'individual');
        setRestored(true);
      } else {
        try {
          const me: any = await getAuthToken() ? await getMyProfile() : null;
          if (!cancelled && me) {
            setForm((f) => ({
              ...f,
              fullName: f.fullName || String(me?.fullName || ''),
              email: f.email || String(me?.email || ''),
              phone: f.phone || String(me?.phoneNumber || ''),
              city: f.city || String(me?.city || me?.place || ''),
              district: f.district || String(me?.district || ''),
              state: f.state || String(me?.state || ''),
            }));
          }
        } catch { /* a blank form is fine */ }
      }
      hydrated.current = true;
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  // Keep the saved copy current as they type (never the amount or message).
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => {
      writeSavedDonor({
        donorType, fullName: form.fullName, email: form.email, phone: form.phone, pan: form.pan,
        line1: form.line1, city: form.city, district: form.district, state: form.state, pincode: form.pincode,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [form, donorType]);

  const amount = useMemo(() => (custom ? Number(custom) : Number(preset || 0)), [custom, preset]);

  const set = (id: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [id]: id === 'pan' ? String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : v }));
    setErrors((e) => (e[id] ? { ...e, [id]: undefined } : e));
    setFormError('');
  };

  const forgetMe = async () => {
    await forgetSavedDonor();
    setForm(EMPTY);
    setDonorType('individual');
    setRestored(false);
  };

  const goResult = useCallback((ret?: { orderId?: string; paymentId?: string; paymentStatus?: string }) => {
    if (handedOff.current) return;
    const id = currentOrderId.current.trim();
    if (ret?.orderId && ret.orderId !== id) {
      Alert.alert('Different donation order', 'This return does not match your donation. Please check the current order status.');
      return;
    }
    if (!id) return;
    handedOff.current = true;
    navigation.replace('DonationResult', { orderId: id, paymentId: ret?.paymentId || undefined, paymentStatus: ret?.paymentStatus || undefined });
  }, [navigation]);

  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    const previous = await getPendingPayment('donation');
    if (!mounted.current) { submitting.current = false; return; }
    if (previous || currentOrderId.current) {
      if (previous) currentOrderId.current = previous.orderId;
      submitting.current = false;
      goResult(); return;
    }
    const found = validate(form, amount);
    setErrors(found);
    if (Object.values(found).some(Boolean)) {
      setFormError('Please check the highlighted fields.');
      submitting.current = false;
      return;
    }
    setBusy(true);
    setFormError('');
    handedOff.current = false;
    try {
      const owner = await getPaymentStorageOwner();
      if (!mounted.current) return;
      const res = await createDonation({
        amount,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, '').slice(-10),
        pan: form.pan.trim() || undefined,
        donorType,
        address: {
          line1: form.line1.trim(), city: form.city.trim(), district: form.district.trim(), state: form.state.trim(), pincode: form.pincode.trim(),
        },
        message: form.message.trim() || undefined,
      });
      const id = String(res?.orderId || '');
      if (!id) throw new Error('The donation order could not be identified. Please try again.');
      currentOrderId.current = id;
      await setPendingPayment({ orderId: id, orderType: 'donation', paymentUrl: res.paymentUrl, amount: res.amount }, owner);
      if (!mounted.current) return;
      setOrderId(id);
      setPending({ orderId: id, orderType: 'donation', paymentUrl: res.paymentUrl, amount: res.amount });
      if (res?.paymentUrl) {
        if (!/^https:\/\//i.test(res.paymentUrl)) throw new Error('The secure donation page is unavailable. Check this order before trying again.');
        setPayUrl(String(res.paymentUrl));
        setBrowserMode(!WebViewComp);
        if (!WebViewComp) {
          try { await Linking.openURL(String(res.paymentUrl)); } catch { /* the button retries */ }
        }
        return;
      }
      if (res?.mock && id) {
        await mockCompleteDonation(id);
        if (mounted.current) goResult();
        return;
      }
      setFormError('The payment could not be started. Please try again.');
    } catch (err) {
      if (mounted.current) setFormError(errorText(err, 'The donation could not be started. Please try again.'));
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const cancelPayment = useCallback(() => {
    Alert.alert('Leave the payment?', 'Check this donation before leaving. Your receipt is available once payment is confirmed.', [
      { text: 'Stay', style: 'cancel' },
      { text: orderId ? 'Check status' : 'Leave', onPress: () => (orderId ? goResult() : setPayUrl('')) },
    ]);
    return true;
  }, [orderId, goResult]);

  useEffect(() => {
    if (!payUrl) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', cancelPayment);
    return () => sub.remove();
  }, [payUrl, cancelPayment]);

  const openBrowser = async () => {
    if (!payUrl) return;
    setBrowserMode(true);
    try { await Linking.openURL(payUrl); }
    catch { Alert.alert('Could not open the browser', 'Retry the payment page or check this order status.'); }
  };

  usePaymentResumeCheck(!!orderId && !!payUrl, async () => {
    const found = await getDonationReturn(orderId);
    return found?.status === 'paid' || found?.status === 'failed';
  }, () => { if (navigation.isFocused?.() !== false) goResult(); });

  /* ---------------------------------------------------------------- gateway */
  if (payUrl && WebViewComp && !browserMode) {
    return (
      <WebCheckout
        WebViewComp={WebViewComp}
        url={payUrl}
        isReturn={parseDonationReturnUrl}
        onReturn={goResult}
        onClose={cancelPayment}
        onOpenBrowser={openBrowser}
        onError={() => setBrowserMode(true)}
        title="Secure donation"
      />
    );
  }

  if (payUrl && (browserMode || !WebViewComp)) {
    return (
      <PremiumPage
        header={(
          <PremiumPageHeader
            onBack={cancelPayment}
            eyebrow="Secure payment"
            title="Finish paying in your browser"
            subtitle="Complete the payment on Instamojo, then come back here and check the status."
            art={<SecureCard3D size={88} />}
          />
        )}
        footer={(
          <BottomActionBar>
            <View style={s.stack}>
              <GradientButton label="Open payment page" icon="open-in-new" onPress={openBrowser} />
              <GradientButton label="I have paid — check status" icon="fact-check" variant="outline" onPress={() => goResult()} disabled={!orderId} />
            </View>
          </BottomActionBar>
        )}
      />
    );
  }

  /* ---------------------------------------------------------------- form */
  const amountOk = amount >= MIN && amount <= MAX;
  return (
    <PremiumPage
      header={(
        <PremiumPageHeader
          onBack={() => navigation.goBack()}
          right={<GlassIconButton icon="receipt-long" onPress={() => navigation.navigate('MemberDonations')} accessibilityLabel="My donations and 80G receipts" />}
          eyebrow="Support ACTIV · 80G"
          title="Give with a tax benefit"
          subtitle="Your gift helps SC/ST entrepreneurs start, grow and be heard — with an 80G receipt for every donation."
          art={<DonateHeart3D size={92} />}
          artSize={92}
          artLabel="A heart held in cupped hands"
        >
          <HeaderStatRow>
            <HeaderStat icon="favorite" value={amount ? inr(amount) : '—'} label="Your gift" />
            <HeaderStat icon="verified" value="80G" label="Tax receipt" />
          </HeaderStatRow>
        </PremiumPageHeader>
      )}
      footer={(
        <BottomActionBar note="The amount is checked by ACTIV's server before any payment is taken.">
          <GradientButton label={pending ? 'Check previous donation' : amount ? `Donate ${inr(amount)}` : 'Donate'} icon={pending ? 'fact-check' : 'favorite'} onPress={submit} loading={busy} style={s.flex} />
        </BottomActionBar>
      )}
    >
      <Overlap>
        {pending ? <SurfaceCard style={s.gutter}>
          <GroupTitle title="Your previous donation" subtitle="Check its status before making another payment." />
          <GradientButton label="Check donation status" icon="fact-check" onPress={() => goResult()} />
          {pending.paymentUrl && /^https:\/\//i.test(pending.paymentUrl) ? <GradientButton label="Continue the same payment" variant="outline" onPress={() => { setPayUrl(pending.paymentUrl || ''); setBrowserMode(!WebViewComp); }} style={{ marginTop: SPACE.sm }} /> : null}
        </SurfaceCard> : null}
        <PremiumSection icon="volunteer-activism" title="Choose an amount" subtitle={`Any amount from ${inr(MIN)}`}>
          <View style={s.presets} accessibilityRole="radiogroup">
            {PRESETS.map((n) => {
              const on = !custom && preset === n;
              const body = (
                <>
                  <Icon name={on ? 'favorite' : 'favorite-border'} size={14} color={on ? PALETTE.white : '#E11D48'} />
                  <Text style={[s.presetText, on && { color: PALETTE.white }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>{inr(n)}</Text>
                </>
              );
              return (
                <PressableScale
                  key={n}
                  onPress={() => { setPreset(n); setCustom(''); setErrors((e) => ({ ...e, amount: undefined })); }}
                  style={s.presetCell}
                  scaleTo={0.94}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={inr(n)}
                >
                  {on ? (
                    <LinearGradient colors={[BRAND.blue900, BRAND.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.preset, s.presetOn]}>{body}</LinearGradient>
                  ) : <View style={s.preset}>{body}</View>}
                </PressableScale>
              );
            })}
          </View>
          <PremiumInput
            label="Or another amount"
            placeholder="Other amount"
            value={custom}
            onChangeText={(v) => { setCustom(String(v || '').replace(/\D/g, '').slice(0, 7)); setErrors((e) => ({ ...e, amount: undefined })); }}
            keyboardType="number-pad"
            icon="currency-rupee"
            error={errors.amount}
            hint={amountOk ? `You give ${inr(amount)} — and receive an 80G receipt for it.` : undefined}
            style={s.lastField}
          />
        </PremiumSection>
      </Overlap>

      {restored ? (
        <FadeInUp delay={260}>
          <Notice
            kind="info"
            icon="waving-hand"
            style={s.notice}
            text={`Welcome back${form.fullName ? `, ${form.fullName}` : ''} — your details are filled in from last time.`}
            action="Not you? Clear my details"
            onAction={forgetMe}
          />
        </FadeInUp>
      ) : null}

      <FadeInUp delay={300}>
        <PremiumSection icon="how-to-reg" title="I am donating as" subtitle="Printed on your receipt">
          <View style={s.types} accessibilityRole="radiogroup">
            {([['individual', 'An individual', 'person-outline'], ['organisation', 'An organisation', 'business']] as [DonorType, string, string][]).map(([key, label, icon]) => {
              const on = donorType === key;
              return (
                <PressableScale
                  key={key}
                  onPress={() => setDonorType(key)}
                  style={s.typeCell}
                  scaleTo={0.96}
                  contentStyle={[s.type, on && s.typeOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                >
                  <View style={[s.radio, on && s.radioOn]}>{on ? <Icon name="check" size={12} color={PALETTE.white} /> : null}</View>
                  <Icon name={icon} size={24} color={on ? PALETTE.blue : PALETTE.textMuted} />
                  <Text style={[s.typeText, on && { color: BRAND.navy }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>{label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </PremiumSection>
      </FadeInUp>

      <FadeInUp delay={340}>
        <PremiumSection icon="badge" title="Your details" subtitle="For your receipt and 80G certificate">
          <PremiumInput label={donorType === 'organisation' ? 'Organisation name' : 'Full name'} required icon={donorType === 'organisation' ? 'business' : 'person-outline'} value={form.fullName} onChangeText={set('fullName')} error={errors.fullName} hint="As it should appear on your receipt" autoCapitalize="words" />
          <PremiumInput label="Email" required icon="mail-outline" value={form.email} onChangeText={set('email')} error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} hint="Your receipts are sent here" />
          <PremiumInput label="Mobile number" required icon="phone" prefix="+91" value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" />
          <PremiumInput label="PAN (optional)" icon="credit-card" value={form.pan} onChangeText={set('pan')} error={errors.pan} autoCapitalize="characters" placeholder="ABCDE1234F" hint="Needed to claim the 80G deduction" />
          <PremiumInput label="Address" required icon="home" value={form.line1} onChangeText={set('line1')} error={errors.line1} placeholder="Door no., street, area" />
          <PremiumInput label="City / town" required icon="location-city" value={form.city} onChangeText={set('city')} error={errors.city} />
          <PremiumInput label="District (optional)" icon="map" value={form.district} onChangeText={set('district')} />
          <PremiumInput label="State" required icon="public" value={form.state} onChangeText={set('state')} error={errors.state} />
          <PremiumInput label="PIN code" required icon="markunread-mailbox" value={form.pincode} onChangeText={(v) => set('pincode')(String(v || '').replace(/\D/g, '').slice(0, 6))} error={errors.pincode} keyboardType="number-pad" />
          <PremiumInput label="Message (optional)" icon="edit-note" value={form.message} onChangeText={set('message')} multiline numberOfLines={3} placeholder="A note to the association, or what you would like your gift to support" style={s.lastField} />
        </PremiumSection>
      </FadeInUp>

      {formError ? <Notice kind="danger" style={s.notice} text={formError} /> : null}

      <GroupTitle title="What you receive" style={{ marginTop: SPACE.xs }} />
      <SurfaceCard style={s.gutter} padded={false}>
        {[
          ['receipt-long', 'A receipt for every gift', 'An 80G receipt by email the moment each payment goes through.', 'green'],
          ['date-range', 'One certificate for the year', 'All your gifts from April to March, added up into one consolidated 80G certificate.', 'sky'],
          ['verified-user', 'Registered under 80G', "ACTIV's PAN and 80G registration are printed on every document.", 'gold'],
        ].map(([icon, title, body, tone], i, arr) => (
          <LinkRow key={title} icon={icon} tone={tone as any} title={title} subtitle={body} last={i === arr.length - 1} />
        ))}
      </SurfaceCard>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { marginHorizontal: SPACE.lg },
  notice: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  lastField: { marginBottom: 0 },
  stack: { flex: 1, gap: SPACE.sm },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.lg },
  presetCell: { width: '31%', flexGrow: 1 },
  preset: {
    minHeight: 52, borderRadius: 16, borderWidth: 1.5, borderColor: PALETTE.border, backgroundColor: PALETTE.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: SPACE.xs,
  },
  presetOn: { borderColor: 'transparent', shadowColor: PALETTE.blue, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  presetText: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'], flexShrink: 1 },
  types: { flexDirection: 'row', gap: SPACE.sm },
  typeCell: { flex: 1, minWidth: 0 },
  type: {
    alignItems: 'center', gap: SPACE.xs + 2, paddingVertical: SPACE.md, paddingHorizontal: SPACE.sm,
    borderRadius: 18, borderWidth: 1.5, borderColor: PALETTE.border, backgroundColor: PALETTE.white,
  },
  typeOn: { borderColor: PALETTE.blue, backgroundColor: PALETTE.blueTint },
  typeText: { ...TYPE.bodyStrong, color: PALETTE.textSoft, textAlign: 'center' },
  radio: {
    position: 'absolute', top: SPACE.sm, right: SPACE.sm, width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.white,
  },
  radioOn: { borderColor: PALETTE.blue, backgroundColor: PALETTE.blue },
});

export default DonateScreen;
