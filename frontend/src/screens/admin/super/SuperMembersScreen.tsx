import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  PALETTE, SPACE, useApi,
  ConsoleFrame, ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleNote, ConsoleTabs, ConsoleSearch,
  ConsoleButton, ConsoleSkeleton, ConsoleState, GlassIconButton, MembersCircle3D, CONSOLE_LIST,
} from '../../../ui';
import PremiumMemberCard from '../shared/PremiumMemberCard';
import {
  listAdminMembers, setMemberReminders, remindMemberNow, remindAllExpired, memberAction,
  AdminMember, MembersTab, EMPTY_MEMBERS, errorText,
} from '../../../services/superApi';
import { confirm } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — Members (website /super-admin/members, AdminMembersScreen)
 * ============================================================================
 *
 * `GET /admin/members` — every member in every region (the Super Admin is not
 * geofenced). Active = paid and in date; Expired = the paid period ended;
 * Awaiting payment = approved, not paid (members/membershipState.js).
 *
 * Reminders: the switch, "Remind now" (24 h guard on the server) and "Remind
 * all expired" are the State / Super Admin's — shown here because the server
 * says `canManageReminders`. Block / suspend / delete are keyed by the
 * APPLICATION id, as on the website.
 */

const TYPES = [
  { value: '', label: 'All types' },
  { value: 'business', label: 'Business' },
  { value: 'aspirant', label: 'Aspirant' },
  { value: 'student', label: 'Student' },
];

const inTab = (m: AdminMember, tab: MembersTab) => {
  if (tab === 'active') return m?.status === 'active';
  if (tab === 'expiring') return m?.status === 'active' && !!m?.expiringSoon;
  if (tab === 'expired') return m?.status === 'expired';
  if (tab === 'awaiting') return m?.status === 'awaiting_payment';
  return true;
};

const SuperMembersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { data, setData, loading, refreshing, error, reload, refresh } =
    useApi<any>(() => listAdminMembers({ tab: 'all' }).then((d) => ({ data: d })), [], EMPTY_MEMBERS);
  const [tab, setTab] = useState<MembersTab>('active');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [openId, setOpenId] = useState('');

  const payload = (data || EMPTY_MEMBERS) as typeof EMPTY_MEMBERS;
  const rows = useMemo(() => (Array.isArray(payload?.rows) ? payload.rows : []), [payload]);
  const canManageReminders = !!payload?.canManageReminders;
  const summary = payload?.summary || EMPTY_MEMBERS.summary;
  const counts = payload?.counts || EMPTY_MEMBERS.counts;

  const visible = useMemo(() => {
    const term = (q || '').trim().toLowerCase();
    return rows
      .filter((m) => inTab(m, tab))
      .filter((m) => !type || m?.kind === type)
      .filter((m) => !term || [m?.name, m?.email, m?.phone, m?.memberNumber, m?.block, m?.district, m?.state]
        .some((v) => String(v || '').toLowerCase().includes(term)));
  }, [rows, tab, type, q]);

  const patchRow = (id: string, patch: Partial<AdminMember>) =>
    setData((d: any) => ({ ...(d || EMPTY_MEMBERS), rows: (d?.rows || []).map((r: AdminMember) => (r?.id === id ? { ...r, ...patch } : r)) }));

  const onReminders = useCallback(async (m: AdminMember, enabled: boolean) => {
    setBusyId(m.id);
    try {
      await setMemberReminders(m.id, enabled);
      patchRow(m.id, { reminders: enabled });
      Alert.alert(enabled ? 'Reminders on' : 'Reminders off', enabled
        ? `${m?.name || 'This member'} is reminded on the 1st and 15th once expired.`
        : `Reminders off for ${m?.name || 'this member'}.`);
    } catch (err) {
      Alert.alert('Could not change reminders', errorText(err));
    } finally { setBusyId(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemind = useCallback(async (m: AdminMember) => {
    setBusyId(m.id);
    try {
      const r = await remindMemberNow(m.id);
      patchRow(m.id, { lastReminderAt: r?.at || new Date().toISOString() });
      Alert.alert('Reminder sent', `${m?.name || 'The member'} was reminded by email, WhatsApp and their bell.`);
    } catch (err) {
      Alert.alert('Could not send the reminder', errorText(err));
    } finally { setBusyId(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemindAll = async () => {
    if (!(await confirm('Remind all expired', 'Send a renewal reminder to every expired member with reminders on? Members reminded in the last 24 hours will not receive another reminder.', 'Send'))) return;
    setBulkBusy(true);
    try {
      const r = await remindAllExpired();
      Alert.alert('Reminders sent', `Sent to ${r?.sent || 0} member${r?.sent === 1 ? '' : 's'}${r?.skipped ? ` · ${r.skipped} not sent (already reminded in the last 24 hours)` : ''}.`);
      reload();
    } catch (err) {
      Alert.alert('Could not send reminders', errorText(err));
    } finally { setBulkBusy(false); }
  };

  const onBlock = async (m: AdminMember) => {
    if (!m?.applicationId) { Alert.alert('Not possible', 'This member has no application on record.'); return; }
    const unblock = !!m?.blocked;
    if (!(await confirm(unblock ? 'Unblock member' : 'Block member',
      unblock ? `${m?.name || 'This member'} will be able to sign in again.` : `${m?.name || 'This member'} will no longer be able to sign in.`,
      unblock ? 'Unblock' : 'Block', !unblock))) return;
    setBusyId(m.id);
    try {
      await memberAction(m.applicationId, unblock ? 'activate' : 'suspend');
      Alert.alert(unblock ? 'Member unblocked' : 'Member blocked', unblock ? 'They can sign in again.' : 'They can no longer sign in.');
      reload();
    } catch (err) {
      Alert.alert('Could not update this member', errorText(err));
    } finally { setBusyId(''); }
  };

  const onDelete = async (m: AdminMember) => {
    if (!m?.applicationId) { Alert.alert('Not possible', 'This member has no application on record.'); return; }
    if (!(await confirm('Delete permanently?', `This removes ${m?.name || 'this member'}'s application, login, member record, business, financial and declaration forms. It cannot be undone.`, 'Delete', true))) return;
    setBusyId(m.id);
    try {
      await memberAction(m.applicationId, 'delete');
      Alert.alert('Deleted', `${m?.name || 'Member'} deleted.`);
      reload();
    } catch (err) {
      Alert.alert('Could not delete this member', errorText(err));
    } finally { setBusyId(''); }
  };

  const onOpen = (m: AdminMember) => {
    if (!m?.applicationId) { Alert.alert('Not possible', 'This member has no application on record.'); return; }
    navigation.navigate('ApplicantDetail', {
      applicant: {
        id: m.applicationId, _id: m.applicationId, applicationId: m.applicationId,
        fullName: m?.name || '', email: m?.email || '', phone: m?.phone || '',
        block: m?.block || '', district: m?.district || '', state: m?.state || '',
        memberCode: m?.memberNumber || '', stage: 'approved', status: 'Approved', statusLabel: 'Approved',
        canAct: false,
      },
    });
  };

  const emptyHint = q || type
    ? 'Try a different search or type.'
    : tab === 'expired' ? 'Nobody’s membership has lapsed.'
      : tab === 'expiring' ? 'No membership ends in the next 30 days.'
        : tab === 'awaiting' ? 'Every approved applicant has paid.'
          : 'Members appear here once they have paid.';

  const back = <GlassIconButton icon="arrow-back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />;
  const totalMembers = Number(counts?.all ?? rows.length) || 0;

  const heading = (
    <ConsoleHeader
      left={back}
      topCenter="Super Admin"
      eyebrow="Every region"
      title="Members"
      subtitle="Paid members across the association — who is in date, who is about to lapse, and who has not paid yet"
      art={<MembersCircle3D size={96} />}
      badges={[
        { icon: 'groups', label: loading ? 'Loading…' : `${totalMembers} member${totalMembers === 1 ? '' : 's'}` },
        ...(summary?.renewedThisMonth ? [{ icon: 'autorenew', label: `${summary.renewedThisMonth} renewed this month` }] : []),
      ]}
      waveHeight={62}
    />
  );

  const header = (
    <View>
      {heading}
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Active" hint={summary?.renewedThisMonth ? `Paid and in date · ${summary.renewedThisMonth} renewed this month` : 'Paid and in date'} value={Number(summary?.active ?? 0)} icon="verified" accent="green" selected={tab === 'active'} onPress={() => setTab('active')} delay={40} />
        <ConsoleStatTile label="Expiring soon" hint="Within 30 days" value={Number(summary?.expiringSoon ?? 0)} icon="schedule" accent="amber" selected={tab === 'expiring'} onPress={() => setTab('expiring')} delay={100} />
        <ConsoleStatTile label="Expired" hint="Not renewed" value={Number(summary?.expired ?? 0)} icon="highlight-off" accent="red" selected={tab === 'expired'} onPress={() => setTab('expired')} delay={160} />
        <ConsoleStatTile label="Awaiting payment" hint="Approved, not paid" value={Number(summary?.awaitingPayment ?? 0)} icon="hourglass-empty" accent="slate" selected={tab === 'awaiting'} onPress={() => setTab('awaiting')} delay={220} />
      </ConsoleGrid>
      {payload?.scopeUnresolved ? (
        <ConsoleNote kind="amber" icon="warning-amber" style={s.note} text={String((payload as any)?.message || 'This account has no region on record, so no members can be shown. Ask the Super Admin to set its region.')} />
      ) : null}
      <ConsoleNote
        icon="autorenew"
        style={s.note}
        text={`Active = paid and in date. When the paid period ends the member moves to Expired by itself${canManageReminders
          ? ', and — while their Reminders switch is on — is sent “your membership has expired, renew now” on the 1st and 15th of every month.'
          : '.'}`}
      />
      <ConsoleTabs<MembersTab>
        scrollable
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'Active', count: counts?.active },
          { value: 'expiring', label: 'Expiring soon', count: counts?.expiring },
          { value: 'expired', label: 'Expired', count: counts?.expired },
          { value: 'awaiting', label: 'Awaiting payment', count: counts?.awaiting },
          { value: 'all', label: 'All', count: counts?.all },
        ]}
      />
      <ConsoleSearch value={q} onChangeText={setQ} placeholder="Name, email, phone, Member ID or area" style={s.search} />
      <ConsoleTabs<string> value={type} onChange={setType} options={TYPES} style={s.types} />
      {canManageReminders && (tab === 'expired' || tab === 'all') && (counts?.expired || 0) > 0 ? (
        <ConsoleButton icon="send" label="Remind all expired" loading={bulkBusy} onPress={onRemindAll} style={s.bulk} />
      ) : null}
    </View>
  );

  if (loading) return <ConsoleScroll>{heading}<ConsoleSkeleton variant="tiles" style={s.overlap} /><ConsoleSkeleton rows={4} /></ConsoleScroll>;
  if (error) return <ConsoleScroll>{heading}<ConsoleState kind="error" title="Could not load members" message={error} action="Try again" onAction={reload} style={s.errorGap} /></ConsoleScroll>;

  return (
    <ConsoleFrame>
      <FlatList
        data={visible}
        keyExtractor={(m, i) => String(m?.id || m?.applicationId || i)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={refresh} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
        contentContainerStyle={CONSOLE_LIST}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<ConsoleState title="No members here" message={rows.length === 0 && !payload?.scopeUnresolved ? 'No paid or approved members yet.' : emptyHint} />}
        renderItem={({ item, index }) => (
          <PremiumMemberCard
            m={item as any}
            delay={Math.min(index, 6) * 40}
            open={openId === item?.id}
            onToggle={() => setOpenId((prev) => (prev === item?.id ? '' : String(item?.id || '')))}
            canManage
            canReminders={canManageReminders}
            busy={busyId === item?.id}
            onReminders={onReminders}
            onRemindNow={onRemind}
            onBlock={onBlock}
            onDelete={onDelete}
            onView={onOpen}
          />
        )}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  overlap: { marginTop: -30 },
  errorGap: { marginTop: SPACE.lg },
  note: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  search: { marginTop: SPACE.md },
  types: { marginTop: SPACE.sm },
  bulk: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
});

export default SuperMembersScreen;
