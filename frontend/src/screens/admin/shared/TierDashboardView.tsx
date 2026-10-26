import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleSectionTitle, ConsoleNote,
  ConsoleChip, ConsoleSkeleton, ConsoleState, CoverageRing, GradientAvatar, PressableScale, FadeInUp,
  BlockVillage3D, DistrictSkyline3D, StateNetwork3D, consoleGreeting, consoleStageKind,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import { formatApplicationRef } from '../../../services/memberApi';
import { Applicant, ApplicantBuckets } from '../../../types';
import { AdminTier, MenuButton, TIER_LABEL } from './TierMenu';

/**
 * ============================================================================
 * TIER DASHBOARD — the website's shared `AdminDashboardScreen`, for block /
 * district / state, drawn as the premium admin console.
 * ============================================================================
 *
 * Same data (GET /admin/<tier>/dashboard, via the tier context), same figures:
 *
 *   - FOUR TILES THAT ARE ONE SUM: Total Applicants (`stats.totalApplications`,
 *     the bucket sum as fallback) = Pending + Approved + Rejected. No trend
 *     footer — no endpoint returns one.
 *   - RECENT ACTIVITY: the five newest rows of the server's `all` bucket — name,
 *     application reference, the server's own stage label, member type and the
 *     submission date — with "View All" into Approvals.
 *
 * The indigo wave header carries the admin's photo, their tier and region, a
 * time-of-day greeting and art chosen by tier (a village block, a town
 * skyline, a state wired into one network). The "decided" ring is drawn from
 * the same three figures — nothing new is fetched.
 *
 * Decisions are NOT made here; Approvals is one tap away (website parity).
 */

interface Props {
  tier: AdminTier;
  adminName: string;
  location: string;
  photo?: string | null;
  stats: any;
  applicants: ApplicantBuckets;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  scopeMessage?: string;
  navigation: any;
}

const TIER_ART: Record<AdminTier, React.ComponentType<{ size?: number }>> = {
  block: BlockVillage3D,
  district: DistrictSkyline3D,
  state: StateNetwork3D,
};

const submitted = (v?: string | null) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const photoOf = (photo?: string | null) => {
  const p = String(photo || '');
  if (!p) return '';
  return p.startsWith('/uploads') || p.startsWith('uploads') ? resolveMediaUrl(p) : p;
};

function RecentRow({ app, onPress, delay }: { app: Applicant; onPress: () => void; delay: number }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const name = app?.fullName || 'Unknown';
  const stage = String(app?.stage || 'pending');
  const photoPath = (app as any)?.profilePhoto;
  const photo = photoPath ? resolveMediaUrl(photoPath) : '';
  const ref = formatApplicationRef(app) || 'N/A';
  const type = String(app?.memberType || '—');
  return (
    <FadeInUp delay={delay}>
      <ConsoleCard onPress={onPress} accessibilityLabel={`${name}, ${app?.statusLabel || stage}`} style={s.rowGap}>
        <View style={s.row}>
          <GradientAvatar name={name} uri={photo} size={48} tone="admin" />
          <View style={s.rowText}>
            <Text style={s.rowName} numberOfLines={1}>{name}</Text>
            <Text style={s.rowRef} numberOfLines={1}>{ref}</Text>
            <Text style={s.rowMeta} numberOfLines={1}>
              <Text style={s.cap}>{type}</Text>
              {'  ·  '}
              {submitted(app?.submittedAt)}
            </Text>
          </View>
          <View style={s.rowEnd}>
            <ConsoleChip label={app?.statusLabel || stage} kind={consoleStageKind(stage)} />
            <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
          </View>
        </View>
      </ConsoleCard>
    </FadeInUp>
  );
}

