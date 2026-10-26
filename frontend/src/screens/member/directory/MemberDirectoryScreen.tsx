import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import StudentNetworkingGate from '../StudentNetworkingGate';
import { isStudentMembership } from '../../../utils/memberAudience';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, SIZE, errorText, asArray,
  PremiumListPage, PremiumPage, PremiumPageHeader, GlassCountButton, HeaderStat, HeaderStatRow, PREMIUM_OVERLAP,
  SurfaceCard, SearchPill, StateView, CardSkeletons, PremiumSelect, GradientAvatar, GradientGlyph, FadeInUp,
  DirectorySearch3D, BRAND, FitImage } from '../../../ui';
import { searchDirectory, getDirectorySectors } from '../../../services/memberApi';
import { getStates, getDistricts, getBlocks } from '../../../services/regions';
import { resolveMediaUrl } from '../../../config/api.config';
import { useMemberAccess, useLockedCta, runMembershipCta } from '../useMemberAccess';
import MemberLocked from '../MemberLocked';

/**
 * MEMBER DIRECTORY — website `features/member/pages/MemberDirectory.tsx`.
 *
 * GET /members/directory?q&state&district&block&sector&page&limit=20
 * GET /members/directory/sectors · GET /regions/tree?include=all (the region lists)
 *
 * Website parity: the search box (debounced 350 ms), a Filters toggle with a
 * count, State → District → Block → Sector (each child reset when its parent
 * changes), "Clear all filters"; the FIRST search narrows itself to the
 * viewer's own region (`viewerRegion`), with "Search the whole association" /
 * "Back to <home>" beside the count; each card shows photo (and the business
 * logo), name, business (or "No business listed"), region, trade, member
 * since, listings, sector chips, up to four product tiles and "+N more". The
 * page guards itself: an unpaid member gets the locked card and their next
 * step. Contact details are never listed — the directory's contact action is
 * Message, on the member's card.
 *
 * Premium: brand header with the search pill and live figures, removable
 * active-filter chips, and member cards with the photo in a gradient ring.
 */

