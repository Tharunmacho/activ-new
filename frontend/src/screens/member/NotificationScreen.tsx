import { useLegacyAppearance } from '../../ui/legacyAppearance';
import { isUpcomingEvent } from '../../utils/eventLifecycle';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, SIZE, TYPE, asArray, BRAND,
  PremiumListPage, PremiumPageHeader, HeaderStat, HeaderStatRow, GlassIconButton, NotificationBell3D,
  SurfaceCard, GradientGlyph, LinkRow, GroupTitle, PillTabs, StateView, CardSkeletons, FadeInUp,
} from '../../ui';
import type { GlyphTone } from '../../ui';
import {
  listNotifications, markNotificationRead, markAllNotificationsRead, listAnnouncements, listMemberEvents,
} from '../../services/memberApi';
import api, { getUserData } from '../../services/api';
import { notificationDestination } from '../../services/pushNotifications';

/**
 * ============================================================================
 * THE BELL — website `features/member/components/MemberTopBar.tsx`
 * ============================================================================
 *
 * Three things reach a member, and only one is a stored notification:
 *
 *   GET /notifications?page=1&limit=10   rows written for THIS member (isRead on the server)
 *   GET /events                           events the association published (targeting applied server-side)
 *   GET /announcements?limit=10           association updates (targeting applied server-side)
 *
 * Merged at read time, last 24 hours only (FEED_WINDOW_MS). An item with NO
 * usable date is KEPT — a missing timestamp is missing information, not proof
 * of age. Older items live on Events and Association Updates (the two footer
 * links), and the empty state names the window.
 *
 * Read state has two halves and needs both (CLAUDE.md "The bell shows 24 hours"):
 *   seenAt     one timestamp — "anything older is old news"
 *   dismissed  the ids ticked off by hand — survives a newer item moving seenAt
 * Both per account in AsyncStorage. Stored notifications are ALSO marked on the
 * server. Opening the screen marks nothing; reading is deliberate — the tick on
 * a row, opening a row, or "Mark all read".
 */

type FeedKind = 'notification' | 'event' | 'update';

interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  detail: string;
  /** ISO timestamp, or '' when the source carried none. */
  at: string;
  unread: boolean;
  go: { route: string; params?: any };
  /** Glyph for the row (visual only). */
  icon?: string;
  tone?: GlyphTone;
}

const FEED_WINDOW_MS = 24 * 60 * 60 * 1000;
const SEEN_KEY = 'activ:memberFeedSeenAt';
const READ_KEY = 'activ:memberFeedRead';

const accountSuffix = async (): Promise<string> => {
  try {
    const u = await getUserData();
    return String(u?.email || 'anon').toLowerCase();
  } catch {
    return 'anon';
  }
};

