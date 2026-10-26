import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../../types';
import { Badge, SegmentedTabs, ToggleRow, SPACE, timeAgo, money, BrandFrame, BrandHeaderBlock, BrandTopBar, BrandHero, GlassFigure, PREMIUM_OVERLAP, FadeInUp, LiftCard, LiftSearchBar, PremiumInput, GradientButton, GrowBar, RingGauge, CountUpText, ArtEmptyState, StockColumns3D, SearchLens3D, PressableScale, FitImage } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { useActiveCompany, useActiveCompanyStore } from '../../stores/activeCompanyStore';
import {
  getProducts, getStockMovements, adjustStock, updateProduct, setProductPublished, errorMessage,
  Product, StockMovement, StockReason, STOCK_REASONS,
} from '../../services/businessApi';
import { BizSectionTitle, BizStatePage } from './businessKit';
import { ChipChoice, Label } from './companyForm/controls';

type Props = NativeStackScreenProps<RootStackParamList, 'StockCentre'>;

/**
 * STOCK — the website's /business/stock, for the active company.
 *
 *   GET  /products?companyId=        the catalogue with stock + minStock
 *   GET  /products/stock-movements   the member's recent movements
 *   POST /products/:id/stock         { delta | setTo, reason, note }
 *
 * State comes from the same rule the server uses (`stockState`): out when
 * stock ≤ 0, low when a minimum is set and stock ≤ minimum.
 *
 * The movement log is kept per MEMBER on the server (not per company), so a
 * member with two companies used to see the other company's movements here.
 * It is now narrowed to this catalogue's products, and each line's own recent
 * movements show when the line is opened.
 */

type Filter = 'all' | 'low' | 'out';

const MOVES_SHOWN = 20;

const REASON_LABEL: Record<StockReason, string> = {
  restock: 'Stock received',
  sale: 'Sold',
  damage: 'Damaged or lost',
  return: 'Returned',
  correction: 'Correcting the count',
  other: 'Other',
};
const REASON_BY_LABEL: Record<string, StockReason> = STOCK_REASONS.reduce((acc, r) => {
  acc[REASON_LABEL[r]] = r;
  return acc;
}, {} as Record<string, StockReason>);

const stateOf = (p: Product): 'ok' | 'low' | 'out' => {
  const stock = Number(p?.stock || 0);
  const min = Number(p?.minStock || 0);
  if (stock <= 0) return 'out';
  if (min > 0 && stock <= min) return 'low';
  return 'ok';
};

const stateBadges = (PALETTE: AppTheme['palette']) => ({
  ok: { label: 'In stock', fg: PALETTE.successText, bg: PALETTE.successSoft, bar: ['#34D399', '#047857'] },
  low: { label: 'Low', fg: PALETTE.warningText, bg: PALETTE.warningSoft, bar: ['#FBBF24', '#B45309'] },
  out: { label: 'Out of stock', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft, bar: ['#F87171', '#B91C1C'] },
});

function MoveRow({ m, last }: { m: StockMovement; last?: boolean }) {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const up = Number(m?.delta) > 0;
  return (
    <View style={[styles.move, !last && styles.moveDivider]}>
      <LinearGradient colors={up ? ['#34D399', '#047857'] : ['#F87171', '#B91C1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.moveIcon}>
        <Icon name={up ? 'north-east' : 'south-west'} size={16} color={PALETTE.white} />
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.moveName} numberOfLines={1} maxFontSizeMultiplier={1.3}>{m?.productName || 'Product'}</Text>
        <Text style={styles.muted} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {REASON_LABEL[(m?.reason as StockReason) || 'other'] || 'Other'}{m?.note ? ` · ${m.note}` : ''} · {timeAgo(m?.at)}
        </Text>
      </View>
      <Text style={[styles.moveDelta, { color: up ? PALETTE.successText : PALETTE.dangerText }]} maxFontSizeMultiplier={1.2}>
        {up ? '+' : ''}{Number(m?.delta || 0)}
      </Text>
    </View>
  );
}

function AdjustPanel({ product, history, onDone }: { product: Product; history: StockMovement[]; onDone: (p: Product) => void }) {
  const styles = useThemeStyles(makeStyles);
  const [mode, setMode] = useState<'delta' | 'setTo'>('delta');
  // Website Stock.tsx keeps the low-stock threshold and the publish switch on
  // the line itself — they are stock decisions, made while reviewing stock.
  const [minimum, setMinimum] = useState(Number(product?.minStock || 0) > 0 ? String(product?.minStock) : '');
  const [savingMin, setSavingMin] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const saveMinimum = async () => {
    const value = Math.max(0, Math.round(Number(minimum || 0) || 0));
    setSavingMin(true);
    try {
      // PUT /products/:id updates only the fields present, so this changes the
      // threshold alone (the website sends { minStock } the same way).
      const form = new FormData();
      form.append('minStock', String(value));
      await updateProduct(product._id, form);
      onDone({ ...product, minStock: value });
      Alert.alert('Threshold saved', value > 0 ? `You will be warned at ${value} or below.` : 'This line will no longer be flagged as low.');
    } catch (err) {
      Alert.alert('Not saved', errorMessage(err, 'Could not save the threshold.'));
    } finally {
      setSavingMin(false);
    }
  };

  const togglePublished = async (next: boolean) => {
    setPublishing(true);
    try {
      const res = await setProductPublished(product._id, next);
      onDone({ ...product, isActive: res?.isActive !== undefined ? !!res.isActive : next });
    } catch (err) {
      Alert.alert('Not changed', errorMessage(err, 'Could not change whether this is published.'));
    } finally {
      setPublishing(false);
    }
  };
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState<StockReason>('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (sign: 1 | -1) => {
    const n = Math.round(Number(amount || ''));
    if (!Number.isFinite(n) || (mode === 'delta' ? n <= 0 : n < 0)) {
      Alert.alert('Stock', mode === 'delta' ? 'Enter how many.' : 'Enter the count you have now.');
      return;
    }
    setBusy(true);
    try {
      const body = mode === 'delta'
        ? { delta: sign * n, reason: sign > 0 ? reason : (reason === 'restock' ? 'sale' : reason), note: note.trim() }
        : { setTo: n, reason: 'correction' as StockReason, note: note.trim() };
      const res = await adjustStock(product._id, body);
      onDone({ ...product, stock: Number(res?.stock ?? product.stock ?? 0) });
      setAmount('');
      setNote('');
    } catch (err) {
      Alert.alert('Stock not changed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const mine = (history || []).filter((m) => String(m?.productId || '') === String(product?._id || '')).slice(0, 3);

  return (
    <View style={styles.panel}>
      <SegmentedTabs tone="business"
        options={[{ value: 'delta', label: 'Add / remove' }, { value: 'setTo', label: 'Stock take' }]}
        value={mode}
        onChange={(v) => setMode(v as 'delta' | 'setTo')}
        style={{ marginHorizontal: 0 }}
      />
      <View style={{ height: SPACE.md }} />
      <PremiumInput tone="business"
        label={mode === 'delta' ? 'How many' : 'Count on hand now'}
        value={amount}
        onChangeText={(t) => setAmount((t || '').replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        icon="inventory-2"
      />
      {mode === 'delta' ? (
        <>
          <Label text="Reason" />
          <ChipChoice
            options={STOCK_REASONS.map((r) => REASON_LABEL[r])}
            value={REASON_LABEL[reason]}
            onChange={(label) => setReason(REASON_BY_LABEL[label] || 'restock')}
            required
          />
        </>
      ) : null}
      <PremiumInput tone="business" label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. invoice number" icon="notes" />
      {mode === 'delta' ? (
        <View style={styles.adjustRow}>
          <GradientButton tone="business" label="Remove" icon="remove" variant="outline" onPress={() => save(-1)} loading={busy} style={{ flex: 1 }} />
          <GradientButton tone="business" label="Add" icon="add" onPress={() => save(1)} loading={busy} style={{ flex: 1 }} />
        </View>
      ) : (
        <GradientButton tone="business" label="Save count" icon="fact-check" onPress={() => save(1)} loading={busy} />
      )}

      <View style={styles.subPanel}>
        <Text style={styles.subLabel}>Low-stock warning</Text>
        <View style={styles.minRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <PremiumInput tone="business"
              label="Warn me at or below"
              value={minimum}
              onChangeText={(t) => setMinimum((t || '').replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0 = never"
              icon="notifications-active"
            />
          </View>
          {/* Bottom-aligned with the input box (PremiumInput keeps SPACE.lg under it). */}
          <GradientButton tone="business" label="Save" variant="outline" onPress={saveMinimum} loading={savingMin} style={styles.minSave} />
        </View>

        <ToggleRow tone="business"
          title="Published"
          subtitle={product?.isActive === false ? 'Hidden from other members' : 'Visible to other members in ACTIV Network'}
          value={product?.isActive !== false}
          onValueChange={togglePublished}
          disabled={publishing}
          last
        />
      </View>

      {mine.length ? (
        <View style={styles.subPanel}>
          <Text style={styles.subLabel}>This line's recent movements</Text>
          {mine.map((m, i) => <MoveRow key={String(m?.id || i)} m={m} last={i === mine.length - 1} />)}
        </View>
      ) : null}
    </View>
  );
}

function ProductStockRow({ item, open, onToggle, onChanged, scale, history }: {
  item: Product; open: boolean; onToggle: () => void; onChanged: (p: Product) => void; scale: number; history: StockMovement[];
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  const st = stateBadges(PALETTE)[stateOf(item)];
  const img = item?.imageUrl ? resolveMediaUrl(item.imageUrl) : '';
  const stock = Number(item?.stock || 0);
  const min = Number(item?.minStock || 0);
  return (
    <LiftCard tone="business" style={styles.rowCard}>
      <PressableScale
        onPress={onToggle}
        scaleTo={0.985}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${item?.name || 'Product'}, ${stock} in stock, ${st.label}`}
      >
        <View style={styles.rowTop}>
          {img ? <FitImage uri={img} style={styles.thumb} /> : (
            <LinearGradient colors={[PALETTE.violetSoft, PALETTE.violetTint]} style={[styles.thumb, styles.thumbEmpty]}><Icon name="inventory-2" size={22} color={p.accent} /></LinearGradient>
          )}
          <View style={styles.rowText}>
            <Text style={styles.rowName} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.name || 'Untitled product'}</Text>
            <Text style={styles.rowSub} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              <Text style={styles.rowQty}>{stock}</Text> in stock{min > 0 ? ` · minimum ${min}` : ''}{item?.isActive === false ? ' · Unpublished' : ''}
            </Text>
          </View>
          <View style={styles.rowEnd}>
            <Badge label={st.label} color={st.fg} bg={st.bg} size="sm" />
            <Icon name={open ? 'expand-less' : 'expand-more'} size={24} color={PALETTE.textFaint} />
          </View>
        </View>
        {/* Visual stock level against the catalogue (and its warning mark). */}
        <View style={styles.barWrap}>
          <GrowBar progress={scale > 0 ? Math.max(stock > 0 ? 0.04 : 0, stock / scale) : 0} colors={st.bar} height={8} />
          {min > 0 && scale > 0 ? <View style={[styles.minMark, { left: `${Math.min(100, (min / scale) * 100)}%` }]} /> : null}
        </View>
      </PressableScale>
      {open ? <AdjustPanel product={item} history={history} onDone={onChanged} /> : null}
    </LiftCard>
  );
}

const StockCentreScreen: React.FC<Props> = ({ navigation, route }) => {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const company = useActiveCompany();
  const loadCompanies = useActiveCompanyStore((s) => s.loadCompanies);
  const companyId = company?._id || '';

  const [rows, setRows] = useState<Product[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(route?.params?.productId || null);
  const [query, setQuery] = useState('');

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    try {
      await loadCompanies();
      const id = useActiveCompanyStore.getState().activeCompanyId || '';
      const [list, history] = await Promise.all([
        id ? getProducts(id) : Promise.resolve([] as Product[]),
        getStockMovements({ limit: 50 }).catch(() => [] as StockMovement[]),
      ]);
      setRows(list || []);
      setMoves(history || []);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your catalogue'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadCompanies]);

  // Re-runs when the active company changes, so switching reloads the catalogue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { load(); }, [load, companyId]));

  const counts = useMemo(() => {
    const all = rows || [];
    return {
      total: all.length,
      low: all.filter((p) => stateOf(p) === 'low').length,
      out: all.filter((p) => stateOf(p) === 'out').length,
      units: all.reduce((n, p) => n + Math.max(0, Number(p?.stock || 0)), 0),
      // Website Stock.tsx "Stock value — at list price".
      value: all.reduce((n, p) => n + Number(p?.stock || 0) * Number(p?.price || 0), 0),
    };
  }, [rows]);

  // The bar scale: the biggest line (or three times its warning level), so bars compare.
  const scale = useMemo(
    () => Math.max(1, ...(rows || []).map((p) => Math.max(Number(p?.stock || 0), Number(p?.minStock || 0) * 3))),
    [rows],
  );

  // The log is per member on the server; keep this company's lines only.
  const companyMoves = useMemo(() => {
    const ids = new Set((rows || []).map((p) => String(p?._id || '')));
    return (moves || []).filter((m) => ids.has(String(m?.productId || ''))).slice(0, MOVES_SHOWN);
  }, [moves, rows]);

  const shown = useMemo(
    () => {
      const term = (query || '').trim().toLowerCase();
      return (rows || []).filter((p) => {
        if (filter !== 'all' && stateOf(p) !== filter) return false;
        if (!term) return true;
        return [p?.name, p?.category].some((f) => String(f || '').toLowerCase().includes(term));
      });
    },
    [rows, filter, query],
  );

  const onChanged = (p: Product) => {
    setRows((prev) => (prev || []).map((x) => (x._id === p._id ? { ...x, stock: p.stock, minStock: p.minStock, isActive: p.isActive } : x)));
    getStockMovements({ limit: 50 }).then((h) => setMoves(h || [])).catch(() => null);
  };

  useEffect(() => { setOpenId(route?.params?.productId || null); }, [route?.params?.productId]);

  const healthy = Math.max(0, counts.total - counts.low - counts.out);

  const header = (
    <View>
      <BrandHeaderBlock tone="business">
        <BrandTopBar onBack={() => navigation.goBack()} title="Stock" />
        <BrandHero
          eyebrow={`Inventory · ${company?.businessName || 'your company'}`}
          title={`${counts.units.toLocaleString('en-IN')} units`}
          subtitle={`${counts.total} product${counts.total === 1 ? '' : 's'} — every change is logged.`}
          art={<StockColumns3D tone="business" size={92} />}
          artSize={92}
        >
          <View style={styles.figures}>
            <GlassFigure icon="inventory-2" value={String(counts.total)} label="Lines" />
            <GlassFigure icon="trending-down" value={String(counts.low)} label="Low" />
            <GlassFigure icon="remove-shopping-cart" value={String(counts.out)} label="Out" />
          </View>
        </BrandHero>
      </BrandHeaderBlock>

      {/* Stock health: the share of lines that are fine, and what the shelf is worth. */}
      <FadeInUp delay={160} style={styles.overlap}>
        <LiftCard tone="business" style={styles.gutter}>
          <View style={styles.health}>
            <RingGauge
              progress={counts.total ? healthy / counts.total : 0}
              size={104}
              stroke={11}
              colors={['#047857', '#34D399']}
              label="healthy"
            />
            <View style={styles.legend}>
              <LegendRow color={PALETTE.green} label="In stock" value={healthy} onPress={() => setFilter('all')} />
              <LegendRow color={PALETTE.amber} label="Low" value={counts.low} onPress={() => setFilter('low')} />
              <LegendRow color={PALETTE.red} label="Out of stock" value={counts.out} onPress={() => setFilter('out')} />
              <View style={styles.valueRow}>
                <Text style={styles.valueLabel} maxFontSizeMultiplier={1.2}>Stock value · at list price</Text>
                <CountUpText value={Math.round(counts.value)} format={(n) => money(Math.round(n))} style={styles.valueFig} />
              </View>
            </View>
          </View>
        </LiftCard>
      </FadeInUp>

      <LiftSearchBar tone="business" value={query} onChangeText={setQuery} placeholder="Search your catalogue" style={styles.search} />
      <SegmentedTabs tone="business"
        options={[
          { value: 'all', label: 'All', count: counts.total },
          { value: 'low', label: 'Low', count: counts.low },
          { value: 'out', label: 'Out', count: counts.out },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
      />
      <View style={{ height: SPACE.md }} />
    </View>
  );

  const footer = (
    <View>
      <BizSectionTitle title="Recent movements" caption={company?.businessName ? `Across ${company.businessName}'s catalogue` : undefined} />
      <LiftCard tone="business" style={styles.gutter}>
        {companyMoves.length === 0 ? (
          <View style={styles.noMoves}>
            <Icon name="history" size={20} color={PALETTE.textFaint} />
            <Text style={styles.muted}>No stock movements yet.</Text>
          </View>
        ) : companyMoves.map((m, i) => <MoveRow key={String(m?.id || i)} m={m} last={i === companyMoves.length - 1} />)}
      </LiftCard>
    </View>
  );

  if (loading && !refreshing) {
    return <BizStatePage title="Stock" eyebrow="Inventory" onBack={() => navigation.goBack()} rows={5} />;
  }
  if (error) {
    return <BizStatePage title="Stock" eyebrow="Inventory" onBack={() => navigation.goBack()} error={error} onRetry={() => load()} />;
  }
  if (!companyId) {
    return (
      <BrandFrame tone="business">
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={(
            <BrandHeaderBlock tone="business">
              <BrandTopBar onBack={() => navigation.goBack()} title="Stock" />
              <BrandHero eyebrow="Inventory" title="No company yet" art={<StockColumns3D tone="business" size={88} />} artSize={88} />
            </BrandHeaderBlock>
          )}
          ListEmptyComponent={(
            <LiftCard tone="business" style={[styles.gutter, styles.overlap]}>
              <ArtEmptyState tone="business" compact art={<StockColumns3D tone="business" size={72} />} title="No company yet" message="Create a business profile to track stock." action="Add company" actionIcon="add-business" onAction={() => navigation.navigate('AddCompany' as any)} />
            </LiftCard>
          )}
        />
      </BrandFrame>
    );
  }

  return (
    <BrandFrame tone="business">
      <FlatList
        data={shown}
        keyExtractor={(item, index) => String(item?._id || index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: SPACE.xxl * 2 }}
        refreshing={refreshing}
        onRefresh={() => load('refresh')}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <LiftCard tone="business" style={styles.gutter}>
            <ArtEmptyState tone="business"
              compact
              art={(rows || []).length === 0 ? <StockColumns3D tone="business" size={72} /> : <SearchLens3D tone="business" size={72} />}
              title={(rows || []).length === 0 ? 'Nothing in your catalogue yet' : 'Nothing matches that'}
              message={(rows || []).length === 0 ? 'Add a product or service and its stock level appears here.' : 'Try a different search, or switch back to all lines.'}
              action={(rows || []).length === 0 ? 'Add product' : undefined}
              actionIcon="add"
              onAction={(rows || []).length === 0 ? () => navigation.navigate('AddProduct', { companyId }) : undefined}
            />
          </LiftCard>
        }
        renderItem={({ item }) => (
          <ProductStockRow
            item={item}
            open={openId === item?._id}
            onToggle={() => setOpenId(openId === item?._id ? null : item?._id)}
            onChanged={onChanged}
            scale={scale}
            history={moves}
          />
        )}
      />
    </BrandFrame>
  );
};

function LegendRow({ color, label, value, onPress }: { color: string; label: string; value: number; onPress: () => void }) {
  const styles = useThemeStyles(makeStyles);
  return (
    <PressableScale onPress={onPress} contentStyle={styles.legendRow} accessibilityRole="button" accessibilityLabel={`Show ${label}: ${value}`}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={styles.legendValue} maxFontSizeMultiplier={1.2}>{value}</Text>
    </PressableScale>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  figures: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  health: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  legend: { flex: 1, minWidth: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 30 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...TYPE.caption, color: PALETTE.textSoft, flex: 1, minWidth: 0 },
  legendValue: { ...TYPE.bodyStrong, fontVariant: ['tabular-nums'] },
  valueRow: { marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  valueLabel: { ...TYPE.caption, fontSize: 11 },
  valueFig: { ...TYPE.number, fontSize: 18, lineHeight: 24, color: PALETTE.greenDark },
  search: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg, marginBottom: SPACE.md },

  rowCard: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md, padding: SPACE.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, minHeight: 56 },
  thumb: { width: 54, height: 54, borderRadius: 14, backgroundColor: PALETTE.field },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { ...TYPE.subheading },
  rowSub: { ...TYPE.caption, marginTop: SPACE.xxs },
  rowQty: { fontWeight: '800', color: PALETTE.text, fontVariant: ['tabular-nums'] },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  barWrap: { marginTop: SPACE.md, justifyContent: 'center' },
  minMark: { position: 'absolute', top: -3, width: 2, height: 14, marginLeft: -1, borderRadius: 1, backgroundColor: PALETTE.amberDark },
  panel: { marginTop: SPACE.md, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  adjustRow: { flexDirection: 'row', gap: SPACE.md },
  move: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, gap: SPACE.md, minHeight: 56 },
  moveDivider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  moveIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  moveName: { ...TYPE.bodyStrong },
  moveDelta: { ...TYPE.heading, fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
  muted: { ...TYPE.caption },
  noMoves: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xs },
  subPanel: { marginTop: SPACE.lg, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  subLabel: { ...TYPE.eyebrow, marginBottom: SPACE.sm },
  minRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md },
  minSave: { marginBottom: SPACE.lg, minWidth: 96 },
});

export default StockCentreScreen;
