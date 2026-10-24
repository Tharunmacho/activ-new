// Business Dashboard — the member's business COMMAND CENTRE (premium, business tone: violet).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../../types';
import api, { getUserData } from '../../services/api';
import { ENDPOINTS, resolveMediaUrl } from '../../config/api.config';
import {
  PALETTE,
  SPACE,
  TYPE,
  Skeleton,
  shortDate,
  timeAgo,
  BrandScrollPage,
  BrandTopBar,
  BrandHero,
  PREMIUM_OVERLAP,
  FadeInUp,
  GlassIconButton,
  GradientButton,
  LiftCard,
  MetricGrid,
  MetricTile,
  CompanyChip,
  ActivityTimeline,
  ArtEmptyState,
  ShopFront3D,
  Briefcase3D,
  PressableScale,
} from '../../ui';
import {
  useActiveCompany,
  useActiveCompanyStore,
  ActiveCompany,
} from '../../stores/activeCompanyStore';
import { BusinessTabBar } from './BusinessTabBar';
import { BizSectionTitle, CompanyGlassCard, ToolGrid, ToolTile, CHIP } from './businessKit';

type BusinessDashboardProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};


type BusinessProfile = ActiveCompany;

const BusinessDashboardScreen: React.FC<BusinessDashboardProps> = ({ navigation }) => {
  // Companies + the active selection live in the shared store, so every other
  // business screen shows this exact company until the user switches here.
  const companies = useActiveCompanyStore((state) => state.companies);
  const setActiveCompany = useActiveCompanyStore((state) => state.setActiveCompany);
  const loadCompanies = useActiveCompanyStore((state) => state.loadCompanies);
  const businessProfile = useActiveCompany();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setShowCompanyPicker] = useState(false);
  const [catalogStats, setCatalogStats] = useState({ total: 0, active: 0, featured: 0, views: 0 });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  // Bumped every time the screen regains focus. The data effects below key off
  // it as well as the company id, so returning here after creating, editing or
  // deleting something re-reads from the server instead of showing the copy
  // fetched the first time this company was selected.
  const [focusTick, setFocusTick] = useState(0);
  const [memberName, setMemberName] = useState('');

  const companiesCount = (companies || []).length;

  useFocusEffect(
    useCallback(() => {
      setFocusTick((tick) => tick + 1);
      loadAllCompanies();
      loadMemberName();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    if (businessProfile?._id) {
      fetchCompanyData(businessProfile._id);
    } else {
      setCatalogStats({ total: 0, active: 0, featured: 0, views: 0 });
      setRecentActivities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfile?._id, focusTick]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // The greeting name is pulled live from the backend (/auth/me) on every
  // focus, so it always reflects the real signed-in member rather than a stale
  // snapshot saved at login. The cached copy is only a fallback for when the
  // request fails (offline / expired session).
  const loadMemberName = async () => {
    let resolved = '';

    try {
      const response = await api.get(ENDPOINTS.AUTH.PROFILE);
      const payload = response.data?.data || response.data || {};
      resolved =
        payload?.details?.fullName ||
        payload?.auth?.fullName ||
        payload?.fullName ||
        '';
    } catch (err) {
      console.warn('Live profile fetch safely caught:', err);
    }

    if (!resolved) {
      try {
        const cached = await getUserData();
        resolved = cached?.fullName || cached?.name || '';
      } catch (err) {
        console.warn('Cached profile read safely caught:', err);
      }
    }

    // The reference design greets the member by first name only.
    const firstName = (resolved || '').trim().split(' ')[0] || '';
    setMemberName(firstName);
  };

  const loadAllCompanies = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const companiesData = await loadCompanies({ force: forceRefresh });

      if ((companiesData || []).length === 0) {
        Alert.alert(
          'No Business Profile',
          "You haven't registered any company profile yet. Would you like to create one now?",
          [
            { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
            { text: 'Create Profile', onPress: () => navigation.navigate('AddCompany') },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'Failed to load business profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompanyData = async (companyId: string) => {
    if (!companyId) return;

    try {
      const statsResponse = await api.get(ENDPOINTS.PRODUCTS.STATS, {
        params: { companyId },
      });

      const stats = statsResponse.data?.data || statsResponse.data || {};
      setCatalogStats({
        total: Number(stats.total || 0),
        active: Number(stats.active || 0),
        featured: Number(stats.featured || 0),
        views: Number(stats.views || 0),
      });

      const activitiesResponse = await api.get(ENDPOINTS.PRODUCTS.ACTIVITIES, {
        params: { companyId, limit: 5 },
      });

      const activityRows = activitiesResponse?.data?.data;
      if (Array.isArray(activityRows)) {
        setRecentActivities(activityRows);
      } else {
        setRecentActivities([]);
      }

    } catch (error: any) {
      console.error('Error fetching company data:', error);
      setCatalogStats({ total: 0, active: 0, featured: 0, views: 0 });
      setRecentActivities([]);
    }
  };

  // Back always lands on the member (unpaid) dashboard - the first tab of
  // MemberMain - rather than retracing whatever route opened the business
  // area. reset() rebuilds the tab navigator at its initial tab, so a
  // previously-selected tab can't be restored instead.
  const handleGoBack = () => {
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MemberMain' }],
      });
    } catch (err) {
      console.warn('Back navigation safely caught:', err);
    }
  };

  const handleSelectCompany = (company: BusinessProfile) => {
    if (!company?._id) return;
    setActiveCompany(company._id);
    setShowCompanyPicker(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllCompanies(true);
    await loadMemberName();
    if (businessProfile?._id) {
      await fetchCompanyData(businessProfile._id);
    }
    setRefreshing(false);
  };

  const handleDeleteCompany = () => {
    if (!businessProfile) {
      Alert.alert('Error', 'No company selected to delete');
      return;
    }

    Alert.alert(
      'Delete Company',
      `Are you sure you want to delete "${businessProfile.businessName}"? This action cannot be undone and will permanently remove all company data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.delete(ENDPOINTS.BUSINESS.DELETE(businessProfile._id));
              // Drop the deleted company from the shared store so no other
              // screen keeps rendering its data.
              setActiveCompany(null);
              await loadCompanies({ force: true });

              Alert.alert('Success', 'Company deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.navigate('ManageCompanies'),
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete company.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // `status` is optional on older company rows — never call string methods on it raw.
  const status = String(businessProfile?.status || 'pending').trim().toLowerCase() || 'pending';

  const companyId = businessProfile?._id || '';
  const goProducts = () => {
    if (companyId) navigation.navigate('ProductsServices', { companyId });
  };

  const tabBar = (
    <BusinessTabBar
      active="business"
      onPress={(key) => {
        if (key === 'products') goProducts();
        else if (key === 'discover') navigation.navigate('Discover');
        else if (key === 'analytics') navigation.navigate('Analytics');
        else if (key === 'settings') navigation.navigate('Settings');
      }}
    />
  );

  const location = [businessProfile?.area, businessProfile?.location].filter(Boolean).join(', ');
  const logoUri = businessProfile?.logo ? resolveMediaUrl(businessProfile.logo) : '';
  const activities = (recentActivities || []).slice(0, 5);
  const list = companies || [];

  const header = (
    <View>
      <BrandTopBar
        onBack={handleGoBack}
        title="Business account"
        right={<GlassIconButton icon="tune" onPress={() => navigation.navigate('Settings')} accessibilityLabel="Business settings" />}
      />
      <BrandHero
        eyebrow={`Welcome back, ${memberName || 'Member'}`}
        title="Your command centre"
        subtitle="Companies, catalogue and reach — in one place."
        art={<ShopFront3D tone="business" size={96} />}
      />

      {/* The ACTIVE company, with its real logo — every business screen follows it. */}
      {!isLoading && businessProfile ? (
        <FadeInUp delay={200} distance={10} style={styles.headerBlock}>
          <CompanyGlassCard
            name={businessProfile.businessName || 'Your company'}
            type={businessProfile.businessType || undefined}
            logo={logoUri}
            status={status}
            facts={[
              { icon: 'phone', text: businessProfile.mobileNumber || '' },
              { icon: 'mail-outline', text: businessProfile.email || '' },
              { icon: 'place', text: location },
            ]}
          />
        </FadeInUp>
      ) : isLoading ? (
        <View style={[styles.headerBlock, styles.glassSkeleton]} accessibilityLabel="Loading company" />
      ) : null}

      {/* COMPANY SWITCHER — the website's active-company selector, inline chips
          (no popup — CLAUDE.md RULE 2). Only when there is more than one. */}
      {!isLoading && companiesCount > 1 ? (
        <FadeInUp delay={260} distance={8}>
          <Text style={styles.switchLabel} maxFontSizeMultiplier={1.2}>Switch company · products, stock and analytics follow</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.switchRow}
            style={styles.switchScroll}
          >
            {list.map((c: any, i: number) => (
              <CompanyChip tone="business"
                key={String(c?._id || c?.id || `company-${i}`)}
                name={String(c?.businessName || 'Company')}
                logo={c?.logo ? resolveMediaUrl(c.logo) : ''}
                active={String(c?._id || '') === String(companyId)}
                onPress={() => handleSelectCompany(c)}
              />
            ))}
          </ScrollView>
        </FadeInUp>
      ) : null}
    </View>
  );

  return (
    <BrandScrollPage tone="business"
      header={header}
      footer={tabBar}
      refreshing={refreshing}
      onRefresh={onRefresh}
      waveHeight={60}
    >
      {isLoading ? (
        <DashboardSkeleton />
      ) : businessProfile ? (
        <>
          {/* Company actions, directly under the company they act on. */}
          <FadeInUp delay={300} style={styles.overlap}>
            <LiftCard tone="business" style={styles.gutter}>
              <View style={styles.actionRow}>
                <GradientButton tone="business"
                  label="Edit"
                  icon="edit"
                  onPress={() => { if (companyId) navigation.navigate('EditCompany', { companyId }); }}
                  style={styles.actionBtn}
                />
                <GradientButton tone="business"
                  label="Details"
                  variant="outline"
                  onPress={() => { if (companyId) navigation.navigate('ViewCompany', { companyId }); }}
                  style={styles.actionBtn}
                  accessibilityLabel="Company details"
                />
              </View>
              <PressableScale
                onPress={handleDeleteCompany}
                contentStyle={styles.deleteRow}
                accessibilityRole="button"
                accessibilityLabel="Delete company"
              >
                <Icon name="delete-outline" size={18} color={PALETTE.red} />
                <Text style={styles.deleteText} maxFontSizeMultiplier={1.3}>Delete this company</Text>
              </PressableScale>
            </LiftCard>
          </FadeInUp>

          {/* Catalog overview — every number here comes from /products/stats. */}
          <BizSectionTitle title="Catalogue overview" caption="Live figures for the active company" />
          <MetricGrid>
            <MetricTile tone="business" icon="visibility" label="Product views" value={catalogStats.views} colors={CHIP.violet} delay={120} />
            <MetricTile tone="business" icon="inventory-2" label="Products" value={catalogStats.total} colors={CHIP.sky} onPress={companyId ? goProducts : undefined} delay={180} />
            <MetricTile tone="business" icon="check-circle" label="Live in ACTIV Network" value={catalogStats.active} colors={CHIP.green} delay={240} />
            <MetricTile tone="business" icon="star" label="Featured" value={catalogStats.featured} colors={CHIP.amber} delay={300} />
          </MetricGrid>
        </>
      ) : (
        <FadeInUp delay={200} style={styles.overlap}>
          <LiftCard tone="business" style={styles.gutter}>
            {/* "No company exists" and "none is selected" need different
                instructions — the website's dashboard makes the same split. */}
            <ArtEmptyState tone="business"
              compact
              art={<ShopFront3D tone="business" size={78} />}
              title={companiesCount === 0 ? 'No business profile yet' : 'No active company'}
              message={companiesCount === 0
                ? 'Create one to start listing products and reaching buyers.'
                : 'Pick which of your companies this dashboard should describe.'}
              action={companiesCount === 0 ? 'Create business profile' : 'Select active company'}
              actionIcon={companiesCount === 0 ? 'add-business' : 'swap-horiz'}
              onAction={() => navigation.navigate(companiesCount === 0 ? 'AddCompany' : 'ManageCompanies')}
            />
          </LiftCard>
        </FadeInUp>
      )}

      {!isLoading ? (
        <>
          {/* Business tools — every business feature the website has, one tap away. */}
          <BizSectionTitle title="Business tools" />
          <ToolGrid>
            <ToolTile icon="add-box" label="Add product" colors={CHIP.violet}
              onPress={() => (companyId
                ? navigation.navigate('AddProduct', { companyId })
                : navigation.navigate('AddCompany'))} />
            <ToolTile icon="inventory" label="Stock" colors={CHIP.sky}
              onPress={() => navigation.navigate('StockCentre')} />
            <ToolTile icon="travel-explore" label="ACTIV Network" colors={CHIP.plum}
              onPress={() => navigation.navigate('Discover')} />
            <ToolTile icon="verified-user" label="Trust list" colors={CHIP.green}
              onPress={() => navigation.navigate('TrustList')} />
            <ToolTile icon="apartment" label="My companies" colors={CHIP.amber}
              onPress={() => navigation.navigate('ManageCompanies')} badge={companiesCount > 1 ? String(companiesCount) : undefined} />
            <ToolTile icon="public" label="Public page" colors={CHIP.gold}
              onPress={() => (companyId
                ? navigation.navigate('CompanyPublic', { companyId })
                : navigation.navigate('AddCompany'))} />
          </ToolGrid>

          {/* Your companies — the count and the way in to manage them. */}
          <LiftCard tone="business" style={[styles.gutter, styles.companiesCard]} onPress={() => navigation.navigate('ManageCompanies')} accessibilityLabel={`Manage my companies, ${companiesCount}`}>
            <View style={styles.companiesRow}>
              <View style={styles.companiesArt}><Briefcase3D tone="business" size={56} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.companiesTitle} maxFontSizeMultiplier={1.3}>Manage my companies</Text>
                <Text style={styles.companiesSub} maxFontSizeMultiplier={1.3}>
                  {companiesCount} {companiesCount === 1 ? 'company' : 'companies'} under your membership
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={PALETTE.textFaint} />
            </View>
          </LiftCard>

          <BizSectionTitle title="Recent activity" caption={activities.length ? 'Your latest catalogue changes' : undefined} />
          <LiftCard tone="business" style={styles.gutter}>
            {activities.length > 0 ? (
              <ActivityTimeline tone="business"
                items={activities.map((activity: any, index: number) => ({
                  key: String(activity?.productId || index),
                  icon: /updat|edit/i.test(String(activity?.label || '')) ? 'edit' : 'add-box',
                  title: activity?.label || 'Product created',
                  subtitle: activity?.description || 'Untitled',
                  meta: activity?.time ? (timeAgo(activity.time) || shortDate(activity.time)) : undefined,
                }))}
              />
            ) : (
              <View style={styles.noActivity}>
                <Icon name="history" size={22} color={PALETTE.textFaint} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.noActivityTitle} maxFontSizeMultiplier={1.3}>No recent activity</Text>
                  <Text style={styles.noActivitySub} maxFontSizeMultiplier={1.3}>Products you add or update will show up here.</Text>
                </View>
              </View>
            )}
          </LiftCard>
        </>
      ) : null}
    </BrandScrollPage>
  );
};

/* ------------------------------------------------------------------ helpers */

/** First-load placeholder shaped like the body: action card, 2×2 stats, tools. */
function DashboardSkeleton() {
  return (
    <View style={[styles.skeleton, styles.overlap]} accessibilityLabel="Loading">
      <View style={styles.skCard}>
        <View style={styles.skeletonRow}>
          <Skeleton width="48%" height={48} radius={999} />
          <Skeleton width="48%" height={48} radius={999} />
        </View>
      </View>
      <View style={styles.skeletonRow}>
        <Skeleton width="48.5%" height={128} radius={20} />
        <Skeleton width="48.5%" height={128} radius={20} />
      </View>
      <View style={styles.skeletonRow}>
        <Skeleton width="48.5%" height={128} radius={20} />
        <Skeleton width="48.5%" height={128} radius={20} />
      </View>
      <View style={styles.skeletonRow}>
        <Skeleton width="31.5%" height={108} radius={20} />
        <Skeleton width="31.5%" height={108} radius={20} />
        <Skeleton width="31.5%" height={108} radius={20} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  headerBlock: { marginTop: SPACE.lg },
  glassSkeleton: { height: 132, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  switchLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: SPACE.lg, marginBottom: SPACE.sm },
  switchScroll: { marginHorizontal: -SPACE.lg },
  switchRow: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xs },

  actionRow: { flexDirection: 'row', gap: SPACE.md },
  actionBtn: { flex: 1, minWidth: 0 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, minHeight: 44, marginTop: SPACE.sm },
  deleteText: { ...TYPE.label, color: PALETTE.red, fontWeight: '700' },

  companiesCard: { marginTop: SPACE.xs },
  companiesRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  companiesArt: { width: 60, height: 60, borderRadius: 18, backgroundColor: PALETTE.violetDeep, alignItems: 'center', justifyContent: 'center' },
  companiesTitle: { ...TYPE.heading },
  companiesSub: { ...TYPE.caption, marginTop: 2 },

  noActivity: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.xs },
  noActivityTitle: { ...TYPE.bodyStrong },
  noActivitySub: { ...TYPE.caption, marginTop: 2 },

  skeleton: { paddingHorizontal: SPACE.lg, gap: SPACE.md },
  skCard: { padding: SPACE.lg, borderRadius: 20, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
});

export default BusinessDashboardScreen;
