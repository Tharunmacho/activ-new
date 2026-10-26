import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, money, shortDate,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch,
  ConsoleSkeleton, ConsoleState, ConsoleNote, GlassIconButton, GradientAvatar, TrustShield3D, CONSOLE_LIST,
  consoleStageKind,
} from '../../../ui';
import {
  getDonationSummary, listDonors, listDonations, fyLabel, statementUrl, receiptUrl, errorText,
} from '../../../services/superApi';
import { ChipRow, MiniAction, openUrl, place } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — Donors (website /super-admin/donations)
 * ============================================================================
 *
 * GET /admin/super/donations/summary?fy, /donors?fy&q&limit=200, and
 * /donations?fy&limit=200 — the same three calls, with the same parameters, as
 * the website. The financial year drives every figure, because the year is
 * what a donor's tax certificate is for. Each gift is its own row, with its
 * own message and 80G receipt. The receipt and the year certificate are public
 * web pages keyed by an unguessable token; they open in the browser.
 */

type Tab = 'donors' | 'donations';

const GOLD = PALETTE.amberDark;

function DonorRow({ d, fy, onOpen }: { d: any; fy: string; onOpen: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const where = place(d?.city, d?.district, d?.state);
  const count = Number(d?.donationCount || 0);
  return (
    <ConsoleCard style={s.card} onPress={onOpen} accessibilityLabel={`${d?.fullName || 'Donor'}, ${money(d?.totalAmount)}`}>
      <View style={s.row}>
        <GradientAvatar name={d?.fullName || '?'} size={44} tone="admin" ring={false} />
        <View style={s.flexText}>
          <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{d?.fullName || '—'}</Text>
          {d?.email ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{d.email}</Text> : null}
          {d?.phone ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{d.phone}</Text> : null}
          {where ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{where}</Text> : null}
        </View>
        <View style={s.right}>
          <Text style={s.amount} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(d?.totalAmount)}</Text>
          <Text style={s.sub} maxFontSizeMultiplier={1.3}>{count} gift{count === 1 ? '' : 's'}</Text>
        </View>
      </View>
      <Text style={s.footText} maxFontSizeMultiplier={1.3}>
        All time {money(d?.allTimeAmount)}{d?.lastDonationAt ? ` · last ${shortDate(d.lastDonationAt)}` : ''}{d?.pan ? ` · PAN ${d.pan}` : ''}
      </Text>
      {d?.statementToken ? (
        <View style={s.actions}>
          <MiniAction icon="event-note" label="Year certificate" color={GOLD} onPress={() => openUrl(statementUrl(d.statementToken, fy || undefined))} />
        </View>
      ) : null}
    </ConsoleCard>
  );
}

function DonationRow({ r, onOpenDonor }: { r: any; onOpenDonor: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const status = String(r?.status || 'pending');
  const paid = status.toLowerCase() === 'paid';
  return (
    <ConsoleCard style={s.card} accent={paid ? PALETTE.green : undefined}>
      <View style={s.row}>
        <View style={s.flexTextNoMargin}>
          <TouchableOpacity onPress={onOpenDonor} disabled={!r?.donorId} accessibilityRole="button" accessibilityLabel={`Open donor ${r?.donorName || ''}`}>
            <Text style={[s.name, r?.donorId ? s.link : null]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r?.donorName || '—'}</Text>
          </TouchableOpacity>
          {r?.donorEmail ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r.donorEmail}</Text> : null}
          <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r?.receiptNumber || 'No receipt yet'} · {shortDate(r?.paidAt || r?.createdAt) || '—'}</Text>
        </View>
        <View style={s.right}>
          <Text style={s.amount} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(r?.amount)}</Text>
          <ConsoleChip label={status} kind={paid ? 'approved' : consoleStageKind(status)} style={s.chipTop} />
        </View>
      </View>
      {r?.message ? <Text style={s.message} maxFontSizeMultiplier={1.3}>“{r.message}”</Text> : null}
      {paid && r?.receiptToken ? (
        <View style={s.actions}>
          <MiniAction icon="receipt-long" label="80G receipt" color={GOLD} onPress={() => openUrl(receiptUrl(r.receiptToken))} />
        </View>
      ) : null}
    </ConsoleCard>
  );
}

const SuperDonorsScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const [fy, setFy] = useState('');
  const [tab, setTab] = useState<Tab>('donors');
  const [q, setQ] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [donors, setDonors] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const [sm, dn, dl] = await Promise.all([
        getDonationSummary(fy || undefined),
        listDonors({ fy: fy || undefined, q: (q || '').trim() || undefined, limit: 200 }),
        listDonations({ fy: fy || undefined, limit: 200 }),
      ]);
      if (mine !== seq.current) return;
      setSummary(sm || {});
      setDonors(Array.isArray(dn?.rows) ? dn.rows : []);
      setDonations(Array.isArray(dl?.rows) ? dl.rows : []);
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The donations could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [fy, q]);

  // Search is sent to the server (debounced); the year reloads at once. After
  // the first answer, reloads keep the list on screen (no skeleton flash).
  const loadedOnce = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { load(loadedOnce.current ? 'quiet' : 'load'); loadedOnce.current = true; }, (q || '').length ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const years: string[] = Array.isArray(summary?.financialYears) ? summary.financialYears : [];
  const shownDonations = useMemo(() => {
    const term = (q || '').trim().toLowerCase();
    const list = Array.isArray(donations) ? donations : [];
    if (!term) return list;
    return list.filter((r) => [r?.donorName, r?.donorEmail, r?.receiptNumber, r?.message].some((v) => String(v || '').toLowerCase().includes(term)));
  }, [donations, q]);

  const firstLoad = loading && !summary;
  const hardError = !!error && !summary;
  const data: any[] = firstLoad || hardError ? [] : tab === 'donors' ? donors : shownDonations;
  const fyWord = fy ? `FY ${fyLabel(fy)}` : 'All years';

  const renderItem = useCallback(({ item }: { item: any }) => (tab === 'donors' ? (
    <DonorRow d={item} fy={fy} onOpen={() => navigation?.navigate?.('SuperDonorDetail', { id: String(item?.id || ''), name: item?.fullName || '' })} />
  ) : (
    <DonationRow r={item} onOpenDonor={() => navigation?.navigate?.('SuperDonorDetail', { id: String(item?.donorId || ''), name: item?.donorName || '' })} />
  )), [tab, fy, navigation]);

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · donations"
        title="Donors"
        subtitle="Every donor, every gift, 80G receipts and year certificates"
        art={<TrustShield3D size={84} tone="admin" />}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={<GlassIconButton icon="refresh" accessibilityLabel="Refresh" onPress={() => load('refresh')} />}
      />
      {firstLoad ? <ConsoleSkeleton variant="tiles" style={s.overlap} /> : hardError ? null : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Total donated" hint={fyWord} value={money(summary?.totalAmount || 0)} icon="currency-rupee" accent="gold" />
          <ConsoleStatTile label="Donations" value={Number(summary?.donationCount || 0)} icon="volunteer-activism" accent="indigo" delay={60} />
          <ConsoleStatTile label="Donors" value={Number(summary?.donorCount || 0)} icon="groups" accent="green" delay={120} />
          <ConsoleStatTile label="This month" value={money(summary?.thisMonthAmount || 0)} icon="calendar-today" accent="sky" delay={180} />
        </ConsoleGrid>
      )}
      {years.length ? (
        <ChipRow<string>
          options={[{ value: '', label: 'All years' }, ...years.map((y) => ({ value: String(y || ''), label: `FY ${fyLabel(y)}` }))]}
          value={fy}
          onChange={setFy}
        />
      ) : null}
      <ConsoleTabs<Tab>
        value={tab}
        onChange={setTab}
        style={s.tabs}
        options={[
          { value: 'donors', label: 'Donors', ...(summary ? { count: donors.length } : {}) },
          { value: 'donations', label: 'All donations', ...(summary ? { count: donations.length } : {}) },
        ]}
      />
      <ConsoleSearch value={q} onChangeText={setQ} placeholder="Name, email, phone, PAN or receipt" style={s.search} />
      {error && summary ? <ConsoleNote kind="red" icon="error-outline" text={error} style={s.note} action="Try again" onAction={() => load('refresh')} /> : null}
      {hardError ? <ConsoleState kind="error" title="Could not load donations" message={error} action="Try again" onAction={() => load('load')} /> : null}
      {firstLoad ? <ConsoleSkeleton rows={3} /> : null}
    </>
  );

  const term = (q || '').trim();
  return (
    <ConsoleFrame>
      <FlatList
        data={data}
        keyExtractor={(x, i) => String(x?.id || x?._id || i)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!firstLoad && !hardError ? (
          <ConsoleState
            title={tab === 'donors'
              ? `No donors ${fy ? `in FY ${fyLabel(fy)}` : 'yet'}${term ? ' match that search' : ''}`
              : `No donations ${fy ? `in FY ${fyLabel(fy)}` : 'yet'}${term ? ' match that search' : ''}`}
            message="Donations made on the website appear here."
          />
        ) : null}
        ListFooterComponent={!firstLoad && !hardError && data.length ? (
          <View style={s.foot}>
            <Icon name="lock-outline" size={14} color={PALETTE.textFaint} />
            <Text style={s.footNote} maxFontSizeMultiplier={1.3}>Receipts and year certificates are public pages keyed by a private link — share them only with the donor.</Text>
          </View>
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
};

const s = StyleSheet.create({
  overlap: { marginTop: -30 },
  tabs: { marginTop: SPACE.md },
  search: { marginTop: SPACE.md, marginBottom: SPACE.sm },
  note: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  flexText: { flex: 1, minWidth: 0, marginHorizontal: SPACE.md },
  flexTextNoMargin: { flex: 1, minWidth: 0, marginRight: SPACE.md },
  right: { alignItems: 'flex-end', maxWidth: '42%' },
  name: { ...TYPE.subheading, fontWeight: '800' },
  link: { color: PALETTE.indigoDark },
  sub: { ...TYPE.caption, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: '800', color: GOLD },
  chipTop: { marginTop: SPACE.xs },
  message: { fontSize: 13, color: PALETTE.textSoft, fontStyle: 'italic', marginTop: SPACE.sm, lineHeight: 19 },
  footText: { ...TYPE.caption, marginTop: SPACE.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.md },
  foot: { flexDirection: 'row', gap: SPACE.xs, alignItems: 'flex-start', marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
  footNote: { ...TYPE.caption, flex: 1, minWidth: 0, color: PALETTE.textFaint },
});

export default SuperDonorsScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
