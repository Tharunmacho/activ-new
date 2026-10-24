import { membershipValidityLabel } from '../../../utils/membershipDates';
import { saveSpreadsheetReport } from '../../../services/reportExport';
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, BackHandler, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleTabs, ConsoleSearch, ConsoleChip, ConsoleButton, ConsoleNote, ConsoleState, ConsoleSkeleton, GlassIconButton, PremiumInput, PremiumSelect, InfoRow, SPACE, TYPE, PALETTE, money, shortDate } from '../../../ui';
import { getMembershipRegistrations, exportMembershipReport, getMembershipRegistration, confirmMembershipRegistration, deleteMembershipRegistration, deleteArchivedMembershipPayment, errorText } from '../../../services/superApi';
import { ChipRow, ToggleRow, confirm } from './superKit';

const MODES = [{ value: 'waived', label: 'Fee waiver' }, { value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cheque', label: 'Cheque' }];
const display = (v: any) => String(v || '—').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const MEMBER_FILTERS = [
  ['all', 'All registrations'], ['registered', 'Application not submitted'], ['submitted', 'Applications submitted'],
  ['pending', 'Awaiting review'], ['awaiting_payment', 'Awaiting payment'], ['active', 'Active'],
  ['expired', 'Expired'], ['waived', 'Fee waived'], ['rejected', 'Rejected'], ['blocked', 'Blocked'],
];
const PAYMENT_FILTERS = [['all', 'All payments'], ['paid', 'Paid / confirmed'], ['created', 'Pending checkout'], ['waived', 'Fee waived'], ['failed', 'Failed'], ['cancelled', 'Cancelled']];
function Receipt({ p }: { p: any }) {
  return <View style={s.receipt}><Text style={s.title}>{p.planName} · {money(p.amount)}</Text><Text style={s.body}>{display(p.status)} · {display(p.mode)} · {shortDate(p.paidAt || p.createdAt)}</Text><Text selectable style={s.body}>Order: {p.orderId}</Text>{p.paymentId ? <Text selectable style={s.body}>Payment: {p.paymentId}</Text> : null}{p.manual ? <Text style={s.body}>Confirmed by {p.manual.byName} · {shortDate(p.manual.at)}{'\n'}{p.manual.note}{p.manual.waivedAmount > 0 ? `\nFee waived: ${money(p.manual.waivedAmount)}` : ''}</Text> : null}</View>;
}
export default function SuperMembershipRegistrationsScreen() {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'members' | 'payments' | 'archived'>('members');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any>(null);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState('');
  const deleteInFlight = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [planId, setPlanId] = useState('');
  const [mode, setMode] = useState('cash');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState('');
  const [membershipNumber, setMembershipNumber] = useState('');
  const [commencementYear, setCommencementYear] = useState('');
  const offeredPlans: any[] = detail?.confirmation?.plans || [];
  const selectedPlan = offeredPlans.find(p => p.id === planId);
  const [ack, setAck] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const detailId = useRef('');
  detailId.current = detail?.member?.id || '';
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await getMembershipRegistrations(); if (!result?.summary) throw new Error('Membership data is unavailable.'); setData(result); }
    catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    let current = true;
    void load();
    const id = detailId.current;
    if (id) getMembershipRegistration(id).then(result => {
      if (current && detailId.current === id && result?.member) setDetail(result);
    }).catch(err => { if (current) setError(errorText(err)); });
    return () => { current = false; };
  }, [load]));
  const removeArchivedPayment = async (payment: any) => {
    if (!payment?.registrationDeleted || !payment.id || deleteInFlight.current) return;
    deleteInFlight.current = true;
    try {
      if (!(await confirm('Delete archived payment permanently?', `${payment.name || payment.email || 'Deleted account'}\n${payment.planName || 'Membership payment'}\nOrder: ${payment.orderId || payment.id}\n\nOnly this payment record will be removed from the database and reports. This cannot be undone and does not refund any payment. Export a copy first if needed.`, 'Delete permanently', true))) return;
      setDeletingPayment(payment.id);
      await deleteArchivedMembershipPayment(payment.id);
      setData((current: any) => current ? { ...current, payments: (current.payments || []).filter((row: any) => row.id !== payment.id) } : current);
      await load();
      Alert.alert('Payment deleted', 'The archived payment was permanently removed.');
    } catch (err) { Alert.alert('Could not delete archived payment', errorText(err)); }
    finally { deleteInFlight.current = false; setDeletingPayment(''); }
  };
  const open = async (id: string) => {
    if (!id || opening || saving) return;
    setOpening(true); setError(''); setAck(false); setShowConfirm(false); setPlanId(''); setMode('cash'); setAmount(''); setNote(''); setReceipt(''); setMembershipNumber('');
    setCommencementYear('');
    try { const result = await getMembershipRegistration(id); if (!result?.member) throw new Error('Member details are unavailable.'); setDetail(result);
      setCommencementYear(result.confirmation?.commencementYear || '');
      if (result.confirmation?.plans.length === 1) { const p = result.confirmation.plans[0]; setPlanId(p.id); setAmount(String(p.price)); }
    }
    catch (err) { Alert.alert('Could not open member', errorText(err)); }
    finally { setOpening(false); }
  };
  const submit = async () => {
    if (saving || !detail) return;
    if (!selectedPlan || (selectedPlan.audience === 'business' && !selectedPlan.commencementYears?.includes(commencementYear))) { Alert.alert('Check commencement year', 'Choose the eligible plan and a year from its business commencement range.'); return; }
    if (!planId || !note.trim() || !ack || (mode !== 'waived' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0))) { Alert.alert('Check confirmation', 'Choose a plan, enter a reason and confirm the amount or fee waiver.'); return; }
    if (!(await confirm('Confirm membership?', mode === 'waived' ? 'Activate membership with ₹0 collected and an audited fee waiver?' : `Record ${money(Number(amount))} received and activate membership?`))) return;
    setSaving(true);
    try { const result = await confirmMembershipRegistration(detail.member.id, { planId, mode, amount: mode === 'waived' ? 0 : Number(amount), note: note.trim(), receiptNumber: receipt.trim(), membershipNumber: membershipNumber.trim(), commencementYear: selectedPlan.audience === 'business' ? commencementYear : undefined }); setDetail(result); setAck(false); setShowConfirm(false); await load(); Alert.alert('Membership confirmed', 'The member can open their receipt, membership certificate and tax certificate from their dashboard. Confirmation delivery is available in Message delivery.'); }
    catch (err) { Alert.alert('Could not confirm membership', errorText(err)); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!detail || saving || !(await confirm('Permanently delete registration?', `Delete ${detail.member.name}'s account, application, business profile and membership payments from the database? This cannot be undone and does not refund payments. They must register again to sign in.`))) return;
    setSaving(true);
    try { await deleteMembershipRegistration(detail.member.id); setDetail(null); await load(); Alert.alert('Permanently deleted', 'The member account and registration have been removed from the database.'); }
    catch (err) { Alert.alert('Could not delete registration', errorText(err)); }
    finally { setSaving(false); }
  };
  const chooseSummary = (nextTab: 'members' | 'payments', nextFilter: string) => { setTab(nextTab); setFilter(nextFilter); setQuery(''); setPage(1); };
  const payments: any[] = data?.payments || [];
  const currentPayments = payments.filter(p => !p.registrationDeleted);
  const archivedPayments = payments.filter(p => p.registrationDeleted);
  const all: any[] = tab === 'members' ? (data?.rows || []) : tab === 'archived' ? archivedPayments : currentPayments;
  const rows = all.filter(r => (filter === 'all' || (filter === 'submitted' ? !!r.applicationId : filter === 'waived' ? (r.confirmation === 'Fee waived' || (r.mode === 'waived' && r.status === 'paid')) : r.status === filter)) && Object.values(r).some(v => String(v || '').toLowerCase().includes(query.trim().toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const currentPage = Math.min(page, pages);
  const exportReport = async () => {
    if (exporting || loading || !data) return;
    setExporting(true);
    try { await saveSpreadsheetReport(await exportMembershipReport(tab, filter, query)); }
    catch (err) { Alert.alert('Could not export report', errorText(err)); }
    finally { setExporting(false); }
  };
  const summary = data?.summary || {};
  const back = () => { if (!saving && !opening) { if (showConfirm) setShowConfirm(false); else if (detail) setDetail(null); else navigation.goBack(); } };
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving || opening) return true;
      if (showConfirm) { setShowConfirm(false); return true; }
      if (detail) { setDetail(null); return true; }
      return false;
    });
    return () => listener.remove();
  }, [saving, opening, showConfirm, detail]));
  const refresh = () => { if (!saving && !opening) { if (detail) void open(detail.member.id); else void load(); } };
  return <ConsoleScroll key={detail?.member?.id || 'list'} avoidKeyboard refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} colors={[PALETTE.indigo]} />}>
    <ConsoleHeader compact title={detail ? detail.member.name : 'Membership registrations'} subtitle={detail ? detail.member.memberNumber || 'Member details and payment history' : 'Accounts, applications and membership payments'} left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={back} />} right={<GlassIconButton icon="refresh" accessibilityLabel="Refresh memberships" onPress={refresh} />} />
    {error ? <ConsoleNote style={s.card} kind="red" text={error} /> : null}
    {opening || (loading && !data) ? <ConsoleSkeleton rows={3} /> : detail ? <>
      <ConsoleCard style={s.card}>
        <Text style={s.title}>Member details</Text>
        <InfoRow label="Name" value={detail.member.name} />
        <InfoRow label="Email" value={detail.member.email} />
        <InfoRow label="Mobile" value={detail.member.phone} />
        <InfoRow label="Member type" value={display(detail.member.kind)} />
        <InfoRow label="Region" value={detail.member.region} />
        <InfoRow label="Registered" value={shortDate(detail.member.registeredAt)} />
        <InfoRow label="Application" value={detail.member.applicationStatus} />
        <InfoRow label="Submitted" value={shortDate(detail.member.submittedAt)} last />
      </ConsoleCard>
      <ConsoleCard style={s.card}>
        <Text style={s.title}>Membership details</Text>
        <InfoRow label="Member number" value={detail.member.memberNumber} />
        <InfoRow label="Status" value={display(detail.member.status)} />
        <InfoRow label="Plan" value={detail.member.planName || 'Not activated'} />
        <InfoRow label="Activated" value={shortDate(detail.member.activatedAt)} />
        <InfoRow label="Valid until" value={detail.member.lifetime ? 'Lifetime' : membershipValidityLabel(detail.member.expiresAt)} />
        <InfoRow label="Amount collected" value={money(detail.member.collected)} />
        <InfoRow label="Confirmation" value={detail.member.confirmation} last />
        {detail.member.applicationId ? <ConsoleButton label="Open application review" disabled={saving} onPress={() => navigation.navigate('ApplicantDetail', { applicant: { id: detail.member.applicationId, applicationId: detail.member.applicationId, fullName: detail.member.name, email: detail.member.email, status: detail.member.applicationStatus } })} /> : null}
      </ConsoleCard>
      <ConsoleCard style={s.card}><Text style={s.title}>Payment history</Text>{detail.payments?.length ? detail.payments.map((p: any) => <Receipt key={p.id} p={p} />) : <Text style={s.body}>No payment records yet.</Text>}</ConsoleCard>
      {detail.member.canConfirm ? showConfirm ? <ConsoleCard style={s.card}>
        <Text style={s.title}>Confirm membership / record payment</Text>
        <PremiumInput label="Membership ID" value={detail.member.assignedMemberNumber || membershipNumber} editable={!detail.member.assignedMemberNumber} onChangeText={value => setMembershipNumber(value.toUpperCase())} placeholder="ACTIV-BEG-20261012-001" autoCapitalize="characters" maxLength={40} />
        <Text style={s.body}>{detail.member.assignedMemberNumber ? "The member keeps this ID when renewing." : "Enter the office membership ID, or leave blank to generate one automatically."}</Text>
        <ConsoleNote text="Initial membership requires complete Personal, Business and Declaration forms submitted for review. Office payment or a fee waiver does not replace the application." />
        {detail.member.applicationStatus === 'Pending' ? <ConsoleNote text="This also approves the submitted application through the Super Admin review workflow." /> : null}
        <View pointerEvents={saving ? 'none' : 'auto'}>
          <Text style={s.body}>Membership plan</Text>
          <ChipRow options={offeredPlans.map((p: any) => ({ value: p.id, label: `${p.name} · ${money(p.price)}` }))} value={planId} onChange={id => { const p = offeredPlans.find(p => p.id === id); setPlanId(id); setAmount(String(p?.price ?? '')); setCommencementYear(y => p?.commencementYears.includes(y) ? y : ''); setAck(false); }} />
          <ConsoleNote text={offeredPlans.length ? "Eligible plans follow this member's category and the current membership settings." : "No eligible plan is available. Check the member's category, commencement year and active plans."} />{selectedPlan?.audience === "business" && <PremiumSelect label="Business commencement year" value={commencementYear} options={selectedPlan.commencementYears || []} onChange={value => { setCommencementYear(value); setAck(false); }} placeholder="Choose commencement year" hint={`${selectedPlan.name}: started ${selectedPlan.commencementYearLabel}.`} />}<Text style={s.body}>Confirmation mode</Text>
          <ChipRow options={MODES} value={mode} onChange={v => { setMode(v); setAck(false); }} />
          {mode !== 'waived' ? <>
            <PremiumInput tone="admin" label="Actual amount received (₹)" value={amount} onChangeText={v => { setAmount(v); setAck(false); }} keyboardType="decimal-pad" editable={!saving} />
            <PremiumInput tone="admin" label="Receipt / transaction reference" value={receipt} onChangeText={setReceipt} maxLength={120} editable={!saving} />
          </> : null}
          <PremiumInput tone="admin" label={mode === 'waived' ? 'Reason for fee waiver' : 'Payment / confirmation notes'} value={note} onChangeText={setNote} maxLength={500} multiline editable={!saving} />
          <Text style={s.body}>{mode === 'waived' ? '₹0 is recorded as collected. The waived fee and your reason remain in the record.' : 'Only the amount actually received is added to Collected.'}</Text>
          <ToggleRow label={mode === 'waived' ? 'I approve this fee waiver; ₹0 collected' : `I confirm ${money(Number(amount) || 0)} has been received`} value={ack} onChange={setAck} disabled={saving} />
        </View>
        <ConsoleButton label="Confirm membership" icon="how-to-reg" onPress={submit} loading={saving} disabled={saving || !ack} />
        <ConsoleButton label="Back to member details" kind="ghost" onPress={() => setShowConfirm(false)} disabled={saving} />
      </ConsoleCard> : <View style={s.card}><ConsoleButton label="Confirm membership / record payment" icon="payments" onPress={() => setShowConfirm(true)} /></View> : <ConsoleNote style={s.card} text={detail.member.blockedReason || 'Membership is already active.'} />}
      <View style={s.card}><ConsoleButton kind="danger" icon="delete-outline" label="Delete registration" onPress={remove} disabled={saving} /></View>
    </> : data ? <>
      <ConsoleGrid><ConsoleStatTile label="Registered" value={summary.registered || 0} icon="people" hint={`${summary.submitted || 0} applications submitted`} onPress={() => chooseSummary('members', 'all')} /><ConsoleStatTile label="Active members" value={summary.active || 0} icon="verified-user" onPress={() => chooseSummary('members', 'active')} /><ConsoleStatTile label="Collected" value={money(summary.collected)} icon="payments" hint="Money actually received" onPress={() => chooseSummary('payments', 'paid')} /><ConsoleStatTile label="Awaiting payment" value={summary.awaiting || 0} icon="schedule" hint={`${summary.pendingReview || 0} awaiting review · ${summary.expired || 0} expired`} onPress={() => chooseSummary('members', 'awaiting_payment')} /></ConsoleGrid>
      <ConsoleTabs scrollable value={tab} onChange={v => { setTab(v); setFilter('all'); setPage(1); }} options={[{ value: 'members', label: 'Members', count: data.rows?.length || 0 }, { value: 'payments', label: 'Payments', count: currentPayments.length }, { value: 'archived', label: 'Archived payments', count: archivedPayments.length }]} />
      {tab === 'archived' ? <ConsoleNote style={s.card} text="Payments from deleted registrations are retained here. Export any records you need before permanently deleting an unnecessary payment." /> : null}
      <ConsoleSearch value={query} onChangeText={v => { setQuery(v); setPage(1); }} placeholder="Name, email, mobile or reference" />
      <ChipRow value={filter} onChange={v => { setFilter(v); setPage(1); }} options={(tab === 'members' ? MEMBER_FILTERS : PAYMENT_FILTERS).map(([value, label]) => ({ value, label }))} />
      <View style={s.card}><ConsoleButton label="Export Excel report" icon="file-download" onPress={exportReport} loading={exporting} disabled={loading || !data} /></View>
      {rows.slice((currentPage - 1) * 20, currentPage * 20).map(r => <ConsoleCard key={r.id} style={s.card} onPress={r.registrationDeleted ? undefined : () => void open(tab === 'members' ? r.id : r.memberId)} accessibilityLabel={`${r.registrationDeleted ? "Archived payment for" : "Open membership"} ${r.name || r.email}`}><Text style={s.title}>{r.name || r.email}</Text><ConsoleChip label={display(r.status)} /><Text style={s.body}>{r.email}{'\n'}{r.phone || r.orderId}{'\n'}{r.planName || r.applicationStatus}</Text>{tab !== 'members' ? <Receipt p={r} /> : <Text style={s.body}>Collected: {money(r.collected)}</Text>}{tab === 'archived' && r.registrationDeleted ? <ConsoleButton kind="danger" icon="delete-outline" label="Delete permanently" disabled={!!deletingPayment} loading={deletingPayment === r.id} onPress={() => void removeArchivedPayment(r)} /> : null}</ConsoleCard>)}
      {!rows.length ? <ConsoleState title="No matching records" message="Try another search or filter." /> : null}
      <View style={s.card}><Text style={s.body}>{rows.length} records · Page {currentPage} of {pages}</Text><View style={s.actions}><ConsoleButton label="Previous" disabled={currentPage <= 1} onPress={() => setPage(currentPage - 1)} /><ConsoleButton label="Next" disabled={currentPage >= pages} onPress={() => setPage(currentPage + 1)} /></View></View>
    </> : <ConsoleState kind="error" title="Could not load membership registrations" action="Try again" onAction={load} />}
  </ConsoleScroll>;
}
const s = StyleSheet.create({ card: { marginHorizontal: SPACE.lg, marginVertical: SPACE.sm }, title: { ...TYPE.subheading, marginBottom: SPACE.sm }, body: { ...TYPE.caption, lineHeight: 21, marginVertical: SPACE.xs }, receipt: { paddingVertical: SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe3ef' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm } });
