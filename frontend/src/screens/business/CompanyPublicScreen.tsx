import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Linking, Alert, FlatList, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../../types';
import {
  Badge, InfoRow, PALETTE, SPACE, TYPE, money,
  BrandFrame, BrandHeaderBlock, BrandTopBar, PREMIUM_OVERLAP, FadeInUp, LiftCard,
  GradientButton, TrustStar, ContactAction, ArtEmptyState, ProductCrate3D, CountUpText, premiumTone, FitImage } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import {
  getPublicCompany, addToTrustList, removeFromTrustList, errorMessage, Company, PublicProduct,
} from '../../services/businessApi';
import { recordProductView } from '../../services/memberApi';
import { governmentSchemes } from '../../utils/governmentSchemes';
import { CompanyShareButton } from '../../components/BusinessShareButton';
import CatalogueAlbum from '../../components/CatalogueAlbum';
import { BizSectionTitle, BizStatePage, CoverHero, GlassTag } from './businessKit';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanyPublic'>;

/**
 * A COMPANY AS THE NETWORK SEES IT — the website's /business/company/:id.
 *
 *   GET    /business-profiles/public/:id          company + published products,
 *                                                 trustedBy, isTrusted, isOwner
 *   POST   /business-profiles/trust-list/:id      add to my trust list
 *   DELETE /business-profiles/trust-list/:id      remove
 *
 * The owner sees their own public page with no trust button (you cannot trust
 * yourself) and a note saying this is how others see it.
 *
 * Like the website it re-reads whenever it regains focus (an owner who edits
 * and comes back sees the edit), silently once something is on screen; and
 * the trust toggle answers at once and rolls back if the server refuses.
 */

/** "March 2024" — when the company joined the directory. */
const monthYear = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return `${d.getMonth() + 1}/${d.getFullYear()}`;
  }
};

function ProductCard({ item, onOpen }: { item: PublicProduct; onOpen?: () => void }) {
  const p = premiumTone('business');
  const img = item?.imageUrl ? resolveMediaUrl(item.imageUrl) : '';
  const stock = Number(item?.stock || 0);
  return (
    <Pressable
      style={[styles.product, { shadowColor: p.shadow }]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${item?.name || 'Product'}, view photos and details`}
    >
      {/* Fixed 4:3 frame so every card's text starts on the same line. */}
      <View style={styles.productImgWrap}>
        {img ? <FitImage uri={img} style={styles.productImg} /> : (
          <LinearGradient colors={[PALETTE.violetSoft, PALETTE.violetTint]} style={[styles.productImg, styles.productImgEmpty]}>
            <Icon name="inventory-2" size={28} color={p.accent} />
          </LinearGradient>
        )}
        {stock > 0 ? (
          <View style={styles.stockChip}><Text style={styles.stockChipText} maxFontSizeMultiplier={1.2}>{`${stock} in stock`}</Text></View>
        ) : null}
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productName} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.name || 'Product'}</Text>
        <Text style={styles.productCat} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.category || 'General'}{item?.sku ? ` · ${item.sku}` : ''}</Text>
        {item?.description ? <Text style={styles.productDesc} numberOfLines={3} maxFontSizeMultiplier={1.3}>{item.description}</Text> : null}
        <View style={styles.productFoot}>
          <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.priceChip}>
            <Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>{money(item?.price)}</Text>
          </LinearGradient>
        </View>
      </View>
    </Pressable>
  );
}

/** One figure in the at-a-glance strip. */
function Fact({ icon, value, label, count }: { icon: string; value?: string; label: string; count?: number }) {
  const p = premiumTone('business');
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${typeof count === 'number' ? count : value}`}>
      <Icon name={icon} size={18} color={p.accent} />
      {typeof count === 'number' ? (
        <CountUpText value={count} style={styles.factValue} />
      ) : (
        <Text style={styles.factValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>{value || '—'}</Text>
      )}
      <Text style={styles.factLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
    </View>
  );
}

const CompanyPublicScreen: React.FC<Props> = ({ navigation, route }) => {
  const companyId = route?.params?.companyId || '';
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [albumAt, setAlbumAt] = useState<number | null>(null);
  const hasData = useRef(false);

  /*
   * Catalogue views for the seller's analytics — the same record-view call the
   * directory profile makes, once per product per visit, recorded when a card
   * actually scrolls into view. Refs, because FlatList refuses a changing
   * `onViewableItemsChanged`. The owner's own look is skipped (the server
   * ignores it too).
   */
  const seenProducts = useRef<Set<string>>(new Set());
  const isOwnerRef = useRef(false);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item?: any }> }) => {
    try {
      if (isOwnerRef.current) return;
      (viewableItems || []).forEach((v) => {
        const key = String(v?.item?._id || '');
        if (!key || seenProducts.current.has(key)) return;
        seenProducts.current.add(key);
        recordProductView(key);
      });
    } catch (err) {
      console.warn('Product view not recorded:', err);
    }
  }).current;

  const load = useCallback(async () => {
    if (!companyId) { setError('No company selected.'); setLoading(false); return; }
    // First load shows the skeleton; a re-read on focus happens behind the page.
    if (!hasData.current) setLoading(true);
    setError('');
    try {
      const c = await getPublicCompany(companyId);
      if (!c) throw new Error('This company is not available.');
      setCompany(c);
      hasData.current = true;
    } catch (err: any) {
      if (!hasData.current) {
        setError(err?.response ? errorMessage(err, 'Could not load this company.') : String(err?.message || 'Could not load this company.'));
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleTrust = async () => {
    if (!company || busy) return;
    const was = company?.isTrusted === true;
    const before = Number(company?.trustedBy || 0);
    setBusy(true);
    // Optimistic, like the website — rolled back if the server refuses.
    setCompany((c) => (c ? { ...c, isTrusted: !was, trustedBy: Math.max(0, before + (was ? -1 : 1)) } : c));
    try {
      const res = was ? await removeFromTrustList(company._id) : await addToTrustList(company._id);
      setCompany((c) => (c ? { ...c, isTrusted: !!res?.isTrusted, trustedBy: Number(res?.trustedBy ?? c.trustedBy ?? 0) } : c));
    } catch (err) {
      setCompany((c) => (c ? { ...c, isTrusted: was, trustedBy: before } : c));
      Alert.alert('Trust list', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const open = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Cannot open', url));
  };

  if (loading) return <BizStatePage title="Company" eyebrow="On the ACTIV Network" onBack={() => navigation.goBack()} />;
  if (error || !company) return <BizStatePage title="Company" eyebrow="On the ACTIV Network" onBack={() => navigation.goBack()} error={error} onRetry={load} />;

  const banner = company?.banner ? resolveMediaUrl(company.banner) : '';
  const logo = company?.logo ? resolveMediaUrl(company.logo) : '';
  const products = (company?.products || []).filter((p) => p && p._id);
  const phone = String(company?.mobileNumber || '').replace(/[^\d+]/g, '');
  const place = [company?.area, company?.location].filter(Boolean).join(', ');
  const categories = (company?.productCategories || []).filter((c) => c && c.description);
  const { schemes, explicitlyNone } = governmentSchemes(company?.govtSchemes);
  const isOwner = company?.isOwner === true;
  isOwnerRef.current = isOwner;
  const trustedBy = Number(company?.trustedBy || 0);
  const trusted = company?.isTrusted === true;
  // The website's one-line "who are you" — type, constitution, headline category.
  const whoLine = [company?.businessType, company?.constitutionType, categories[0]?.description].filter(Boolean).join(' · ');

  const header = (
    <View>
      <BrandHeaderBlock tone="business" waveHeight={60}>
        <BrandTopBar
          onBack={() => navigation.goBack()}
          title="Company"
          right={<CompanyShareButton company={company} source="public" compact appearance="glass" />}
        />
        <FadeInUp delay={80} distance={12} style={styles.coverWrap}>
          <CoverHero
            banner={banner}
            logo={logo}
            name={company?.businessName || 'Company'}
            subtitle={whoLine || 'Business'}
            badges={(
              <>
                {isOwner ? <GlassTag icon="person" label="Your company" /> : null}
                {trusted ? <GlassTag icon="verified-user" label="Trusted" /> : null}
              </>
            )}
          />
        </FadeInUp>
      </BrandHeaderBlock>

      {/* ---- at a glance */}
      <FadeInUp delay={180} style={styles.overlap}>
        <LiftCard tone="business" style={styles.gutter}>
          <View style={styles.facts}>
            <Fact icon="inventory-2" label="Products" count={products.length} />
            <View style={styles.factDivider} />
            <Fact icon="groups" label="Trusted by" count={trustedBy} />
            <View style={styles.factDivider} />
            <Fact icon="badge" label="Employees" value={company?.numberOfEmployees ? String(company.numberOfEmployees) : '—'} />
          </View>
          {place ? (
            <View style={styles.placeRow}>
              <Icon name="place" size={16} color={PALETTE.textFaint} />
              <Text style={styles.placeText} maxFontSizeMultiplier={1.3}>{place}</Text>
            </View>
          ) : null}
        </LiftCard>
      </FadeInUp>

      {/* ---- trust */}
      <FadeInUp delay={240}>
        <LiftCard tone="business" style={[styles.gutter, styles.block]}>
          <View style={styles.trustRow}>
            <TrustStar
              trusted={trusted}
              busy={busy}
              disabled={isOwner}
              onPress={toggleTrust}
              size={52}
              accessibilityLabel={isOwner ? 'Your own company' : undefined}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.trustTitle} maxFontSizeMultiplier={1.3}>Trusted by {trustedBy} member{trustedBy === 1 ? '' : 's'}</Text>
              <Text style={styles.trustSub} maxFontSizeMultiplier={1.3}>{isOwner ? 'This is your company — this is how other members see it.' : trusted ? 'On your trust list' : 'Add companies you have done business with'}</Text>
            </View>
          </View>
          {!isOwner ? (
            <GradientButton tone="business"
              label={trusted ? 'Remove from trust list' : 'Add to trust list'}
              icon={trusted ? 'remove-moderator' : 'add-moderator'}
              variant={trusted ? 'outline' : 'primary'}
              onPress={toggleTrust}
              disabled={busy}
              style={{ marginTop: SPACE.lg }}
            />
          ) : null}
        </LiftCard>
      </FadeInUp>

      {/* ---- contact, with the real marks */}
      {(phone || company?.email) ? (
        <FadeInUp delay={300} style={styles.contactRow}>
          {phone ? <ContactAction kind="call" onPress={() => open(`tel:${phone}`)} /> : null}
          {phone ? (
            <ContactAction
              kind="whatsapp"
              onPress={() => {
                const digits = phone.replace(/\D/g, '');
                open(`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`);
              }}
            />
          ) : null}
          {company?.email ? <ContactAction kind="email" onPress={() => open(`mailto:${company.email}`)} /> : null}
        </FadeInUp>
      ) : null}

      {/* ---- about */}
      <BizSectionTitle title="About" />
      <LiftCard tone="business" style={styles.gutter}>
        {company?.description ? <Text style={styles.about} maxFontSizeMultiplier={1.3}>{company.description}</Text> : null}
        {!company?.description ? (
          <Text style={styles.about} maxFontSizeMultiplier={1.3}>{company?.businessActivities || 'This company has not written an overview yet.'}</Text>
        ) : null}
        <InfoRow label="Type of business" value={company?.businessType} />
        <InfoRow label="Business activities" value={company?.businessActivities} />
        <InfoRow label="Constitution" value={company?.constitutionType} />
        <InfoRow label="Employees" value={company?.numberOfEmployees} />
        <InfoRow label="Location" value={place} />
        {company?.memberOfOtherChamber ? <InfoRow label="Other chamber" value={company?.otherChamber || 'Yes'} /> : null}
        <InfoRow label="On ACTIV since" value={monthYear(company?.createdAt)} last={!categories.length && !(company?.govtRegistrations || []).length && !(company?.govtSchemes || []).length} />
        {categories.length ? (
          <View style={styles.tagsBlock}>
            <Text style={styles.tagsLabel}>Product categories</Text>
            <View style={{ gap: SPACE.sm }}>
              {categories.map((c, i) => (
                <View key={`${c?.code || 'c'}-${i}`} style={styles.catRow}>
                  <Icon name={c?.industryType === 'Manufacturing' ? 'precision-manufacturing' : 'category'} size={16} color={PALETTE.violet} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catTitle} maxFontSizeMultiplier={1.3}>{c?.description || ''}</Text>
                    <Text style={styles.catMeta} maxFontSizeMultiplier={1.3}>{c?.code ? `NIC ${c.code}${c?.industryType ? ` · ${c.industryType}` : ''}` : 'Custom category'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {(company?.govtRegistrations || []).length ? (
          <View style={styles.tagsBlock}>
            <Text style={styles.tagsLabel}>Registered with</Text>
            <View style={styles.tags}>{(company?.govtRegistrations || []).map((t) => <Badge key={t} label={t} icon="verified" color={PALETTE.violetDark} bg={PALETTE.violetSoft} />)}</View>
          </View>
        ) : null}
        {schemes.length || explicitlyNone ? (
          <View style={styles.tagsBlock}>
            <Text style={styles.tagsLabel}>Schemes availed</Text>
            {schemes.length ? <View style={styles.tags}>{schemes.map((t) => <Badge key={t} label={t} color={PALETTE.greenDark} bg={PALETTE.greenSoft} />)}</View>
              : <Text style={TYPE.body}>No government schemes availed.</Text>}
          </View>
        ) : null}
      </LiftCard>

      <BizSectionTitle title={`Products & services (${products.length})`} />
    </View>
  );

  return (
    <>
    <BrandFrame tone="business" safeBottom>
      <FlatList
        data={products}
        keyExtractor={(item, index) => String(item?._id || index)}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: SPACE.lg, justifyContent: 'space-between' }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: SPACE.huge }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <LiftCard tone="business" style={styles.gutter}>
            <ArtEmptyState tone="business"
              compact
              art={<ProductCrate3D tone="business" size={76} />}
              title={isOwner ? 'Nothing listed yet' : 'No catalogue yet'}
              message={isOwner ? 'Add products so other members can find you by what you sell.' : 'This company has not published a catalogue.'}
              action={isOwner ? 'Add a product' : undefined}
              actionIcon="add"
              onAction={isOwner ? () => navigation.navigate('AddProduct', { companyId: company?._id || companyId }) : undefined}
            />
          </LiftCard>
        }
        renderItem={({ item, index }) => <ProductCard item={item} onOpen={() => setAlbumAt(index)} />}
      />
    </BrandFrame>
    <CatalogueAlbum
      items={products}
      startIndex={albumAt}
      tone="business"
      onClose={() => setAlbumAt(null)}
      onProductShown={(it) => {
        if (isOwnerRef.current || !it.key || seenProducts.current.has(it.key)) return;
        seenProducts.current.add(it.key);
        recordProductView(it.key);
      }}
    />
    </>
  );
};

const styles = StyleSheet.create({
  coverWrap: { marginTop: SPACE.md, marginBottom: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  block: { marginTop: SPACE.md },
  facts: { flexDirection: 'row', alignItems: 'stretch' },
  fact: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  factDivider: { width: 1, backgroundColor: PALETTE.divider, marginVertical: SPACE.xs },
  factValue: { ...TYPE.number, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  factLabel: { ...TYPE.caption, fontSize: 11, lineHeight: 14 },
  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  placeText: { ...TYPE.caption, color: PALETTE.textSoft, flex: 1, minWidth: 0 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  trustTitle: { ...TYPE.subheading },
  trustSub: { ...TYPE.caption, marginTop: SPACE.xxs },
  contactRow: { flexDirection: 'row', gap: SPACE.md, paddingHorizontal: SPACE.lg, marginTop: SPACE.md },
  about: { ...TYPE.body, lineHeight: 21, marginBottom: SPACE.xs },
  tagsBlock: { paddingTop: SPACE.md },
  tagsLabel: { ...TYPE.eyebrow, marginBottom: SPACE.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  // Shadow on the card, no overflow clip: the image rounds its own top corners.
  product: {
    width: '48.5%', backgroundColor: PALETTE.card, borderRadius: 18, marginBottom: SPACE.md,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  productImgWrap: { borderTopLeftRadius: 17, borderTopRightRadius: 17, overflow: 'hidden' },
  productImg: { width: '100%', aspectRatio: 4 / 3, backgroundColor: PALETTE.field },
  productImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  stockChip: { position: 'absolute', left: SPACE.sm, top: SPACE.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(46,16,101,0.62)' },
  stockChipText: { color: PALETTE.white, fontSize: 10, lineHeight: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  productBody: { flex: 1, padding: SPACE.md },
  productName: { ...TYPE.bodyStrong },
  productCat: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs },
  productDesc: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xs },
  // Pinned to the bottom so prices line up across a row, whatever the text above.
  productFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, marginTop: 'auto', paddingTop: SPACE.sm },
  priceChip: { paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: 999, maxWidth: '100%' },
  priceText: { color: PALETTE.white, fontSize: 13, lineHeight: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, padding: SPACE.md, borderRadius: 14, backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  catTitle: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18 },
  catMeta: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xxs, fontVariant: ['tabular-nums'] },
});

export default CompanyPublicScreen;
