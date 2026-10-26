import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import ApprovalQueue from '../../../components/ApprovalQueue';
import { Applicant, ApplicantBuckets, AdminLevel } from '../../../types';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleTabs, ConsoleSkeleton, ApprovalStack3D,
} from '../../../ui';
import { AdminTier, MenuButton, TIER_LABEL } from './TierMenu';

/**
 * ============================================================================
 * TIER APPROVALS — the website's `AdminApprovalsScreen`, for block / district
 * / state.
 * ============================================================================
 *
 * The buckets are the server's own (`GET /admin/<tier>/dashboard` →
 * `applicants`), rendered verbatim by the shared `ApprovalQueue`: four pills,
 * the server's `canAct` drawing the buttons, an inline reject form (no native
 * <Modal>, CLAUDE.md Rule 2). Approve / reject go through the context's
 * `submitReview`, which posts the website's tier-agnostic aliases.
 *
 * The region filter mirrors `ApplicantRegionFilter`: the levels BENEATH this
 * tier (`tierConfig.approvalFilters`) — none for a block admin, block for a
 * district admin, district then block for a state admin. It is a view over what
 * the server already sent, applied to ALL FOUR buckets so the pill counts agree
 * with the list; nothing is sent back to the API.
 */

type RegionLevel = 'district' | 'block';

const FILTERS: Record<AdminTier, RegionLevel[]> = {
  block: [],
  district: ['block'],
  state: ['district', 'block'],
};

const norm = (v?: string | null) => String(v || '').trim().toLowerCase();

interface Props {
  tier: AdminTier;
  region: string;
  applicants: ApplicantBuckets;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  submitReview: (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => Promise<void>;
  navigation: any;
}

function ChipRow({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  if (!options.length) return null;
  return (
    <View style={s.filterBlock}>
      <Text style={s.filterLabel}>{label}</Text>
      <ConsoleTabs
        scrollable
        value={value}
        onChange={onChange}
        options={['', ...options].map((opt) => ({ value: opt, label: opt || `All ${label.toLowerCase()}s` }))}
      />
    </View>
  );
}

export default function TierApprovalsView({
  tier, region, applicants, loading, refreshing, onRefresh, submitReview, navigation,
}: Props) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const levels = useMemo(() => FILTERS[tier] || [], [tier]);
  const [tab, setTab] = useState<keyof ApplicantBuckets>('all');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');

  const all = useMemo(() => applicants?.all || [], [applicants]);

  const districtOptions = useMemo(() => {
    if (!levels.includes('district')) return [];
    const set = new Set<string>();
    all.forEach((a) => { const d = String(a?.district || '').trim(); if (d) set.add(d); });
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [all, levels]);

  // Blocks are narrowed by the district already chosen, so picking one never
  // offers a block from somewhere else.
  const blockOptions = useMemo(() => {
    if (!levels.includes('block')) return [];
    const set = new Set<string>();
    all.forEach((a) => {
      if (district && norm(a?.district) !== norm(district)) return;
      const b = String(a?.block || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((x, y) => x.localeCompare(y));
  }, [all, levels, district]);

  const buckets = useMemo<ApplicantBuckets>(() => {
    const safe: ApplicantBuckets = {
      pending: applicants?.pending || [],
      approved: applicants?.approved || [],
      rejected: applicants?.rejected || [],
      all: applicants?.all || [],
    };
    if (!district && !block) return safe;
    const keep = (rows: Applicant[]) => (rows || []).filter((a) =>
      (!district || norm(a?.district) === norm(district)) && (!block || norm(a?.block) === norm(block)));
    return { pending: keep(safe.pending), approved: keep(safe.approved), rejected: keep(safe.rejected), all: keep(safe.all) };
  }, [applicants, district, block]);

  const onReview = useCallback(
    (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => submitReview(applicant, action, reason),
    [submitReview],
  );

  const tierWord = TIER_LABEL[tier].toLowerCase();
  const intro = region
    ? `Every application in ${region} (your ${tierWord}) — any of them is yours to decide.`
    : `Every application in your ${tierWord} — any of them is yours to decide.`;

  const firstLoad = loading && !all.length;

  // The contexts clear `refreshing` but never raise it, so the pull indicator
  // is driven from here for the duration of the refetch.
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(async () => {
    setPulling(true);
    try { await onRefresh(); } catch { /* the context reports its own error */ } finally { setPulling(false); }
  }, [onRefresh]);

  const pendingCount = (applicants?.pending || []).length;

  return (
    <ConsoleScroll
      refreshControl={<RefreshControl refreshing={pulling || refreshing} onRefresh={pull} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
    >
      <ConsoleHeader
        left={<MenuButton />}
        topCenter={`${TIER_LABEL[tier]} Admin`}
        eyebrow={region ? `${region} · ${TIER_LABEL[tier]} Admin` : `${TIER_LABEL[tier]} Admin`}
        title="Approvals"
        subtitle={intro}
        art={<ApprovalStack3D size={96} />}
        badges={[
          { icon: 'schedule', label: firstLoad ? 'Loading…' : `${pendingCount} pending` },
          { icon: 'fact-check', label: `${all.length} in total` },
        ]}
      />

      {levels.includes('district') ? (
        <ChipRow label="District" options={districtOptions} value={district} onChange={(v) => { setDistrict(v); setBlock(''); }} />
      ) : null}
      {levels.includes('block') ? (
        <ChipRow label="Block" options={blockOptions} value={block} onChange={setBlock} />
      ) : null}

      {firstLoad ? (
        <ConsoleSkeleton rows={4} style={s.skeleton} />
      ) : (
        <ApprovalQueue
          buckets={buckets}
          level={tier as AdminLevel}
          activeFilter={tab}
          onFilterChange={setTab}
          onReview={onReview}
          onPressApplicant={(a) => navigation?.navigate?.('ApplicantDetail', { applicant: a })}
        />
      )}
    </ConsoleScroll>
  );
}

const s = StyleSheet.create({
  filterBlock: { marginTop: SPACE.xs, marginBottom: SPACE.xs },
  filterLabel: { ...TYPE.eyebrow, marginHorizontal: SPACE.lg, marginBottom: SPACE.sm, color: PALETTE.indigoDark },
  skeleton: { marginTop: SPACE.md },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
