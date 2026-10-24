import StudentNetworkingGate from '../StudentNetworkingGate';
import { isStudentMembership } from '../../../utils/memberAudience';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, asArray, timeAgo,
  PremiumListPage, PremiumPage, PremiumPageHeader, HeaderStat, HeaderStatRow, PREMIUM_OVERLAP, GlassIconButton,
  SurfaceCard, GradientGlyph, PillTabs, SearchPill, StateView, CardSkeletons, GradientAvatar, GradientButton,
  FadeInUp, ArtBadge, ChatBubbles3D, BRAND,
} from '../../../ui';
import { listConversations } from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { useMemberAccess, useLockedCta, runMembershipCta } from '../useMemberAccess';
import MemberLocked, { GateBenefitItem } from '../MemberLocked';
import { useLoad } from '../useLoad';
import { memberFacing, MEMBERS_ONLY_COPY, timeOf, OPENERS } from './messageCopy';

/**
 * Messages — website `MemberMessages` + `MemberInbox` (the conversation pane).
 *
 * GET /messages → { conversations, unreadTotal }, re-read quietly every 10 s
 * while the screen is in front (the website's poll). Direct messages are a
 * membership benefit on BOTH ends; an unpaid member gets the website's
 * MembershipGate: MEMBERS_ONLY_COPY, what the membership covers (two of which
 * are open now), and the ONE next step from `membershipCta`.
 *
 * Premium: live figures on the header (threads · unread · today), All/Unread
 * tabs and a name search over the loaded list — local only, no new request.
 */

const GATE_BENEFITS: GateBenefitItem[] = [
  { icon: 'chat', title: 'Direct messages', detail: 'Write to any member of the association from their directory card.' },
  { icon: 'handshake', title: 'Member connections', detail: 'Introduce your business to members trading in your sector.' },
  { icon: 'verified', title: 'Membership certificate', detail: 'Your certificate and tax exemption document, issued on activation.' },
  { icon: 'campaign', title: 'Members-only notices', detail: 'Updates the association publishes to active members alone.' },
  { icon: 'event', title: 'Events programme', detail: 'Browse the programme and register for a seat — open to you now.', open: true },
  { icon: 'groups', title: 'ACTIV Network', detail: 'See who is already a member across the state — open to you now.', open: true },
];

type Tab = 'all' | 'unread';

const isToday = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === new Date().toDateString();
};

/** "4:05 pm" today (the website's timeOf), "5 min ago" style otherwise. */
const whenOf = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ms = Date.now() - d.getTime();
  if (ms >= 0 && ms < 60 * 60 * 1000) return timeAgo(iso);
  return isToday(iso) ? timeOf(iso) : timeAgo(iso);
};

