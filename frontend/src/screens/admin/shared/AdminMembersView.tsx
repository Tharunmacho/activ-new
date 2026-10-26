import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import {
  PALETTE, SPACE, errorText,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleNote, ConsoleTabs, ConsoleSearch, ConsoleButton,
  ConsoleSkeleton, ConsoleState, CONSOLE_LIST, MembersCircle3D,
} from '../../../ui';
import PremiumMemberCard from './PremiumMemberCard';
import {
  listAdminMembers, setMemberReminders, remindMemberNow, remindAllExpired, memberAction,
  AdminMembersPayload, AdminMemberRow, MembersTab, EMPTY_MEMBERS,
} from '../../../services/adminApi';
import { AdminTier, MenuButton, TIER_LABEL } from './TierMenu';

/**
 * ============================================================================
 * ADMIN → MEMBERS, for the three geofenced tiers
 * ============================================================================
 *
 * The website's AdminMembersScreen on the SAME endpoint (GET /admin/members):
 * who is Active (paid and in date), Expiring soon, Expired, and Awaiting
 * payment (approved, not paid) — inside the caller's own region only; the
 * server forces the geofence (`ownRegionMissing` → nothing, never everything).
 *
 * WHO MAY DO WHAT — the website's rule, not a new one:
 *   every tier   reads, searches, filters, opens a member
 *   State only   the Reminders switch, "Remind now", "Remind all expired",
 *                and Block / Unblock / Delete. Block and District admins see
 *                NONE of these controls — hidden, not disabled. The server
 *                refuses them anyway (requireRole state_admin/super_admin).
 */

const TABS: { value: MembersTab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'expiring', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
  { value: 'awaiting', label: 'Awaiting payment' },
  { value: 'all', label: 'All' },
];

const KINDS: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'business', label: 'Business' },
  { value: 'aspirant', label: 'Aspirant' },
  { value: 'student', label: 'Student' },
];

/** The website's `inTab` — a view over the one `tab=all` payload. */
const inTab = (m: AdminMemberRow, tab: MembersTab) => {
  if (tab === 'active') return m?.status === 'active';
  if (tab === 'expiring') return m?.status === 'active' && !!m?.expiringSoon;
  if (tab === 'expired') return m?.status === 'expired';
  if (tab === 'awaiting') return m?.status === 'awaiting_payment';
  return true;
};

/* ------------------------------------------------------------------ the screen */

