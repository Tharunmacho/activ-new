import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE, money,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, ConsoleNote, ConsoleSectionTitle, GlassIconButton, GradientAvatar,
  PremiumInput, BottomActionBar,
} from '../../../ui';
import { grantPlatinum, getPlatinumOverview, updatePlatinumAccount, PlatinumPaymentMode, PAYMENT_MODE_LABEL, errorText } from '../../../services/superApi';
import { ChipRow, ToggleRow, place } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — grant Platinum to one member (website PlatinumMembers → Grant)
 * ============================================================================
 *
 * POST /admin/super/membership/platinum/:memberId
 *   { amount, paymentMode, receiptNumber?, receivedOn?, note? } — the website's
 * body. The office receipt becomes a paid `provider: 'offline'` payment order
 * (so 80G and reports see it), and the member becomes lifetime Platinum with
 * no expiry. `platinumGrant.previous` on the server is what lets "Undo" restore
 * them exactly. The amount is PRE-FILLED from the Platinum plan row (never a
 * number in this client) and stays editable: the office records what it got.
 */

const MODES = (Object.keys(PAYMENT_MODE_LABEL) as PlatinumPaymentMode[]).map((k) => ({ value: k, label: PAYMENT_MODE_LABEL[k] }));

const todayIso = () => new Date().toISOString().slice(0, 10);