function ConversationRow({ c, onPress, index }: { c: any; onPress: () => void; index: number }) {
  const who = c?.withMember || {};
  const unread = Number(c?.unread || 0);
  const photo = who?.photoUrl ? resolveMediaUrl(who.photoUrl) : '';
  const where = who?.organizationName || [who?.block, who?.district, who?.state].filter(Boolean).join(', ');
  return (
    <FadeInUp delay={Math.min(index, 6) * 50} distance={12}>
      <SurfaceCard
        onPress={onPress}
        accent={unread > 0 ? '#BFD4FB' : undefined}
        contentStyle={[styles.row, unread > 0 && styles.rowUnread]}
        padded={false}
        accessibilityLabel={`${who?.fullName || 'Member'}${unread > 0 ? `, ${unread} unread` : ''}`}
      >
        <GradientAvatar name={who?.fullName || 'Member'} uri={photo || undefined} size={54} ring={unread > 0} />
        <View style={styles.rowText}>
          <View style={styles.top}>
            <Text style={[styles.name, unread > 0 && { fontWeight: '800' }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{who?.fullName || 'Member'}</Text>
            <Text style={[styles.time, unread > 0 && { color: PALETTE.blue, fontWeight: '700' }]} numberOfLines={1}>{whenOf(c?.lastMessageAt)}</Text>
          </View>
          {where ? (
            <View style={styles.whereRow}>
              <Icon name={who?.organizationName ? 'storefront' : 'place'} size={12} color={PALETTE.textFaint} />
              <Text style={styles.org} numberOfLines={1}>{where}</Text>
            </View>
          ) : null}
          <View style={styles.top}>
            <Text style={[styles.last, unread > 0 && { color: PALETTE.text, fontWeight: '700' }]} numberOfLines={1}>
              {c?.lastMessageMine ? <Text style={styles.you}>You: </Text> : null}
              {c?.lastMessageText || 'No messages yet'}
            </Text>
            {unread > 0 ? (
              <View style={styles.badge}><Text style={styles.badgeText} maxFontSizeMultiplier={1}>{unread > 99 ? '99+' : unread}</Text></View>
            ) : c?.lastMessageMine ? <Icon name="done-all" size={16} color={PALETTE.textFaint} /> : null}
          </View>
        </View>
      </SurfaceCard>
    </FadeInUp>
  );
}

/** Website PaneWelcome with no conversations: the three openers and Find a member. */
function Welcome({ onFind }: { onFind: () => void }) {
  return (
    <View style={styles.welcome}>
      <ArtBadge size={112}><ChatBubbles3D size={84} /></ArtBadge>
      <Text style={styles.welcomeTitle}>Talk business with a member</Text>
      <Text style={styles.welcomeText}>
        Find a member in ACTIV Network, open their profile and choose Message. A first message usually starts with one of these:
      </Text>
      {OPENERS.map((o, i) => (
        <FadeInUp key={o.label} delay={120 + i * 70} style={{ alignSelf: 'stretch' }}>
          <SurfaceCard style={styles.opener} contentStyle={styles.openerInner}>
            <GradientGlyph icon={o.icon} tone={i === 0 ? 'blue' : i === 1 ? 'teal' : 'amber'} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.openerTitle}>{o.label}</Text>
              <Text style={styles.openerHint}>{o.hint}</Text>
            </View>
          </SurfaceCard>
        </FadeInUp>
      ))}
      <GradientButton label="Find a member" icon="search" onPress={onFind} style={{ alignSelf: 'stretch', marginTop: SPACE.sm }} />
    </View>
  );
}

const MemberMessagesScreen = ({ navigation }: any) => {
  const { paid, profile, loading: accessLoading } = useMemberAccess();
  const cta = useLockedCta(paid, profile);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const { data, setData, loading, error, reload, refreshing, refresh } = useLoad<any>(
    async () => {
      try { return await listConversations(); } catch (err) { throw new Error(memberFacing(err, 'Could not load your messages')); }
    },
    [],
    { conversations: [], unreadTotal: 0 },
  );

  // Coming back from a thread updates the unread counts (skip the first focus — useLoad already loaded).
  const seen = useRef(false);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (seen.current && paid) refresh();
    seen.current = true;
    return () => { focused.current = false; };
  }, [paid])); // eslint-disable-line react-hooks/exhaustive-deps

  // The website polls the inbox every 10 s while it is on screen — quietly.
  useEffect(() => {
    if (!paid) return undefined;
    const timer = setInterval(() => {
      if (!focused.current) return;
      listConversations().then((d) => { if (d) setData(d); }).catch(() => null);
    }, 10000);
    return () => clearInterval(timer);
  }, [paid, setData]);

  const list = asArray<any>(data?.conversations);
  const unread = Number(data?.unreadTotal || 0);
  const unreadThreads = useMemo(() => list.filter((c) => Number(c?.unread || 0) > 0), [list]);
  const today = useMemo(() => list.filter((c) => isToday(c?.lastMessageAt)).length, [list]);
  const shown = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    const base = tab === 'unread' ? unreadThreads : list;
    if (!q) return base;
    return base.filter((c) => {
      const w = c?.withMember || {};
      return [w?.fullName, w?.organizationName, w?.district, w?.block, c?.lastMessageText]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [list, unreadThreads, tab, query]);

  const find = () => navigation.navigate('MemberDirectory');
  const findButton = <GlassIconButton icon="person-search" onPress={find} accessibilityLabel="Find a member to message" />;

  const header = (withLive: boolean) => (
    <PremiumPageHeader
      eyebrow="Member conversations"
      title="Messages"
      subtitle="Private, one member to one member"
      onBack={() => navigation.goBack()}
      right={withLive ? findButton : undefined}
      art={<ChatBubbles3D size={84} />}
      artSize={84}
    >
      {withLive && !loading && !error ? (
        <View style={{ gap: SPACE.md }}>
          <HeaderStatRow>
            <HeaderStat icon="forum" value={list.length} label={list.length === 1 ? 'Thread' : 'Threads'} />
            <HeaderStat icon="mark-chat-unread" value={unread} label="Unread" />
            <HeaderStat icon="today" value={today} label="Today" />
          </HeaderStatRow>
          {list.length > 0 ? <SearchPill value={query} onChangeText={setQuery} placeholder="Search conversations" /> : null}
        </View>
      ) : null}
    </PremiumPageHeader>
  );

  if (accessLoading && !profile) {
    return (
      <PremiumPage header={header(false)}>
        <View style={styles.overlap}><CardSkeletons rows={5} /></View>
      </PremiumPage>
    );
  }
  if (isStudentMembership(profile)) return <StudentNetworkingGate navigation={navigation} />;

  if (!paid) {
    return (
      <PremiumPage header={header(false)}>
        <View style={styles.overlap}>
          <MemberLocked
            title={MEMBERS_ONLY_COPY.title}
            detail={MEMBERS_ONLY_COPY.detail}
            benefits={GATE_BENEFITS}
            action={cta.label}
            actionDetail={cta.detail}
            onActivate={() => runMembershipCta(navigation, cta.target, profile)}
          />
        </View>
      </PremiumPage>
    );
  }

  const listHeader = loading || error || list.length === 0 ? <View style={styles.overlapSpacer} /> : (
    <View style={styles.overlap}>
      <PillTabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: 'All', count: list.length, icon: 'forum' },
          { value: 'unread', label: 'Unread', count: unreadThreads.length, icon: 'mark-chat-unread' },
        ]}
      />
      <View style={styles.privacy}>
        <Icon name="lock-outline" size={14} color={PALETTE.greenDark} />
        <Text style={styles.privacyText}>Between you and one fellow member — nobody else reads them</Text>
      </View>
    </View>
  );

  return (
    <PremiumListPage<any>
      header={header(true)}
      listHeader={listHeader}
      data={loading ? [] : shown}
      keyExtractor={(c, i) => String(c?.id || c?._id || i)}
      renderItem={({ item, index }) => (
        <ConversationRow
          c={item}
          index={index}
          onPress={() => navigation.navigate('MessageThread', { conversationId: String(item?.id || ''), name: item?.withMember?.fullName })}
        />
      )}
      ListEmptyComponent={loading ? <CardSkeletons rows={5} /> : error ? (
        <StateView kind="error" title="Could not load your messages" message={error} onAction={reload} />
      ) : list.length === 0 ? <Welcome onFind={find} /> : (
        <StateView
          compact
          art={<ChatBubbles3D size={64} />}
          title={tab === 'unread' && !query ? 'You are all caught up' : 'No conversations match'}
          message={tab === 'unread' && !query ? 'Every message has been read.' : 'Try a different name, or clear the search.'}
          action={query ? 'Clear search' : tab === 'unread' ? 'Show all' : undefined}
          onAction={query ? () => setQuery('') : tab === 'unread' ? () => setTab('all') : undefined}
        />
      )}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP, marginBottom: SPACE.sm },
  overlapSpacer: { marginTop: -SPACE.sm },
  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, marginHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.xs,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: 14, backgroundColor: PALETTE.successSoft,
  },
  privacyText: { ...TYPE.caption, flex: 1, minWidth: 0, color: PALETTE.greenDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, minHeight: 80 },
  rowUnread: { backgroundColor: PALETTE.blueTint },
  rowText: { flex: 1, minWidth: 0 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  name: { ...TYPE.subheading, flex: 1, minWidth: 0 },
  whereRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  org: { ...TYPE.caption, flexShrink: 1 },
  time: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint, flexShrink: 0 },
  last: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, color: PALETTE.textMuted, marginTop: 3 },
  you: { color: BRAND.blue900, fontWeight: '700' },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: PALETTE.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: PALETTE.white, fontSize: 11, fontWeight: '800' },
  welcome: { alignItems: 'center', paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  welcomeTitle: { ...TYPE.title, fontSize: 19, marginTop: SPACE.lg, textAlign: 'center' },
  welcomeText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.xs + 2, marginBottom: SPACE.lg, maxWidth: 340 },
  opener: { marginBottom: SPACE.md },
  openerInner: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, padding: SPACE.md },
  openerTitle: { ...TYPE.bodyStrong },
  openerHint: { ...TYPE.caption, fontWeight: '400', lineHeight: 17, marginTop: 2 },
});

export default MemberMessagesScreen;