const readSeenAt = async (acct: string): Promise<number> => {
  try {
    const n = Number((await AsyncStorage.getItem(`${SEEN_KEY}:${acct}`)) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const writeSeenAt = async (acct: string, value: number) => {
  try { await AsyncStorage.setItem(`${SEEN_KEY}:${acct}`, String(value)); } catch { /* storage unavailable */ }
};

const readDismissed = async (acct: string): Promise<Set<string>> => {
  try {
    const raw = JSON.parse((await AsyncStorage.getItem(`${READ_KEY}:${acct}`)) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
};

/** Capped, newest last — far more than a 24-hour window can hold. */
const writeDismissed = async (acct: string, ids: Set<string>) => {
  try { await AsyncStorage.setItem(`${READ_KEY}:${acct}`, JSON.stringify(Array.from(ids).slice(-200))); } catch { /* storage unavailable */ }
};

const time = (value?: string | null): number => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** "3h ago", "2 Sep". Relative while it is news, dated once it is not. */
const when = (value: string): string => {
  const at = time(value);
  if (!at) return '';
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;
  const d = new Date(at);
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
};

/** Look per kind. A stored notification refines it from its `data` (a message, a payment). */
const KIND_STYLE: Record<FeedKind, { icon: string; tone: GlyphTone; color: string; label: string }> = {
  notification: { icon: 'notifications-active', tone: 'blue', color: PALETTE.blueDark, label: 'For you' },
  event: { icon: 'event-available', tone: 'sky', color: PALETTE.skyDark, label: 'Event' },
  update: { icon: 'campaign', tone: 'amber', color: PALETTE.amberDark, label: 'Update' },
};

/** A stored notification's glyph from what it is about. Visual only. */
const notificationLook = (row: any): { icon: string; tone: GlyphTone } => {
  const data = row?.data || {};
  const ev = String(data?.event || data?.kind || row?.type || '').toLowerCase();
  if (data?.kind === 'message' || ev.includes('message')) return { icon: 'forum', tone: 'teal' };
  if (data?.orderId || ev.includes('payment') || ev.includes('membership')) return { icon: 'payments', tone: 'green' };
  if (ev.includes('reject')) return { icon: 'report-gmailerrorred', tone: 'red' };
  if (ev.includes('approv')) return { icon: 'verified', tone: 'green' };
  if (ev.includes('event') || ev.includes('booking')) return { icon: 'confirmation-number', tone: 'sky' };
  return { icon: 'notifications-active', tone: 'blue' };
};

/** Where a stored notification opens: its thread, its receipt, else the application. */
const notificationTarget = (row: any): { route: string; params?: any } => {
  const target = notificationDestination(row?.data || {});
  return target.route === 'MemberNotifications' ? { route: 'ApplicationStatus' } : target;
};

async function buildFeed(acct: string): Promise<FeedItem[]> {
  const seenAt = await readSeenAt(acct);
  const [personal, events, updates] = await Promise.allSettled([
    listNotifications({ page: 1, limit: 10 }),
    listMemberEvents(),
    listAnnouncements({ limit: 10 }),
  ]);
  const rows: FeedItem[] = [];

  if (personal.status === 'fulfilled') {
    asArray<any>(personal.value).forEach((row) => {
      const id = String(row?._id || row?.id || '');
      if (!id) return;
      rows.push({
        id: `n:${id}`,
        kind: 'notification',
        title: String(row?.title || 'Update'),
        detail: String(row?.message || ''),
        at: row?.createdAt || '',
        unread: row?.isRead !== true,
        go: notificationTarget(row),
        ...notificationLook(row),
      });
    });
  }

  if (events.status === 'fulfilled') {
    asArray<any>(events.value?.events).filter(event => isUpcomingEvent(event)).forEach((event) => {
      const id = String(event?.id || event?._id || '');
      if (!id) return;
      const at = event?.publishedAt || event?.createdAt || event?.startAt || '';
      rows.push({
        id: `e:${id}`,
        kind: 'event',
        title: String(event?.title || 'New event'),
        detail: [event?.venue, event?.district].filter(Boolean).join(' · ') || 'A new event has been published',
        at,
        unread: time(at) > seenAt,
        go: { route: 'MemberEventDetail', params: { id } },
      });
    });
  }

  if (updates.status === 'fulfilled') {
    asArray<any>(updates.value?.announcements).forEach((update) => {
      const id = String(update?.id || update?._id || '');
      if (!id) return;
      const at = update?.publishedAt || '';
      rows.push({
        id: `u:${id}`,
        kind: 'update',
        title: String(update?.title || 'Association update'),
        detail: String(update?.summary || update?.targetLabel || 'A new notice has been published'),
        at,
        unread: time(at) > seenAt,
        go: { route: 'UpdateDetail', params: { id } },
      });
    });
  }

  // The last 24 hours — an item with no usable date is kept.
  const cutoff = Date.now() - FEED_WINDOW_MS;
  const recent = rows.filter((row) => !row.at || !time(row.at) || time(row.at) >= cutoff);

  // Dismissed by hand beats every other signal.
  const dismissed = await readDismissed(acct);
  recent.forEach((row) => { if (dismissed.has(row.id)) row.unread = false; });

  recent.sort((a, b) => time(b.at) - time(a.at));
  return recent.slice(0, 20);
}

/** The bell's badge on the dashboards (website MemberTopBar unreadCount). Never throws. */
export const feedUnreadCount = async (): Promise<number> => {
  try {
    const acct = await accountSuffix();
    return (await buildFeed(acct)).filter((i) => i.unread).length;
  } catch {
    return 0;
  }
};

type Filter = 'all' | 'unread';

function Row({ item, index, onOpen, onTick }: { item: FeedItem; index: number; onOpen: () => void; onTick: () => void }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const k = KIND_STYLE[item.kind] || KIND_STYLE.notification;
  const ago = when(item.at);
  return (
    <FadeInUp delay={Math.min(index, 8) * 50} distance={12}>
      <SurfaceCard padded={false} accent={item.unread ? '#BFD4FB' : undefined} contentStyle={item.unread ? styles.unreadBg : null}>
        <View style={styles.row}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onOpen}
            style={styles.rowMain}
            accessibilityRole="button"
            accessibilityLabel={`${k.label}: ${item.title}${item.unread ? ', unread' : ''}${ago ? `, ${ago}` : ''}`}
          >
            <View>
              <GradientGlyph icon={item.icon || k.icon} tone={item.tone || k.tone} size={44} />
              {item.unread ? <View style={styles.glyphDot} /> : null}
            </View>
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={[styles.kind, { color: k.color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{(k.label || '').toUpperCase()}</Text>
                {ago ? (
                  <View style={styles.timePill}>
                    <Icon name="schedule" size={11} color={PALETTE.textFaint} />
                    <Text style={styles.time} numberOfLines={1} maxFontSizeMultiplier={1.2}>{ago}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.title, item.unread && styles.titleUnread]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item.title}</Text>
              {item.detail ? <Text style={styles.msg} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item.detail}</Text> : null}
            </View>
          </TouchableOpacity>
          {item.unread ? (
            <TouchableOpacity
              onPress={onTick}
              style={styles.tick}
              accessibilityRole="button"
              accessibilityLabel={`Mark "${item.title}" as read`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="check" size={SIZE.iconSm + 2} color={PALETTE.blue} />
            </TouchableOpacity>
          ) : (
            <View style={styles.readMark} importantForAccessibility="no-hide-descendants">
              <Icon name="done-all" size={SIZE.iconSm} color={PALETTE.textFaint} />
            </View>
          )}
        </View>
      </SurfaceCard>
    </FadeInUp>
  );
}

const NotificationScreen = () => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acct, setAcct] = useState('anon');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    try {
      const a = await accountSuffix();
      setAcct(a);
      setItems(await buildFeed(a));
    } catch {
      // A bell that throws is worse than an empty one.
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Rebuilt whenever the screen regains focus — a payment changes what may be seen.
  // Opening marks NOTHING read: reading is deliberate (tick, open, or Mark all read).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const all = useMemo(() => items || [], [items]);
  const unreadCount = useMemo(() => all.filter((i) => i.unread).length, [all]);
  const personalCount = useMemo(() => all.filter((i) => i.kind === 'notification').length, [all]);
  const associationCount = all.length - personalCount;
  const rows = useMemo(() => (filter === 'unread' ? all.filter((i) => i.unread) : all), [all, filter]);

  const markOne = useCallback(async (item: FeedItem) => {
    setItems((current) => (current || []).map((row) => (row.id === item.id ? { ...row, unread: false } : row)));
    const dismissed = await readDismissed(acct);
    dismissed.add(item.id);
    await writeDismissed(acct, dismissed);
    if (item.kind === 'notification') {
      // Best effort — a failed call means the dot returns on the next load.
      markNotificationRead(item.id.replace(/^n:/, '')).catch(() => {});
    }
  }, [acct]);

  const markAll = useCallback(async () => {
    const unread = (items || []).filter((i) => i.unread);
    setItems((current) => (current || []).map((row) => ({ ...row, unread: false })));
    await writeSeenAt(acct, Date.now());
    const dismissed = await readDismissed(acct);
    unread.forEach((i) => dismissed.add(i.id));
    await writeDismissed(acct, dismissed);
    if (unread.some((i) => i.kind === 'notification')) {
      try { await markAllNotificationsRead(); } catch { /* the badge returning is the fallback */ }
    }
  }, [items, acct]);

  const open = (item: FeedItem) => {
    if (item.unread) markOne(item);
    if (item.kind === 'notification') void api.patch(`/notifications/${encodeURIComponent(item.id.replace(/^n:/, ''))}/open`, { channel: 'in_app' }).catch(() => undefined);
    try {
      navigation.navigate(item.go.route, item.go.params);
    } catch (err) {
      console.warn('Notification navigation safely caught:', err);
    }
  };

  const go = (route: string) => {
    try { navigation.navigate(route); } catch (err) { console.warn('Navigation safely caught:', err); }
  };

  // Mounted both as a (hidden) tab and as a stack route — back only when there is somewhere to go.
  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

  const header = (
    <PremiumPageHeader
      eyebrow="The last 24 hours"
      title="Notifications"
      subtitle={loading ? 'Checking for news…' : unreadCount ? `${unreadCount} new since you last looked` : 'You are all caught up'}
      onBack={canGoBack ? () => navigation.goBack() : undefined}
      right={unreadCount ? <GlassIconButton icon="done-all" onPress={markAll} accessibilityLabel="Mark all read" /> : undefined}
      art={<NotificationBell3D size={88} />}
    >
      <HeaderStatRow>
        <HeaderStat icon="fiber-new" value={loading ? '–' : unreadCount} label="Unread" />
        <HeaderStat icon="person-outline" value={loading ? '–' : personalCount} label="For you" />
        <HeaderStat icon="campaign" value={loading ? '–' : associationCount} label="Association" />
      </HeaderStatRow>
    </PremiumPageHeader>
  );

  const listHeader = loading || all.length === 0 ? null : (
    <View style={styles.listHeader}>
      <PillTabs<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: all.length, icon: 'inbox' },
          { value: 'unread', label: 'Unread', count: unreadCount, icon: 'mark-email-unread' },
        ]}
      />
      {unreadCount ? (
        <TouchableOpacity onPress={markAll} style={styles.markAll} accessibilityRole="button" accessibilityLabel="Mark all read">
          <Icon name="done-all" size={16} color={PALETTE.blue} />
          <Text style={styles.markAllText} maxFontSizeMultiplier={1.3}>Mark all read</Text>
        </TouchableOpacity>
      ) : <View style={styles.listHeaderGap} />}
    </View>
  );

  // Older items live on the two full lists.
  const footer = loading ? null : (
    <View>
      <GroupTitle title="Browse everything" subtitle="Older news is kept on the full lists" />
      <SurfaceCard padded={false} style={styles.gutter}>
        <LinkRow icon="event" tone="sky" title="All events" subtitle="Upcoming, past and your registrations" onPress={() => go('MemberEvents')} />
        <LinkRow icon="campaign" tone="amber" title="All updates" subtitle="Every association notice for your region" onPress={() => go('AssociationUpdates')} last />
      </SurfaceCard>
    </View>
  );

  return (
    <PremiumListPage<FeedItem>
      header={header}
      listHeader={listHeader}
      data={loading ? [] : rows}
      keyExtractor={(n, i) => String(n?.id || i)}
      renderItem={({ item, index }) => <Row item={item} index={index} onOpen={() => open(item)} onTick={() => markOne(item)} />}
      ListEmptyComponent={loading ? <CardSkeletons rows={5} /> : filter === 'unread' && all.length > 0 ? (
        <StateView
          compact
          art={<NotificationBell3D size={64} />}
          title="No unread notifications"
          message="Everything from the last 24 hours has been read."
          action="Show all"
          onAction={() => setFilter('all')}
        />
      ) : (
        <StateView
          art={<NotificationBell3D size={84} />}
          title="Nothing in the last 24 hours"
          message="New events and association notices appear here for a day. Everything else is under All events and All updates."
        />
      )}
      ListFooterComponent={footer}
      refreshing={refreshing}
      onRefresh={() => load('refresh')}
    />
  );
};

const styles = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  listHeader: { marginTop: -SPACE.md },
  listHeaderGap: { height: SPACE.md },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, alignSelf: 'flex-end', minHeight: SIZE.touch, paddingHorizontal: SPACE.lg },
  markAllText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blue },
  unreadBg: { backgroundColor: '#F7FAFF' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, padding: SPACE.lg, paddingRight: SPACE.sm },
  glyphDot: { position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderRadius: 7, backgroundColor: PALETTE.red, borderWidth: 2, borderColor: PALETTE.white },
  text: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs },
  kind: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, flexShrink: 1 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', flexShrink: 0 },
  time: { ...TYPE.caption, fontSize: 11, lineHeight: 13, color: PALETTE.textFaint },
  title: { ...TYPE.bodyStrong, fontSize: 15, fontWeight: '600', color: PALETTE.textSoft },
  titleUnread: { fontWeight: '800', color: BRAND.navy },
  msg: { ...TYPE.caption, fontSize: 13, lineHeight: 18, fontWeight: '400', marginTop: 3 },
  tick: { width: 36, height: 36, borderRadius: 18, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
  readMark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: SPACE.md },
});

export default NotificationScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
