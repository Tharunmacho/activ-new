import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE, shortDate, money,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleButton, ConsoleNote, ConsoleSectionTitle,
  ConsoleSkeleton, ConsoleState, GlassIconButton, GradientAvatar, PremiumInput, type ConsoleChipKind,
} from '../../../ui';
import { getPlatinumRequestDetail, updatePlatinumRequest, PlatinumRequestStatus, errorText } from '../../../services/superApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { MiniAction, confirm, place, callNumber, whatsappNumber, openUrl } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — one Platinum request (website PlatinumMembers request row +
 * PlatinumRequestDetails)
 * ============================================================================
 *
 * GET  /admin/super/membership/platinum/requests/:id — everything the member
 *      filled in (personal, membership & application, business, declaration,
 *      earlier requests), read-only, for the office calling them back.
 * PATCH …/requests/:id { status, notes } — contacted / declined (the decline
 *      reason is the note, as on the website). Granting goes through the normal
 *      grant, which marks the request `converted` itself.
 */

const words = (v?: string | null) => String(v || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const yesNo = (v?: boolean) => (v ? 'Yes' : 'No');
const join = (v: any) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : String(v || ''));
const CONTACT_LABEL: Record<string, string> = { call: 'a phone call', whatsapp: 'WhatsApp', email: 'email' };
const STATUS_WORD: Record<string, string> = { new: 'New', contacted: 'Contacted', converted: 'Lifetime granted', declined: 'Declined' };
const statusKind = (st?: string): ConsoleChipKind => (st === 'converted' ? 'approved' : st === 'declined' ? 'rejected' : 'pending');

/** Absent values are left out rather than printed as dashes (website `Row`). */
function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={s.detail}>
      <Text style={s.detailLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={s.detailValue} selectable maxFontSizeMultiplier={1.3}>{String(value)}</Text>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <>
      <ConsoleSectionTitle title={title} icon={icon} style={s.section} />
      <ConsoleCard style={s.card}>{children}</ConsoleCard>
    </>
  );
}

const SuperPlatinumRequestScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = String(route?.params?.id || '');
  const blockedReason: string = String(route?.params?.blockedReason || '');

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    if (!id) { setLoading(false); setError('No request was chosen.'); return; }
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const d = await getPlatinumRequestDetail(id);
      setDetail(d || {});
      setNotes(String(d?.request?.notes || ''));
    } catch (err) { setError(errorText(err, 'Could not load the member’s details')); } finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(loadedOnce.current ? 'quiet' : 'load'); loadedOnce.current = true; }, [load]));

  const setStatus = async (status: PlatinumRequestStatus) => {
    if (status === 'declined' && !(await confirm('Decline this request?', 'The note above is kept as the reason, for your records. The member stays on their current membership.', 'Decline', true))) return;
    setBusy(true);
    try {
      await updatePlatinumRequest(id, { status, notes: (notes || '').trim() });
      Alert.alert('Updated', status === 'contacted' ? 'Marked as contacted' : status === 'declined' ? 'Request declined' : 'Updated');
      await load('quiet');
    } catch (err) { Alert.alert('Could not update the request', errorText(err)); } finally { setBusy(false); }
  };
  const saveNotes = async () => {
    setBusy(true);
    try { await updatePlatinumRequest(id, { notes: (notes || '').trim() }); Alert.alert('Saved', 'Notes saved.'); } catch (err) { Alert.alert('Could not update the request', errorText(err)); } finally { setBusy(false); }
  };
  /** Grant = the normal grant screen, for the member who asked (`request.memberId`). */
  const grant = () => {
    const r = detail?.request || {};
    const p = detail?.personal || {};
    const mem = detail?.membership || {};
    if (!r?.memberId) { Alert.alert('Not possible', 'This request is not linked to a member record.'); return; }
    navigation?.navigate?.('SuperPlatinumGrant', {
      member: {
        id: r.memberId, fullName: r?.name || p?.fullName, email: r?.email || p?.email, phoneNumber: r?.phone || p?.phoneNumber,
        block: p?.block, district: p?.district, state: p?.state, membershipNumber: mem?.memberNumber,
        membershipStatus: mem?.status, membershipType: mem?.type, blockedReason,
      },
    });
  };

  const r = detail?.request || {};
  const p = detail?.personal || {};
  const header = (
    <ConsoleHeader
      compact
      eyebrow="Super Admin · wants Lifetime"
      title={r?.name || p?.fullName || 'Lifetime request'}
      subtitle={detail ? `Prefers ${CONTACT_LABEL[String(r?.preferredContact || '')] || 'a phone call'}${r?.preferredTime ? ` · ${r.preferredTime}` : ''}${r?.createdAt ? ` · asked ${shortDate(r.createdAt)}` : ''}` : 'Loading the member’s details…'}
      left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
    />
  );

  if (loading && !detail) return <ConsoleScroll>{header}<ConsoleSkeleton rows={3} /></ConsoleScroll>;
  if (error && !detail) {
    return <ConsoleScroll>{header}<ConsoleState kind="error" title="Could not load this request" message={error} action="Try again" onAction={() => load('load')} /></ConsoleScroll>;
  }

  const mem = detail?.membership || {};
  const biz = detail?.business || null;
  const decl = detail?.declaration || null;
  const app = detail?.application || null;
  const open = r?.status === 'new' || r?.status === 'contacted';
  const photo = p?.profilePhoto ? resolveMediaUrl(p.profilePhoto) : '';
  const region = p?.isInternational ? place(p?.place, p?.country) : place(p?.block, p?.district, p?.state);
  const earlier: any[] = (Array.isArray(detail?.history) ? detail.history : []).filter((h: any) => h?.id !== r?.id);
  /** Sister concerns and company names are business answers only. */
  const trading = !!biz?.doingBusiness && !['aspirant', 'student'].includes(String(biz?.registrationType || mem?.memberType || '').toLowerCase());
  const lifetime = mem?.tier === 'platinum' || mem?.type === 'lifetime';
  const phone = r?.phone || p?.phoneNumber;
  const wa = p?.whatsappNumber || r?.phone;

  return (
    <ConsoleScroll avoidKeyboard refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}>
      {header}

      <ConsoleCard style={[s.card, s.overlap]} accent={open ? PALETTE.indigo : undefined}>
        <View style={s.row}>
          <GradientAvatar name={r?.name || p?.fullName || '?'} uri={photo} size={52} tone="admin" />
          <View style={s.flexText}>
            <ConsoleChip label={STATUS_WORD[String(r?.status || '')] || String(r?.status || 'New')} kind={statusKind(r?.status)} style={s.chip} />
            {r?.handledBy ? <Text style={s.sub} maxFontSizeMultiplier={1.3}>{r.handledBy} · {shortDate(r?.handledAt)}</Text> : null}
          </View>
        </View>
        <View style={s.actions}>
          <MiniAction icon="call" label={r?.phone || 'Call'} onPress={() => callNumber(phone)} disabled={!phone} />
          <MiniAction icon="chat" label="WhatsApp" color={PALETTE.green} onPress={() => whatsappNumber(wa, `Hello ${r?.name || ''}, this is the ACTIV office about your Lifetime Membership request.`)} disabled={!wa} />
          <MiniAction icon="email" label="Email" color={PALETTE.textSoft} onPress={() => openUrl(r?.email ? `mailto:${r.email}?subject=${encodeURIComponent('Your ACTIV Lifetime Membership request')}` : '')} disabled={!r?.email} />
        </View>
      </ConsoleCard>

      {r?.message ? (
        <Section title="Their message" icon="format-quote">
          <Text style={s.body} maxFontSizeMultiplier={1.3}>“{r.message}”</Text>
        </Section>
      ) : null}
      {open && blockedReason ? <ConsoleNote kind="amber" icon="warning-amber" text={blockedReason} style={s.note} /> : null}

      <Section title="Personal" icon="person">
        {photo ? <Image source={{ uri: photo }} style={s.photo} /> : null}
        <Row label="Full name" value={p?.fullName} />
        <Row label="Email" value={p?.email || r?.email} />
        <Row label="Mobile" value={p?.phoneNumber || r?.phone} />
        <Row label="WhatsApp" value={p?.whatsappNumber} />
        <Row label="Gender" value={words(p?.gender)} />
        <Row label="Social category" value={p?.socialCategory} />
        <Row label="Religion" value={p?.religion} />
        <Row label="Education" value={p?.educationalQualification} />
        <Row label={p?.isInternational ? 'Place' : 'Block · District · State'} value={region} />
        <Row label="City" value={p?.city} />
        <Row label="Registered on" value={shortDate(p?.registeredOn)} />
      </Section>

      <Section title="Membership & application" icon="badge">
        <Row label="Member ID" value={mem?.memberNumber} />
        <Row label="Member type" value={words(mem?.memberType)} />
        <Row label="Membership" value={`${words(mem?.status)}${mem?.type && mem.type !== 'none' ? ` · ${words(mem.type)}` : ''}${mem?.tier === 'platinum' ? ' · Lifetime' : ''}`} />
        <Row label="Member since" value={shortDate(mem?.activatedAt)} />
        <Row label="Valid until" value={lifetime ? 'Lifetime' : shortDate(mem?.expiresAt)} />
        <Row label="Last payment" value={mem?.lastPaymentAmount ? `${money(mem.lastPaymentAmount)}${mem?.lastPaymentDate ? ` · ${shortDate(mem.lastPaymentDate)}` : ''}` : ''} />
        {app ? (
          <>
            <Row label="Application" value={app?.reference} />
            <Row label="Application status" value={app?.status} />
            <Row label="Applied as" value={words(app?.memberType)} />
            <Row label="Submitted" value={shortDate(app?.submittedAt)} />
          </>
        ) : <Row label="Application" value="Not submitted yet" />}
      </Section>

      <Section title="Business" icon="business">
        {biz ? (
          <>
            <Row label="Doing business" value={yesNo(biz?.doingBusiness)} />
            <Row label="Registered as" value={words(biz?.registrationType)} />
            <Row label="Company" value={biz?.organizationName || r?.companyName} />
            <Row label="Constitution" value={biz?.constitutionType} />
            <Row label="Commencement year" value={biz?.commencementYear} />
            <Row label="Employees" value={biz?.numberOfEmployees ? String(biz.numberOfEmployees) : ''} />
            <Row label="Type of business" value={join(biz?.businessTypes)} />
            <Row label="Activities" value={join(biz?.businessActivities)} />
            <Row label="Other chamber" value={biz?.memberOfOtherChamber ? (biz?.otherChamber || 'Yes') : ''} />
            <Row label="Government registrations" value={join(biz?.govtOrganizations)} />
          </>
        ) : <Row label="Business details" value="Not filled in yet" />}
      </Section>

      <Section title="Declaration" icon="gavel">
        {decl ? (
          <>
            {trading ? <Row label="Sister concerns" value={String(decl?.sisterConcerns ?? '')} /> : null}
            <Row label="Declaration accepted" value={yesNo(decl?.agreed)} />
            {trading ? <Row label="Company names" value={join(decl?.companyNames)} /> : null}
          </>
        ) : <Row label="Declaration" value="Not filled in yet" />}
      </Section>

      {earlier.length ? (
        <Section title="Earlier Lifetime requests" icon="history">
          {earlier.map((h, i) => (
            <Row key={String(h?.id || i)} label={shortDate(h?.createdAt) || '—'} value={`${words(h?.status)}${h?.notes ? ` — ${h.notes}` : ''}`} />
          ))}
        </Section>
      ) : null}

      <Section title="Office notes" icon="edit-note">
        <PremiumInput tone="admin" value={notes} onChangeText={setNotes} multiline accessibilityLabel="Office notes"
          placeholder={open ? 'What was agreed on the call, or the reason if you decline (optional, for your records)' : 'Notes'} />
        <ConsoleButton kind="soft" size="sm" icon="save" label="Save notes" onPress={saveNotes} disabled={busy} />
      </Section>

      {open ? (
        <View style={s.decide}>
          <ConsoleButton icon="diamond" label="Grant Lifetime" onPress={grant} loading={busy} disabled={!!blockedReason} />
          {r?.status === 'new' ? <ConsoleButton kind="soft" icon="done" label="Mark contacted" onPress={() => setStatus('contacted')} disabled={busy} /> : null}
          <ConsoleButton kind="danger" icon="close" label="Decline" onPress={() => setStatus('declined')} disabled={busy} />
        </View>
      ) : null}
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  overlap: { marginTop: -SPACE.lg },
  card: { marginHorizontal: SPACE.lg },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  chip: { marginBottom: SPACE.xs },
  sub: { ...TYPE.caption },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  body: { fontSize: 14, color: PALETTE.textSoft, lineHeight: 21 },
  detail: { paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  detailLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, lineHeight: 20, color: PALETTE.text, marginTop: 2 },
  photo: { width: 80, height: 80, borderRadius: 14, marginBottom: SPACE.sm, backgroundColor: PALETTE.divider },
  decide: { paddingHorizontal: SPACE.lg, marginTop: SPACE.xl, gap: SPACE.md },
});

export default SuperPlatinumRequestScreen;
