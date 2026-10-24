import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Linking, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../../types';
import {
  SegmentedTabs, Badge, PALETTE, SPACE, SIZE, TYPE, money, BRAND,
  BrandFrame, BrandHeaderBlock, BrandTopBar, BrandHero, GlassIconButton, PREMIUM_OVERLAP, FadeInUp, LiftCard,
  LiftSearchBar, CompanyLogoTile, TrustStar, ArtEmptyState, MarketGlobe3D, SearchLens3D, VaultLock3D,
  PressableScale, premiumTone, FitImage } from '../../ui';
import api from '../../services/api';
import { resolveMediaUrl } from '../../config/api.config';
import { getGeography } from '../../services/regions';
import { getMyProfile, recordProductView } from '../../services/memberApi';
import {
  getTrustListIds, addToTrustList, removeFromTrustList, getMyCompanies, errorMessage,
} from '../../services/businessApi';
import { useMembershipPaid } from './MembershipGate';
import { BusinessTabBar } from './BusinessTabBar';
import { CardSkeletons, SoftAction } from './businessKit';

type Props = NativeStackScreenProps<RootStackParamList, 'Discover'>;

/**
 * DISCOVER — the website's /business/discover, same requests:
 *
 *   GET /business-profiles/discover?q&state&district&block   companies (+ products, matchedProducts)
 *   GET /products/discover?q&state&district&block            products (companyId populated)
 *   GET /regions/geography[?state[&district]]                the three region pickers (all of India)
 *   GET /members/my-profile                                  home region (default) + paid check
 *   GET /business-profiles/all                               my own companies (no Trust on them)
 *   GET /business-profiles/trust-list/ids                    which cards start trusted
 *   POST/DELETE /business-profiles/trust-list/:id            trust / untrust
 *
 * No search term is NOT "no query": the region alone is browsed (q is optional
 * on both endpoints). The screen opens on the member's own region, and every
 * level can be changed or cleared ("Any state" = the whole network).
 *
 * The directory is a membership benefit: an unpaid member is told HOW MANY
 * matches there are and nothing else — no names, no numbers.
 */

interface ProductItem {
  _id: string;
  name?: string;
  category?: string;
  price?: number;
  stock?: number;
  description?: string;
  sku?: string;
  imageUrl?: string;
  companyId?: any;
}

interface CompanyItem {
  _id: string;
  businessName?: string;
  businessType?: string;
  location?: string;
  area?: string;
  mobileNumber?: string;
  email?: string;
  description?: string;
  logo?: string;
  banner?: string;
  trustedBy?: number;
  ownerIsMember?: boolean;
  products?: ProductItem[];
  matchedProducts?: ProductItem[];
}

type Region = { state: string; district: string; block: string };
type Level = keyof Region;
type DiscoverFilter = 'all' | 'companies' | 'products';

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;
const EMPTY_REGION: Region = { state: '', district: '', block: '' };
const FILTERS: { value: DiscoverFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'companies', label: 'Companies' },
  { value: 'products', label: 'Products' },
];
const LEVEL_LABEL: Record<Level, string> = { state: 'Any state', district: 'Any district', block: 'Any block' };

const listOf = (res: any): any[] => {
  const payload = res?.data?.data ?? res?.data ?? [];
  return Array.isArray(payload) ? payload : [];
};


/* ------------------------------------------------------------------ region picker */

function RegionPill({ level, value, disabled, open, onPress }: {
  level: Level; value: string; disabled: boolean; open: boolean; onPress: () => void;
}) {
  const p = premiumTone('business');
  const set = !!value;
  const inner = (
    <>
      <Text style={[s.regionPillText, set && { color: PALETTE.white }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{value || LEVEL_LABEL[level]}</Text>
      <Icon name={open ? 'expand-less' : 'expand-more'} size={18} color={set ? PALETTE.white : PALETTE.textFaint} />
    </>
  );
  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.95}
      style={[s.regionCell, disabled && { opacity: 0.45 }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open, disabled }}
      accessibilityLabel={`${level}: ${value || LEVEL_LABEL[level]}`}
    >
      {set ? (
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.regionPill, open && s.regionPillOpen]}>{inner}</LinearGradient>
      ) : (
        <View style={[s.regionPill, s.regionPillIdle, open && s.regionPillOpenIdle]}>{inner}</View>
      )}
    </PressableScale>
  );
}