export default function AdminMembersView({ tier, region, navigation }: { tier: AdminTier; region: string; navigation: any }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [tab, setTab] = useState<MembersTab>('active');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminMembersPayload>(EMPTY_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  /*
   * Two separate rights, exactly as the website splits them:
   *   - block / unblock / delete  -> `mayManageMembers` (State; Super elsewhere)
   *   - reminder switch + Remind  -> the server's `canManageReminders` AND that
   */
  const mayManageMembers = tier === 'state';
  const canReminders = mayManageMembers && !!data?.canManageReminders;
  const canManage = mayManageMembers;

  /*
   * ONE request for the whole region (`GET /admin/members?tab=all`, the
   * website's call), then tabs, type and search are views over it. Counts on
   * the pills are therefore computed from the same rows the list shows, and
   * switching tab costs no round trip.
   */
  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setData(await listAdminMembers({ tab: 'all' }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load('load'); }, [load, tier]);

  const patchRow = (id: string, patch: Partial<AdminMemberRow>) =>
    setData((prev) => ({ ...prev, rows: (prev.rows || []).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const onReminders = async (m: AdminMemberRow, enabled: boolean) => {
    setBusyId(m.id);
    try {
      await setMemberReminders(m.id, enabled);
      patchRow(m.id, { reminders: enabled });
    } catch (err) {
      Alert.alert('Could not change reminders', errorText(err));
    } finally { setBusyId(null); }
  };

  const onRemindNow = (m: AdminMemberRow) => {
    Alert.alert('Send a renewal reminder', `Send ${m.name || 'this member'} a renewal reminder now by email, WhatsApp and their bell?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send', onPress: async () => {
          setBusyId(m.id);
          try {
            const r = await remindMemberNow(m.id);
            patchRow(m.id, { lastReminderAt: r?.at || new Date().toISOString() });
            Alert.alert('Reminder sent', `${m.name || 'The member'} has been reminded.`);
          } catch (err) {
            Alert.alert('Not sent', errorText(err));
          } finally { setBusyId(null); }
        },
      },
    ]);
  };

  const onRemindAll = () => {
    Alert.alert('Remind every expired member', 'Send a renewal reminder to every expired member in your region with reminders on? Members reminded in the last 24 hours will not receive another reminder.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send to all', onPress: async () => {
          setBulkBusy(true);
          try {
            const r = await remindAllExpired();
            Alert.alert('Reminders sent', `Sent to ${r?.sent || 0} member${r?.sent === 1 ? '' : 's'}${r?.skipped ? ` · ${r.skipped} not sent (already reminded in the last 24 hours)` : ''}.`);
            load('refresh');
          } catch (err) {
            Alert.alert('Not sent', errorText(err));
          } finally { setBulkBusy(false); }
        },
      },
    ]);
  };

  const onBlock = (m: AdminMemberRow) => {
    const unblock = !!m.blocked;
    Alert.alert(unblock ? 'Unblock member' : 'Block member',
      unblock ? `Let ${m.name || 'this member'} sign in again?` : `Stop ${m.name || 'this member'} from signing in?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: unblock ? 'Unblock' : 'Block', style: unblock ? 'default' : 'destructive', onPress: async () => {
            setBusyId(m.id);
            try {
              await memberAction(m.applicationId, unblock ? 'activate' : 'suspend');
              Alert.alert(unblock ? 'Member unblocked' : 'Member blocked', unblock ? 'They can sign in again.' : 'They can no longer sign in.');
              await load('refresh');
            } catch (err) {
              Alert.alert('Could not update this member', errorText(err));
            } finally { setBusyId(null); }
          },
        },
      ]);
  };

  const onDelete = (m: AdminMemberRow) => {
    Alert.alert('Delete permanently', `Permanently delete ${m.name || 'this member'}?\n\nThis removes their application, login, member record, business, financial and declaration forms. It cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusyId(m.id);
          try {
            await memberAction(m.applicationId, 'delete');
            Alert.alert('Deleted', `${m.name || 'Member'} deleted.`);
            setOpenId(null);
            await load('refresh');
          } catch (err) {
            Alert.alert('Could not delete this member', errorText(err));
          } finally { setBusyId(null); }
        },
      },
    ]);
  };

  const onView = (m: AdminMemberRow) => {
    // A member's application is already decided: opened read-only (no verdict buttons).
    navigation?.navigate?.('ApplicantDetail', {
      applicant: {
        id: m.applicationId, applicationId: m.applicationId, fullName: m.name, email: m.email, phone: m.phone,
        block: m.block, district: m.district, state: m.state, stage: 'approved', status: 'Approved',
        statusLabel: m.status === 'awaiting_payment' ? 'Approved — awaiting payment' : 'Member', canAct: false,
      },
    });
  };

  const summary = data?.summary || EMPTY_MEMBERS.summary;
  const allRows = useMemo(() => data?.rows || [], [data]);
  const counts = useMemo(() => {
    const c: Record<MembersTab, number> = { active: 0, expiring: 0, expired: 0, awaiting: 0, all: 0 };
    TABS.forEach((t) => { c[t.value] = allRows.filter((m) => inTab(m, t.value)).length; });
    return c;
  }, [allRows]);
  const rows = useMemo(() => {
    const term = (query || '').trim().toLowerCase();
    return allRows
      .filter((m) => inTab(m, tab))
      .filter((m) => !kind || m?.kind === kind)
      .filter((m) => !term || [m?.name, m?.email, m?.phone, m?.memberNumber, m?.block, m?.district]
        .some((v) => String(v || '').toLowerCase().includes(term)));
  }, [allRows, tab, kind, query]);

  const emptyHint = query || kind
    ? 'Try a different search or type.'
    : tab === 'expired' ? 'Nobody\u2019s membership has lapsed.'
      : tab === 'expiring' ? 'No membership ends in the next 30 days.'
        : tab === 'awaiting' ? 'Every approved applicant has paid.'
          : 'Members appear here once they have paid.';

  const totalMembers = counts.all || allRows.length;

  const header = (
    <View>
      <ConsoleHeader
        left={<MenuButton />}
        topCenter={`${TIER_LABEL[tier]} Admin`}
        eyebrow={region ? `${region} · ${TIER_LABEL[tier]} Admin` : `${TIER_LABEL[tier]} Admin`}
        title="Members"
        subtitle="Who is in date, who is about to lapse, and who has not paid yet"
        art={<MembersCircle3D size={96} />}
        badges={[
          { icon: 'groups', label: loading ? 'Loading…' : `${totalMembers} member${totalMembers === 1 ? '' : 's'}` },
          ...(summary?.renewedThisMonth ? [{ icon: 'autorenew', label: `${summary.renewedThisMonth} renewed this month` }] : []),
        ]}
        waveHeight={62}
      />

      {loading ? (
        <ConsoleSkeleton variant="tiles" style={s.overlap} />
      ) : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Active" hint={summary?.renewedThisMonth ? `Paid and in date · ${summary.renewedThisMonth} renewed this month` : 'Paid and in date'} value={Number(summary.active || 0)} icon="verified" accent="green" selected={tab === 'active'} onPress={() => setTab('active')} delay={40} />
          <ConsoleStatTile label="Expiring soon" hint="Within 30 days" value={Number(summary.expiringSoon || 0)} icon="schedule" accent="amber" selected={tab === 'expiring'} onPress={() => setTab('expiring')} delay={100} />
          <ConsoleStatTile label="Expired" hint="Not renewed" value={Number(summary.expired || 0)} icon="event-busy" accent="red" selected={tab === 'expired'} onPress={() => setTab('expired')} delay={160} />
          <ConsoleStatTile label="Awaiting payment" hint="Approved, not paid" value={Number(summary.awaitingPayment || 0)} icon="hourglass-top" accent="slate" selected={tab === 'awaiting'} onPress={() => setTab('awaiting')} delay={220} />
        </ConsoleGrid>
      )}

      {data?.scopeUnresolved ? (
        <ConsoleNote kind="amber" icon="warning-amber" style={s.noteGap} text={(data as any)?.message || 'This account has no region on record, so no members can be shown. Ask the Super Admin to set its region.'} />
      ) : null}

      <ConsoleNote
        icon="autorenew"
        style={s.noteGap}
        text={`Active = paid and in date. When the paid period ends the member moves to Expired by itself${canReminders ? ', and — while their Reminders switch is on — is sent “your membership has expired, renew now” on the 1st and 15th of every month.' : '.'}`}
      />

      <ConsoleTabs value={tab} onChange={setTab} options={TABS.map((t) => ({ ...t, count: counts[t.value] }))} scrollable />

      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Name, email, phone, Member ID or area" style={s.search} />

      <ConsoleTabs value={kind} onChange={setKind} options={KINDS} style={s.kinds} />

      {canReminders && (tab === 'expired' || tab === 'all') && (counts.expired || 0) > 0 ? (
        <ConsoleButton icon="campaign" label="Remind all expired" loading={bulkBusy} onPress={onRemindAll} style={s.bulk} />
      ) : null}
    </View>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : rows}
        keyExtractor={(item, index) => String(item?.id || item?.applicationId || index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        contentContainerStyle={CONSOLE_LIST}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
        renderItem={({ item, index }) => (
          <PremiumMemberCard
            m={item}
            delay={Math.min(index, 6) * 40}
            open={openId === item.id}
            onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
            canManage={canManage}
            canReminders={canReminders}
            busy={busyId === item.id}
            onReminders={onReminders}
            onRemindNow={onRemindNow}
            onBlock={onBlock}
            onDelete={onDelete}
            onView={onView}
          />
        )}
        ListEmptyComponent={
          loading ? <ConsoleSkeleton rows={4} style={s.listGap} />
            : error ? <ConsoleState kind="error" title="Could not load members" message={error} action="Try again" onAction={() => load('load')} />
              : data?.scopeUnresolved ? null
                : <ConsoleState title="No members here" message={emptyHint} />
        }
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  overlap: { marginTop: -30 },
  noteGap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  search: { marginTop: SPACE.md },
  kinds: { marginTop: SPACE.sm },
  bulk: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  listGap: { marginTop: SPACE.md },
});
// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
const legacyAppearance_PALETTE = PALETTE;
