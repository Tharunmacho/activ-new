import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
// Analytics — scoped strictly to the ACTIVE company (premium, member tone).
// There is no company switcher here on purpose: switching happens once, on the
// Business dashboard / Manage Companies.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS, resolveMediaUrl } from '../../config/api.config';
import { useActiveCompany, useActiveCompanyStore } from '../../stores/activeCompanyStore';
import { useMembershipPaid, MembershipLocked } from './MembershipGate';
import { BusinessTabBar } from './BusinessTabBar';
import { Skeleton, SPACE, BrandScrollPage, BrandTopBar, BrandHero, PREMIUM_OVERLAP, LiftCard, MetricGrid, MetricTile, RingGauge, GrowBar, CountUpText, CompanyLogoTile, ArtEmptyState, GrowthChart3D } from '../../ui';
import { BizSectionTitle, CHIP } from './businessKit';

type AnalyticsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Analytics'>;

interface Props {
  navigation: AnalyticsScreenNavigationProp;
}

const EMPTY_STATS = {
  totalProducts: 0,
  featuredProducts: 0,
  activeProducts: 0,
  profileViews: 0,
  trustedBy: 0,
  topViewed: [] as { name: string; views: number }[],
};

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const styles = useThemeStyles(makeStyles);
  const activeCompany = useActiveCompany();
  const loadCompanies = useActiveCompanyStore((state) => state.loadCompanies);

  // Analytics is a membership benefit (website Analytics.tsx: getPaymentStatus()).
  const paid = useMembershipPaid();
  const [stats, setStats] = useState(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);

  // Bumped every time the screen regains focus. The data effects below key off
  // it as well as the company id, so returning here after creating, editing or
  // deleting something re-reads from the server instead of showing the copy
  // fetched the first time this company was selected.
  const [focusTick, setFocusTick] = useState(0);

  /*
   * PROFILE VIEWS — the member's directory card, not the company's catalogue.
   * Counted by the server on each directory open (one per viewer per day, never
   * the member themselves) and served by GET /analytics/me (website Analytics
   * "Profile Views"). A count only: the endpoint does not name the viewers.
   */
  const [reach, setReach] = useState<{ profileViews: number; windowDays: number } | null>(null);

  useEffect(() => {
    if (paid !== true) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/analytics/me', { params: { days: 30 } });
        const payload = res?.data?.data || res?.data || {};
        if (!cancelled) {
          setReach({
            profileViews: Number(payload?.engagement?.profileViews || 0),
            windowDays: Number(payload?.windowDays || 30),
          });
        }
      } catch {
        if (!cancelled) setReach(null);
      }
    })();
    return () => { cancelled = true; };
  }, [paid, focusTick]);

  useFocusEffect(
    useCallback(() => {
      setFocusTick((tick) => tick + 1);
      loadCompanies();
    }, [loadCompanies])
  );

  useEffect(() => {
    const companyId = activeCompany?._id;
    if (!companyId) {
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }
    fetchAnalytics(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany?._id, focusTick]);

  const fetchAnalytics = async (companyId: string) => {
    if (!companyId) return;
    try {
      setIsLoading(true);
      const response = await api.get(ENDPOINTS.PRODUCTS.STATS, {
        params: { companyId },
      });
      const data = response.data?.data || {};
      setStats({
        totalProducts: Number(data.total || 0),
        featuredProducts: Number(data.featured || 0),
        activeProducts: Number(data.active || 0),
        profileViews: Number(data.views || 0),
        trustedBy: Number(data.trustedBy || 0),
        topViewed: Array.isArray(data.topViewed) ? data.topViewed : [],
      });
    } catch (error) {
      console.log('Error fetching analytics stats:', error);
      setStats(EMPTY_STATS);
    } finally {
      setIsLoading(false);
    }
  };

  const topViewed = stats.topViewed || [];
  const maxViews = Math.max(1, ...topViewed.map((r) => Number(r?.views || 0)));
  const hasViews = topViewed.some((r) => Number(r?.views || 0) > 0);
  const total = Number(stats.totalProducts || 0);
  const live = Number(stats.activeProducts || 0);
  const logo = activeCompany?.logo ? resolveMediaUrl(activeCompany.logo) : '';

  const header = (
    <View style={styles.headerPad}>
      <BrandTopBar onBack={() => navigation.goBack()} title="Business analytics" />
      <BrandHero
        eyebrow="Analytics for"
        title={activeCompany ? (activeCompany.businessName || 'Company') : 'No active company'}
        subtitle={activeCompany
          ? `${activeCompany.businessType || '—'}${activeCompany.location ? ` · ${activeCompany.location}` : ''}`
          : 'Create a company to see its analytics'}
        art={<GrowthChart3D tone="business" size={92} />}
        artSize={92}
      >
        {/* Active company - read only, no switcher on this screen */}
        {activeCompany ? (
          <View style={styles.companyRow}>
            <CompanyLogoTile tone="business" uri={logo} name={activeCompany.businessName} size={40} />
            <Text style={styles.companyNote} numberOfLines={2} maxFontSizeMultiplier={1.2}>Figures for the company you are working as. Switch on the Business tab.</Text>
          </View>
        ) : null}
      </BrandHero>
    </View>
  );

  return (
    <BrandScrollPage tone="business"
      header={header}
      footer={(
        <BusinessTabBar
          active="analytics"
          onPress={(key) => {
            if (key === 'business') navigation.navigate('BusinessDashboard');
            else if (key === 'products') navigation.navigate('ProductsServices', {});
            else if (key === 'discover') navigation.navigate('Discover');
            else if (key === 'settings') navigation.navigate('Settings');
          }}
        />
      )}
    >
      {isLoading || paid === null ? (
        <View style={[styles.skeletonWrap, styles.overlap]} accessibilityLabel="Loading analytics">
          <View style={styles.skeletonRow}>
            <SkeletonTile />
            <SkeletonTile />
          </View>
          <View style={[styles.skeletonTile, styles.skeletonWide]}>
            <Skeleton width="45%" height={16} />
            <Skeleton height={12} />
            <Skeleton height={12} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ) : paid === false ? (
        <MembershipLocked
          icon="lock-outline"
          title="Analytics opens with membership"
          message="Your products are already being counted. Membership is what lets you read the figures."
          perks={[
            { icon: 'visibility', title: 'Who is opening your products', detail: 'Every view, counted when somebody outside your company opens one — and which products they open most.' },
            { icon: 'verified-user', title: 'Who has kept your company', detail: 'How many members have added you to their trust list.' },
          ]}
          onJoin={() => navigation.navigate('MemberMain')}
          footnote="The counting carries on either way — membership is what opens the figures."
          style={styles.overlap}
        />
      ) : (
        <>
          <View style={styles.overlap}>
            <MetricGrid>
              <MetricTile tone="business" icon="visibility" label="Product views" value={stats.profileViews} hint="All time" colors={CHIP.violet} delay={80} />
              <MetricTile tone="business" icon="inventory-2" label="Catalog products" value={total} hint="Total listed" colors={CHIP.green} delay={140} />
            </MetricGrid>
          </View>

          {/* Who is finding the MEMBER — their directory card, all companies. */}
          <BizSectionTitle title="Your profile" caption={`Last ${reach?.windowDays || 30} days`} />
          <LiftCard tone="business" style={styles.gutter}>
            <MetricRow icon="person" label="Directory profile views" value={Number(reach?.profileViews || 0)} colors={CHIP.violet} last />
          </LiftCard>

          {/* Catalogue health — how much of the catalogue is live, and who keeps you. */}
          <BizSectionTitle title="Catalog breakdown" />
          <LiftCard tone="business" style={styles.gutter}>
            <View style={styles.health}>
              <RingGauge progress={total ? live / total : 0} size={108} stroke={12} label="live" colors={['#5B21B6', '#A78BFA']} delay={150} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <MetricRow icon="check-circle" label="Active catalog items" value={stats.activeProducts} colors={CHIP.green} />
                <MetricRow icon="star" label="Featured offerings" value={stats.featuredProducts} colors={CHIP.amber} />
                <MetricRow icon="verified-user" label="Members who trust this company" value={stats.trustedBy} colors={CHIP.violet} last />
              </View>
            </View>
          </LiftCard>

          <BizSectionTitle title="Traffic & engagement" caption={hasViews ? 'Most-opened products' : undefined} />
          <LiftCard tone="business" style={styles.gutter}>
            {hasViews ? (
              <View style={styles.bars}>
                {topViewed.map((row, i) => (
                  <BarRow
                    key={`${row?.name || 'p'}-${i}`}
                    rank={i + 1}
                    label={row?.name || 'Untitled product'}
                    value={Number(row?.views || 0)}
                    max={maxViews}
                    delay={120 + i * 90}
                  />
                ))}
              </View>
            ) : (
              <ArtEmptyState tone="business"
                compact
                art={<GrowthChart3D tone="business" size={76} />}
                title="No views yet"
                message="No product has been opened by another member yet. Views appear here as buyers open your catalogue."
              />
            )}
          </LiftCard>
        </>
      )}
    </BrandScrollPage>
  );
};