/** Inline options panel — no native Modal (CLAUDE.md Rule 2). */
function RegionPanel({ level, options, value, onPick }: {
  level: Level; options: string[]; value: string; onPick: (v: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = options || [];
    return needle ? list.filter((o) => String(o || '').toLowerCase().includes(needle)) : list;
  }, [options, q]);

  return (
    <View style={s.panel}>
      {(options || []).length > 8 ? (
        <View style={s.panelSearch}>
          <Icon name="search" size={18} color={PALETTE.textFaint} />
          <TextInput value={q} onChangeText={setQ} placeholder={`Find a ${level}`} placeholderTextColor={PALETTE.textFaint} style={s.panelInput} />
        </View>
      ) : null}
      <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[s.option, !value && s.optionRowOn]} onPress={() => onPick('')} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ checked: !value }}>
          <Text style={[s.optionText, !value && s.optionOn]}>{LEVEL_LABEL[level]}</Text>
          {!value ? <Icon name="check-circle" size={18} color={PALETTE.violet} /> : null}
        </TouchableOpacity>
        {shown.slice(0, 120).map((o) => (
          <TouchableOpacity key={o} style={[s.option, o === value && s.optionRowOn]} onPress={() => onPick(o)} activeOpacity={0.7} accessibilityRole="radio" accessibilityState={{ checked: o === value }}>
            <Text style={[s.optionText, o === value && s.optionOn]} numberOfLines={2}>{o}</Text>
            {o === value ? <Icon name="check-circle" size={18} color={PALETTE.violet} /> : null}
          </TouchableOpacity>
        ))}
        {(options || []).length === 0 ? <Text style={s.panelEmpty}>Nothing to choose here yet.</Text> : null}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ company card */

