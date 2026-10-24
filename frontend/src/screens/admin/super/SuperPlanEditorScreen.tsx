import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleCard, BottomActionBar, ConsoleButton, ConsoleNote, ConsoleSectionTitle, GlassIconButton, PremiumInput,
} from '../../../ui';
import { createMembershipPlan, updateMembershipPlan, MembershipPlanRow, PlanAudience, errorText } from '../../../services/superApi';
import { ChipRow, ToggleRow } from './superKit';
import { bandLabel, yearWindowLabel, yearsFromStart } from './membershipBands';

/**
 * ============================================================================
 * SUPER ADMIN — create / edit one membership plan (website Membership editor)
 * ============================================================================
 *
 * Same payload as the website (its BLANK form: key, name, description, price,
 * audience, minYears, maxYears, features, popular, active, order): price in
 * RUPEES (membershipplan.service converts to paise), features one per line
 * (split here so an empty line never becomes a bullet), the band
 * [minYears, maxYears) with a blank "to" = the open-ended top band (null, not a
 * sentinel). The key is set once, on create — it is what paid memberships
 * point at. "Offered to applicants" off = retire (isActive false), never delete.
 */

const AUDIENCE_HINT: Record<PlanAudience, string> = {
  business: 'A company — priced by years trading.',
  aspirant: 'An aspirant — no company.',
  student: 'A student — no company.',
  platinum: 'Lifetime — lifetime, granted by Super Admin (not paid online).',
};

const AUDIENCES: { value: PlanAudience; label: string }[] = [
  { value: 'business', label: 'A company' },
  { value: 'aspirant', label: 'An aspirant' },
  { value: 'student', label: 'A student' },
  { value: 'platinum', label: 'Lifetime' },
];

const num = (v: string) => (String(v || '').trim() === '' ? NaN : Number(v));

const SuperPlanEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const existing: MembershipPlanRow | undefined = route?.params?.plan || undefined;
  const editingKey: string = String(route?.params?.planKey || '');
  const creating = !editingKey;

  const [key, setKey] = useState(String(existing?.key || ''));
  const [name, setName] = useState(String(existing?.name || ''));
  const [description, setDescription] = useState(String(existing?.description || ''));
  const [price, setPrice] = useState(existing && existing?.price !== null && existing?.price !== undefined ? String(existing.price) : '');
  const [audience, setAudience] = useState<PlanAudience>((existing?.audience as PlanAudience) || 'business');
  const [minYears, setMinYears] = useState(existing ? String(existing?.minYears ?? 0) : '0');
  const [maxYears, setMaxYears] = useState(existing && existing?.maxYears !== null && existing?.maxYears !== undefined ? String(existing.maxYears) : '');
  const [features, setFeatures] = useState((Array.isArray(existing?.features) ? existing?.features || [] : []).join('\n'));
  const [order, setOrder] = useState(existing ? String(existing?.order ?? 0) : '0');
  const [popular, setPopular] = useState(!!existing?.popular);
  const [active, setActive] = useState(existing ? existing?.active !== false : true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Read once per render so the two dials on the band agree.
  const thisYear = new Date().getFullYear();
  const minN = Number.isFinite(num(minYears)) ? num(minYears) : 0;
  const maxN = (maxYears || '').trim() === '' ? null : num(maxYears);
  const bandNow = { audience, minYears: minN, maxYears: maxN !== null && Number.isFinite(maxN) ? maxN : null };

  const save = async () => {
    const e: Record<string, string> = {};
    if (creating && !/^[a-z0-9][a-z0-9-]*$/.test((key || '').trim())) e.key = 'Lower-case letters, numbers and dashes, e.g. growth-member';
    if (!(name || '').trim()) e.name = 'Give the plan a name';
    const rupees = num(price);
    if (!Number.isFinite(rupees) || rupees < 0) e.price = 'Enter the price in rupees';
    const min = num(minYears);
    const max = (maxYears || '').trim() === '' ? null : num(maxYears);
    if (audience === 'business') {
      if (!Number.isFinite(min) || min < 0) e.minYears = 'From 0 years or more';
      if (max !== null && (!Number.isFinite(max) || max <= (Number.isFinite(min) ? min : 0))) e.maxYears = 'Must be more than "from", or blank for no upper limit';
    }
    setErrors(e);
    if (Object.keys(e).length) {
      Alert.alert('Check the plan', Object.values(e)[0] || 'Some fields need attention.');
      return;
    }

    const payload: Partial<MembershipPlanRow> = {
      ...(creating ? { key: (key || '').trim() } : {}),
      name: (name || '').trim(),
      description: (description || '').trim(),
      price: rupees,
      audience,
      minYears: Number.isFinite(min) ? min : 0,
      maxYears: max,
      features: String(features || '').split('\n').map((x) => x.trim()).filter(Boolean),
      popular,
      active,
      order: Number.isFinite(num(order)) ? num(order) : 0,
    };
    setSaving(true);
    try {
      if (creating) await createMembershipPlan(payload);
      else await updateMembershipPlan(editingKey, payload);
      Alert.alert('Saved', creating ? 'Plan created' : 'Plan updated — applicants see the new price now');
      navigation?.goBack?.();
    } catch (err) {
      Alert.alert('Could not save this plan', errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <BottomActionBar>
      <ConsoleButton icon="check" label={creating ? 'Create plan' : 'Save — applicants see it immediately'} onPress={save} loading={saving} style={s.flex} />
    </BottomActionBar>
  );

  return (
    <ConsoleScroll avoidKeyboard footer={footer}>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · membership"
        title={creating ? 'New plan' : 'Edit plan'}
        subtitle={creating ? 'A price and who earns it' : String(existing?.name || editingKey)}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
      />
      <ConsoleNote style={s.note} icon="payments" text="What an applicant is charged is exactly this price — checkout reads the same row. Changes apply to the next payment." />

      <ConsoleSectionTitle title="The plan" icon="workspace-premium" style={s.section} />
      <ConsoleCard style={s.card}>
        {creating ? (
          <PremiumInput tone="admin" label="Key" value={key} onChangeText={(t) => setKey((t || '').toLowerCase())} placeholder="growth-member"
            autoCapitalize="none" autoCorrect={false} error={errors.key} hint="Set once. Payments refer to the plan by this." />
        ) : null}
        <PremiumInput tone="admin" label="Name" value={name} onChangeText={setName} placeholder="Growth Member" error={errors.name} />
        <PremiumInput tone="admin" label="Short description" value={description} onChangeText={setDescription} multiline placeholder="Who it is for" />
        <PremiumInput tone="admin" label="Price (₹)" value={price} onChangeText={(t) => setPrice((t || '').replace(/[^\d.]/g, ''))} keyboardType="numeric" placeholder="Amount in rupees" error={errors.price} icon="currency-rupee" />
      </ConsoleCard>

      <ConsoleSectionTitle title="Who it is for" icon="groups" style={s.section} />
      <ConsoleCard style={s.card}>
        <View style={s.bleed}>
          <ChipRow<PlanAudience> options={AUDIENCES} value={audience} onChange={setAudience} />
        </View>
        <Text style={[s.hint, s.hintTop]} maxFontSizeMultiplier={1.3}>{AUDIENCE_HINT[audience]}</Text>
        {audience === 'business' ? (
          <View style={s.bandWrap}>
            <Text style={s.hint} maxFontSizeMultiplier={1.3}>Years since the business started. The band includes "from" and stops just before "to" — a company at exactly 5 years belongs to the band that starts at 5.</Text>
            <View style={s.twoCol}>
              <View style={s.col}>
                <PremiumInput tone="admin" label="From (years)" value={minYears} onChangeText={(t) => setMinYears((t || '').replace(/\D/g, ''))} keyboardType="numeric" error={errors.minYears} />
              </View>
              <View style={s.col}>
                <PremiumInput tone="admin" label="To (years)" value={maxYears} onChangeText={(t) => setMaxYears((t || '').replace(/\D/g, ''))} keyboardType="numeric" placeholder="No limit" error={errors.maxYears} hint="Exclusive; blank = open-ended" />
              </View>
            </View>
            <View style={s.yearBox}>
              <Text style={s.yearTitle} maxFontSizeMultiplier={1.3}>Or set it by commencement year</Text>
              <Text style={s.yearHint} maxFontSizeMultiplier={1.3}>Which years a company can have started in to earn this plan. Stored as a duration, so this window moves forward every January and a company rises to the next plan as it matures.</Text>
              <View style={s.twoCol}>
                <View style={s.col}>
                  <PremiumInput tone="admin" label="Started in or after" hint="The oldest company in this band."
                    value={maxN === null || !Number.isFinite(maxN) ? '' : String(thisYear - maxN + 1)} placeholder="No limit" keyboardType="number-pad"
                    onChangeText={(t) => {
                      const v = (t || '').replace(/\D/g, '').slice(0, 4);
                      // Inverse of the year window. Blank = the band reaches back for ever (maxYears null).
                      setMaxYears(v === '' ? '' : String(yearsFromStart(Number(v), thisYear) + 1));
                    }} />
                </View>
                <View style={s.col}>
                  <PremiumInput tone="admin" label="Started in or before" hint="The newest company in this band."
                    value={String(thisYear - minN)} keyboardType="number-pad"
                    onChangeText={(t) => {
                      const v = (t || '').replace(/\D/g, '').slice(0, 4);
                      setMinYears(v === '' ? '0' : String(yearsFromStart(Number(v), thisYear)));
                    }} />
                </View>
              </View>
              <Text style={s.yearNow} maxFontSizeMultiplier={1.3}>Right now: <Text style={s.bold}>{yearWindowLabel(bandNow, thisYear)}</Text> · {bandLabel(bandNow)}</Text>
            </View>
          </View>
        ) : audience === 'platinum' ? (
          <Text style={[s.hint, s.hintTop]} maxFontSizeMultiplier={1.3}>Lifetime is granted by the Super Admin after an office payment. It is never offered to applicants to buy online.</Text>
        ) : null}
      </ConsoleCard>

      <ConsoleSectionTitle title="What members get" icon="checklist" style={s.section} />
      <ConsoleCard style={s.card}>
        <PremiumInput tone="admin" label="Benefits (one per line)" value={features} onChangeText={setFeatures} multiline placeholder={'ACTIV Network\nEvents at member rates'} />
        <PremiumInput tone="admin" label="Display order" value={order} onChangeText={(t) => setOrder((t || '').replace(/[^\d-]/g, ''))} keyboardType="numeric" />
        <ToggleRow label="Mark as popular" value={popular} onChange={setPopular} />
        <ToggleRow label="Offered to applicants" hint="Off retires the plan: it is hidden from applicants and payment, but paid memberships keep it." value={active} onChange={setActive} last />
      </ConsoleCard>
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  note: { marginHorizontal: SPACE.lg, marginTop: -SPACE.sm },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg },
  bleed: { marginHorizontal: -SPACE.lg, marginTop: -SPACE.sm },
  hint: { ...TYPE.caption, lineHeight: 17, marginBottom: SPACE.sm },
  hintTop: { marginTop: SPACE.sm },
  bandWrap: { marginTop: SPACE.md },
  twoCol: { flexDirection: 'row', gap: SPACE.md },
  col: { flex: 1, minWidth: 0 },
  yearBox: { backgroundColor: PALETTE.indigoSoft, borderRadius: 14, padding: SPACE.md, marginTop: SPACE.sm },
  yearTitle: { fontSize: 13, fontWeight: '800', color: PALETTE.indigoDark },
  yearHint: { fontSize: 12, color: PALETTE.indigoDark, opacity: 0.85, lineHeight: 17, marginTop: 2, marginBottom: SPACE.sm },
  yearNow: { fontSize: 12, color: PALETTE.indigoDark, marginTop: SPACE.xs },
  bold: { fontWeight: '800' },
  flex: { flex: 1 },
});

export default SuperPlanEditorScreen;