/** Placeholder shaped like a MetricTile. */
function SkeletonTile() {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.skeletonTile}>
      <Skeleton width={40} height={40} radius={13} />
      <Skeleton width="50%" height={24} />
      <Skeleton width="70%" height={12} />
    </View>
  );
}

/** One labelled figure — gradient chip, label wraps, a counted number on the right. */
function MetricRow({ icon, label, value, colors, last }: { icon: string; label: string; value: number; colors: string[]; last?: boolean }) {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={[styles.metricRow, !last && styles.metricDivider]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.metricIcon}>
        <Icon name={icon} size={15} color={PALETTE.white} />
      </LinearGradient>
      <Text style={styles.metricLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <CountUpText value={Number(value || 0)} style={styles.metricValue} />
    </View>
  );
}

/** A ranked horizontal bar: rank, name + value on one line, a growing gradient bar below. */
function BarRow({ rank, label, value, max, delay }: { rank: number; label: string; value: number; max: number; delay: number }) {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const share = Math.max(0.04, Number(value || 0) / Math.max(1, Number(max || 1)));
  return (
    <View accessible accessibilityLabel={`${label}: ${value} views`}>
      <View style={styles.barHead}>
        <LinearGradient colors={rank === 1 ? CHIP.amber : CHIP.plum} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rank}>
          <Text style={styles.rankText} maxFontSizeMultiplier={1}>{rank}</Text>
        </LinearGradient>
        <Text style={styles.barLabel} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
        <Text style={styles.barValue} numberOfLines={1} maxFontSizeMultiplier={1.2}>{Number(value || 0).toLocaleString('en-IN')}</Text>
      </View>
      <GrowBar progress={Math.min(1, share)} colors={rank === 1 ? ['#FBBF24', '#D97706'] : ['#A78BFA', '#5B21B6']} height={10} delay={delay} trackColor={PALETTE.violetTint} />
    </View>
  );
}