function CompanyCard({ item, ordered, highlightIds, matchedOnly, own, trusted, busy, onOpen, onTrust, onViewProduct }: {
  item: CompanyItem; ordered: ProductItem[]; highlightIds: Set<string>; matchedOnly: boolean;
  own: boolean; trusted: boolean; busy: boolean; onOpen: () => void; onTrust: () => void;
  onViewProduct?: (id: string) => void;
}) {
  const p = premiumTone('business');
  const logo = item?.logo ? resolveMediaUrl(item.logo) : '';
  const trustedBy = Number(item?.trustedBy || 0);
  const phone = String(item?.mobileNumber || '');
  const shownProducts = (ordered || []).slice(0, 4);
  const place = [item?.location, item?.area].filter(Boolean).join(', ');

  return (
    <FadeInUp distance={12} style={s.cardWrap}>
      <LiftCard tone="business">
        {item.banner ? <PressableScale onPress={onOpen} accessibilityLabel={`View ${item.businessName || 'company'} banner`}><FitImage uri={resolveMediaUrl(item.banner)} style={{ width: '100%', height: 132, backgroundColor: '#fff', borderRadius: 14 }} /></PressableScale> : null}
        <View style={s.cardHead}>
          <PressableScale onPress={onOpen} scaleTo={0.98} style={{ flex: 1, minWidth: 0 }} contentStyle={s.cardHeadMain} accessibilityRole="button" accessibilityLabel={`Open ${item?.businessName || 'company'}`}>
            <CompanyLogoTile tone="business" uri={logo} name={item?.businessName} size={56} ring={trusted} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.businessName || 'Business'}</Text>
                {item?.ownerIsMember === true ? (
                  <LinearGradient colors={['#FDE68A', '#D97706']} style={s.memberStar} accessibilityLabel="ACTIV member">
                    <Icon name="star" size={11} color={PALETTE.white} />
                  </LinearGradient>
                ) : null}
              </View>
              <Text style={s.type} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.businessType || '—'}</Text>
              {trustedBy > 0 ? (
                <View style={s.trustLine}>
                  <Icon name="verified-user" size={13} color={PALETTE.green} />
                  <Text style={s.trustLineText} maxFontSizeMultiplier={1.3}>{trustedBy} {trustedBy === 1 ? 'member trusts them' : 'members trust them'}</Text>
                </View>
              ) : null}
            </View>
          </PressableScale>
          <TrustStar
            trusted={trusted}
            busy={busy}
            disabled={own}
            onPress={onTrust}
            accessibilityLabel={own ? 'Your own company' : trusted ? 'On your trust list — remove' : 'Add to your trust list'}
          />
        </View>

        <View style={s.facts}>
          <View style={s.factChip}>
            <Icon name="place" size={14} color={p.accent} />
            <Text style={s.factText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{place || 'Location not set'}</Text>
          </View>
          {phone ? (
            <PressableScale onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => null)} contentStyle={[s.factChip, s.factChipLink]} accessibilityRole="link" accessibilityLabel={`Call ${phone}`}>
              <Icon name="call" size={14} color={p.accentDark} />
              <Text style={[s.factText, s.factLink]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{phone}</Text>
            </PressableScale>
          ) : null}
          {item?.email ? (
            <PressableScale onPress={() => Linking.openURL(`mailto:${item?.email || ''}`).catch(() => null)} contentStyle={s.factChip} accessibilityRole="link" accessibilityLabel={`Email ${item?.email || ''}`}>
              <Icon name="mail-outline" size={14} color={PALETTE.textMuted} />
              <Text style={s.factText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.email}</Text>
            </PressableScale>
          ) : null}
        </View>

        {item?.description ? <Text style={s.desc} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item.description}</Text> : null}

        {shownProducts.length > 0 ? (
          <View style={s.products}>
            <Text style={s.productsLabel}>
              {matchedOnly ? `Matching products (${(ordered || []).length})` : `Products & services (${(ordered || []).length})`}
            </Text>
            {shownProducts.map((pr, i) => {
              const hit = highlightIds.has(String(pr?._id));
              const img = pr?.imageUrl ? resolveMediaUrl(pr.imageUrl) : '';
              return (
                <View
                  key={String(pr?._id || i)}
                  style={[s.product, hit && s.productHit]}
                >
                  <TouchableOpacity
                    style={s.productMain}
                    activeOpacity={0.85}
                    onPress={() => onViewProduct?.(String(pr?._id || ''))}
                    accessibilityRole="button"
                    accessibilityLabel={pr?.name || 'Product'}
                  >
                  {img ? <FitImage uri={img} style={s.productImg} /> : (
                    <LinearGradient colors={[PALETTE.violetSoft, PALETTE.violetTint]} style={[s.productImg, s.productImgEmpty]}><Icon name="inventory-2" size={18} color={p.accent} /></LinearGradient>
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.productName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{pr?.name || 'Item'}</Text>
                    <Text style={s.productMeta} numberOfLines={1} maxFontSizeMultiplier={1.3}>{pr?.category || 'General'}{pr?.sku ? ` · ${pr.sku}` : ''}</Text>
                  </View>
                  </TouchableOpacity>
                  <View style={s.priceCol}>
                    <Text style={s.productPrice} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(pr?.price)}</Text>
                    {Number(pr?.stock || 0) > 0 ? <Text style={s.stock} numberOfLines={1} maxFontSizeMultiplier={1.2}>Stock {Number(pr?.stock || 0)}</Text> : null}
                  </View>
                </View>
              );
            })}
            {(ordered || []).length > shownProducts.length ? (
              <Text style={s.moreProducts}>+{(ordered || []).length - shownProducts.length} more on the company page</Text>
            ) : null}
          </View>
        ) : null}

        <View style={s.cardFoot}>
          {own ? (
            <View style={s.ownChip}><Icon name="storefront" size={16} color={PALETTE.violetDark} /><Text style={s.ownChipText} numberOfLines={1}>Your company</Text></View>
          ) : (
            <SoftAction
              icon={trusted ? 'verified-user' : 'add-moderator'}
              label={busy ? 'Saving…' : trusted ? 'Trusted' : 'Trust'}
              onPress={onTrust}
              disabled={busy}
              accessibilityLabel={trusted ? 'Trusted — remove from your trust list' : 'Add to your trust list'}
            />
          )}
          <SoftAction icon="arrow-forward" label="View company" primary onPress={onOpen} />
        </View>
      </LiftCard>
    </FadeInUp>
  );
}

/* ------------------------------------------------------------------ compact row (list view) */

/**
 * The website's list view: one company a row, carrying the four things somebody
 * scans a directory for — who, what trade, where, what number — and dropping
 * the catalogue, write-up and trust count, so a screen holds many at once.
 */
