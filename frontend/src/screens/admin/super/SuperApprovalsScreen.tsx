import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Alert, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ApprovalQueue from '../../../components/ApprovalQueue';
import { Applicant, ApplicantBuckets } from '../../../types';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleSearch, ConsoleTabs, ConsoleSkeleton, ConsoleState, ConsoleNote, ConsoleButton,
  GlassIconButton, ApprovalStack3D,
} from '../../../ui';
import { getSuperApplications, approveApplication, rejectApplication, errorText } from '../../../services/superApi';

/**
 * ============================================================================
 * SUPER ADMIN — Approvals (website /super-admin/approvals)
 * ============================================================================
 *
 * Every application on the platform. The Super Admin fills the STATE seat, so
 * the list is read at `level: 'state'` and each row carries the server's
 * `canAct` / `decidesOutcome` — the buttons come from the server, never from
 * the status. Approve / reject go through the same aliases the website uses
 * (`/applications/:id/approve|reject`), where the caller's role picks the seat
 * and a Super Admin approval is the OUTCOME (it enrols the member).
 */

const EMPTY: ApplicantBuckets = { pending: [], approved: [], rejected: [], all: [] };

/*
 * REGION FILTER - the website's `ApplicantRegionFilter` with the super admin's
 * `approvalFilters: ['state', 'district', 'block']`. Options come from the
 * `all` bucket narrowed by the levels ABOVE (so picking one never deletes the
 * choices beside it), each with its count; a level appears only once it has
 * more than one thing to choose between; picking a level clears those below.
 * Matching is trimmed, whitespace-collapsed and case-insensitive, as there.
 */
type RegionLevel = 'state' | 'district' | 'block';
type RegionSelection = Record<RegionLevel, string>;
const LEVELS: RegionLevel[] = ['state', 'district', 'block'];
const EMPTY_SELECTION: RegionSelection = { state: '', district: '', block: '' };
const LEVEL_LABEL: Record<RegionLevel, string> = { state: 'State', district: 'District', block: 'Block' };
const norm = (v?: string | null) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
const matchesSelection = (a: any, sel: RegionSelection) =>
  LEVELS.every((lvl) => {
    const chosen = norm(sel[lvl]);
    return !chosen || norm(a?.[lvl]) === chosen;
  });

function RegionFilter({ applicants, selection, onChange }: {
  applicants: any[]; selection: RegionSelection; onChange: (s: RegionSelection) => void;
}) {
  const groups = useMemo(() => {
    const rows = Array.isArray(applicants) ? applicants : [];
    return LEVELS.map((level, depth) => {
      const above: RegionSelection = { ...EMPTY_SELECTION };
      LEVELS.slice(0, depth).forEach((up) => { above[up] = selection[up]; });
      const counts = new Map<string, { name: string; count: number }>();
      rows.filter((r) => matchesSelection(r, above)).forEach((r) => {
        const raw = String(r?.[level] || '').trim();
        if (!raw) return;
        const key = norm(raw);
        const seen = counts.get(key);
        if (seen) seen.count += 1; else counts.set(key, { name: raw, count: 1 });
      });
      return { level, rows: Array.from(counts.values()).sort((x, y) => x.name.localeCompare(y.name)) };
    });
  }, [applicants, selection]);

  if (groups.every((g) => g.rows.length < 2)) return null;
  const active = LEVELS.some((l) => !!selection[l]);

  const pick = (level: RegionLevel, value: string) => {
    const next = { ...selection, [level]: value };
    LEVELS.slice(LEVELS.indexOf(level) + 1).forEach((below) => { next[below] = ''; });
    onChange(next);
  };

  return (
    <View style={rf.wrap}>
      {groups.map((g) => (g.rows.length > 1 ? (
        <View key={g.level} style={rf.group}>
          <Text style={rf.label}>{LEVEL_LABEL[g.level]}</Text>
          <ConsoleTabs
            scrollable
            value={g.rows.find((row) => norm(row.name) === norm(selection[g.level]))?.name || ''}
            onChange={(v) => pick(g.level, v)}
            options={[{ value: '', label: `All ${LEVEL_LABEL[g.level].toLowerCase()}s` }, ...g.rows.map((row) => ({ value: row.name, label: row.name, count: row.count }))]}
          />
        </View>
      ) : null))}
      {active ? (
        <ConsoleButton kind="ghost" size="sm" icon="close" label="Clear region" onPress={() => onChange({ ...EMPTY_SELECTION })} style={rf.clear} />
      ) : null}
    </View>
  );
}

const rf = StyleSheet.create({
  wrap: { marginTop: SPACE.xs },
  group: { marginTop: SPACE.md },
  label: { ...TYPE.eyebrow, paddingHorizontal: SPACE.lg, marginBottom: SPACE.sm, color: PALETTE.indigoDark },
  clear: { alignSelf: 'flex-start', marginHorizontal: SPACE.sm, marginTop: SPACE.xs },
});

const SuperApprovalsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [buckets, setBuckets] = useState<ApplicantBuckets>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  // The website opens on "all" (AdminApprovalsScreen `useState('all')`).
  const [filter, setFilter] = useState<keyof ApplicantBuckets>('all');
  const [region, setRegion] = useState<RegionSelection>({ ...EMPTY_SELECTION });
  const loadedOnce = useRef(false);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const statuses: (keyof ApplicantBuckets)[] = ['pending', 'approved', 'rejected', 'all'];
      /*
       * EVERY page of each bucket. The server caps `limit` at 100 and answers
       * `pagination.pages`, so a bucket of 140 used to stop at the first 100
       * with nothing on screen saying so. Page 1 of each bucket first, then the
       * remaining pages (bounded — the server reads at most 500 rows anyway).
       */
      const fetchBucket = async (status: keyof ApplicantBuckets) => {
        const first = await getSuperApplications({ level: 'state', status, limit: 100, page: 1 });
        const rows: any[] = Array.isArray(first?.applicants) ? [...first.applicants] : [];
        const pages = Math.min(10, Math.max(1, Number(first?.pagination?.pages || 1)));
        for (let page = 2; page <= pages; page += 1) {
          const next = await getSuperApplications({ level: 'state', status, limit: 100, page });
          const more = Array.isArray(next?.applicants) ? next.applicants : [];
          if (!more.length) break;
          rows.push(...more);
        }
        return rows;
      };
      const lists = await Promise.all(statuses.map(fetchBucket));
      const next: any = {};
      statuses.forEach((st, i) => { next[st] = lists[i] || []; });
      setBuckets(next as ApplicantBuckets);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load(loadedOnce.current ? 'refresh' : 'load');
    loadedOnce.current = true;
  }, [load]));

  /* Narrow by region and by a search term, over every bucket alike. */

  const shown = useMemo<ApplicantBuckets>(() => {
    const term = (q || '').trim().toLowerCase();
    const keep = (a: any) => {
      if (!matchesSelection(a, region)) return false;
      if (!term) return true;
      return [a?.fullName, a?.email, a?.phone, a?.district, a?.block, a?.memberCode]
        .some((v) => String(v || '').toLowerCase().includes(term));
    };
    return {
      pending: (buckets.pending || []).filter(keep),
      approved: (buckets.approved || []).filter(keep),
      rejected: (buckets.rejected || []).filter(keep),
      all: (buckets.all || []).filter(keep),
    };
  }, [buckets, q, region]);

  const onReview = useCallback(async (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => {
    try {
      if (action === 'approve') {
        const res = await approveApplication(applicant?.id || '');
        Alert.alert('Approved', res?.message || 'The application was approved.');
      } else {
        await rejectApplication(applicant?.id || '', (reason || '').trim() || 'No reason given');
        Alert.alert('Rejected', 'The application was rejected.');
      }
      await load('refresh');
    } catch (err) {
      Alert.alert(`Could not ${action}`, errorText(err));
    }
  }, [load]);

  const pendingCount = (buckets.pending || []).length;

  return (
    <ConsoleScroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
    >
      <ConsoleHeader
        left={<GlassIconButton icon="arrow-back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        topCenter="Super Admin"
        eyebrow="The State seat"
        title={loading ? 'Approvals' : `${pendingCount} waiting`}
        subtitle="Every application on the platform. Your approval grants the membership; Block and District verdicts are endorsements you can read on each card."
        art={<ApprovalStack3D size={96} />}
        badges={[
          { icon: 'fact-check', label: `${(buckets.all || []).length} applications` },
          { icon: 'public', label: 'All India' },
        ]}
      />
      <ConsoleSearch value={q} onChangeText={setQ} placeholder="Search name, email, phone, district…" style={s.search} />
      <RegionFilter applicants={buckets.all || []} selection={region} onChange={setRegion} />

      {loading ? <ConsoleSkeleton rows={4} style={s.gap} /> : error ? (
        <ConsoleState kind="error" title="Could not load approvals" message={error} action="Try again" onAction={() => load()} />
      ) : (
        <View style={s.gap}>
          <ApprovalQueue
            buckets={shown}
            level="state"
            activeFilter={filter}
            onFilterChange={setFilter}
            onReview={onReview}
            onPressApplicant={(a) => navigation.navigate('ApplicantDetail', { applicant: a })}
          />
        </View>
      )}
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  search: { marginTop: SPACE.xs },
  gap: { marginTop: SPACE.md },
  note: { marginHorizontal: SPACE.lg },
});

export default SuperApprovalsScreen;
