import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  PALETTE, GRADIENTS, SPACE, TYPE, errorText, shortDate,
  ConsoleFrame, ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleSectionTitle,
  ConsoleChip, ConsoleTabs, ConsoleSearch, ConsoleButton, ConsoleSkeleton, ConsoleState, ConsoleNote,
  CoverageRing, TierProgressRail, GradientAvatar, GlassIconButton, PremiumInput, PressableScale, FadeInUp,
  CONSOLE_LIST, HubTree3D, DistrictSkyline3D, BlockVillage3D, BRAND,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import {
  hubRegions, hubApplications, approveApplication, rejectApplication,
  LEVELS_FOR, HubRegion, HubStatus, RegionLevel,
} from '../../../services/adminApi';
import { AdminTier, MenuButton, TIER_LABEL } from './TierMenu';

/**
 * ============================================================================
 * THE HUB — District and State admins (the website's AdminHubScreen)
 * ============================================================================
 *
 *   levels        one card per level beneath this tier, WIDEST FIRST
 *                 (State: Districts, Blocks · District: Blocks) with real
 *                 counts — GET /admin/team/directory?level=
 *   regions       every region of that level in the caller's patch
 *   applications  one region's files — GET /admin/team/applications with the
 *                 region's own fields and NO `level` (the server then shows the
 *                 reader's OWN verdict, the same one the Dashboard reports)
 *
 * Whether this admin may still decide a file is the server's `canAct` — never
 * re-derived from the status. Approve / reject go through the generic
 * /applications/:id/approve|reject, where the caller's role selects the seat
 * (the website does the same). A Block admin has no Hub.
 *
 * Premium: gradient level cards with a STAFFING ring (regions with an admin
 * out of all regions at that level), region rows with a DECIDED ring, and the
 * Block → District → State rail on every file.
 */

type Level = 'levels' | 'regions' | 'applications';

const LEVEL_CARD: Record<RegionLevel, { title: string; plural: string; icon: string; grad: string[]; fg: string; soft: string }> = {
  district: { title: 'District', plural: 'Districts', icon: 'map', grad: GRADIENTS.gold, fg: PALETTE.goldDark, soft: PALETTE.goldSoft },
  block: { title: 'Block', plural: 'Blocks', icon: 'place', grad: [BRAND.indigoDeep, BRAND.indigoDark, BRAND.indigo], fg: PALETTE.indigo, soft: PALETTE.indigoSoft },
};

const LEVEL_ART: Record<RegionLevel, React.ComponentType<{ size?: number }>> = {
  district: DistrictSkyline3D,
  block: BlockVillage3D,
};