function Detail({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const v = String(value || '').trim();
  if (!v) return null;
  return (
    <View style={[s.detail, !last && s.divider]}>
      <Text style={s.detailLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={s.detailValue} selectable maxFontSizeMultiplier={1.3}>{v}</Text>
    </View>
  );
}

const SuperPlatinumGrantScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [m, setMember] = useState(route?.params?.member || {});
  const accountOnly = m?.membershipTier === 'platinum';
  const [editing, setEditing] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [account, setAccount] = useState({ email: m.email || '', phoneNumber: m.phoneNumber || '', whatsappNumber: m.whatsappNumber || m.phoneNumber || '', password: '' });
  const saveAccount = async () => {
    setAccountBusy(true); setError('');
    try {
      const updated = await updatePlatinumAccount(String(m.id || ''), { ...account, password: account.password || undefined });
      if (!updated?.id) throw new Error('Account update could not be confirmed.');
      setMember(updated); setAccount(a => ({ ...a, password: '' })); setEditing(false);
      Alert.alert('Account saved', 'Use the saved email and password to sign in.');
    } catch (err) { setError(errorText(err)); }
    finally { setAccountBusy(false); }
  };
  const passedPrice = Number(route?.params?.price);

  const [price, setPrice] = useState<number | null>(Number.isFinite(passedPrice) && passedPrice > 0 ? passedPrice : null);
  const [amount, setAmount] = useState(Number.isFinite(passedPrice) && passedPrice > 0 ? String(passedPrice) : '');
  const [mode, setMode] = useState<PlatinumPaymentMode>('cash');
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [receivedOn, setReceivedOn] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill the Platinum price the Super Admin set (editable: the office
  // records what was actually received).
  useEffect(() => {
    let alive = true;
    getPlatinumOverview().then((o) => {
      const p = Number(o?.plan?.price);
      if (alive && Number.isFinite(p) && p > 0) {
        setPrice(p);
        setAmount((a) => a || String(p));
      }
    }).catch(() => null);
    return () => { alive = false; };
  }, []);

  const memberId = String(m?.id || '');

  const save = async () => {
    if (!memberId) { setError('This member record could not be identified. Go back and search again.'); return; }
    const rupees = Number(amount);
    if ((amount || '').trim() === '' || !Number.isFinite(rupees) || rupees <= 0) { setError('Enter the positive amount received'); return; }
    if (m?.blockedReason) { setError(m.blockedReason); return; }
    if (price !== null && rupees !== price && !note.trim()) { setError('Explain the difference from the Lifetime fee.'); return; }
    const day = (receivedOn || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(day).getTime())) { setError('Received on must be a date like 2026-09-29.'); return; }
    if (day > todayIso()) { setError('Received on cannot be in the future.'); return; }
    if (!confirmed) { setError('Tick the box to confirm the payment was received'); return; }
    setError('');
    setSaving(true);
    try {
      await grantPlatinum(memberId, {
        amount: rupees,
        paymentMode: mode,
        receiptNumber: (receipt || '').trim() || undefined,
        receivedOn: day,
        note: (note || '').trim() || undefined,
      });
      Alert.alert('Lifetime granted', `${m?.fullName || 'The member'} is now a Lifetime Member.`);
      navigation?.goBack?.();
    } catch (err) {
      Alert.alert('Could not grant Lifetime', errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const where = [m?.membershipNumber, place(m?.block, m?.district, m?.state)].filter(Boolean).join(' · ');

  return (
    <ConsoleScroll
      avoidKeyboard
      footer={accountOnly ? undefined : (
        <BottomActionBar>
          <ConsoleButton icon="diamond" label="Grant Lifetime" onPress={save} loading={saving} disabled={!confirmed || !!m?.blockedReason} style={s.flex} />
        </BottomActionBar>
      )}
    >
      <ConsoleHeader
        compact
        eyebrow="Super Admin · Lifetime"
        title={accountOnly ? 'Lifetime member account' : 'Grant Lifetime Membership'}
        subtitle="Lifetime · paid at the office"
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
      />

      <ConsoleCard style={[s.card, s.overlap]} accent={PALETTE.gold}>
        <View style={s.row}>
          <GradientAvatar name={m?.fullName || '?'} size={52} tone="admin" />
          <View style={s.flexText}>
            <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{m?.fullName || 'Member'}</Text>
            {where ? <Text style={s.sub} numberOfLines={2} maxFontSizeMultiplier={1.3}>{where}</Text> : null}
          </View>
        </View>
        <Detail label="Email" value={m?.email} />
        <Detail label="Phone" value={m?.phoneNumber} />
        <ConsoleButton label="Edit login and contact details" onPress={() => setEditing(!editing)} />
        {editing && <View>
          <ConsoleNote text="Leave the new password blank to keep the current password." />
          {(['email', 'phoneNumber', 'whatsappNumber', 'password'] as const).map(key => <PremiumInput key={key} tone="admin" label={{ email: 'Login email', phoneNumber: 'Mobile number', whatsappNumber: 'WhatsApp number', password: 'New password' }[key]} value={account[key]} onChangeText={value => setAccount(a => ({ ...a, [key]: value }))} autoCapitalize="none" secureTextEntry={key === 'password'} keyboardType={key === 'email' ? 'email-address' : key === 'password' ? 'default' : 'phone-pad'} />)}
          <ConsoleButton label="Save account details" loading={accountBusy} disabled={accountBusy} onPress={saveAccount} />
        </View>}
        <Detail label="Current membership" value={[m?.membershipStatus, m?.membershipType].filter(Boolean).join(' · ') || m?.applicationOutcome} last />
      </ConsoleCard>

      {!accountOnly && <><ConsoleSectionTitle title="The office receipt" icon="receipt-long" style={s.section} />
      <ConsoleCard style={s.card}>
        {m?.blockedReason ? <ConsoleNote kind="red" text={m.blockedReason} /> : <ConsoleNote text="First-time members must complete and submit all required forms and receive approval before Lifetime can be granted." />}
        <PremiumInput tone="admin" label="Amount received (₹)" value={amount} onChangeText={(t) => setAmount((t || '').replace(/[^\d.]/g, ''))} keyboardType="numeric" icon="currency-rupee" />
        <Text style={s.label} maxFontSizeMultiplier={1.3}>Paid by</Text>
        <View style={s.bleed}>
          <ChipRow<PlatinumPaymentMode> options={MODES} value={mode} onChange={setMode} />
        </View>
        <PremiumInput tone="admin" label="Receipt / cheque / UTR no." value={receipt} onChangeText={setReceipt} placeholder="Optional" autoCapitalize="characters" />
        <PremiumInput tone="admin" label="Received on" value={receivedOn} onChangeText={setReceivedOn} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" icon="event" />
        <PremiumInput tone="admin" label="Note" value={note} onChangeText={setNote} multiline placeholder="Optional — e.g. received at the Chennai office" />
        {price !== null && amount !== '' && Number(amount) !== Number(price) ? (
          <Text style={s.warn} maxFontSizeMultiplier={1.3}>This differs from the Lifetime price of {money(price)}. That is allowed — the amount received is what is recorded.</Text>
        ) : null}
        <View style={s.bleedToggle}>
          <ToggleRow
            label={`I confirm ${money(Number(amount) || 0)} has been received from ${m?.fullName || 'this member'}`}
            hint="Their membership becomes lifetime and never needs renewing."
            value={confirmed}
            onChange={setConfirmed}
            last
          />
        </View>
      </ConsoleCard></>}

      {error ? <ConsoleNote kind="red" icon="error-outline" text={error} style={s.note} /> : null}
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  overlap: { marginTop: -SPACE.lg },
  card: { marginHorizontal: SPACE.lg },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.sm },
  flexText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.heading, fontSize: 18 },
  sub: { ...TYPE.caption, marginTop: 2 },
  detail: { paddingVertical: SPACE.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  detailLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, lineHeight: 20, color: PALETTE.text, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '700', color: PALETTE.textSoft, marginBottom: 2 },
  bleed: { marginHorizontal: -SPACE.lg, marginTop: -SPACE.xs, marginBottom: SPACE.md },
  bleedToggle: { marginTop: SPACE.sm },
  warn: { fontSize: 12, color: PALETTE.amberDark, lineHeight: 17, marginTop: SPACE.sm },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
});

export default SuperPlatinumGrantScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