const NUMBER_COL = 48;

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  headerPad: { paddingBottom: SPACE.lg },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg, padding: SPACE.sm + 2, borderRadius: 18, backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder },
  companyNote: { flex: 1, minWidth: 0, color: BRAND.onBrandSoft, fontSize: 12, lineHeight: 17 },

  skeletonWrap: { paddingHorizontal: SPACE.lg, gap: SPACE.md },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonTile: {
    width: '48.5%',
    minHeight: 128,
    padding: SPACE.lg,
    gap: SPACE.sm,
    backgroundColor: PALETTE.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: PALETTE.border,
  },
  skeletonWide: { width: '100%', minHeight: 0 },

  health: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 48, paddingVertical: SPACE.xs },
  metricDivider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  metricIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { ...TYPE.caption, color: PALETTE.textSoft, flex: 1, minWidth: 0 },
  metricValue: { ...TYPE.number, fontSize: 18, lineHeight: 24, minWidth: NUMBER_COL, textAlign: 'right' },

  bars: { gap: SPACE.lg },
  barHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm },
  rank: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: PALETTE.white, fontSize: 12, fontWeight: '800' },
  barLabel: { ...TYPE.bodyStrong, flex: 1, minWidth: 0 },
  barValue: { ...TYPE.bodyStrong, color: PALETTE.violetDark, minWidth: NUMBER_COL, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

export default AnalyticsScreen;
