import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  PALETTE, SPACE, TYPE, SIZE, BRAND,
  ConsoleFrame, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleSectionTitle, ConsoleNote,
  ConsoleChip, ConsoleTabs, ConsoleSearch, ConsoleButton, ConsoleSkeleton, CoverageRing, GradientAvatar,
  GlassIconButton, PressableScale, FadeInUp, GlobeCommand3D, CONSOLE_LIST, CONSOLE_ACCENTS, consoleGreeting,
} from '../../../ui';
import { resolveMediaUrl } from '../../../config/api.config';
import api from '../../../services/api';
import { Applicant } from '../../../types';
import { useSuperAdminData } from './context/SuperAdminContext';
import { useSuperAdminBack } from './useSuperAdminBack';

import ApplicantRow from './components/ApplicantRow';
import { SkeletonList } from './components/Skeleton';
import EmptyState from './components/EmptyState';
import { MenuButton } from '../shared/TierMenu';

type Tier = 'block' | 'district' | 'state';
type Level = 'tiers' | 'regions' | 'applications';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface Region {
  id: string;
  name: string;
  state: string;
  district: string;
  block: string;
  applications: number;
  pending: number;
  approved: number;
  rejected: number;
  admins: number;
}

const TIERS: { key: Tier; title: string; plural: string; icon: string; color: string; light: string; grad: string[] }[] = [
  { key: 'state', title: 'State', plural: 'States', icon: 'public', color: PALETTE.successText, light: PALETTE.successSoft, grad: [BRAND.indigoDeep, '#2A2178', BRAND.indigoDark] },
  { key: 'district', title: 'District', plural: 'Districts', icon: 'map', color: PALETTE.warningText, light: PALETTE.warningSoft, grad: ['#8A6A12', '#C9A227', '#E0B93B'] },
  { key: 'block', title: 'Block', plural: 'Blocks', icon: 'location-city', color: PALETTE.indigo, light: PALETTE.indigoSoft, grad: [BRAND.indigoDark, BRAND.indigo, '#7C6CF0'] },
];

const STATUS_TABS: StatusFilter[] = ['all', 'pending', 'approved', 'rejected'];

const EMPTY_SUMMARY = { states: 0, districts: 0, blocks: 0 };

/**
 * The Hub: every application on the platform, reached by drilling down through
 * the geography that owns it.
 *
 *   tiers  ->  regions in that tier  ->  that region's applications
 *
 * All three levels live in one screen, so stepping back is instant and never
 * refetches a level the admin has already loaded.
 */
const SuperAdminActionHubScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const {
    adminName,
    adminProfilePhoto,
    stats,
    tierStats,
    bottlenecks,
    bottleneckAfterDays,
    coverageGaps,
    overviewFailed,
    proxyReview,
    pendingActionId,
    fetchOverview,
    searchQuery,
    setSearchQuery,
    clearSearch,
    searchResults,
    searching,
  } = useSuperAdminData();

  const [level, setLevel] = useState<Level>('tiers');
  const [tier, setTier] = useState<Tier>('state');
  const [region, setRegion] = useState<Region | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');

  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionFilter, setRegionFilter] = useState('');
  const [applicants, setApplicants] = useState<Applicant[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const showingSearch = (searchQuery || '').trim().length >= 2;

  // ---- data ----

  const fetchTierSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/admin/super/directory', { params: { level: 'state' } });
      const payload = response.data?.data || response.data || {};
      setSummary({ ...EMPTY_SUMMARY, ...(payload.summary || {}) });
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the hub');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchRegions = useCallback(async (target: Tier, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/admin/super/directory', { params: { level: target } });
      const payload = response.data?.data || response.data || {};
      setRegions(payload.regions || []);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load regions');
      setRegions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchApplications = useCallback(async (
    target: Region,
    targetTier: Tier,
    targetStatus: StatusFilter,
    isRefresh = false,
  ) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const params: Record<string, string> = { limit: '50', level: targetTier };
      if (target?.state) params.state = target.state;
      if (targetTier !== 'state' && target?.district) params.district = target.district;
      if (targetTier === 'block' && target?.block) params.block = target.block;
      // A directory row with no path at all still narrows by its own name.
      if (!target?.state && !target?.district && !target?.block && target?.name) params[targetTier] = target.name;
      if (targetStatus !== 'all') params.status = targetStatus;

      const response = await api.get('/admin/super/applications', { params });
      const payload = response.data?.data || response.data || {};
      const rows = [...(payload.applicants || [])];
      for (let page = 2; page <= Number(payload.pagination?.pages || 1); page += 1) {
        const next = await api.get('/admin/super/applications', { params: { ...params, page } });
        rows.push(...((next.data?.data || next.data)?.applicants || []));
      }
      setApplicants(rows);
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load applications');
      setApplicants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Refetch whenever the Hub comes back into focus, not just on mount.
   *
   * These are bottom tabs, so every screen stays mounted once visited. With a
   * plain mount effect the Hub kept showing the counts it read the first time it
   * opened: add a block admin on the Admins tab, come back, and "Browse
   * applications" still claimed the old number of blocks — the data was live,
   * the screen simply never asked again.
   *
   * The overview cards above come from SuperAdminContext, which had the same
   * mount-only effect, so both are refreshed together here.
   *
   * Whichever level is open is what gets reloaded — refetching the tier summary
   * while the user is three levels down looking at one region's applications
   * would leave that list stale instead.
   */
  useFocusEffect(
    useCallback(() => {
      // Refresh mode, not load mode: the screen already has data to show, and
      // dropping to a skeleton on every tab switch reads as a slower app than
      // one that quietly corrects its numbers a moment later.
      fetchOverview(true);
      if (level === 'tiers') fetchTierSummary(true);
      else if (level === 'regions') fetchRegions(tier, true);
      else if (level === 'applications' && region) fetchApplications(region, tier, status, true);
      // Deliberately not depending on `status`: the effect below already
      // handles a status change while a region is open, and listing it here
      // would fire two identical requests for one tap.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [level, tier, region, fetchOverview, fetchTierSummary, fetchRegions, fetchApplications]),
  );

  // Re-fetch when the status tab changes while a region is open.
  const statusRef = useRef(status);
  useEffect(() => {
    if (level !== 'applications' || !region) {
      statusRef.current = status;
      return;
    }
    if (statusRef.current === status) return;
    statusRef.current = status;
    fetchApplications(region, tier, status);
  }, [status, level, region, tier, fetchApplications]);

  // ---- moving between levels ----

  const openTier = (target: Tier) => {
    setTier(target);
    setRegions([]);
    setRegionFilter('');
    setLevel('regions');
    fetchRegions(target);
  };

  const openRegion = (target: Region) => {
    setRegion(target);
    setApplicants([]);
    setStatus('all');
    statusRef.current = 'all';
    setLevel('applications');
    fetchApplications(target, tier, 'all');
  };

  /**
   * Up one drill-down level. Returns false at the top, which tells the hook the
   * Hub has nothing left to close and the press belongs to the system.
   */
  const stepBack = useCallback((): boolean => {
    if (level === 'applications') {
      setRegion(null);
      setLevel('regions');
      return true;
    }
    if (level === 'regions') {
      setLevel('tiers');
      return true;
    }
    return false;
  }, [level]);

  const goBack = useSuperAdminBack(stepBack, { isHome: true });

  const onRefresh = () => {
    if (level === 'applications' && region) fetchApplications(region, tier, status, true);
    else if (level === 'regions') fetchRegions(tier, true);
    else {
      fetchTierSummary(true);
      fetchOverview(true);
    }
  };

  const handleReview = useCallback(async (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => {
    const ok = await proxyReview(applicant, action, reason);
    if (ok && region) {
      const isApprove = action === 'approve';
      setRegion(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          pending: Math.max(0, (prev.pending || 0) - 1),
          approved: isApprove ? (prev.approved || 0) + 1 : prev.approved,
          rejected: !isApprove ? (prev.rejected || 0) + 1 : prev.rejected,
        };
      });
      setRegions(prev => prev.map(r => {
        if (r.id !== region.id) return r;
        return {
          ...r,
          pending: Math.max(0, (r.pending || 0) - 1),
          approved: isApprove ? (r.approved || 0) + 1 : r.approved,
          rejected: !isApprove ? (r.rejected || 0) + 1 : r.rejected,
        };
      }));
      fetchApplications(region, tier, status, true);
    }
  }, [proxyReview, region, tier, status, fetchApplications]);

  /**
   * A search hit carries only summary fields. An admin hit hands off to the
   * Admins tab; an applicant hit resolves to the full record first, so the
   * detail screen is never handed a half-populated applicant.
   */
  const openHit = useCallback(async (kind: 'member' | 'application' | 'admin', hit: any) => {
    const term = hit?.email || hit?.fullName || '';
    clearSearch();

    if (kind === 'admin') {
      navigation.navigate('Admins', { q: term });
      return;
    }

    try {
      const response = await api.get('/admin/super/applications', {
        params: { q: term, status: 'all', limit: '1' },
      });
      const payload = response.data?.data || response.data || {};
      const applicant = (payload.applicants || [])[0];
      if (applicant) {
        navigation.navigate('ApplicantDetail', { applicant });
        return;
      }
      setError(`No application found for ${term}`);
    } catch {
      setError('Could not open that record');
    }
  }, [clearSearch, navigation]);

  const visibleRegions = useMemo(() => {
    const needle = (regionFilter || '').trim().toLowerCase();
    if (needle.length < 2) return regions || [];
    return (regions || []).filter(r => `${r?.name || ''} ${r?.state || ''} ${r?.district || ''} ${r?.block || ''}`
      .toLowerCase().includes(needle));
  }, [regions, regionFilter]);

  // ---- level 1: stat cards + tier cards ----

  const renderTiers = () => (
    <View>
      {overviewFailed ? (
        <ConsoleNote
          kind="amber"
          icon="warning-amber"
          style={styles.flushNote}
          text="The overview could not be loaded, so the figures below are not current. The drill-down still works."
        />
      ) : null}

      <ConsoleSectionTitle icon="layers" title="By tier" subtitle="Tap a tier to browse its regions" style={styles.flushSection} />
      <View style={styles.carouselBleed}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
          {TIERS.map((meta, i) => {
            const tStats = tierStats?.[meta.key] || { total: 0, pending: 0, approved: 0, rejected: 0 };
            const total = Number(tStats.total || 0);
            const decided = Number(tStats.approved || 0) + Number(tStats.rejected || 0);
            return (
              <FadeInUp key={meta.key} delay={80 + i * 70}>
                <PressableScale
                  onPress={() => openTier(meta.key)}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={`${meta.title} level`}
                >
                  <View style={styles.tierCard}>
                    <View style={styles.tierClip}>
                      <LinearGradient colors={meta.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tierHead}>
                        <View style={styles.tierBlob} />
                        <View style={styles.flexText}>
                          <View style={styles.tierIcon}><Icon name={meta.icon} size={18} color={PALETTE.white} /></View>
                          <Text style={styles.tierTitle} numberOfLines={1}>{meta.title} Level</Text>
                          <Text style={styles.tierSub} numberOfLines={1}>{decided} of {total} decided</Text>
                        </View>
                        <CoverageRing progress={total ? decided / total : 0} size={62} stroke={6} light caption="decided" />
                      </LinearGradient>
                      <View style={styles.tierGrid}>
                        {[
                          { label: 'Total Members', value: tStats.total, color: PALETTE.text },
                          { label: 'Pending', value: tStats.pending, color: PALETTE.warningText },
                          { label: 'Approved', value: tStats.approved, color: PALETTE.successText },
                          { label: 'Rejected', value: tStats.rejected, color: PALETTE.dangerText },
                        ].map((stat, idx) => (
                          <View key={stat.label} style={[styles.tierCell, idx < 2 && styles.tierCellTop, idx % 2 === 0 && styles.tierCellLeft]}>
                            <Text style={[styles.tierValue, { color: stat.color }]} numberOfLines={1}>{Number(stat.value || 0)}</Text>
                            <Text style={styles.tierLabel} numberOfLines={1}>{stat.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </PressableScale>
              </FadeInUp>
            );
          })}
        </ScrollView>
      </View>

      {(bottlenecks || []).length > 0 ? (
        <ConsoleNote
          kind="amber"
          icon="schedule"
          style={styles.flushNote}
          text={`${(bottlenecks || []).length} application${(bottlenecks || []).length === 1 ? '' : 's'} waiting ${bottleneckAfterDays}+ days at a local tier`}
          action="Browse by state"
          onAction={() => openTier('state')}
        />
      ) : null}

      {/* Unstaffed regions.
          These applications are not stuck — orphan fallback has already handed
          them to the tier above, and will hand them back the moment a
          replacement is created. This panel exists so the vacancy itself is
          visible, listed worst-first, because filling it is the actual fix. */}
      {(coverageGaps || []).length > 0 ? (
        <FadeInUp style={styles.gapWrap}>
          <ConsoleCard accent={PALETTE.red}>
            <View style={styles.gapHeader}>
              <View style={styles.gapIcon}>
                <Icon name="person-off" size={SIZE.icon} color={PALETTE.danger} />
              </View>
              <Text style={styles.gapTitle}>
                {(coverageGaps || []).length} region{(coverageGaps || []).length === 1 ? '' : 's'} with no admin
              </Text>
            </View>

            <Text style={styles.gapCaption}>
              Their queues have escalated automatically. Creating a replacement admin hands the
              applications straight back.
            </Text>

            {(coverageGaps || []).slice(0, 5).map(gap => (
              <View key={gap?.id || gap?.region} style={styles.gapRow}>
                <View style={styles.flexText}>
                  <Text style={styles.gapRegion} numberOfLines={1}>
                    {gap?.region || 'Unknown region'}
                  </Text>
                  <Text style={styles.gapDetail} numberOfLines={2}>
                    No {gap?.missingTierLabel || ''} Admin — escalated to {gap?.escalatedToLabel || 'Super'}
                  </Text>
                </View>
                <ConsoleChip label={`${Number(gap?.pending || 0)} pending`} kind="rejected" />
              </View>
            ))}

            {(coverageGaps || []).length > 5 ? (
              <Text style={styles.gapMore}>
                +{(coverageGaps || []).length - 5} more region
                {(coverageGaps || []).length - 5 === 1 ? '' : 's'}
              </Text>
            ) : null}

            <ConsoleButton
              size="sm"
              icon="person-add"
              label="Staff a region"
              onPress={() => navigation.navigate('Admins' as never)}
              style={styles.gapAction}
            />
          </ConsoleCard>
        </FadeInUp>
      ) : null}

      <ConsoleSectionTitle icon="travel-explore" title="Browse applications" subtitle="Every tier, every region" style={styles.flushSection} />

      <ConsoleCard padded={false}>
        {TIERS.map((meta, i) => {
          const count = meta.key === 'block' ? summary.blocks
            : meta.key === 'district' ? summary.districts
            : summary.states;
          return (
            <BrowseRow
              key={meta.key}
              icon={meta.icon}
              grad={meta.grad}
              title={meta.title}
              subtitle={`${count} ${count === 1 ? meta.title.toLowerCase() : meta.plural.toLowerCase()}`}
              onPress={() => openTier(meta.key)}
              last={false}
              delay={i * 40}
            />
          );
        })}

        {/* Staff management shortcut */}
        <BrowseRow
          icon="admin-panel-settings"
          grad={CONSOLE_ACCENTS.green.grad}
          title="Staff a region"
          subtitle={`${Number(stats?.totalAdmins || 0)} accounts · adding a block admin opens a region for registration`}
          onPress={() => navigation.navigate('Admins')}
          last
          delay={140}
        />
      </ConsoleCard>
    </View>
  );

  // ---- level 2: region cards ----

  const renderRegion = ({ item, index }: { item: Region; index: number }) => {
    const staffed = Number(item?.admins || 0) > 0;
    const apps = Number(item?.applications || 0);
    const pendingN = Number(item?.pending || 0);
    const decided = Number(item?.approved || 0) + Number(item?.rejected || 0);
    return (
      <FadeInUp delay={Math.min(index, 6) * 40} style={styles.gutterCell}>
        <ConsoleCard onPress={() => openRegion(item)} style={styles.regionCard} accessibilityLabel={item?.name || 'Region'}>
          <View style={styles.regionHead}>
            <CoverageRing
              progress={apps ? decided / apps : 0}
              size={56}
              stroke={5}
              accent={pendingN > 0 ? 'amber' : 'green'}
              center={String(pendingN)}
              caption="pending"
            />
            <View style={styles.flexText}>
              <Text style={styles.regionName} numberOfLines={1}>{item?.name || 'Unassigned'}</Text>
              {tier !== 'state' ? (
                <Text style={styles.regionParent} numberOfLines={1}>
                  {[item?.district !== item?.name ? item?.district : '', item?.state].filter(Boolean).join(', ') || '—'}
                </Text>
              ) : null}
              {/* Active = this region actually has an admin assigned to it. */}
              <ConsoleChip
                label={staffed ? 'Active' : 'No admin'}
                kind={staffed ? 'approved' : 'neutral'}
                style={styles.regionChip}
              />
            </View>
            <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
          </View>

          {/* Application data only — staff counts live in the Admins tab. */}
          <View style={styles.regionStats}>
            {[
              { label: 'Total', value: item?.applications, color: PALETTE.text },
              { label: 'Pending', value: item?.pending, color: PALETTE.warningText },
              { label: 'Approved', value: item?.approved, color: PALETTE.successText },
              { label: 'Rejected', value: item?.rejected, color: PALETTE.dangerText },
            ].map((stat, i) => (
              <View key={stat.label} style={[styles.regionStat, i > 0 && styles.regionStatDivider]}>
                <Text style={[styles.regionStatValue, { color: stat.color }]} numberOfLines={1}>{Number(stat.value || 0)}</Text>
                <Text style={styles.regionStatLabel} numberOfLines={1}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </ConsoleCard>
      </FadeInUp>
    );
  };

  // ---- level 3 ----

  const renderApplicant = ({ item }: { item: Applicant }) => (
    <View style={styles.gutterCell}>
    <ApplicantRow
      applicant={item}
      busy={pendingActionId === (item?.id || item?._id)}
      onPress={applicant => navigation.navigate('ApplicantDetail', { applicant })}
      onReview={handleReview}
    />
    </View>
  );

  /** The region's four totals, shown above its application list. */
  const renderRegionSummary = () => (
    <ConsoleCard style={styles.summaryCard} padded={false}>
      <View style={styles.summaryRow}>
        {[
          { label: 'Total', value: region?.applications, color: PALETTE.text },
          { label: 'Pending', value: region?.pending, color: PALETTE.warningText },
          { label: 'Approved', value: region?.approved, color: PALETTE.successText },
          { label: 'Rejected', value: region?.rejected, color: PALETTE.dangerText },
        ].map((cell, index) => (
          <View
            key={cell.label}
            style={[styles.regionStat, styles.summaryCell, index > 0 && styles.regionStatDivider]}
          >
            <Text style={[styles.regionStatValue, { color: cell.color }]} numberOfLines={1}>
              {Number(cell.value || 0)}
            </Text>
            <Text style={styles.regionStatLabel} numberOfLines={1}>{cell.label}</Text>
          </View>
        ))}
      </View>
    </ConsoleCard>
  );

  const renderSearchPanel = () => {
    const groups: { title: string; kind: 'application' | 'member' | 'admin'; icon: string; hits: any[] }[] = [
      { title: 'Applications', kind: 'application', icon: 'description', hits: searchResults.applications || [] },
      { title: 'Members', kind: 'member', icon: 'groups', hits: searchResults.members || [] },
      { title: 'Admins', kind: 'admin', icon: 'admin-panel-settings', hits: searchResults.admins || [] },
    ];
    const total = groups.reduce((sum, g) => sum + (g.hits || []).length, 0);

    if (searching && total === 0) return <SkeletonList count={4} />;

    if (total === 0) {
      return (
        <EmptyState
          title={`No matches for “${(searchQuery || '').trim()}”`}
          caption="Try a name, an email address or a region."
        />
      );
    }

    return (
      <View>
        {groups.filter(g => (g.hits || []).length > 0).map(group => (
          <View key={group.title} style={styles.hitGroup}>
            <View style={styles.hitHead}>
              <Icon name={group.icon} size={15} color={PALETTE.indigo} />
              <Text style={styles.hitGroupTitle}>{group.title}</Text>
              <ConsoleChip label={String((group.hits || []).length)} kind="info" dot={false} />
            </View>
            <ConsoleCard padded={false}>
              {(group.hits || []).map((hit, index) => (
                <TouchableOpacity
                  key={`${group.kind}-${hit?.id || hit?.email}`}
                  style={[styles.hitRow, index === (group.hits || []).length - 1 && styles.hitRowLast]}
                  onPress={() => openHit(group.kind, hit)}
                  accessibilityRole="button"
                  accessibilityLabel={hit?.fullName || hit?.email || 'Result'}
                >
                  <GradientAvatar name={hit?.fullName || hit?.email} size={40} tone="admin" ring={false} />
                  <View style={styles.flexText}>
                    <Text style={styles.hitName} numberOfLines={1}>{hit?.fullName || hit?.email || 'Unnamed'}</Text>
                    <Text style={styles.hitSub} numberOfLines={1}>
                      {[hit?.roleLabel || hit?.status, hit?.location].filter(Boolean).join(' · ') || hit?.email || ''}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
                </TouchableOpacity>
              ))}
            </ConsoleCard>
          </View>
        ))}
      </View>
    );
  };

  const listEmpty = () => {
    if (loading) {
      return <SkeletonList count={level === 'regions' ? 4 : 3} variant={level === 'regions' ? 'region' : 'row'} />;
    }
    if (error) {
      return <EmptyState tone="error" title={error} caption="Pull down to try again." />;
    }
    return level === 'regions'
      ? <EmptyState title="No regions match" caption="Clear the filter to see every region." />
      : (
        <EmptyState
          title={`No ${status === 'all' ? '' : status} applications here`.replace('  ', ' ')}
          caption={`Nothing in ${region?.name || 'this region'} matches this filter yet.`}
        />
      );
  };

  const keyExtractor = useCallback(
    (item: any, index: number) => String(item?.id || item?._id || item?.name || index),
    [],
  );

  const tierPlural = TIERS.find(t => t.key === tier)?.plural || '';
  const firstName = (adminName || 'Super Admin').split(' ')[0];

  const header = level === 'tiers' ? (
    <View>
      <ConsoleHeader
        left={<MenuButton />}
        right={(
          <PressableScale
            onPress={() => navigation.navigate('Settings')}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <GradientAvatar name={adminName || 'Super Admin'} uri={adminProfilePhoto ? resolveMediaUrl(adminProfilePhoto) : ''} size={44} tone="admin" status="online" />
          </PressableScale>
        )}
        eyebrow={consoleGreeting()}
        title={`${firstName}!`}
        subtitle="Super Admin · Platform-wide command centre"
        art={<GlobeCommand3D size={104} />}
        badges={[
          { icon: 'public', label: 'All India' },
          { icon: 'admin-panel-settings', label: `${Number(stats?.totalAdmins || 0)} admins` },
        ]}
        waveHeight={64}
      />
      {loading && !stats?.totalApplications ? (
        <ConsoleSkeleton variant="tiles" style={styles.overlap} />
      ) : (
        /* Platform totals (website Hub `data.stats`). "Applicants": the server
           sets this to the application count, pending included. No trend
           footer: no endpoint returns one. */
        <ConsoleGrid overlap>
          <ConsoleStatTile label="Total applicants" hint="Across the association" value={Number(stats?.totalApplications ?? stats?.totalMembers ?? 0)} icon="groups" accent="indigo" delay={40} />
          <ConsoleStatTile label="Pending" hint="With all three tiers" value={Number(stats?.pendingApplications || 0)} icon="schedule" accent="amber" delay={100} />
          <ConsoleStatTile label="Approved" hint="Members created" value={Number(stats?.approvedApplications || 0)} icon="check-circle" accent="green" delay={160} />
          <ConsoleStatTile label="Rejected" hint="Turned down" value={Number(stats?.rejectedApplications || 0)} icon="cancel" accent="red" delay={220} />
        </ConsoleGrid>
      )}
      <ConsoleSearch
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search members, applications, admins"
        style={styles.search}
      />
    </View>
  ) : (
    <View>
      {/* Drill-down header: back arrow + where you are. */}
      <ConsoleHeader
        compact
        left={<GlassIconButton icon="arrow-back" onPress={goBack} accessibilityLabel="Back" />}
        topCenter="Super Admin · Hub"
        eyebrow={level === 'regions' ? `${visibleRegions.length} ${tierPlural.toLowerCase()}` : ([region?.district !== region?.name ? region?.district : '', region?.state].filter(Boolean).join(', ') || `${(applicants || []).length} applications`)}
        title={level === 'regions' ? (tierPlural || 'Regions') : (region?.name || 'Region')}
        subtitle={level === 'regions' ? 'Pick a region to open its applications' : 'Decide in the State seat, or open a file'}
      />
      {level === 'regions' ? (
        <ConsoleSearch
          value={regionFilter}
          onChangeText={setRegionFilter}
          placeholder={`Filter ${tierPlural.toLowerCase()}`}
        />
      ) : null}
      {level === 'applications' ? (
        // Counts come from the region row the drill-down was opened from —
        // the same figures its card showed a moment ago.
        <ConsoleTabs
          value={status}
          onChange={setStatus}
          options={STATUS_TABS.map(tab => ({
            value: tab,
            label: tab.charAt(0).toUpperCase() + tab.slice(1),
            count: Number((tab === 'all' ? region?.applications
              : tab === 'pending' ? region?.pending
              : tab === 'approved' ? region?.approved
              : region?.rejected) || 0),
          }))}
        />
      ) : null}
    </View>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={
          showingSearch || level === 'tiers' ? []
            : level === 'regions' ? visibleRegions
            : (applicants || [])
        }
        keyExtractor={keyExtractor}
        renderItem={
          level === 'regions'
            ? (renderRegion as any)
            : level === 'applications'
              ? (renderApplicant as any)
              : () => null
        }
        contentContainerStyle={CONSOLE_LIST}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View>
            {header}
            <View style={styles.body}>
              {showingSearch ? renderSearchPanel()
                : level === 'tiers'
                  ? (loading ? <SkeletonList count={3} variant="tier" /> : renderTiers())
                  : level === 'applications'
                    ? renderRegionSummary()
                    : null}
            </View>
          </View>
        )}
        ListEmptyComponent={showingSearch || level === 'tiers' ? null : <View style={styles.body}>{listEmpty()}</View>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
      />
    </ConsoleFrame>
  );
};

/** One row of the "Browse applications" card: gradient chip, title, count. */
function BrowseRow({ icon, grad, title, subtitle, onPress, last, delay }: {
  icon: string; grad: string[]; title: string; subtitle: string; onPress: () => void; last: boolean; delay: number;
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <FadeInUp delay={delay}>
      <TouchableOpacity onPress={onPress} style={[styles.browseRow, last && styles.hitRowLast]} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.browseIcon}>
          <Icon name={icon} size={20} color={PALETTE.white} />
        </LinearGradient>
        <View style={styles.flexText}>
          <Text style={styles.browseTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.browseSub} numberOfLines={2}>{subtitle}</Text>
        </View>
        <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
      </TouchableOpacity>
    </FadeInUp>
  );
}

const TIER_CARD_WIDTH = 272;

const styles = StyleSheet.create({
  flexText: { flex: 1, minWidth: 0 },
  body: { paddingHorizontal: SPACE.lg },
  gutterCell: { paddingHorizontal: SPACE.lg },
  overlap: { marginTop: -30 },
  search: { marginBottom: SPACE.xs },
  flushNote: { marginBottom: SPACE.lg },
  flushSection: { marginHorizontal: 0, marginTop: SPACE.lg },

  carouselBleed: { marginHorizontal: -SPACE.lg, marginBottom: SPACE.lg },
  carousel: { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.md, paddingTop: SPACE.xxs },
  tierCard: {
    width: TIER_CARD_WIDTH, backgroundColor: PALETTE.card, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4,
  },
  tierClip: { borderRadius: 22, overflow: 'hidden' },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, overflow: 'hidden' },
  tierBlob: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.10)', top: -70, right: -40 },
  tierIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.sm },
  tierTitle: { ...TYPE.heading, color: PALETTE.white },
  tierSub: { ...TYPE.caption, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: PALETTE.white },
  tierCell: { width: '50%', padding: SPACE.md },
  tierCellTop: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  tierCellLeft: { borderRightWidth: StyleSheet.hairlineWidth * 2, borderRightColor: PALETTE.divider },
  tierValue: { ...TYPE.number, fontSize: 20, lineHeight: 26 },
  tierLabel: { ...TYPE.caption, fontWeight: '600', marginTop: SPACE.xxs },

  gapWrap: { marginBottom: SPACE.lg },
  gapHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.sm },
  gapIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: PALETTE.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  gapTitle: { flex: 1, minWidth: 0, ...TYPE.heading },
  gapCaption: { ...TYPE.caption, lineHeight: 17, marginBottom: SPACE.md },
  gapRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.md - 2, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider,
  },
  gapRegion: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18 },
  gapDetail: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs },
  gapMore: { ...TYPE.caption, fontSize: 11, marginTop: SPACE.sm, textAlign: 'center' },
  gapAction: { marginTop: SPACE.md },

  browseRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    minHeight: SIZE.row + SPACE.sm, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider,
  },
  browseIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  browseTitle: { ...TYPE.subheading, fontWeight: '800' },
  browseSub: { ...TYPE.caption, marginTop: 1 },

  regionCard: { marginBottom: SPACE.md },
  regionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  regionName: { ...TYPE.heading },
  regionParent: { ...TYPE.caption, marginTop: 1 },
  regionChip: { marginTop: SPACE.sm - 2 },
  regionStats: {
    flexDirection: 'row', marginTop: SPACE.md, paddingTop: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider,
  },
  regionStat: { flex: 1, minWidth: 0, alignItems: 'center' },
  regionStatDivider: { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: PALETTE.divider },
  regionStatValue: { ...TYPE.number, fontSize: 18, lineHeight: 24 },
  regionStatLabel: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs },
  summaryCard: { marginTop: SPACE.md, marginBottom: SPACE.md },
  summaryRow: { flexDirection: 'row', paddingVertical: SPACE.md },
  summaryCell: {},

  hitGroup: { marginTop: SPACE.md },
  hitHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm, marginLeft: SPACE.xs },
  hitGroupTitle: { ...TYPE.eyebrow, color: PALETTE.indigoDark, flex: 1 },
  hitRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
    minHeight: SIZE.row, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider,
  },
  hitRowLast: { borderBottomWidth: 0 },
  hitName: { ...TYPE.bodyStrong },
  hitSub: { ...TYPE.caption, marginTop: 1 },
});

export default SuperAdminActionHubScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_ACCENTS = CONSOLE_ACCENTS;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
