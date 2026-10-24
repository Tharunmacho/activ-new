import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../../types';
import {
  InfoRow, KeyValueGrid, ListRow, Divider, PALETTE, SPACE, TYPE, shortDate,
  BrandScrollPage, BrandTopBar, PREMIUM_OVERLAP, FadeInUp, LiftCard, GradientButton, MetricGrid, MetricTile,
  GlassIconButton, premiumTone,
} from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { useActiveCompanyStore } from '../../stores/activeCompanyStore';
import { getCompany, getProductStats, errorMessage, Company } from '../../services/businessApi';
import { CompanyShareButton } from '../../components/BusinessShareButton';
import api from '../../services/api';
import { BizSectionTitle, BizStatePage, CoverHero, GlassStatus, GlassTag, CHIP } from './businessKit';

type Props = NativeStackScreenProps<RootStackParamList, 'ViewCompany'>;

/**
 * ONE OF MY COMPANIES — the website's /business/companies/:id (CompanyDetails).
 *
 *   GET    /business-profiles/:id              owner-scoped details
 *   GET    /products/stats?companyId=          total / live / featured / views / trustedBy
 *   DELETE /business-profiles/:id              delete
 *
 * "Make active" switches which company every business screen acts as — the
 * website's switcher, same store.
 */

interface Stats { total: number; active: number; featured: number; views: number; trustedBy: number }

const ViewCompanyScreen: React.FC<Props> = ({ navigation, route }) => {
  const companyId = route?.params?.companyId || '';
  const activeId = useActiveCompanyStore((s) => s.activeCompanyId);
  const setActive = useActiveCompanyStore((s) => s.setActiveCompany);
  const loadCompanies = useActiveCompanyStore((s) => s.loadCompanies);

  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, featured: 0, views: 0, trustedBy: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!companyId) { setError('No company selected.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const c = await getCompany(companyId);
      if (!c) throw new Error('Company not found.');
      setCompany(c);
      try {
        const d = await getProductStats(companyId);
        setStats({
          total: Number(d?.total || 0), active: Number(d?.active || 0), featured: Number(d?.featured || 0),
          views: Number(d?.views || 0), trustedBy: Number(d?.trustedBy || 0),
        });
      } catch (err) {
        console.warn('Catalog stats safely caught:', err);
      }
    } catch (err: any) {
      setError(err?.response ? errorMessage(err, 'Could not load this company.') : String(err?.message || 'Could not load this company.'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () => {
    Alert.alert('Delete company', `Delete ${company?.businessName || 'this company'} and its catalogue? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/business-profiles/${encodeURIComponent(companyId)}`);
            await loadCompanies({ force: true });
            navigation.goBack();
          } catch (err) {
            Alert.alert('Not deleted', errorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) return <BizStatePage title="Company" eyebrow="Company details" onBack={() => navigation.goBack()} />;
  if (error || !company) return <BizStatePage title="Company" eyebrow="Company details" onBack={() => navigation.goBack()} error={error} onRetry={load} />;

  const p = premiumTone('business');
  const logo = company?.logo ? resolveMediaUrl(company.logo) : '';
  const banner = company?.banner ? resolveMediaUrl(company.banner) : '';
  const isActiveCompany = activeId === company._id;
  const live = company?.isActive !== false;
  // The company record's own review status (`pending` on create) — the website's CompanyDetails shows it.
  const status = String(company?.status || 'pending').trim().toLowerCase();
  const categories = (company?.productCategories || []).filter((c) => c && c.description);

  const header = (
    <View style={styles.headerPad}>
      <BrandTopBar
        onBack={() => navigation.goBack()}
        title={isActiveCompany ? 'Active company' : 'Company'}
        right={<View style={{ flexDirection: 'row', gap: SPACE.sm }}>
          <CompanyShareButton company={company} compact appearance="glass" />
          <GlassIconButton icon="edit" onPress={() => navigation.navigate('EditCompany', { companyId })} accessibilityLabel="Edit company" />
        </View>}
      />
      <FadeInUp delay={80} distance={12} style={{ marginTop: SPACE.md }}>
        <CoverHero
          banner={banner}
          logo={logo}
          name={company?.businessName || 'Company'}
          subtitle={company?.businessType || undefined}
          badges={(
            <>
              <GlassStatus status={status} />
              {isActiveCompany ? <GlassTag icon="bolt" label="Active" /> : null}
            </>
          )}
        />
      </FadeInUp>
      <FadeInUp delay={160} distance={8} style={styles.headTags}>
        <GlassTag icon={live ? 'travel-explore' : 'visibility-off'} label={live ? 'Listed in ACTIV Network' : 'Hidden from ACTIV Network'} />
      </FadeInUp>
    </View>
  );

  return (
    <BrandScrollPage tone="business" header={header}>
      <FadeInUp delay={200} style={styles.overlap}>
        {!isActiveCompany ? (
          <LiftCard tone="business" style={styles.gutter}>
            <Text style={styles.switchText} maxFontSizeMultiplier={1.3}>Products, stock and analytics follow the company you are working as.</Text>
            <GradientButton tone="business"
              label="Make this my active company"
              icon="swap-horiz"
              onPress={() => setActive(company._id)}
              style={{ marginTop: SPACE.md }}
            />
          </LiftCard>
        ) : (
          <LiftCard tone="business" style={styles.gutter}>
            <View style={styles.activeRow}>
              <Icon name="check-circle" size={20} color={PALETTE.green} />
              <Text style={styles.activeText} maxFontSizeMultiplier={1.3}>You are working as this company everywhere in the business area.</Text>
            </View>
          </LiftCard>
        )}
      </FadeInUp>

      <BizSectionTitle title="Catalogue" caption="From your products" />
      <MetricGrid>
        <MetricTile tone="business" label="Catalogue products" value={stats.total} icon="inventory-2" hint="Total listed" colors={CHIP.violet} delay={100} />
        <MetricTile tone="business" label="Live products" value={stats.active} icon="check-circle" colors={CHIP.green} hint="Visible in ACTIV Network" delay={160} />
        <MetricTile tone="business" label="Featured" value={stats.featured} icon="star" colors={CHIP.amber} hint="Promoted items" delay={220} />
        <MetricTile tone="business" label="Product views" value={stats.views} icon="visibility" colors={CHIP.sky} delay={280} />
      </MetricGrid>

      <BizSectionTitle title="Details" />
      <LiftCard tone="business" style={styles.gutter}>
        {company?.description ? <Text style={styles.about} maxFontSizeMultiplier={1.3}>{company.description}</Text> : null}
        <KeyValueGrid
          items={[
            { label: 'Business type', value: company?.businessType },
            { label: 'Constitution', value: company?.constitutionType },
            { label: 'Employees', value: company?.numberOfEmployees },
            { label: 'Trusted by', value: `${stats.trustedBy} ${stats.trustedBy === 1 ? 'member' : 'members'}` },
            { label: 'Registered', value: shortDate(company?.createdAt) },
            { label: 'Last updated', value: shortDate(company?.updatedAt) },
          ]}
        />
        <Divider spacing={SPACE.md} />
        <InfoRow label="Activities" value={company?.businessActivities} icon="work-outline" />
        <InfoRow label="Phone" value={company?.mobileNumber} icon="phone" />
        <InfoRow label="Email" value={company?.email} icon="mail-outline" />
        <InfoRow label="Location" value={[company?.area, company?.location].filter(Boolean).join(', ')} icon="place" last={!company?.memberOfOtherChamber} />
        {company?.memberOfOtherChamber ? <InfoRow label="Other chamber" value={company?.otherChamber || 'Yes'} icon="groups" last /> : null}
      </LiftCard>

      {categories.length ? (
        <>
          <BizSectionTitle title="Product categories" caption={`${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`} />
          <LiftCard tone="business" style={styles.gutter}>
            <View style={styles.cats}>
              {categories.map((c, i) => (
                <View key={`${c?.code || 'c'}-${i}`} style={styles.catRow}>
                  <View style={[styles.catIcon, { backgroundColor: p.accentSoft }]}>
                    <Icon name={c?.industryType === 'Manufacturing' ? 'precision-manufacturing' : 'category'} size={16} color={p.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catTitle} maxFontSizeMultiplier={1.3}>{c?.description || ''}</Text>
                    <Text style={styles.catMeta} maxFontSizeMultiplier={1.3}>{c?.code ? `NIC ${c.code}${c?.industryType ? ` · ${c.industryType}` : ''}` : 'Custom category'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </LiftCard>
        </>
      ) : null}

      <BizSectionTitle title="Manage" />
      <LiftCard tone="business" style={[styles.gutter, styles.listCard]} padded={false}>
        <ListRow icon="edit" title="Edit company" subtitle="Details, logo, cover, registrations" onPress={() => navigation.navigate('EditCompany', { companyId })} />
        <ListRow icon="inventory-2" title="Products & services" subtitle={`${stats.total} listed`} onPress={() => { setActive(company._id); navigation.navigate('ProductsServices', { companyId }); }} />
        <ListRow icon="public" title="View as other members" subtitle="Your public company page" onPress={() => navigation.navigate('CompanyPublic', { companyId })} />
        <ListRow icon="delete-outline" title="Delete company" danger onPress={remove} last />
      </LiftCard>
    </BrandScrollPage>
  );
};

const styles = StyleSheet.create({
  headerPad: { paddingBottom: SPACE.sm },
  headTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md, marginBottom: SPACE.sm },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  switchText: { ...TYPE.body },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  activeText: { ...TYPE.body, flex: 1, minWidth: 0 },
  about: { ...TYPE.body, lineHeight: 21, marginBottom: SPACE.lg },
  cats: { gap: SPACE.sm },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, padding: SPACE.md, borderRadius: 14, backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  catIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catTitle: { ...TYPE.bodyStrong },
  catMeta: { ...TYPE.caption, marginTop: SPACE.xxs },
  listCard: { paddingHorizontal: SPACE.lg },
});

export default ViewCompanyScreen;