/** Pending / approved / rejected as one bar, plus the decided ring. */
function Progress({ pending, approved, rejected, total }: { pending: number; approved: number; rejected: number; total: number }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const sum = Math.max(1, pending + approved + rejected);
  const decided = approved + rejected;
  const pct = total > 0 ? decided / Math.max(1, total) : 0;
  const seg = (n: number) => ({ flex: Math.max(0, n) / sum });
  return (
    <ConsoleCard style={s.pad}>
      <View style={s.progressRow}>
        <CoverageRing progress={pct} size={76} accent="green" caption="decided" />
        <View style={s.progressText}>
          <Text style={s.progressTitle}>{decided} of {total} decided</Text>
          <Text style={s.progressSub}>
            {pending > 0 ? `${pending} still waiting for your verdict` : 'Nothing is waiting for your verdict'}
          </Text>
          <View style={s.bar}>
            {pending + approved + rejected === 0 ? <View style={[s.barSeg, { flex: 1, backgroundColor: PALETTE.divider }]} /> : null}
            {pending > 0 ? <LinearGradient colors={['#F59E0B', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.barSeg, seg(pending)]} /> : null}
            {approved > 0 ? <LinearGradient colors={['#059669', '#34D399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.barSeg, seg(approved)]} /> : null}
            {rejected > 0 ? <LinearGradient colors={['#DC2626', '#F87171']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.barSeg, seg(rejected)]} /> : null}
          </View>
          <View style={s.legend}>
            <Legend color={PALETTE.amber} label="Pending" />
            <Legend color={PALETTE.green} label="Approved" />
            <Legend color={PALETTE.red} label="Rejected" />
          </View>
        </View>
      </View>
    </ConsoleCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

export default function TierDashboardView({
  tier, adminName, location, photo, stats, applicants, loading, refreshing, onRefresh, scopeMessage, navigation,
}: Props) {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const s = useLegacyAppearance(legacyAppearance_s);
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(async () => {
    setPulling(true);
    try { await onRefresh(); } catch { /* the context reports its own error */ } finally { setPulling(false); }
  }, [onRefresh]);

  const pending = Number(stats?.pendingApplications || 0);
  const approved = Number(stats?.approvedApplications || 0);
  const rejected = Number(stats?.rejectedApplications || 0);
  const total = Number(stats?.totalApplications ?? (pending + approved + rejected)) || 0;

  const recent = useMemo(() => (applicants?.all || []).slice(0, 5), [applicants]);
  const busy = loading && !stats;
  const goApprovals = () => navigation?.navigate?.('Approvals');
  const Art = TIER_ART[tier] || BlockVillage3D;

  return (
    <ConsoleScroll
      refreshControl={<RefreshControl refreshing={pulling || refreshing} onRefresh={pull} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
    >
      <ConsoleHeader
        left={<MenuButton />}
        topCenter={`${TIER_LABEL[tier]} Admin`}
        right={(
          <PressableScale
            onPress={() => navigation?.navigate?.('Settings')}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <GradientAvatar name={adminName || 'Admin'} uri={photoOf(photo)} size={44} tone="admin" status="online" />
          </PressableScale>
        )}
        eyebrow={consoleGreeting()}
        title={adminName || 'Admin'}
        subtitle={`${TIER_LABEL[tier]} Admin Dashboard`}
        art={<Art size={104} />}
        badges={[
          { icon: 'verified-user', label: `${TIER_LABEL[tier]} Admin` },
          { icon: 'place', label: location },
        ]}
        waveHeight={64}
      />

      {busy ? (
        <ConsoleSkeleton variant="tiles" style={s.overlap} />
      ) : (
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Total Applicants" hint="In your region" value={total} icon="groups" accent="indigo" onPress={goApprovals} delay={40} />
          <ConsoleStatTile label="Pending" hint="Awaiting a decision" value={pending} icon="schedule" accent="amber" onPress={goApprovals} delay={100} />
          <ConsoleStatTile label="Approved" hint="By your seat" value={approved} icon="check-circle" accent="green" onPress={goApprovals} delay={160} />
          <ConsoleStatTile label="Rejected" hint="Turned down" value={rejected} icon="cancel" accent="red" onPress={goApprovals} delay={220} />
        </ConsoleGrid>
      )}

      {scopeMessage ? <ConsoleNote kind="amber" icon="warning-amber" text={scopeMessage} style={s.noteGap} /> : null}

      {!busy ? (
        <FadeInUp delay={260}>
          <Progress pending={pending} approved={approved} rejected={rejected} total={total} />
        </FadeInUp>
      ) : null}

      <ConsoleSectionTitle
        icon="bolt"
        title="Recent Activity"
        subtitle="Latest application submissions"
        action="View All"
        onAction={goApprovals}
      />

      <View style={s.list}>
        {busy ? (
          <ConsoleSkeleton rows={3} style={s.skeleton} />
        ) : recent.length === 0 ? (
          <ConsoleCard>
            <ConsoleState title="No applications yet" message="New submissions from your region will appear here." />
          </ConsoleCard>
        ) : (
          recent.map((a, i) => (
            <RecentRow
              key={String(a?.id || a?.applicationId || i)}
              app={a}
              delay={300 + i * 60}
              onPress={() => navigation?.navigate?.('ApplicantDetail', { applicant: a })}
            />
          ))
        )}
      </View>
    </ConsoleScroll>
  );
}

const s = StyleSheet.create({
  overlap: { marginTop: -30 },
  noteGap: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  pad: { marginHorizontal: SPACE.lg },
  list: { paddingHorizontal: SPACE.lg },
  skeleton: { paddingHorizontal: 0 },
  rowGap: { marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { ...TYPE.bodyStrong, fontSize: 15 },
  rowRef: { ...TYPE.caption, fontWeight: '700', color: PALETTE.indigo, marginTop: 1 },
  rowMeta: { ...TYPE.caption, color: PALETTE.textFaint, marginTop: 1 },
  cap: { textTransform: 'capitalize' },
  rowEnd: { flexDirection: 'row', alignItems: 'center', gap: 2, maxWidth: '40%' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  progressText: { flex: 1, minWidth: 0 },
  progressTitle: { ...TYPE.heading },
  progressSub: { ...TYPE.caption, marginTop: 2 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: PALETTE.divider, marginTop: SPACE.md, gap: 2 },
  barSeg: { height: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md, marginTop: SPACE.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: PALETTE.textMuted },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
