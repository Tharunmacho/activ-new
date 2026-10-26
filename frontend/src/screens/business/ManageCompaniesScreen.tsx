import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
// Manage Companies — every company under the membership, the ONE place a
// company switch is made from a list. Premium (business tone, violet).
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS, resolveMediaUrl } from '../../config/api.config';
import { useActiveCompanyStore } from '../../stores/activeCompanyStore';
import { Badge, SPACE, BrandFrame, BrandHeaderBlock, BrandTopBar, BrandHero, GlassIconButton, PREMIUM_OVERLAP, FadeInUp, LiftCard, CompanyLogoTile, ArtEmptyState, Briefcase3D, PressableScale, GlassFigure } from '../../ui';
import { CardSkeletons, SoftAction, companyStatus } from './businessKit';

type ManageCompaniesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ManageCompanies'
>;

interface Props {
  navigation: ManageCompaniesScreenNavigationProp;
}

interface Company {
  _id: string;
  businessName: string;
  businessType: string;
  mobileNumber: string;
  email?: string;
  location: string;
  area?: string;
  status: string;
  isActive: boolean;
  logo?: string;
}

const ManageCompaniesScreen: React.FC<Props> = ({ navigation }) => {
  const { palette: PALETTE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const companies = useActiveCompanyStore((state) => state.companies) as Company[];
  const activeCompanyId = useActiveCompanyStore((state) => state.activeCompanyId);
  const setActiveCompany = useActiveCompanyStore((state) => state.setActiveCompany);
  const loadCompanies = useActiveCompanyStore((state) => state.loadCompanies);

  const [isLoading, setIsLoading] = useState(true);

  // On focus, not on mount: a company created or edited on another screen must
  // be visible the moment the user comes back to this list.
  useFocusEffect(
    useCallback(() => {
      fetchCompanies();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const fetchCompanies = async () => {
    try {
      setIsLoading(true);
      await loadCompanies({ force: true });
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      Alert.alert('Error', 'Failed to load companies.');
    } finally {
      setIsLoading(false);
    }
  };

  // The one place a company switch is made. Every business screen follows it.
  const handleUseCompany = (company: Company) => {
    if (!company?._id) return;
    setActiveCompany(company._id);
    Alert.alert(
      'Company Switched',
      `You are now working as "${company.businessName || 'this company'}". Products, profile and analytics now show this company only.`
    );
  };

  const handleDelete = (company: Company) => {
    Alert.alert(
      'Delete Company',
      `Are you sure you want to delete "${company.businessName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.delete(ENDPOINTS.BUSINESS.DELETE(company._id));
              if (activeCompanyId === company._id) {
                setActiveCompany(null);
              }
              Alert.alert('Success', 'Company deleted successfully');
              fetchCompanies();
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

  const list = companies || [];
  const count = list.length;
  const listed = list.filter((c) => c?.isActive !== false).length;
  const active = list.find((c) => c?._id === activeCompanyId);

  const header = (
    <View>
      <BrandHeaderBlock tone="business">
        <BrandTopBar
          onBack={() => navigation.goBack()}
          title="My companies"
          right={<GlassIconButton icon="add" onPress={() => navigation.navigate('AddCompany')} accessibilityLabel="Add company" />}
        />
        <BrandHero
          eyebrow="Your membership"
          title="Manage companies"
          subtitle="Switch the company you are working as, or tidy up the ones you run."
          art={<Briefcase3D tone="business" size={92} />}
          artSize={92}
        >
          <View style={styles.figures}>
            <GlassFigure icon="apartment" value={String(count)} label={count === 1 ? 'Company' : 'Companies'} />
            <GlassFigure icon="travel-explore" value={String(listed)} label="In ACTIV Network" />
          </View>
        </BrandHero>
      </BrandHeaderBlock>
      {active ? (
        <FadeInUp delay={220} style={styles.overlap}>
          <LiftCard tone="business" style={styles.gutter}>
            <View style={styles.nowRow}>
              <Icon name="bolt" size={18} color={PALETTE.violet} />
              <Text style={styles.nowText} numberOfLines={2} maxFontSizeMultiplier={1.3}>
                Working as <Text style={styles.nowStrong}>{active?.businessName || 'this company'}</Text>
              </Text>
            </View>
          </LiftCard>
        </FadeInUp>
      ) : <View style={styles.overlapSpacer} />}
    </View>
  );

  return (
    <BrandFrame tone="business">
      <FlatList
        data={isLoading ? [] : list}
        keyExtractor={(item, index) => String(item?._id || (item as any)?.id || index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 5) * 70} distance={14}>
            <CompanyCard
              company={item}
              active={activeCompanyId === item?._id}
              onUse={() => handleUseCompany(item)}
              onPreview={() => navigation.navigate('CompanyPublic', { companyId: item._id })}
              onView={() => navigation.navigate('ViewCompany', { companyId: item._id })}
              onEdit={() => navigation.navigate('EditCompany', { companyId: item._id })}
              onProducts={() => {
                // Opening a company's catalog switches the active company,
                // so no screen ends up mixing two companies' data.
                setActiveCompany(item._id);
                navigation.navigate('ProductsServices', { companyId: item._id });
              }}
              onDelete={() => handleDelete(item)}
            />
          </FadeInUp>
        )}
        ListEmptyComponent={
          isLoading ? <CardSkeletons rows={3} tall /> : (
            <LiftCard tone="business" style={styles.gutter}>
              <ArtEmptyState tone="business"
                compact
                art={<Briefcase3D tone="business" size={78} />}
                title="No companies registered"
                message="Add your business profile to showcase products and services."
                action="Add company"
                actionIcon="add-business"
                onAction={() => navigation.navigate('AddCompany')}
              />
            </LiftCard>
          )
        }
      />
    </BrandFrame>
  );
};

function statusLabel(status?: string) {
  return status === 'pending'
    ? 'Not published'
    : status === 'active'
    ? 'Active'
    : status || 'Not published';
}

/** One company: identity, the switch control, and its actions. */
function CompanyCard({ company, active, onUse, onPreview, onView, onEdit, onProducts, onDelete }: {
  company: Company; active: boolean;
  onUse: () => void; onPreview: () => void; onView: () => void; onEdit: () => void; onProducts: () => void; onDelete: () => void;
}) {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  const logo = company?.logo ? resolveMediaUrl(company.logo) : '';
  const label = statusLabel(company?.status);
  const st = companyStatus(company?.status);
  const listed = company?.isActive !== false;
  return (
    <LiftCard tone="business" style={[styles.card, active && { borderColor: p.accent, borderWidth: 1.5 }]}>
      <View style={styles.headRow}>
        <CompanyLogoTile tone="business" uri={logo} name={company?.businessName} size={56} ring={active} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} maxFontSizeMultiplier={1.3}>{company?.businessName || 'Company'}</Text>
          {company?.businessType ? <Text style={styles.type} numberOfLines={2} maxFontSizeMultiplier={1.3}>{company.businessType}</Text> : null}
          {company?.mobileNumber ? (
            <View style={styles.metaRow}>
              <Icon name="phone" size={14} color={PALETTE.textFaint} />
              <Text style={styles.meta} numberOfLines={1}>{company.mobileNumber}</Text>
            </View>
          ) : null}
        </View>
        <Badge size="sm" label={label} status={st.key === 'active' ? 'active' : st.key === 'pending' ? 'pending' : st.key} />
      </View>

      <View style={styles.tags}>
        <Badge size="sm" dot label={listed ? 'Listed in ACTIV Network' : 'Hidden from ACTIV Network'} color={listed ? PALETTE.successText : PALETTE.warningText} bg={listed ? PALETTE.successSoft : PALETTE.warningSoft} />
      </View>

      {/* Active / switch control — the single company-switch point */}
      {active ? (
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.strip}>
          <Icon name="check-circle" size={18} color={PALETTE.white} />
          <Text style={[styles.stripText, { color: PALETTE.white }]} maxFontSizeMultiplier={1.3}>
            Active — products, profile & analytics show this company
          </Text>
        </LinearGradient>
      ) : (
        <PressableScale
          onPress={onUse}
          contentStyle={[styles.strip, styles.stripIdle]}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${company?.businessName || 'this company'}`}
        >
          <Icon name="swap-horiz" size={18} color={p.accent} />
          <Text style={[styles.stripText, { color: p.accentDark }]} maxFontSizeMultiplier={1.3}>Switch to this company</Text>
          <Icon name="chevron-right" size={20} color={p.accent} />
        </PressableScale>
      )}

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <SoftAction icon="visibility" label="View" onPress={onView} accessibilityLabel={`View ${company?.businessName || 'company'}`} />
          <SoftAction icon="edit" label="Edit" onPress={onEdit} />
        </View>
        <View style={styles.actionRow}>
          <SoftAction icon="inventory-2" label="Products" onPress={onProducts} />
          <SoftAction icon="delete-outline" label="Delete" danger onPress={onDelete} />
        </View>
      </View>

      {/* Website MyCompanies "View as member": the member-facing page,
          the one view an owner cannot get any other way. */}
      <PressableScale onPress={onPreview} contentStyle={styles.preview} accessibilityRole="button" accessibilityLabel="View as member">
        <Icon name="public" size={17} color={p.accent} />
        <Text style={[styles.previewText, { color: p.accentDark }]} maxFontSizeMultiplier={1.3}>View as member</Text>
        <Icon name="chevron-right" size={18} color={p.accent} />
      </PressableScale>
    </LiftCard>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  list: { paddingBottom: SPACE.huge, flexGrow: 1 },
  gutter: { marginHorizontal: SPACE.lg },
  overlap: { marginTop: -PREMIUM_OVERLAP, marginBottom: SPACE.md },
  overlapSpacer: { height: SPACE.xs },
  figures: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  nowText: { ...TYPE.body, flex: 1, minWidth: 0 },
  nowStrong: { fontWeight: '800', color: PALETTE.text },

  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  name: { ...TYPE.heading },
  type: { ...TYPE.caption, fontSize: 13, lineHeight: 18, marginTop: SPACE.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  meta: { ...TYPE.caption, color: PALETTE.textSoft, flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 46,
    borderRadius: 14, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, marginTop: SPACE.md,
  },
  stripIdle: { backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  stripText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  actions: { gap: SPACE.sm, marginTop: SPACE.md },
  actionRow: { flexDirection: 'row', gap: SPACE.sm },
  preview: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: 44, marginTop: SPACE.sm, alignSelf: 'flex-start' },
  previewText: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});

export default ManageCompaniesScreen;
