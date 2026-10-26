import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Badge, PALETTE, SPACE, SIZE, TYPE, asArray, timeAgo, BRAND,
  PremiumListPage, PremiumPageHeader, HeaderStat, HeaderStatRow, Megaphone3D,
  SurfaceCard, GradientGlyph, GroupTitle, SearchPill, StateView, CardSkeletons, FadeInUp, FitImage, PressableScale } from '../../../ui';
import { listAnnouncements } from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { useLoad } from '../useLoad';
import { CATEGORIES, categoryStyle, useCategoryStyle, categoryGlyph } from './updateFormat';

/**
 * Association Updates — website `features/member/pages/AssociationUpdates.tsx`.
 *
 * GET /announcements — already scoped to this member's state, district and
 * block by the server, so there is no "another region" control: the targeting
 * is the feature. Category pills and search only narrow what has arrived, and
 * only the categories actually present get a pill. Pinned first, as its own
 * group (the website renders the pinned and the rest as two stacks).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Row =
  | { kind: 'heading'; key: string; title: string; count: number }
  | { kind: 'update'; key: string; u: any; index: number };

const publishedTime = (u: any) => {
  const t = new Date(u?.publishedAt || '').getTime();
  return Number.isNaN(t) ? 0 : t;
};

function UpdateCard({ u, index, onPress }: { u: any; index: number; onPress: () => void }) {
  const categoryStyle = useCategoryStyle();
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const style = categoryStyle(u?.category);
  const glyph = categoryGlyph(u?.category);
  const banner = u?.bannerUrl ? resolveMediaUrl(u.bannerUrl) : '';
  const ago = timeAgo(u?.publishedAt);
  const fresh = publishedTime(u) > Date.now() - 24 * 60 * 60 * 1000;
  return (
    <FadeInUp delay={Math.min(index, 6) * 60} distance={14}>
      <SurfaceCard
        padded={false}
        accent={u?.pinned ? '#BFD4FB' : undefined}
      >
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${style.label}${u?.pinned ? ', pinned' : ''}: ${u?.title || 'Update'}`}>
        {banner ? (
          <View>
            <FitImage uri={banner} style={styles.banner} accessibilityLabel={u?.bannerAlt || ''} />
            <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.55)']} style={styles.bannerShade} pointerEvents="none" />
            <View style={styles.bannerBadges}>
              <Badge label={style.label} color={style.fg} bg={style.bg} size="sm" />
              {u?.pinned ? <Badge label="Pinned" icon="push-pin" color={PALETTE.white} bg={BRAND.blue} size="sm" /> : null}
            </View>
          </View>
        ) : null}
        <View style={styles.body}>
          <View style={styles.headRow}>
            {!banner ? <GradientGlyph icon={glyph.icon} tone={glyph.tone} size={44} /> : null}
            <View style={styles.flexMin}>
              <View style={styles.metaRow}>
                {!banner ? <Text style={[styles.cat, { color: style.fg }]} numberOfLines={1}>{style.label.toUpperCase()}</Text> : null}
                {!banner && u?.pinned ? (
                  <View style={styles.pin}><Icon name="push-pin" size={11} color={PALETTE.blueDark} /><Text style={styles.pinText}>PINNED</Text></View>
                ) : null}
                {fresh ? <View style={styles.newDot}><Text style={styles.newText}>NEW</Text></View> : null}
                {ago ? <Text style={styles.date} numberOfLines={1}>{ago}</Text> : null}
              </View>
              <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{u?.title || 'Update'}</Text>
            </View>
          </View>
          {u?.summary ? <Text style={styles.summary} numberOfLines={3} maxFontSizeMultiplier={1.3}>{u.summary}</Text> : null}
          <View style={styles.foot}>
            <View style={styles.footItem}>
              <Icon name="place" size={SIZE.iconSm} color={PALETTE.textFaint} />
              <Text style={styles.target} numberOfLines={1}>{u?.targetLabel ? u.targetLabel : 'For all members'}</Text>
            </View>
            {u?.attachmentUrl ? (
              <View style={styles.attach}>
                <Icon name="attach-file" size={14} color={PALETTE.blue} />
                <Text style={styles.attachText} numberOfLines={1}>{u?.attachmentLabel || 'Attachment'}</Text>
              </View>
            ) : null}
            <Icon name="arrow-forward" size={18} color={PALETTE.blue} />
          </View>
        </View>
        </PressableScale>
      </SurfaceCard>
    </FadeInUp>
  );
}

const AssociationUpdatesScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const { data, loading, error, reload, refreshing, refresh } = useLoad<any>(() => listAnnouncements(), [], { announcements: [] });
  const updates = useMemo(() => asArray<any>(data?.announcements), [data]);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const present = new Set(updates.map((u) => String(u?.category || 'general')));
    return CATEGORIES.filter((k) => k === 'all' || present.has(k));
  }, [updates]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: updates.length };
    updates.forEach((u) => { const k = String(u?.category || 'general'); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [updates]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - WEEK_MS;
    return {
      total: updates.length,
      pinned: updates.filter((u) => u?.pinned).length,
      week: updates.filter((u) => publishedTime(u) >= weekAgo).length,
    };
  }, [updates]);

  const visible = useMemo(() => {
    const term = (query || '').trim().toLowerCase();
    return updates.filter((u) => {
      if (category !== 'all' && String(u?.category || 'general') !== category) return false;
      if (!term) return true;
      return [u?.title, u?.summary, u?.targetLabel].some((f) => String(f || '').toLowerCase().includes(term));
    });
  }, [updates, category, query]);

  const rows = useMemo<Row[]>(() => {
    const pinned = visible.filter((u) => u?.pinned);
    const rest = visible.filter((u) => !u?.pinned);
    const out: Row[] = [];
    let n = 0;
    if (pinned.length) {
      out.push({ kind: 'heading', key: 'h:pinned', title: 'Pinned', count: pinned.length });
      pinned.forEach((u, i) => { out.push({ kind: 'update', key: `p:${String(u?.id || u?._id || i)}`, u, index: n++ }); });
    }
    if (rest.length) {
      if (pinned.length) out.push({ kind: 'heading', key: 'h:latest', title: 'Latest', count: rest.length });
      rest.forEach((u, i) => { out.push({ kind: 'update', key: `u:${String(u?.id || u?._id || i)}`, u, index: n++ }); });
    }
    return out;
  }, [visible]);

  const open = (u: any) => {
    const id = String(u?.id || u?._id || '');
    if (id) navigation.navigate('UpdateDetail', { id });
  };

  const header = (
    <PremiumPageHeader
      eyebrow="News for your region"
      title="Association Updates"
      subtitle="Notices for your state, district and block"
      onBack={() => navigation.goBack()}
      art={<Megaphone3D size={88} />}
    >
      <HeaderStatRow>
        <HeaderStat icon="campaign" value={loading ? '–' : stats.total} label="Updates" />
        <HeaderStat icon="push-pin" value={loading ? '–' : stats.pinned} label="Pinned" />
        <HeaderStat icon="today" value={loading ? '–' : stats.week} label="This week" />
      </HeaderStatRow>
      {!loading && !error && updates.length > 0 ? (
        <SearchPill value={query} onChangeText={setQuery} placeholder="Search updates" style={styles.search} />
      ) : null}
    </PremiumPageHeader>
  );

  const listHeader = !loading && !error && available.length > 1 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
      {available.map((k) => {
        const on = category === k;
        const label = k === 'all' ? 'All' : categoryStyle(k).label;
        return (
          <TouchableOpacity
            key={k}
            onPress={() => setCategory(k)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label}, ${counts[k] || 0}`}
          >
            {on ? (
              <LinearGradient colors={[BRAND.blue900, BRAND.blue]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, styles.chipOn]}>
                {k !== 'all' ? <Icon name={categoryGlyph(k).icon} size={14} color={PALETTE.white} /> : null}
                <Text style={[styles.chipText, { color: PALETTE.white }]} maxFontSizeMultiplier={1.2}>{label}</Text>
                <Text style={[styles.chipCount, { color: 'rgba(255,255,255,0.8)' }]} maxFontSizeMultiplier={1.1}>{counts[k] || 0}</Text>
              </LinearGradient>
            ) : (
              <View style={styles.chip}>
                {k !== 'all' ? <Icon name={categoryGlyph(k).icon} size={14} color={PALETTE.textMuted} /> : null}
                <Text style={styles.chipText} maxFontSizeMultiplier={1.2}>{label}</Text>
                <Text style={styles.chipCount} maxFontSizeMultiplier={1.1}>{counts[k] || 0}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  ) : <View style={{ height: SPACE.xs }} />;

  return (
    <PremiumListPage<Row>
      header={header}
      listHeader={listHeader}
      data={loading || error ? [] : rows}
      keyExtractor={(r, i) => String(r?.key || i)}
      gutter={false}
      renderItem={({ item }) => (item.kind === 'heading' ? (
        <GroupTitle title={item.title} count={item.count} style={styles.group} />
      ) : (
        <View style={styles.row}><UpdateCard u={item.u} index={item.index} onPress={() => open(item.u)} /></View>
      ))}
      ListEmptyComponent={loading ? <CardSkeletons rows={4} variant="media" /> : error ? (
        <StateView kind="error" title="Updates could not be loaded" message={error} onAction={reload} />
      ) : (
        <StateView
          art={<Megaphone3D size={84} />}
          title={updates.length === 0 ? 'No updates yet' : 'Nothing matches that'}
          message={updates.length === 0 ? 'Notices published for your region will appear here.' : 'Try a different category, or clear the search box.'}
          action={updates.length === 0 ? undefined : 'Clear filters'}
          onAction={updates.length === 0 ? undefined : () => { setQuery(''); setCategory('all'); }}
        />
      )}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  search: { marginTop: SPACE.md },
  chips: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: SPACE.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: SPACE.md, borderRadius: 999,
    backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border,
  },
  chipOn: { borderWidth: 0 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700', color: PALETTE.textSoft },
  chipCount: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: PALETTE.textFaint, fontVariant: ['tabular-nums'] },
  group: { marginTop: SPACE.sm },
  row: { paddingHorizontal: SPACE.lg, marginBottom: SPACE.md },
  banner: { width: '100%', height: 160, backgroundColor: PALETTE.field },
  bannerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 70 },
  bannerBadges: { position: 'absolute', left: SPACE.md, bottom: SPACE.md, flexDirection: 'row', gap: SPACE.sm },
  body: { padding: SPACE.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  cat: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  pin: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pinText: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, color: PALETTE.blueDark },
  newDot: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: PALETTE.greenSoft },
  newText: { fontSize: 9, lineHeight: 12, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.greenDark },
  date: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint, marginLeft: 'auto' },
  title: { ...TYPE.heading, marginTop: SPACE.xs },
  summary: { ...TYPE.body, fontSize: 13, lineHeight: 19, color: PALETTE.textMuted, marginTop: SPACE.sm },
  foot: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  footItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  target: { ...TYPE.caption, flex: 1, minWidth: 0 },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '45%', paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: PALETTE.blueSoft },
  attachText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: PALETTE.blueDark, flexShrink: 1 },
});

export default AssociationUpdatesScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