const PAGE_SIZE = 20;
type Filters = { q: string; state: string; district: string; block: string; sector: string };
const EMPTY_FILTERS: Filters = { q: '', state: '', district: '', block: '', sector: '' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const joinedLabel = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

function Fact({ icon, text, muted }: { icon: string; text: string; muted?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[styles.fact, muted && styles.factMuted]}>
      <Icon name={icon} size={13} color={muted ? PALETTE.textFaint : PALETTE.blue} />
      <Text style={[styles.factText, muted && { color: PALETTE.textFaint }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>{text}</Text>
    </View>
  );
}

function MemberCard({ m, onPress, index }: { m: any; onPress: () => void; index: number }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const photo = resolveMediaUrl(m?.profilePhoto || '');
  const primary = asArray<any>(m?.companies)[0];
  const logo = resolveMediaUrl(primary?.logo || '');
  const where = [m?.block, m?.district, m?.state].filter(Boolean).join(', ');
  const joined = joinedLabel(m?.memberSince);
  const count = Number(m?.productCount || 0);
  const products = asArray<any>(m?.products);
  const sectors = asArray<string>(m?.sectors).filter(Boolean);
  return (
    <FadeInUp delay={Math.min(index, 6) * 60} distance={14}>
      <SurfaceCard onPress={onPress} accessibilityLabel={`${m?.fullName || 'Member'}${primary?.businessName ? `, ${primary.businessName}` : ''}. Open profile`}>
        <View style={styles.cardTop}>
          <GradientAvatar name={m?.fullName || 'Member'} uri={photo || logo || undefined} size={58} status="verified" />
          <View style={styles.cardText}>
            <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.25}>{m?.fullName || 'Member'}</Text>
            <View style={styles.bizRow}>
              {logo && photo ? <Image source={{ uri: logo }} style={styles.bizLogo} /> : (
                <Icon name="storefront" size={14} color={primary?.businessName ? PALETTE.blueDark : PALETTE.textFaint} />
              )}
              <Text style={[styles.biz, !primary?.businessName && { color: PALETTE.textFaint }]} numberOfLines={1} maxFontSizeMultiplier={1.25}>
                {primary?.businessName || 'No business listed'}
              </Text>
            </View>
          </View>
          <View style={styles.chevron}><Icon name="arrow-forward" size={16} color={PALETTE.blue} /></View>
        </View>

        <View style={styles.facts}>
          <Fact icon="place" text={where || 'Region not set'} muted={!where} />
          <Fact icon="business-center" text={primary?.businessType || 'Trade not listed'} muted={!primary?.businessType} />
          <Fact icon="event" text={joined ? `Since ${joined}` : 'Joining date not recorded'} muted={!joined} />
          <Fact icon="inventory-2" text={count === 0 ? 'Nothing listed yet' : `${count} ${count === 1 ? 'listing' : 'listings'}`} muted={count === 0} />
        </View>

        {sectors.length ? (
          <View style={styles.sectors}>
            {sectors.map((s) => (
              <View key={s} style={styles.sector}><Icon name="sell" size={11} color={PALETTE.blueDark} /><Text style={styles.sectorText} numberOfLines={1}>{s}</Text></View>
            ))}
          </View>
        ) : null}

        {products.length ? (
          <View style={styles.products}>
            {products.slice(0, 4).map((p, i) => {
              const src = resolveMediaUrl(p?.imageUrl || '');
              return (
                <View key={String(p?.id || p?.name || i)} style={styles.product}>
                  {src ? <FitImage uri={src} style={styles.productImg} /> : (
                    <View style={[styles.productImg, styles.productFallback]}><Icon name="inventory-2" size={SIZE.iconSm} color={PALETTE.borderStrong} /></View>
                  )}
                  <Text style={styles.productName} numberOfLines={2}>{p?.name || ''}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {count > products.length ? <Text style={styles.more}>+{count - products.length} more in their catalogue</Text> : null}
      </SurfaceCard>
    </FadeInUp>
  );
}

/** "All states" etc. sits first, so a filter can be cleared from the same list. */
const allLabel = (label: string) => `All ${label.toLowerCase()}s`;

function FilterSelect({ label, icon, value, options, onChange, disabled, disabledHint }: {
  label: string; icon: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean; disabledHint?: string;
}) {
  const all = allLabel(label);
  return (
    <PremiumSelect
      label={label}
      icon={icon}
      value={value}
      options={[all, ...(options || [])]}
      onChange={(v) => onChange(v === all ? '' : v)}
      placeholder={disabled ? (disabledHint || 'Not available') : all}
      disabled={disabled}
    />
  );
}

const MemberDirectoryScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const { paid, profile, loading: accessLoading } = useMemberAccess();
  const cta = useLockedCta(paid, profile);
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [home, setHome] = useState({ state: '', district: '', block: '' });
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const defaulted = useRef(false);
  const requestId = useRef(0);

  // Debounce the search box (website: 350 ms).
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === (term || '').trim() ? f : { ...f, q: (term || '').trim() })), 350);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!paid) return;
    getStates().then((list) => setStates((list || []).map((s) => s?.name).filter(Boolean))).catch(() => setStates([]));
    getDirectorySectors().then((list) => setSectors(asArray<string>(list))).catch(() => setSectors([]));
  }, [paid]);

  useEffect(() => {
    if (!filters.state) { setDistricts([]); return; }
    getDistricts(filters.state).then((list) => setDistricts((list || []).map((d) => d?.name).filter(Boolean))).catch(() => setDistricts([]));
  }, [filters.state]);

  useEffect(() => {
    if (!filters.state || !filters.district) { setBlocks([]); return; }
    getBlocks(filters.state, filters.district).then((list) => setBlocks((list || []).map((b) => b?.name).filter(Boolean))).catch(() => setBlocks([]));
  }, [filters.state, filters.district]);

  const load = useCallback(async (p: number, mode: 'load' | 'refresh' | 'more') => {
    const id = requestId.current + 1;
    requestId.current = id;
    if (mode === 'load') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setMore(true);
    try {
      const params: Record<string, any> = { page: p, limit: PAGE_SIZE };
      (Object.keys(filters) as (keyof Filters)[]).forEach((k) => { if (filters[k]) params[k] = filters[k]; });
      const res = await searchDirectory(params);
      if (requestId.current !== id) return;
      const region = res?.viewerRegion;
      if (region) setHome({ state: region.state || '', district: region.district || '', block: region.block || '' });
      // The first search narrows to the viewer's own region (website regionDefaulted).
      if (!defaulted.current) {
        defaulted.current = true;
        if (region?.state) {
          setFilters((f) => ({ ...f, state: region.state || '', district: region.district || '', block: region.block || '' }));
          return; // the effect re-runs with the narrowed filters
        }
      }
      const list = asArray<any>(res?.members);
      setRows((prev) => (p === 1 ? list : [...prev, ...list]));
      setPage(p);
      setPages(Number(res?.pagination?.pages || 0));
      setTotal(Number(res?.pagination?.total || 0));
      setError('');
    } catch (err) {
      if (requestId.current !== id) return;
      setError(errorText(err, 'Could not search ACTIV Network'));
      if (p === 1) setRows([]);
    } finally {
      if (requestId.current === id) { setLoading(false); setRefreshing(false); setMore(false); }
    }
  }, [filters]);

  useEffect(() => { if (paid) load(1, 'load'); }, [paid, load]);

  const set = (patch: Partial<Filters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      if (patch.state !== undefined) { next.district = ''; next.block = ''; }
      if (patch.district !== undefined) { next.block = ''; }
      return next;
    });
  };

  const activeCount = useMemo(
    () => (['state', 'district', 'block', 'sector'] as const).filter((k) => !!filters[k]).length,
    [filters],
  );
  const clearAll = () => { setTerm(''); setFilters(EMPTY_FILTERS); };
  const onHome = !!home.state && filters.state === home.state && filters.district === home.district && filters.block === home.block;
  const homeLabel = [home.block, home.district].filter(Boolean).join(', ') || home.state;
  const scopeLabel = [filters.block, filters.district, filters.state].filter(Boolean)[0] || 'All India';

  /** Removable chips for the filters that are on — the deepest region first. */
  const chips = useMemo(() => {
    const list: { key: keyof Filters; icon: string; label: string }[] = [];
    if (filters.block) list.push({ key: 'block', icon: 'place', label: filters.block });
    else if (filters.district) list.push({ key: 'district', icon: 'place', label: filters.district });
    else if (filters.state) list.push({ key: 'state', icon: 'place', label: filters.state });
    if (filters.sector) list.push({ key: 'sector', icon: 'sell', label: filters.sector });
    return list;
  }, [filters]);

  const back = () => navigation.goBack();

  const pageHeader = (withSearch: boolean) => (
    <PremiumPageHeader
      eyebrow="Find members"
      title="ACTIV Network"
      subtitle="Members and businesses across the association"
      onBack={back}
      art={<DirectorySearch3D size={84} />}
      artSize={84}
      right={withSearch ? (
        <GlassCountButton
          icon="tune"
          count={activeCount}
          onPress={() => setShowFilters((o) => !o)}
          accessibilityLabel={showFilters ? 'Hide filters' : 'Show filters'}
        />
      ) : undefined}
    >
      {withSearch ? (
        <View style={{ gap: SPACE.md }}>
          <SearchPill value={term} onChangeText={setTerm} placeholder="Search by name or business" />
          <HeaderStatRow>
            <HeaderStat icon="groups" value={loading ? '…' : total} label={total === 1 ? 'Member' : 'Members'} />
            <HeaderStat icon="place" value={scopeLabel} label="Showing" />
            <HeaderStat icon="sell" value={sectors.length} label="Sectors" />
          </HeaderStatRow>
        </View>
      ) : null}
    </PremiumPageHeader>
  );

  if (accessLoading && !profile) {
    return (
      <PremiumPage header={pageHeader(false)}>
        <View style={styles.overlap}><CardSkeletons rows={4} /></View>
      </PremiumPage>
    );
  }
  if (isStudentMembership(profile)) return <StudentNetworkingGate navigation={navigation} />;

  if (!paid) {
    return (
      <PremiumPage header={pageHeader(false)}>
        <View style={styles.overlap}>
          <MemberLocked
            title="The ACTIV Network opens with your membership"
            detail="Who the members are — their businesses, their districts and their trades — is what the membership buys. Complete yours and the whole association is searchable from here."
            action={cta.label}
            actionDetail={cta.detail}
            onActivate={() => runMembershipCta(navigation, cta.target, profile)}
          />
        </View>
      </PremiumPage>
    );
  }

  const listHeader = (
    <View style={styles.overlap}>
      {showFilters ? (
        <FadeInUp distance={10}>
          <SurfaceCard style={styles.block}>
            <View style={styles.filterHead}>
              <GradientGlyph icon="tune" size={36} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.filterTitle}>Filters</Text>
                <Text style={styles.filterSub}>{activeCount ? `${activeCount} active` : 'Narrow by region or sector'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilters(false)} hitSlop={8} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Hide filters">
                <Icon name="expand-less" size={22} color={PALETTE.textMuted} />
              </TouchableOpacity>
            </View>
            <FilterSelect label="State" icon="public" value={filters.state} options={states} onChange={(v) => set({ state: v })} />
            <FilterSelect label="District" icon="map" value={filters.district} options={districts} onChange={(v) => set({ district: v })} disabled={!filters.state} disabledHint="Pick a state first" />
            <FilterSelect label="Block" icon="place" value={filters.block} options={blocks} onChange={(v) => set({ block: v })} disabled={!filters.district} disabledHint="Pick a district first" />
            <FilterSelect label="Sector" icon="sell" value={filters.sector} options={sectors} onChange={(v) => set({ sector: v })} />
            {activeCount > 0 || term ? (
              <TouchableOpacity onPress={clearAll} style={styles.clear} accessibilityRole="button">
                <Icon name="close" size={SIZE.iconSm} color={PALETTE.redDark} /><Text style={styles.clearText}>Clear all filters</Text>
              </TouchableOpacity>
            ) : null}
          </SurfaceCard>
        </FadeInUp>
      ) : null}

      <SurfaceCard style={styles.block} contentStyle={styles.countCard}>
        <View style={styles.countTop}>
          <Text style={styles.count} maxFontSizeMultiplier={1.25}>
            {loading ? 'Searching…' : `${total} ${total === 1 ? 'member' : 'members'}${activeCount > 0 || term ? ' matching' : ''}`}
            {!loading && onHome && homeLabel ? <Text style={{ color: PALETTE.textMuted, fontWeight: '500' }}> in {homeLabel}</Text> : null}
          </Text>
          {!loading && onHome ? (
            <TouchableOpacity onPress={() => set({ state: '' })} hitSlop={8} accessibilityRole="button">
              <Text style={styles.countLink}>Search the whole association</Text>
            </TouchableOpacity>
          ) : !loading && home.state ? (
            <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, ...home }))} hitSlop={8} accessibilityRole="button">
              <Text style={styles.countLink} numberOfLines={1}>Back to {homeLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {chips.length || term ? (
          <View style={styles.chips}>
            {term ? (
              <TouchableOpacity style={styles.chip} onPress={() => setTerm('')} accessibilityRole="button" accessibilityLabel={`Remove search ${term}`}>
                <Icon name="search" size={13} color={PALETTE.white} />
                <Text style={styles.chipText} numberOfLines={1}>“{term}”</Text>
                <Icon name="close" size={14} color={PALETTE.white} />
              </TouchableOpacity>
            ) : null}
            {chips.map((c) => (
              <TouchableOpacity key={c.key} style={styles.chip} onPress={() => set({ [c.key]: '' } as Partial<Filters>)} accessibilityRole="button" accessibilityLabel={`Remove filter ${c.label}`}>
                <Icon name={c.icon} size={13} color={PALETTE.white} />
                <Text style={styles.chipText} numberOfLines={1}>{c.label}</Text>
                <Icon name="close" size={14} color={PALETTE.white} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </SurfaceCard>
    </View>
  );

  return (
    <PremiumListPage<any>
      header={pageHeader(true)}
      listHeader={listHeader}
      data={loading ? [] : rows}
      keyExtractor={(m, i) => String(m?.id || m?._id || i)}
      renderItem={({ item, index }) => (
        <MemberCard m={item} index={index} onPress={() => navigation.navigate('DirectoryProfile', { id: String(item?.id || item?._id || ''), name: item?.fullName })} />
      )}
      ListEmptyComponent={loading ? <CardSkeletons rows={4} /> : error ? (
        <StateView kind="error" title="ACTIV Network could not be searched" message={error} onAction={() => load(1, 'load')} />
      ) : (
        <StateView
          art={<DirectorySearch3D size={80} />}
          title="No members found"
          message={activeCount > 0 || term ? 'Try widening the filters, or searching for a different name.' : 'Members appear here once their membership is active.'}
          action={activeCount > 0 || term ? 'Clear all filters' : undefined}
          actionIcon="filter-alt-off"
          onAction={activeCount > 0 || term ? clearAll : undefined}
        />
      )}
      ListFooterComponent={more ? <ActivityIndicator style={styles.more2} color={PALETTE.blue} /> : null}
      onEndReached={() => { if (!loading && !more && page < pages) load(page + 1, 'more'); }}
      onEndReachedThreshold={0.4}
      refreshing={refreshing}
      onRefresh={() => load(1, 'refresh')}
    />
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP, marginBottom: SPACE.sm },
  block: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  filterHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  filterTitle: { ...TYPE.heading },
  filterSub: { ...TYPE.caption, marginTop: 1 },
  closeBtn: { width: SIZE.touch, height: SIZE.touch, alignItems: 'center', justifyContent: 'center', marginRight: -SPACE.sm },
  clear: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, alignSelf: 'flex-start', minHeight: SIZE.touch },
  clearText: { ...TYPE.label, color: PALETTE.redDark, fontWeight: '700' },
  countCard: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg },
  countTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: SPACE.md, rowGap: SPACE.xs },
  count: { ...TYPE.bodyStrong, flexShrink: 1 },
  countLink: { ...TYPE.label, color: PALETTE.blue, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', minHeight: 32, paddingHorizontal: SPACE.md,
    borderRadius: 999, backgroundColor: BRAND.blue900,
  },
  chipText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.white, flexShrink: 1 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  cardText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.heading, fontSize: 17 },
  bizRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  bizLogo: { width: 18, height: 18, borderRadius: 5, backgroundColor: PALETTE.field },
  biz: { ...TYPE.body, color: PALETTE.textSoft, fontWeight: '600', flexShrink: 1 },
  chevron: { width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: PALETTE.blueTint },
  factMuted: { backgroundColor: PALETTE.fieldBg },
  factText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: PALETTE.textSoft, flexShrink: 1 },
  sectors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm },
  sector: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: SPACE.xs, borderRadius: 999, backgroundColor: PALETTE.blueSoft },
  sectorText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.blueDark, flexShrink: 1 },
  products: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  product: { flex: 1, maxWidth: '23%' },
  productImg: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: PALETTE.field },
  productFallback: { alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: 11, lineHeight: 14, color: PALETTE.textMuted, marginTop: SPACE.xs },
  more: { ...TYPE.caption, color: PALETTE.textFaint, marginTop: SPACE.sm },
  more2: { marginVertical: SPACE.lg },
});

export default MemberDirectoryScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