const STATUSES: { value: HubStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const totals = (rows: HubRegion[]) => (rows || []).reduce(
  (t, r) => ({
    applications: t.applications + Number(r?.applications || 0),
    pending: t.pending + Number(r?.pending || 0),
    approved: t.approved + Number(r?.approved || 0),
    rejected: t.rejected + Number(r?.rejected || 0),
    admins: t.admins + Number(r?.admins || 0),
  }),
  { applications: 0, pending: 0, approved: 0, rejected: 0, admins: 0 },
);

/* ------------------------------------------------------------------ pieces */

function Figure({ label, value, color }: { label: string; value: number; color: string }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return (
    <View style={s.figure} accessible accessibilityLabel={`${label}: ${Number(value || 0)}`}>
      <Text style={[s.figureValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{Number(value || 0)}</Text>
      <Text style={s.figureLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function LevelCard({ level, rows, onPress, delay }: { level: RegionLevel; rows: HubRegion[]; onPress: () => void; delay: number }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const c = LEVEL_CARD[level];
  const t = totals(rows);
  const count = (rows || []).length;
  const unstaffed = (rows || []).filter((r) => !Number(r?.admins || 0)).length;
  const staffed = Math.max(0, count - unstaffed);
  const Art = LEVEL_ART[level];
  return (
    <FadeInUp delay={delay} style={s.levelWrap}>
      <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${c.plural}: ${count}`}>
        <View style={s.levelCard}>
          <View style={s.levelClip}>
            <LinearGradient colors={c.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.levelHead}>
              <View style={s.levelBlob} />
              <View style={s.flexText}>
                <View style={s.levelTitleRow}>
                  <View style={s.levelIcon}><Icon name={c.icon} size={20} color={PALETTE.white} /></View>
                  <Text style={s.levelTitle}>{c.plural}</Text>
                </View>
                <Text style={s.levelSub}>{count} {(count === 1 ? c.title : c.plural).toLowerCase()} in your region</Text>
                <View style={s.levelOpen}>
                  <Text style={s.levelOpenText}>Open</Text>
                  <Icon name="arrow-forward" size={16} color={PALETTE.white} />
                </View>
              </View>
              <View style={s.levelRing}>
                <CoverageRing progress={count ? staffed / count : 0} size={72} stroke={7} light caption="staffed" />
              </View>
              <View pointerEvents="none" style={s.levelArt}><Art size={70} /></View>
            </LinearGradient>
            {/* The website's six figures: the regions and who staffs them, then the
                work sitting in them. `Admins` matches what the Super Admin's Admins
                screen reports, so the two can be read against each other. */}
            <View style={s.levelFigures}>
              <Figure label={c.plural} value={count} color={PALETTE.text} />
              <Figure label="Admins" value={t.admins} color={PALETTE.indigo} />
              <Figure label="Unstaffed" value={unstaffed} color={unstaffed ? PALETTE.warningText : PALETTE.textFaint} />
            </View>
            <View style={[s.levelFigures, s.levelFiguresSecond]}>
              <Figure label="Pending" value={t.pending} color={PALETTE.warningText} />
              <Figure label="Approved" value={t.approved} color={PALETTE.successText} />
              <Figure label="Rejected" value={t.rejected} color={PALETTE.dangerText} />
            </View>
            {unstaffed > 0 ? (
              <View style={s.unstaffed}>
                <Icon name="person-off" size={14} color={PALETTE.warningText} />
                <Text style={s.unstaffedText}>{unstaffed} {unstaffed === 1 ? c.title.toLowerCase() : c.plural.toLowerCase()} with no admin — the Super Admin can appoint one</Text>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
    </FadeInUp>
  );
}

function RegionRow({ r, level, onPress, delay }: { r: HubRegion; level: RegionLevel; onPress: () => void; delay: number }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const parent = level === 'block' ? r?.district : r?.state;
  const apps = Number(r?.applications || 0);
  const pending = Number(r?.pending || 0);
  const decided = Number(r?.approved || 0) + Number(r?.rejected || 0);
  const admins = Number(r?.admins || 0);
  return (
    <FadeInUp delay={delay} style={s.regionWrap}>
      <ConsoleCard onPress={onPress} accessibilityLabel={`${r?.name || 'Region'}, ${pending} pending`}>
        <View style={s.regionTop}>
          <CoverageRing
            progress={apps ? decided / apps : 0}
            size={56}
            stroke={5}
            accent={pending > 0 ? 'amber' : 'green'}
            center={String(pending)}
            caption="pending"
          />
          <View style={s.flexText}>
            <Text style={s.regionName} numberOfLines={1}>{r?.name || '—'}</Text>
            <Text style={s.regionParent} numberOfLines={1}>{parent || ''}</Text>
            <View style={s.regionChips}>
              {admins ? (
                <ConsoleChip label={`${admins} admin${admins === 1 ? '' : 's'}`} kind="info" icon="verified-user" />
              ) : (
                <ConsoleChip label="No admin" kind="warning" icon="person-off" />
              )}
            </View>
          </View>
          <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
        </View>
        <View style={s.regionBar}>
          <Text style={s.regionStat}>{apps} applications</Text>
          <Text style={[s.regionStat, { color: PALETTE.successText }]}>{Number(r?.approved || 0)} approved</Text>
          <Text style={[s.regionStat, { color: PALETTE.dangerText }]}>{Number(r?.rejected || 0)} rejected</Text>
        </View>
      </ConsoleCard>
    </FadeInUp>
  );
}

function DecisionCard({ a, you, busy, onDecide, onView, delay }: {
  a: any; you: string; busy: boolean; onDecide: (a: any, approve: boolean, reason?: string) => void; onView: (a: any) => void; delay: number;
}) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const canAct = !!a?.canAct;
  const statusWord = String(a?.status || '').toLowerCase();
  const fromStatus = statusWord.includes('reject') ? 'rejected'
    : statusWord.includes('approved') && !statusWord.includes('pending') ? 'approved' : 'pending';
  const stage = canAct ? 'pending' : String(a?.stage || fromStatus);
  // The verdict, in the website's three words (ApplicantDecisionRow VERDICT).
  const label = stage === 'approved' ? 'Approved' : stage === 'rejected' ? 'Rejected' : 'Pending';
  // The application's own outcome, when it differs from this seat's verdict.
  const outcome = String(a?.outcome || a?.status || '');
  const enrolled = outcome === 'Approved' && stage !== 'approved';
  const declined = outcome === 'Rejected' && stage !== 'rejected';
  const unowned = !canAct && !!a?.waitingOn && stage === 'pending';
  const place = [a?.block, a?.district].filter(Boolean).join(', ');
  const photo = a?.profilePhoto ? resolveMediaUrl(String(a.profilePhoto)) : '';
  const stripe = stage === 'approved' ? PALETTE.green : stage === 'rejected' ? PALETTE.red : PALETTE.amber;

  return (
    <FadeInUp delay={delay} style={s.regionWrap}>
      <ConsoleCard accent={stripe}>
        <PressableScale onPress={() => onView(a)} scaleTo={0.99} style={s.appHead} contentStyle={s.appHeadInner} accessibilityRole="button" accessibilityLabel={a?.fullName || 'Applicant'}>
          <GradientAvatar name={a?.fullName} uri={photo} size={50} tone="admin" status={stage === 'pending' ? 'pending' : stage === 'approved' ? 'verified' : undefined} />
          <View style={s.flexText}>
            <Text style={s.appName} numberOfLines={1}>{a?.fullName || 'Applicant'}</Text>
            <Text style={s.appSub} numberOfLines={1}>{a?.email || a?.phone || ''}</Text>
            <View style={s.appMeta}>
              <ConsoleChip label={label} kind={stage === 'approved' ? 'approved' : stage === 'rejected' ? 'rejected' : 'pending'} />
              {enrolled ? <ConsoleChip label="Member" kind="neutral" icon="check-circle" /> : null}
              {declined ? <ConsoleChip label="Not admitted" kind="neutral" icon="cancel" /> : null}
            </View>
          </View>
          <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
        </PressableScale>

        <View style={s.rail}>
          <TierProgressRail app={a} you={you} />
        </View>

        <View style={s.appInfo}>
          {place ? (
            <View style={s.appInfoItem}>
              <Icon name="place" size={14} color={PALETTE.textFaint} />
              <Text style={s.appInfoText} numberOfLines={1}>{place}</Text>
            </View>
          ) : null}
          {a?.createdAt || a?.submittedAt ? (
            <View style={s.appInfoItem}>
              <Icon name="event" size={14} color={PALETTE.textFaint} />
              <Text style={s.appInfoText} numberOfLines={1}>Submitted {shortDate(a?.submittedAt || a?.createdAt)}</Text>
            </View>
          ) : null}
        </View>

        {unowned ? (
          <Text style={s.endorse}>No admin in this region — with the Super Admin</Text>
        ) : null}

        {(a?.endorsementLine || (canAct && a?.decidesOutcome === false)) ? (
          <Text style={s.endorse}>
            {a?.endorsementLine || ''}
            {a?.endorsementLine && canAct && a?.decidesOutcome === false ? ' · ' : ''}
            {canAct && a?.decidesOutcome === false ? 'Your decision is recorded for the file; the State Admin grants the membership' : ''}
          </Text>
        ) : null}

        {canAct ? (
          <View style={s.decide}>
            {rejecting ? (
              <PremiumInput
                tone="admin"
                label="Reason for rejection"
                icon="edit-note"
                value={reason}
                onChangeText={setReason}
                placeholder="Why is this being rejected?"
                multiline
                autoFocus
                style={s.fieldGap}
              />
            ) : null}
            <View style={s.decideRow}>
              {rejecting ? (
                <>
                  <ConsoleButton kind="soft" size="sm" label="Cancel" onPress={() => { setRejecting(false); setReason(''); }} disabled={busy} style={s.flex} />
                  <ConsoleButton kind="dangerSolid" size="sm" icon="block" label="Confirm reject" loading={busy} onPress={() => { onDecide(a, false, reason); }} style={s.flex} />
                </>
              ) : (
                <>
                  <ConsoleButton kind="danger" size="sm" icon="close" label="Reject" onPress={() => setRejecting(true)} disabled={busy} style={s.flex} />
                  <ConsoleButton kind="approve" size="sm" icon="check" label="Approve" loading={busy} onPress={() => onDecide(a, true)} style={s.flex} />
                </>
              )}
            </View>
          </View>
        ) : null}
      </ConsoleCard>
    </FadeInUp>
  );
}

/* ------------------------------------------------------------------ screen */

export default function AdminHubView({ tier, region, navigation, onDecided }: {
  tier: AdminTier; region: string; navigation: any; onDecided?: () => void;
}) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const levels = LEVELS_FOR[tier] || ['block'];
  const [level, setLevel] = useState<Level>('levels');
  const [regionLevel, setRegionLevel] = useState<RegionLevel>(levels[0]);
  const [openRegion, setOpenRegion] = useState<HubRegion | null>(null);
  const [status, setStatus] = useState<HubStatus>('all');
  const [summary, setSummary] = useState<Record<RegionLevel, HubRegion[]>>({ district: [], block: [] });
  const [applicants, setApplicants] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSummary = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const pairs = await Promise.all(levels.map(async (l) => [l, await hubRegions(l)] as const));
      const next: Record<RegionLevel, HubRegion[]> = { district: [], block: [] };
      pairs.forEach(([l, rows]) => { next[l] = rows; });
      setSummary(next);
    } catch (err) {
      setError(errorText(err));
    } finally { setLoading(false); setRefreshing(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  useEffect(() => { loadSummary('load'); }, [loadSummary]);

  const loadApplications = useCallback(async (r: HubRegion, st: HubStatus, mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setApplicants(await hubApplications(r, st));
    } catch (err) {
      setError(errorText(err));
      setApplicants([]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const back = useCallback(() => {
    if (level === 'applications') { setLevel('regions'); setOpenRegion(null); setApplicants([]); return true; }
    if (level === 'regions') { setLevel('levels'); setQuery(''); return true; }
    return false;
  }, [level]);

  // The hardware back button steps out of a drill-down before leaving the tab.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]);

  const openLevel = (l: RegionLevel) => { setRegionLevel(l); setQuery(''); setLevel('regions'); };
  const pickRegion = (r: HubRegion) => { setOpenRegion(r); setStatus('all'); setLevel('applications'); loadApplications(r, 'all'); };
  const pickStatus = (st: HubStatus) => { setStatus(st); if (openRegion) loadApplications(openRegion, st); };

  const decide = async (a: any, approve: boolean, reason?: string) => {
    const id = String(a?.id || a?.applicationId || a?._id || '');
    if (!id) return;
    setBusyId(id);
    try {
      const res = approve ? await approveApplication(id) : await rejectApplication(id, (reason || '').trim() || 'No reason given');
      const msg = String(res?.data?.message || '');
      Alert.alert(approve ? 'Approved' : 'Rejected', msg || (approve ? 'Your approval is recorded.' : 'Your rejection is recorded.'));
      if (openRegion) await loadApplications(openRegion, status, 'refresh');
      loadSummary('refresh');
      onDecided?.();
    } catch (err) {
      Alert.alert('Could not record your decision', errorText(err));
    } finally { setBusyId(null); }
  };

  const view = (a: any) => navigation?.navigate?.('ApplicantDetail', { applicant: a });

  const regionRows = useMemo(() => {
    const rows = summary[regionLevel] || [];
    const q = (query || '').trim().toLowerCase();
    const list = q ? rows.filter((r) => [r?.name, r?.district, r?.state].some((v) => String(v || '').toLowerCase().includes(q))) : rows;
    return [...list].sort((x, y) => Number(y?.pending || 0) - Number(x?.pending || 0) || String(x?.name || '').localeCompare(String(y?.name || '')));
  }, [summary, regionLevel, query]);

  const headline = totals(summary[levels[0]] || []);
  const onRefresh = () => (level === 'applications' && openRegion ? loadApplications(openRegion, status, 'refresh') : loadSummary('refresh'));
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />;

  if (level === 'levels') {
    return (
      <ConsoleScroll refreshControl={refresh}>
        <ConsoleHeader
          left={<MenuButton />}
          topCenter={`${TIER_LABEL[tier]} Admin`}
          eyebrow={region ? `${region} · ${TIER_LABEL[tier]} Admin` : `${TIER_LABEL[tier]} Admin`}
          title="Hub"
          subtitle={`Every application in your ${TIER_LABEL[tier].toLowerCase()} — any of them is yours to approve or reject.`}
          art={<HubTree3D size={100} />}
          badges={levels.map((l) => ({ icon: LEVEL_CARD[l].icon, label: `${(summary[l] || []).length} ${LEVEL_CARD[l].plural.toLowerCase()}` }))}
          waveHeight={62}
        />
        {loading ? (
          <>
            <ConsoleSkeleton variant="tiles" style={s.overlap} />
            <ConsoleSkeleton rows={2} />
          </>
        ) : error ? (
          <ConsoleState kind="error" title="Could not load the hub" message={error} action="Try again" onAction={() => loadSummary('load')} style={s.errorGap} />
        ) : (
          <>
            <ConsoleGrid overlap>
              <ConsoleStatTile label="Applications" hint="In your region" value={headline.applications} icon="description" accent="indigo" delay={40} />
              <ConsoleStatTile label="Pending" hint="Awaiting a decision" value={headline.pending} icon="schedule" accent="amber" delay={100} />
              <ConsoleStatTile label="Approved" hint="Members created" value={headline.approved} icon="check-circle" accent="green" delay={160} />
              <ConsoleStatTile label="Rejected" hint="Turned down" value={headline.rejected} icon="cancel" accent="red" delay={220} />
            </ConsoleGrid>
            <ConsoleSectionTitle icon="account-tree" title="Levels" subtitle="Tap a level to see its regions" style={s.sectionTight} />
            {levels.map((l, i) => <LevelCard key={l} level={l} rows={summary[l] || []} onPress={() => openLevel(l)} delay={260 + i * 80} />)}
          </>
        )}
      </ConsoleScroll>
    );
  }

  const title = level === 'regions' ? LEVEL_CARD[regionLevel].plural : (openRegion?.name || 'Applications');
  const subtitle = level === 'regions'
    ? 'Pick a region to see its applications'
    : [openRegion?.block, openRegion?.district, openRegion?.state].filter(Boolean).join(', ');

  const header = (
    <View>
      <ConsoleHeader
        compact
        left={<GlassIconButton icon="arrow-back" onPress={() => back()} accessibilityLabel="Back" />}
        topCenter={`${TIER_LABEL[tier]} Admin · Hub`}
        right={<MenuButton />}
        eyebrow={level === 'regions' ? `${regionRows.length} shown` : 'Region'}
        title={title}
        subtitle={subtitle}
        badges={level === 'applications' && openRegion ? [
          { icon: 'schedule', label: `${Number(openRegion?.pending || 0)} pending` },
          { icon: 'description', label: `${Number(openRegion?.applications || 0)} total` },
        ] : undefined}
      />
      {level === 'regions' ? (
        <ConsoleSearch value={query} onChangeText={setQuery} placeholder={`Search ${LEVEL_CARD[regionLevel].plural.toLowerCase()}`} />
      ) : null}
      {level === 'applications' ? (
        <ConsoleTabs value={status} onChange={pickStatus} options={STATUSES} />
      ) : null}
      {level === 'applications' && !loading && !error && applicants.length > 0 ? (
        <ConsoleNote icon="touch-app" style={s.noteGap} text="Tap a card for the full application. Approve and reject act in your own seat." />
      ) : null}
    </View>
  );

  const empty = loading ? <ConsoleSkeleton rows={4} style={s.listGap} />
    : error ? <ConsoleState kind="error" title="Could not load this" message={error} action="Try again" onAction={() => (level === 'applications' && openRegion ? loadApplications(openRegion, status) : loadSummary('load'))} />
      : level === 'regions' ? <ConsoleState title="No regions" message={query ? 'Nothing matches this search.' : 'No regions at this level in your patch yet.'} />
        : <ConsoleState title="No applications" message="Nothing in this region matches this filter." />;

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : (level === 'regions' ? regionRows : applicants)}
        keyExtractor={(item: any, index) => String(item?.id || item?._id || item?.applicationId || `${item?.name}-${index}`)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        ListHeaderComponent={header}
        contentContainerStyle={CONSOLE_LIST}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refresh}
        renderItem={({ item, index }: any) => (level === 'regions'
          ? <RegionRow r={item} level={regionLevel} delay={Math.min(index, 6) * 40} onPress={() => pickRegion(item)} />
          : <DecisionCard a={item} you={tier} delay={Math.min(index, 6) * 40} busy={busyId === String(item?.id || item?.applicationId || item?._id || '')} onDecide={decide} onView={view} />)}
        ListEmptyComponent={empty}
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  overlap: { marginTop: -30 },
  errorGap: { marginTop: SPACE.lg },
  sectionTight: { marginTop: SPACE.sm },
  noteGap: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  listGap: { marginTop: SPACE.md },
  figure: { alignItems: 'center', flex: 1, minWidth: 0 },
  figureValue: { ...TYPE.number, fontSize: 22, lineHeight: 28 },
  figureLabel: { ...TYPE.caption, fontSize: 11, fontWeight: '600', marginTop: SPACE.xxs },
  levelWrap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  levelCard: {
    backgroundColor: PALETTE.card, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 22, elevation: 5,
  },
  levelClip: { borderRadius: 24, overflow: 'hidden' },
  levelHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, minHeight: 124, overflow: 'hidden' },
  levelBlob: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)', top: -80, right: -50 },
  levelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  levelIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  levelTitle: { ...TYPE.title, color: PALETTE.white },
  levelSub: { ...TYPE.label, color: 'rgba(255,255,255,0.88)', marginTop: SPACE.xs },
  levelOpen: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: SPACE.md, paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)' },
  levelOpenText: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: PALETTE.white },
  levelRing: { zIndex: 2 },
  levelArt: { position: 'absolute', right: -6, bottom: -14, opacity: 0.22 },
  levelFiguresSecond: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  levelFigures: { flexDirection: 'row', paddingVertical: SPACE.lg, paddingHorizontal: SPACE.sm },
  unstaffed: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm - 2, backgroundColor: PALETTE.warningSoft, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md - 2 },
  unstaffedText: { flex: 1, minWidth: 0, ...TYPE.caption, color: PALETTE.warningText, fontWeight: '600' },
  regionWrap: { marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  regionTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  regionName: { ...TYPE.subheading, fontWeight: '800' },
  regionParent: { ...TYPE.caption, marginTop: SPACE.xxs },
  regionChips: { flexDirection: 'row', gap: 6, marginTop: SPACE.sm - 2 },
  regionBar: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  regionStat: { ...TYPE.caption, fontWeight: '700', color: PALETTE.textSoft },
  appHead: {},
  appHeadInner: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  appName: { ...TYPE.subheading, fontWeight: '800' },
  appSub: { ...TYPE.caption, marginTop: SPACE.xxs },
  appMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm - 2 },
  rail: { marginTop: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xs, borderRadius: 16, backgroundColor: PALETTE.indigoTint },
  appInfo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  appInfoItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flexShrink: 1, minWidth: 0 },
  appInfoText: { ...TYPE.caption, fontWeight: '600', flexShrink: 1 },
  endorse: { ...TYPE.caption, lineHeight: 18, marginTop: SPACE.sm, color: PALETTE.indigoDark, backgroundColor: PALETTE.indigoSoft, padding: SPACE.md - 2, borderRadius: 12, fontWeight: '600', overflow: 'hidden' },
  decide: { marginTop: SPACE.md },
  fieldGap: { marginBottom: SPACE.sm },
  decideRow: { flexDirection: 'row', gap: SPACE.sm },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
