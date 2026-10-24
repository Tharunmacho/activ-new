import { updateAudienceLabel } from '../../../utils/memberAudience';
import { resolveUpdateDeliveryChannels, updateDeliverySummary } from '../../../utils/updateDeliveryChannels';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, shortDate,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch,
  ConsoleSkeleton, ConsoleState, ConsoleNote, ConsoleButton, GlassIconButton, Megaphone3D, CONSOLE_LIST,
} from '../../../ui';
import { listAnnouncementsAdmin, setAnnouncementStatus, deleteAnnouncement, errorText } from '../../../services/superApi';
import { MiniAction, confirm } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — Updates (website /super-admin/updates)
 * ============================================================================
 *
 * Association announcements members read on their dashboard.
 * GET /announcements/admin (drafts included), PATCH /announcements/:id/status,
 * DELETE /announcements/:id; create / edit in SuperUpdateEditor.
 */

type Tab = 'all' | 'published' | 'draft';

export const CATEGORY_TONE: Record<string, { fg: string; bg: string; icon: string }> = {
  general: { fg: PALETTE.blueDark, bg: PALETTE.blueSoft, icon: 'campaign' },
  notice: { fg: '#6D28D9', bg: '#EDE9FE', icon: 'push-pin' },
  policy: { fg: '#0F766E', bg: '#CCFBF1', icon: 'policy' },
  scheme: { fg: '#B45309', bg: PALETTE.amberSoft, icon: 'account-balance' },
  achievement: { fg: '#047857', bg: PALETTE.greenSoft, icon: 'emoji-events' },
  urgent: { fg: '#B91C1C', bg: PALETTE.redSoft, icon: 'priority-high' },
};

function UpdateCard({ a, onEdit, onToggle, onDelete }: { a: any; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const tone = CATEGORY_TONE[String(a?.category || 'general')] || CATEGORY_TONE.general;
  const published = String(a?.status) === 'published';
  const title = String(a?.title || '').trim() || 'Untitled update';
  return (
    <ConsoleCard style={s.card} onPress={onEdit} accent={String(a?.category) === 'urgent' ? PALETTE.red : undefined}
      accessibilityLabel={`Edit ${title}`}>
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: tone.bg }]}><Icon name={tone.icon} size={20} color={tone.fg} /></View>
        <View style={s.flexText}>
          <View style={s.titleRow}>
            {a?.pinned ? <Icon name="push-pin" size={14} color={PALETTE.indigo} style={s.pin} /> : null}
            <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{title}</Text>
          </View>
          <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {String(a?.category || 'general')}{a?.pinned ? ' · pinned' : ''}
          </Text>
        </View>
        <ConsoleChip label={published ? 'Published' : 'Draft'} kind={published ? 'approved' : 'pending'} />
      </View>
      <View style={s.chips}>
        <ConsoleChip icon={a?.targetLabel ? 'my-location' : 'public'} label={a?.targetLabel || 'All regions'} kind={a?.targetLabel ? 'info' : 'neutral'} />
        <ConsoleChip icon={String(a?.audience) === 'paid' ? 'lock' : 'groups'} label={updateAudienceLabel(a?.audience)} kind="neutral" />
      </View>
      <Text style={s.summary}>{updateDeliverySummary(resolveUpdateDeliveryChannels(a?.deliveryChannels, true))}</Text>
      {a?.summary ? <Text style={s.summary} numberOfLines={3} maxFontSizeMultiplier={1.3}>{a.summary}</Text> : null}
      <Text style={s.date} maxFontSizeMultiplier={1.3}>
        {published ? `Published ${shortDate(a?.publishedAt) || ''}` : `Created ${shortDate(a?.createdAt) || ''}`}{a?.expiresAt ? ` · until ${shortDate(a.expiresAt)}` : ''}
      </Text>
      <View style={s.actions}>
        <MiniAction icon={published ? 'unpublished' : 'publish'} label={published ? 'Unpublish' : 'Review & publish'} color={published ? PALETTE.amberDark : PALETTE.greenDark} onPress={onToggle} />
        <MiniAction icon="edit" label="Edit" onPress={onEdit} />
        <View style={s.flex} />
        <MiniAction icon="delete-outline" label="Delete" color={PALETTE.red} onPress={onDelete} />
      </View>
    </ConsoleCard>
  );
}

const SuperUpdatesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('all');
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const d = await listAnnouncementsAdmin();
      setRows(Array.isArray(d?.announcements) ? d.announcements : []);
    } catch (err) { setError(errorText(err)); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  // Quietly refetched on every return from the editor.
  const loadedOnce = useRef(false);
  useFocusEffect(useCallback(() => { load(loadedOnce.current ? 'quiet' : 'load'); loadedOnce.current = true; }, [load]));

  const all = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const publishedCount = useMemo(() => all.filter((a) => String(a?.status) === 'published').length, [all]);
  const shown = useMemo(() => {
    const needle = (query || '').trim().toLowerCase();
    return all
      .filter((a) => (tab === 'all' ? true : tab === 'published' ? String(a?.status) === 'published' : String(a?.status) !== 'published'))
      .filter((a) => !needle || [a?.title, a?.summary, a?.category, a?.targetLabel].some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [all, tab, query]);

  const toggle = useCallback(async (a: any) => {
    if (String(a?.status) !== 'published') {
      navigation.navigate('SuperUpdateEditor', { announcement: a });
      return;
    }
    try {
      await setAnnouncementStatus(String(a?.id || ''), 'draft');
      Alert.alert('Withdrawn from members');
      load('quiet');
    } catch (err) { Alert.alert('Could not change the status', errorText(err)); }
  }, [load, navigation]);
  const remove = useCallback(async (a: any) => {
    if (!(await confirm(`Delete "${a?.title || 'Untitled'}"?`, 'Members who have already read it will no longer see it.', 'Delete', true))) return;
    try { await deleteAnnouncement(String(a?.id || '')); load('quiet'); } catch (err) { Alert.alert('Could not delete the update', errorText(err)); }
  }, [load]);

  const openNew = useCallback(() => navigation.navigate('SuperUpdateEditor'), [navigation]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <UpdateCard a={item} onEdit={() => navigation.navigate('SuperUpdateEditor', { announcement: item })} onToggle={() => toggle(item)} onDelete={() => remove(item)} />
  ), [navigation, toggle, remove]);

  const header = (
    <>
      <ConsoleHeader
        eyebrow="Super Admin · communication"
        title="Association Updates"
        subtitle="News and notices, targeted by region and by membership."
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />}
        right={<GlassIconButton icon="add" accessibilityLabel="New update" onPress={openNew} />}
        art={<Megaphone3D size={96} />}
      />
      <ConsoleGrid overlap>
        <ConsoleStatTile label="Published" value={loading && !rows ? '…' : publishedCount} icon="campaign" accent="green" hint="on members' dashboards" />
        <ConsoleStatTile label="Drafts" value={loading && !rows ? '…' : all.length - publishedCount} icon="edit-note" accent="amber" hint="seen by nobody yet" delay={60} />
      </ConsoleGrid>
      <ConsoleButton icon="add" label="New update" onPress={openNew} style={s.newBtn} />
      <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Search a headline, category or region" style={s.search} />
      <ConsoleTabs<Tab> value={tab} onChange={setTab} style={s.tabs} options={[
        { value: 'all', label: 'All', count: all.length },
        { value: 'published', label: 'Published', count: publishedCount },
        { value: 'draft', label: 'Drafts', count: all.length - publishedCount },
      ]} />
      {error && rows ? <ConsoleNote kind="red" icon="error-outline" text={error} action="Retry" onAction={() => load('refresh')} style={s.note} /> : null}
      {error && !rows ? <ConsoleState kind="error" title="Could not load the updates" message={error} action="Try again" onAction={() => load()} /> : null}
      {loading && !rows && !error ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={rows ? shown : []}
        keyExtractor={(a, i) => String(a?.id || a?._id || i)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        contentContainerStyle={CONSOLE_LIST}
        ListEmptyComponent={rows && !loading ? (
          <ConsoleState
            title={query ? 'Nothing matches' : 'No updates here'}
            message={query ? 'No update answers that search.' : 'Nothing here yet. Create one and it appears on every matching member’s dashboard.'}
            action={query ? undefined : 'New update'}
            onAction={query ? undefined : openNew}
          />
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  newBtn: { marginHorizontal: SPACE.lg, marginTop: SPACE.xs },
  search: { marginTop: SPACE.md },
  tabs: { marginTop: SPACE.sm, marginBottom: SPACE.md },
  note: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  pin: { marginRight: 4 },
  title: { ...TYPE.subheading, fontWeight: '600', flexShrink: 1 },
  sub: { ...TYPE.caption, marginTop: 3, textTransform: 'capitalize' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs, marginTop: SPACE.md },
  summary: { fontSize: 16, color: PALETTE.textSoft, marginTop: SPACE.md, lineHeight: 24 },
  date: { fontSize: 14, color: PALETTE.textFaint, marginTop: SPACE.sm, lineHeight: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
});

export default SuperUpdatesScreen;
