// Business Settings — premium (business tone, violet).
//
// Everything here maps to a real capability of a business account:
// the company record itself, its public listing, its catalog, and the session.
// No placeholder rows - a row exists only if tapping it does something.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { useAuthStore } from '../../stores/exampleStore';
import {
  useActiveCompany,
  useActiveCompanyStore,
} from '../../stores/activeCompanyStore';
import api from '../../services/api';
import { ENDPOINTS, resolveMediaUrl } from '../../config/api.config';
import {
  ListRow, ToggleRow, PALETTE, SPACE, TYPE,
  BrandScrollPage, BrandTopBar, BrandHero, PREMIUM_OVERLAP, FadeInUp, PremiumSection, LiftCard, CountUpText,
  ControlPanel3D, PressableScale,
} from '../../ui';
import { BusinessTabBar, BusinessTabKey } from './BusinessTabBar';
import { CompanyGlassCard, GlassTag } from './businessKit';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

type StatusTone = {
  label: string;
  background: string;
  color: string;
  icon: string;
};

// The company record carries `status` (pending until an admin activates it).
const STATUS_TONES: Record<string, StatusTone> = {
  active: { label: 'Published', background: PALETTE.successSoft, color: PALETTE.successText, icon: 'verified' },
  pending: { label: 'Not published', background: PALETTE.warningSoft, color: PALETTE.warningText, icon: 'schedule' },
  inactive: { label: 'Not published', background: PALETTE.dangerSoft, color: PALETTE.dangerText, icon: 'block' },
};

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const activeCompany = useActiveCompany();
  const companies = useActiveCompanyStore((state) => state.companies);
  const loadCompanies = useActiveCompanyStore((state) => state.loadCompanies);
  const setActiveCompany = useActiveCompanyStore((state) => state.setActiveCompany);

  const [isListed, setIsListed] = useState(true);
  const [isSavingListing, setIsSavingListing] = useState(false);
  const [catalogStats, setCatalogStats] = useState({ total: 0, active: 0, featured: 0 });
  // Bumped every time the screen regains focus. The data effects below key off
  // it as well as the company id, so returning here after creating, editing or
  // deleting something re-reads from the server instead of showing the copy
  // fetched the first time this company was selected.
  const [focusTick, setFocusTick] = useState(0);

  const companyName = activeCompany?.businessName || '';
  const companyId = activeCompany?._id || '';
  const companiesCount = (companies || []).length;
  const statusTone =
    STATUS_TONES[(activeCompany?.status || 'pending').toLowerCase()] || STATUS_TONES.pending;

  // Settings can be opened straight from the tab bar, so the store may not have
  // been populated by the dashboard yet.
  useFocusEffect(
    useCallback(() => {
      setFocusTick((tick) => tick + 1);
      loadCompanies().catch((err) => console.warn('Company load safely caught:', err));
    }, [loadCompanies])
  );

  useEffect(() => {
    setIsListed(activeCompany?.isActive !== false);
  }, [activeCompany?._id, activeCompany?.isActive]);

  // A settings screen that can't tell you whether your catalog is empty is
  // just a menu, so pull the same counts the dashboard shows.
  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      if (!companyId) {
        setCatalogStats({ total: 0, active: 0, featured: 0 });
        return;
      }
      try {
        const res = await api.get(ENDPOINTS.PRODUCTS.STATS, { params: { companyId } });
        const payload = res.data?.data || res.data || {};
        if (cancelled) return;
        setCatalogStats({
          total: Number(payload.total || 0),
          active: Number(payload.active || 0),
          featured: Number(payload.featured || 0),
        });
      } catch (err) {
        console.warn('Catalog stats safely caught:', err);
        if (!cancelled) setCatalogStats({ total: 0, active: 0, featured: 0 });
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [companyId, focusTick]);

  // Every company-scoped action needs a company to act on. Rather than
  // navigating to a screen that would render empty, say so and offer the fix.
  const requireCompany = (run: () => void) => {
    if (!companyId) {
      Alert.alert('No Active Company', 'Select or create a company first, then try again.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Manage Companies', onPress: () => navigation.navigate('ManageCompanies') },
      ]);
      return;
    }
    run();
  };

  // Directory visibility - drives whether other members find this company in
  // Discover. Optimistic, reverted if the write fails.
  const handleToggleListing = async (next: boolean) => {
    if (!companyId) {
      requireCompany(() => {});
      return;
    }

    if (next && activeCompany?.publication?.paymentRequired) {
      try {
        const res = await api.get(`/business-profiles/${companyId}/publishing`);
        const quote = res.data?.data || res.data;
        if (quote.paymentRequired) {
          Alert.alert('Publish another company', `₹${Number(quote.amount).toLocaleString('en-IN')} · ${quote.term}\n\n${quote.message}`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue to payment', onPress: () => navigation.navigate('PaymentCheckout', { orderType: 'company_listing', companyId }) },
          ]);
          return;
        }
      } catch (error: any) { Alert.alert('Company publishing', error?.response?.data?.message || 'The current fee could not be loaded. Please retry.'); return; }
    }
    setIsListed(next);
    setIsSavingListing(true);

    try {
      await api.put(ENDPOINTS.BUSINESS.UPDATE(companyId), { isActive: next });
      await loadCompanies({ force: true });
    } catch (error: any) {
      setIsListed(!next);
      Alert.alert(
        'Could Not Update Listing',
        error?.response?.data?.message || 'Please check your connection and try again.'
      );
    } finally {
      setIsSavingListing(false);
    }
  };

  const handleDeleteCompany = () => {
    requireCompany(() => {
      Alert.alert(
        'Delete Company',
        `Permanently delete "${companyName}"? Its products and listing are removed with it. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await api.delete(ENDPOINTS.BUSINESS.DELETE(companyId));
                setActiveCompany(null);
                await loadCompanies({ force: true });
                Alert.alert('Deleted', 'Company removed successfully.', [
                  { text: 'OK', onPress: () => navigation.navigate('ManageCompanies') },
                ]);
              } catch (error: any) {
                Alert.alert(
                  'Error',
                  error?.response?.data?.message || 'Failed to delete company.'
                );
              }
            },
          },
        ]
      );
    });
  };

  // Leaves the business area but keeps the session - not a logout.
  const handleExitBusiness = () => {
    Alert.alert('Exit Business Account', 'Switch back to the main member dashboard?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit to Dashboard',
        onPress: () => {
          try {
            navigation.reset({ index: 0, routes: [{ name: 'MemberMain' as any }] });
          } catch (err) {
            console.warn('Exit navigation safely caught:', err);
          }
        },
      },
    ]);
  };

  // Ends the session for real.
  const handleLogout = () => {
    Alert.alert('Log Out', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: 'Login' as any }] });
          } catch (err) {
            console.warn('Logout safely caught:', err);
          }
        },
      },
    ]);
  };

  const handleTab = (key: BusinessTabKey) => {
    if (key === 'business') navigation.navigate('BusinessDashboard');
    else if (key === 'products') navigation.navigate('ProductsServices', {});
    else if (key === 'discover') navigation.navigate('Discover');
    else if (key === 'analytics') navigation.navigate('Analytics');
  };

  return (
    <BrandScrollPage tone="business"
      footer={<BusinessTabBar active="settings" onPress={handleTab} />}
      header={(
        <View style={styles.headerPad}>
          <BrandTopBar onBack={() => navigation.goBack()} title="Business settings" />
          <BrandHero
            eyebrow="Settings for"
            title={companyName || 'No company selected'}
            subtitle="Your company record, its listing, its catalogue and your session."
            art={<ControlPanel3D tone="business" size={92} />}
            artSize={92}
          />
          {/* Which company every setting below applies to */}
          <FadeInUp delay={200} distance={10} style={{ marginTop: SPACE.lg }}>
            <CompanyGlassCard
              name={companyName || 'None selected'}
              type={`${activeCompany?.businessType || 'Business'}${activeCompany?.location ? ` · ${activeCompany.location}` : ''}`}
              logo={activeCompany?.logo ? resolveMediaUrl(activeCompany.logo) : ''}
            />
            <View style={styles.headTags}>
              <GlassTag icon={statusTone.icon} label={statusTone.label} />
              <GlassTag icon="apartment" label={`${companiesCount} ${companiesCount === 1 ? 'company' : 'companies'}`} />
              <GlassTag icon={isListed ? 'travel-explore' : 'visibility-off'} label={isListed ? 'Listed' : 'Hidden'} />
            </View>
          </FadeInUp>
        </View>
      )}
    >
      {/* Directory presence — the one switch with consequences for others. */}
      <FadeInUp delay={240} style={styles.overlap}>
        <PremiumSection tone="business" icon="travel-explore" title="ACTIV Network" subtitle={activeCompany?.publication?.unlimited ? 'Lifetime Membership · publish multiple companies' : 'One company included · membership payment for each additional company'}>
          <ToggleRow tone="business"
            icon="travel-explore"
            title="List in ACTIV Network"
            subtitle={isSavingListing
              ? 'Saving…'
              : isListed
                ? 'Other members can find this company and its products'
                : 'Hidden from search across the member network'}
            value={isListed}
            onValueChange={handleToggleListing}
            disabled={isSavingListing}
          />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="search" title="ACTIV Network" subtitle="Search companies and products across members"
            onPress={() => navigation.navigate('Discover')} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="verified-user" title="My trust list" subtitle="Companies you have kept, with your notes"
            onPress={() => navigation.navigate('TrustList')} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="bar-chart" title="Analytics" subtitle="Profile views and catalogue performance"
            onPress={() => navigation.navigate('Analytics')} last />
        </PremiumSection>
      </FadeInUp>

      {/* Company record */}
      <FadeInUp delay={300}>
        <PremiumSection tone="business" icon="storefront" title="Company profile" subtitle="The record other members read">
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="edit" title="Edit company profile" subtitle="Name, type, contact, location and logo"
            onPress={() => requireCompany(() => navigation.navigate('EditCompany', { companyId }))} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="public" title="View public page" subtitle="Your company as other members see it"
            onPress={() => requireCompany(() => navigation.navigate('CompanyPublic', { companyId }))} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="swap-horiz" title="Manage companies" subtitle="Switch between or review your business accounts"
            onPress={() => navigation.navigate('ManageCompanies')} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="add-business" title="Add new company" subtitle="Register another business under your membership"
            onPress={() => navigation.navigate('AddCompany')} last />
        </PremiumSection>
      </FadeInUp>

      {/* Catalog */}
      <FadeInUp delay={360}>
        <PremiumSection tone="business" icon="inventory-2" title="Catalogue" subtitle="Live counts for the active company">
          <View style={styles.statStrip}>
            <View style={styles.statCell}>
              <CountUpText value={catalogStats.total} style={styles.statValue} />
              <Text style={styles.statLabel}>Items</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <CountUpText value={catalogStats.active} style={styles.statValue} />
              <Text style={styles.statLabel}>Live</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <CountUpText value={catalogStats.featured} style={styles.statValue} />
              <Text style={styles.statLabel}>Featured</Text>
            </View>
          </View>
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="inventory-2" title="Products & services" subtitle="Review, edit or remove your catalogue items"
            onPress={() => requireCompany(() => navigation.navigate('ProductsServices', { companyId }))} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="inventory" title="Stock" subtitle="Counts, low-stock warnings and the movement log"
            onPress={() => requireCompany(() => navigation.navigate('StockCentre'))} />
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="add-circle-outline" title="Add product or service" subtitle="Publish a new item with photo, price and stock"
            onPress={() => requireCompany(() => navigation.navigate('AddProduct', { companyId }))} last />
        </PremiumSection>
      </FadeInUp>

      {/* Session */}
      <PremiumSection tone="business" icon="dashboard" title="Session">
        <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="dashboard" title="Exit to member dashboard" subtitle="Leave the business area, stay signed in"
          onPress={handleExitBusiness} last />
      </PremiumSection>

      {/* Irreversible actions, kept apart from everything else */}
      <View style={styles.danger}>
        <Text style={styles.dangerTitle} accessibilityRole="header">Danger zone</Text>
        <LiftCard tone="business" padded={false} style={styles.dangerCard}>
          <ListRow iconColor={PALETTE.violet} iconBg={PALETTE.violetSoft} icon="delete-outline" danger title="Delete this company"
            subtitle={`Removes ${companyName || 'the company'} and its catalogue permanently`}
            onPress={handleDeleteCompany} last />
        </LiftCard>
        <PressableScale onPress={handleLogout} contentStyle={styles.logout} accessibilityRole="button" accessibilityLabel="Log out">
          <Icon name="logout" size={20} color={PALETTE.redDark} />
          <Text style={styles.logoutText} maxFontSizeMultiplier={1.3}>Log out</Text>
        </PressableScale>
      </View>
    </BrandScrollPage>
  );
};

const styles = StyleSheet.create({
  headerPad: { paddingBottom: SPACE.md },
  headTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },

  statStrip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.violetTint,
    borderRadius: 16, paddingVertical: SPACE.md, marginBottom: SPACE.xs,
    borderWidth: 1, borderColor: PALETTE.violetBorder,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: PALETTE.violetBorder },
  statValue: { ...TYPE.number, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  statLabel: { ...TYPE.caption, marginTop: SPACE.xxs },

  danger: { marginHorizontal: SPACE.lg, marginTop: SPACE.xs },
  dangerTitle: { ...TYPE.eyebrow, color: PALETTE.redDark, marginBottom: SPACE.sm },
  dangerCard: { paddingHorizontal: SPACE.lg, borderColor: '#FECACA' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2', marginTop: SPACE.md },
  logoutText: { color: PALETTE.redDark, fontSize: 15, lineHeight: 20, fontWeight: '700' },
});

export default SettingsScreen;