function CompanyRow({ item, onOpen }: { item: CompanyItem; onOpen: () => void }) {
  const p = premiumTone('business');
  const logo = item?.logo ? resolveMediaUrl(item.logo) : '';
  const phone = String(item?.mobileNumber || '');
  return (
    <View style={[s.listRowWrap, s.listRow, { shadowColor: p.shadow }]}>
      <PressableScale onPress={onOpen} scaleTo={0.98} style={{ flex: 1, minWidth: 0 }} contentStyle={s.listRowMain} accessibilityRole="button" accessibilityLabel={`Open ${item?.businessName || 'company'}`}>
      <CompanyLogoTile tone="business" uri={logo} name={item?.businessName} size={42} ring={false} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.nameRow}>
          <Text style={s.listName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.businessName || 'Business'}</Text>
          {item?.ownerIsMember === true ? <Icon name="star" size={13} color={PALETTE.amber} accessibilityLabel="ACTIV member" /> : null}
        </View>
        <Text style={s.listMeta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {[item?.businessType || '—', [item?.location, item?.area].filter(Boolean).join(', ') || 'Location not set'].join(' · ')}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
      </PressableScale>
      {phone ? (
        <PressableScale
          onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => null)}
          scaleTo={0.9}
          contentStyle={s.listCall}
          accessibilityLabel={`Call ${item?.businessName || 'company'}`}
          hitSlop={6}
        >
          <Icon name="call" size={18} color={PALETTE.white} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ count only (unpaid) */

function CountOnly({ companies, products, term, regionLabel, onJoin }: {
  companies: number; products: number; term: string; regionLabel: string; onJoin: () => void;
}) {
  const title = `${companies} ${companies === 1 ? 'company' : 'companies'}${products > 0 ? ` · ${products} ${products === 1 ? 'product' : 'products'}` : ''}`;
  return (
    <LiftCard tone="business" style={s.gutter}>
      <ArtEmptyState tone="business"
        compact
        art={<VaultLock3D tone="business" size={80} />}
        title={title}
        message={`${term ? `match “${term}” in ${regionLabel}. ` : `in ${regionLabel}. `}Membership opens the directory — names, catalogues and contact details for every one of them.`}
        action="Become a member"
        actionIcon="workspace-premium"
        onAction={onJoin}
      >
        <Badge label="Members only" icon="workspace-premium" color={PALETTE.violetDark} bg={PALETTE.violetSoft} size="sm" style={{ marginTop: SPACE.md }} />
      </ArtEmptyState>
    </LiftCard>
  );
}

/* ------------------------------------------------------------------ screen */

const DiscoverScreen: React.FC<Props> = ({ navigation }) => {
  const paid = useMembershipPaid();

  // A product tapped in a result card feeds the seller's catalogue analytics —
  // the same record-view call as the directory profile, once per product per
  // visit. The server ignores the owner and de-duplicates per viewer per day.
  const seenProducts = useRef<Set<string>>(new Set());
  const viewProduct = useCallback((pid: string) => {
    const key = String(pid || '');
    if (!key || seenProducts.current.has(key)) return;
    seenProducts.current.add(key);
    recordProductView(key);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [filter, setFilter] = useState<DiscoverFilter>('all');
  // Card view or the compact list — the website's grid/list toggle.
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const [homeRegion, setHomeRegion] = useState<Region>(EMPTY_REGION);
  const [region, setRegion] = useState<Region>(EMPTY_REGION);
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  const [stateList, setStateList] = useState<string[]>([]);
  const [districtList, setDistrictList] = useState<string[]>([]);
  const [blockList, setBlockList] = useState<string[]>([]);

  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set());
  const [trustedIds, setTrustedIds] = useState<Set<string>>(new Set());
  const [trustPending, setTrustPending] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const requestIdRef = useRef(0);

  // Returning to the screen re-reads (a company trusted elsewhere, a new product).
  useFocusEffect(useCallback(() => { setFocusTick((t) => t + 1); }, []));

  /* ---- once: home region, states, own companies */
  useEffect(() => {
    let alive = true;
    getMyProfile()
      .then((me: any) => {
        if (!alive || !me) return;
        const mine: Region = { state: String(me?.state || ''), district: String(me?.district || ''), block: String(me?.block || '') };
        setHomeRegion(mine);
        // Only if nothing has been picked yet — never overwrite a deliberate choice.
        setRegion((cur) => (cur.state || cur.district || cur.block ? cur : mine));
      })
      .catch(() => null);
    getGeography().then((rows) => { if (alive) setStateList((rows || []).filter(Boolean).map(String)); }).catch(() => null);
    getMyCompanies()
      .then((rows) => { if (alive) setOwnIds(new Set((rows || []).map((r: any) => String(r?._id || '')))); })
      .catch(() => null);
    return () => { alive = false; };
  }, []);

  /* ---- trust ids, on every focus */
  useEffect(() => {
    let alive = true;
    getTrustListIds()
      .then((ids) => { if (alive) setTrustedIds(new Set((ids || []).map(String))); })
      .catch(() => null);
    return () => { alive = false; };
  }, [focusTick]);

  /* ---- each level narrows the next */
  useEffect(() => {
    let alive = true;
    if (!region.state) { setDistrictList([]); setBlockList([]); return undefined; }
    getGeography(region.state).then((rows) => { if (alive) setDistrictList((rows || []).filter(Boolean).map(String)); }).catch(() => { if (alive) setDistrictList([]); });
    return () => { alive = false; };
  }, [region.state]);

  useEffect(() => {
    let alive = true;
    if (!region.state || !region.district) { setBlockList([]); return undefined; }
    getGeography(region.state, region.district).then((rows) => { if (alive) setBlockList((rows || []).filter(Boolean).map(String)); }).catch(() => { if (alive) setBlockList([]); });
    return () => { alive = false; };
  }, [region.state, region.district]);

  /* ---- debounce the search box */
  useEffect(() => {
    const h = setTimeout(() => setActiveQuery((searchQuery || '').trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [searchQuery]);

  /* ---- the directory */
  useEffect(() => {
    const term = (activeQuery || '').length >= MIN_QUERY_LENGTH ? activeQuery : '';
    const params: Record<string, string> = {};
    if (term) params.q = term;
    if (region.state) params.state = region.state;
    if (region.district) params.district = region.district;
    if (region.block) params.block = region.block;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);

    (async () => {
      try {
        const [compRes, prodRes] = await Promise.allSettled([
          api.get('/business-profiles/discover', { params }),
          api.get('/products/discover', { params }),
        ]);
        if (requestIdRef.current !== requestId) return;
        const compList = (compRes.status === 'fulfilled' ? listOf(compRes.value) : []).filter((c: CompanyItem) => {
          const n = String(c?.businessName || '').toLowerCase();
          return !!n && !n.includes('test company') && !n.includes('dummy');
        });
        const prodList = (prodRes.status === 'fulfilled' ? listOf(prodRes.value) : []).filter((p: ProductItem) => p && p._id);
        setCompanies(compList);
        setProducts(prodList);
      } catch (err) {
        console.warn('Discover load safely caught:', err);
        if (requestIdRef.current === requestId) { setCompanies([]); setProducts([]); }
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    })();
  }, [activeQuery, region.state, region.district, region.block, focusTick]);

  const hasQuery = activeQuery.length >= MIN_QUERY_LENGTH;
  const isTermTooShort = activeQuery.length > 0 && !hasQuery;

  const includesTerm = useCallback((v?: string | null) => {
    const term = (activeQuery || '').toLowerCase();
    return !!term && String(v || '').toLowerCase().includes(term);
  }, [activeQuery]);

  const productMatches = useCallback((p?: ProductItem | null) =>
    !!p && (includesTerm(p?.name) || includesTerm(p?.category) || includesTerm(p?.sku)), [includesTerm]);
  const companyMatches = useCallback((c?: CompanyItem | null) =>
    !!c && (includesTerm(c?.businessName) || includesTerm(c?.businessType)), [includesTerm]);

  const productResults = useMemo(() => {
    if (!hasQuery || filter === 'companies') return [];
    return (products || []).filter((p) => p && p.name && productMatches(p));
  }, [products, hasQuery, filter, productMatches]);

  /** Product hits fold into their seller's card (website Discover). */
  const companyResults = useMemo(() => {
    if (!hasQuery) return companies || [];
    const byId = new Map<string, CompanyItem>();
    (companies || []).forEach((c) => {
      if (!c?._id) return;
      const nameHit = companyMatches(c);
      const productHit = (c?.matchedProducts || []).some(productMatches);
      if (!nameHit && !productHit) return;
      if (filter === 'companies' && !nameHit) return;
      if (filter === 'products' && !productHit) return;
      byId.set(String(c._id), c);
    });
    if (filter !== 'companies') {
      (productResults || []).forEach((prod) => {
        const seller = prod?.companyId && typeof prod.companyId === 'object' ? prod.companyId : null;
        const sellerId = seller?._id ? String(seller._id) : '';
        if (!sellerId) return;
        const existing = byId.get(sellerId);
        if (!existing) { byId.set(sellerId, { ...seller, products: [prod], matchedProducts: [prod] }); return; }
        const known = new Set((existing.matchedProducts || []).map((p) => String(p?._id)));
        if (!known.has(String(prod?._id))) {
          byId.set(sellerId, { ...existing, matchedProducts: [...(existing.matchedProducts || []), prod] });
        }
      });
    }
    return Array.from(byId.values());
  }, [companies, productResults, hasQuery, filter, companyMatches, productMatches]);

  const regionLabel = [region.block, region.district, region.state].filter(Boolean).join(', ') || 'the whole network';
  const awayFromHome = !!homeRegion.state
    && (region.state !== homeRegion.state || region.district !== homeRegion.district || region.block !== homeRegion.block);

  const pickRegion = (level: Level, value: string) => {
    setOpenLevel(null);
    setRegion((r) => (level === 'state'
      ? { state: value, district: '', block: '' }
      : level === 'district' ? { ...r, district: value, block: '' } : { ...r, block: value }));
  };

  const toggleTrust = async (companyId: string, name: string) => {
    if (!companyId || trustPending) return;
    const was = trustedIds.has(companyId);
    setTrustPending(companyId);
    setTrustedIds((cur) => { const n = new Set(cur); if (was) n.delete(companyId); else n.add(companyId); return n; });
    try {
      if (was) await removeFromTrustList(companyId); else await addToTrustList(companyId);
    } catch (err) {
      setTrustedIds((cur) => { const n = new Set(cur); if (was) n.add(companyId); else n.delete(companyId); return n; });
      Alert.alert('Trust list', errorMessage(err, `Could not update your trust list for ${name}.`));
    } finally {
      setTrustPending(null);
    }
  };

  const goJoin = () => navigation.navigate('MemberMain');

  const renderItem = ({ item }: { item: CompanyItem }) => {
    if (viewMode === 'list') {
      return <CompanyRow item={item} onOpen={() => navigation.navigate('CompanyPublic', { companyId: String(item?._id || '') })} />;
    }
    const catalog = item?.products || [];
    const matched = (item?.matchedProducts || []).filter(productMatches);
    const highlightIds = new Set(matched.map((p) => String(p?._id)));
    const nameHit = companyMatches(item);
    const ordered = !hasQuery
      ? catalog
      : nameHit ? [...matched, ...catalog.filter((p) => !highlightIds.has(String(p?._id)))] : matched;
    const id = String(item?._id || '');
    return (
      <CompanyCard
        item={item}
        ordered={ordered}
        highlightIds={highlightIds}
        matchedOnly={hasQuery && !nameHit}
        own={ownIds.has(id)}
        trusted={trustedIds.has(id)}
        busy={trustPending === id}
        onOpen={() => navigation.navigate('CompanyPublic', { companyId: id })}
        onTrust={() => toggleTrust(id, item?.businessName || 'Company')}
        onViewProduct={viewProduct}
      />
    );
  };

  const optionsFor = (level: Level) => (level === 'state' ? stateList : level === 'district' ? districtList : blockList);


  const header = (
    <View>
      <BrandHeaderBlock tone="business">
        <BrandTopBar
          onBack={() => navigation.goBack()}
          title="ACTIV Network"
          right={<GlassIconButton icon="verified-user" onPress={() => navigation.navigate('TrustList')} accessibilityLabel="My trust list" />}
        />
        <BrandHero
          eyebrow="The ACTIV business network"
          title="ACTIV Network"
          subtitle={`Browsing ${regionLabel}`}
          art={<MarketGlobe3D tone="business" size={92} />}
          artSize={92}
        />
        <View style={s.headerGap} />
      </BrandHeaderBlock>

      <View style={s.overlap}>
        <LiftSearchBar tone="business"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search a product or company — e.g. chairs"
          style={s.gutter}
        />
      </View>
      {isTermTooShort ? <Text style={s.tooShort}>Type at least {MIN_QUERY_LENGTH} characters to search.</Text> : null}

      <View style={{ marginTop: SPACE.md }}>
        <SegmentedTabs tone="business" options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <View style={s.regionHead}>
        <Icon name="place" size={16} color={PALETTE.textMuted} />
        <Text style={s.regionHeadText}>Where</Text>
        {awayFromHome ? (
          <PressableScale onPress={() => { setOpenLevel(null); setRegion(homeRegion); }} contentStyle={s.homeBtn} accessibilityRole="button" hitSlop={6}>
            <Icon name="my-location" size={14} color={PALETTE.violetDark} />
            <Text style={s.homeBtnText}>My region</Text>
          </PressableScale>
        ) : null}
      </View>
      {/* Region chips — each level narrows the next. */}
      <View style={s.regionRow}>
        {(['state', 'district', 'block'] as Level[]).map((level) => (
          <RegionPill
            key={level}
            level={level}
            value={region[level]}
            disabled={level === 'district' ? !region.state : level === 'block' ? !region.district : false}
            open={openLevel === level}
            onPress={() => setOpenLevel((cur) => (cur === level ? null : level))}
          />
        ))}
      </View>
      {openLevel ? (
        <RegionPanel
          key={openLevel}
          level={openLevel}
          options={optionsFor(openLevel)}
          value={region[openLevel]}
          onPick={(v) => pickRegion(openLevel, v)}
        />
      ) : null}

      {!loading && paid === true && companyResults.length > 0 ? (
        <View style={s.resultsHead}>
          <Text style={s.resultsTitle} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {hasQuery ? `Results (${companyResults.length})` : `Companies in ${regionLabel} (${companyResults.length})`}
          </Text>
          <View style={s.viewToggle}>
            {([['cards', 'view-agenda', 'Card view'], ['list', 'view-list', 'List view']] as const).map(([mode, icon, label]) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[s.viewBtn, viewMode === mode && s.viewBtnOn]}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: viewMode === mode }}
                hitSlop={{ top: 4, bottom: 4 }}
              >
                <Icon name={icon} size={18} color={viewMode === mode ? PALETTE.white : PALETTE.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : <View style={{ height: SPACE.lg }} />}
    </View>
  );

  const empty = loading || paid === null ? (
    <View accessibilityLabel={hasQuery ? 'Searching the business network…' : 'Loading ACTIV Network…'}>
      <CardSkeletons rows={3} tall />
    </View>
  ) : paid === false ? (
    <CountOnly companies={companyResults.length} products={productResults.length} term={activeQuery} regionLabel={regionLabel} onJoin={goJoin} />
  ) : (
    <LiftCard tone="business" style={s.gutter}>
      <ArtEmptyState tone="business"
        compact
        art={hasQuery ? <SearchLens3D tone="business" size={74} /> : <MarketGlobe3D tone="business" size={78} />}
        title={hasQuery ? 'No matching results' : 'Nothing listed here yet'}
        message={hasQuery
          ? `No ${filter === 'companies' ? 'businesses' : filter === 'products' ? 'products' : 'products or businesses'} matching "${activeQuery}" in ${regionLabel}.`
          : `No companies are listed in ${regionLabel}. Widen the region or search by name.`}
      />
    </LiftCard>
  );

  const data = !loading && paid === true ? companyResults : [];

  return (
    <BrandFrame tone="business"
      footer={(
        <BusinessTabBar
          active="discover"
          onPress={(key) => {
            if (key === 'business') navigation.navigate('BusinessDashboard');
            else if (key === 'products') navigation.navigate('ProductsServices', {});
            else if (key === 'analytics') navigation.navigate('Analytics');
            else if (key === 'settings') navigation.navigate('Settings');
          }}
        />
      )}
    >
      <FlatList
        data={data}
        keyExtractor={(item, index) => String(item?._id || index)}
        renderItem={renderItem}
        extraData={viewMode}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: SPACE.xl }}
        showsVerticalScrollIndicator={false}
      />
    </BrandFrame>
  );
};

const s = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  headerGap: { height: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  tooShort: { ...TYPE.caption, marginHorizontal: SPACE.lg, marginTop: SPACE.sm },

  regionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, marginHorizontal: SPACE.lg, marginTop: SPACE.lg, marginBottom: SPACE.sm, minHeight: 28 },
  regionHeadText: { ...TYPE.eyebrow, flex: 1 },
  homeBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, minHeight: 30, borderRadius: 999, backgroundColor: PALETTE.violetSoft },
  homeBtnText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.violetDark },
  regionRow: { flexDirection: 'row', gap: SPACE.xs + 2, paddingHorizontal: SPACE.lg },
  regionCell: { flex: 1, minWidth: 0 },
  regionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: SIZE.touch, paddingLeft: SPACE.sm + 2, paddingRight: SPACE.xs, borderRadius: 14 },
  regionPillIdle: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  regionPillOpen: { borderWidth: 1.5, borderColor: BRAND.violetGlow },
  regionPillOpenIdle: { borderColor: PALETTE.violet, borderWidth: 1.5 },
  regionPillText: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 16, fontWeight: '700', color: PALETTE.textSoft },
  panel: {
    marginHorizontal: SPACE.lg, marginTop: SPACE.sm, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.border,
    backgroundColor: PALETTE.card, overflow: 'hidden',
  },
  panelSearch: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: PALETTE.divider, backgroundColor: PALETTE.fieldBg },
  panelInput: { flex: 1, minWidth: 0, fontSize: 14, color: PALETTE.text, paddingVertical: SPACE.md, minHeight: SIZE.control },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: SIZE.touch + SPACE.xs, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  optionRowOn: { backgroundColor: PALETTE.violetTint },
  optionText: { ...TYPE.body, flex: 1 },
  optionOn: { color: PALETTE.violetDark, fontWeight: '700' },
  panelEmpty: { ...TYPE.caption, padding: SPACE.lg },
  resultsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  resultsTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22, flex: 1 },
  viewToggle: { flexDirection: 'row', gap: SPACE.xxs, padding: 3, borderRadius: 14, backgroundColor: PALETTE.field },
  viewBtn: { width: SIZE.controlSm, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  viewBtnOn: { backgroundColor: PALETTE.violet },

  listRowWrap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.sm },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md,
    minHeight: SIZE.row + SPACE.sm, backgroundColor: PALETTE.card, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  listName: { ...TYPE.bodyStrong, flexShrink: 1 },
  listRowMain: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  listMeta: { ...TYPE.caption, marginTop: SPACE.xxs },
  listCall: { width: SIZE.controlSm, height: SIZE.controlSm, borderRadius: 999, backgroundColor: PALETTE.violet, alignItems: 'center', justifyContent: 'center' },

  cardWrap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  cardHeadMain: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  name: { ...TYPE.heading, flexShrink: 1 },
  memberStar: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  type: { ...TYPE.caption, fontSize: 13, lineHeight: 18, marginTop: SPACE.xxs },
  trustLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  trustLineText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.greenDark },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs + 2, marginTop: SPACE.md },
  factChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', minHeight: 32, paddingHorizontal: SPACE.sm + 2, borderRadius: 999, backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.divider },
  factChipLink: { backgroundColor: PALETTE.violetTint, borderColor: PALETTE.violetBorder },
  factText: { fontSize: 12, lineHeight: 16, color: PALETTE.textSoft, flexShrink: 1 },
  factLink: { color: PALETTE.violetDark, fontWeight: '700', fontVariant: ['tabular-nums'] },
  desc: { ...TYPE.body, fontSize: 13, lineHeight: 19, marginTop: SPACE.md },
  products: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider, gap: SPACE.sm },
  productsLabel: { ...TYPE.eyebrow },
  product: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.sm, borderRadius: 14, backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.divider },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  productHit: { backgroundColor: PALETTE.violetTint, borderColor: PALETTE.violet },
  productImg: { width: 46, height: 46, borderRadius: 12, backgroundColor: PALETTE.card },
  productImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  productName: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18 },
  productMeta: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs },
  // Right-aligned, tabular: prices line up down the list.
  priceCol: { alignItems: 'flex-end', maxWidth: '38%' },
  productPrice: { ...TYPE.bodyStrong, fontSize: 13, fontWeight: '800', color: PALETTE.violetDark, fontVariant: ['tabular-nums'] },
  stock: { fontSize: 11, lineHeight: 15, color: PALETTE.textMuted, marginTop: SPACE.xxs, fontVariant: ['tabular-nums'] },
  moreProducts: { ...TYPE.caption, textAlign: 'center', paddingTop: SPACE.xs },
  cardFoot: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg },
  ownChip: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs + 2, minHeight: SIZE.touch, borderRadius: 999, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.fieldBg },
  ownChipText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.violetDark, flexShrink: 1 },
});

export default DiscoverScreen;
