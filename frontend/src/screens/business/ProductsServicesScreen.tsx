import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { ENDPOINTS, resolveMediaUrl } from '../../config/api.config';
import { useActiveCompany, useActiveCompanyStore } from '../../stores/activeCompanyStore';
import { BusinessTabBar } from './BusinessTabBar';
import CatalogueAlbum from '../../components/CatalogueAlbum';
import { Notice, Badge, SPACE, money, BrandFrame, BrandHeaderBlock, BrandTopBar, BrandHero, GlassIconButton, GlassFigure, PREMIUM_OVERLAP, FadeInUp, LiftCard, LiftSearchBar, ArtEmptyState, ProductCrate3D, SearchLens3D, PressableScale, FitImage } from '../../ui';
import { BUSINESS_TAB_ROUTES, CardSkeletons, CHIP } from './businessKit';

type ProductsServicesScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProductsServices'
>;
type ProductsServicesScreenRouteProp = RouteProp<RootStackParamList, 'ProductsServices'>;

interface Props {
  navigation: ProductsServicesScreenNavigationProp;
}

interface Product {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  companyId?: string | { _id?: string };
}

const ProductsServicesScreen: React.FC<Props> = ({ navigation }) => {
  const { palette: PALETTE, type: TYPE } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const route = useRoute<ProductsServicesScreenRouteProp>();
  const { companyId: routeCompanyId } = route.params || {};

  const selectedCompany = useActiveCompany();
  const setActiveCompany = useActiveCompanyStore((state) => state.setActiveCompany);
  const loadCompanies = useActiveCompanyStore((state) => state.loadCompanies);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Website Products.tsx: a search over name + description, and a load failure
  // that SAYS so rather than rendering as an empty catalogue.
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');
  const [albumAt, setAlbumAt] = useState<number | null>(null);

  // Bumped every time the screen regains focus. The data effects below key off
  // it as well as the company id, so returning here after creating, editing or
  // deleting something re-reads from the server instead of showing the copy
  // fetched the first time this company was selected.
  const [focusTick, setFocusTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusTick((tick) => tick + 1);
      // A route param is an explicit switch (e.g. "Products" from Manage
      // Companies) — it becomes the new active company everywhere.
      if (routeCompanyId) {
        setActiveCompany(routeCompanyId);
      }
      loadCompanies();
    }, [routeCompanyId, setActiveCompany, loadCompanies])
  );

  useEffect(() => {
    const companyId = selectedCompany?._id;
    if (!companyId) {
      setProducts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchProductsForCompany(companyId).finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?._id, focusTick]);

  const fetchProductsForCompany = async (targetCompanyId: string) => {
    if (!targetCompanyId) return;
    try {
      const response = await api.get(ENDPOINTS.PRODUCTS.LIST, {
        params: { companyId: targetCompanyId },
      });

      const payload = response.data?.data || [];
      setLoadError('');
      // Belt and braces: the server already scopes by companyId, but never let
      // a stale/mismatched row from another company render here.
      setProducts(
        (Array.isArray(payload) ? payload : []).filter((p: any) => {
          const owner = typeof p?.companyId === 'object' ? p?.companyId?._id : p?.companyId;
          return !owner || String(owner) === String(targetCompanyId);
        })
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      setLoadError('Failed to load products. Pull back and try again.');
    }
  };

  const filteredProducts = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const list = products || [];
    if (!q) return list;
    return list.filter((p) =>
      (p?.name || '').toLowerCase().includes(q) || (p?.description || '').toLowerCase().includes(q));
  }, [products, searchQuery]);

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await api.delete(ENDPOINTS.PRODUCTS.DELETE(product._id));
              Alert.alert('Success', 'Product deleted successfully');
              if (selectedCompany?._id) {
                fetchProductsForCompany(selectedCompany._id);
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete product.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };


  const goAdd = () =>
    selectedCompany?._id
      ? navigation.navigate('AddProduct', { companyId: selectedCompany._id })
      : Alert.alert('Notice', 'Please select or create a company profile first.');

  const totalViews = (products || []).reduce((n, p: any) => n + Number(p?.views || 0), 0);
  const hasProducts = (products || []).length > 0;
  const liveCount = (products || []).filter((p: any) => p?.isActive !== false).length;

  const header = (
    <View>
      <BrandHeaderBlock tone="business">
        <BrandTopBar
          onBack={() => navigation.goBack()}
          title="Products & Services"
          right={<GlassIconButton icon="add" onPress={goAdd} accessibilityLabel="Add product" />}
        />
        <BrandHero
          eyebrow="Active catalogue"
          title={selectedCompany?.businessName || 'No company selected'}
          subtitle="What buyers see in ACTIV Network and on your company page."
          art={<ProductCrate3D tone="business" size={92} />}
          artSize={92}
        >
          {/* Real views from the products themselves. */}
          <View style={styles.figures}>
            <GlassFigure icon="inventory-2" value={String((products || []).length)} label="Products" />
            <GlassFigure icon="check-circle" value={String(liveCount)} label="Published" />
            <GlassFigure icon="visibility" value={totalViews.toLocaleString('en-IN')} label="Views" />
          </View>
        </BrandHero>
      </BrandHeaderBlock>

      <View style={styles.overlap}>
        {hasProducts ? (
          <LiftSearchBar tone="business"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or description…"
            style={styles.gutter}
          />
        ) : null}
        <View style={styles.listHead}>
          <Text style={styles.listTitle} maxFontSizeMultiplier={1.3}>{`Catalogue items (${(products || []).length})`}</Text>
          <PressableScale onPress={goAdd} contentStyle={styles.addPill} accessibilityRole="button" accessibilityLabel="Add product">
            <Icon name="add" size={16} color={PALETTE.white} />
            <Text style={styles.addPillText} maxFontSizeMultiplier={1.2}>Add</Text>
          </PressableScale>
        </View>
      </View>

      {loadError && !isLoading ? (
        <Notice
          kind="danger"
          text={loadError}
          action="Retry"
          onAction={() => setFocusTick((t) => t + 1)}
          style={{ marginTop: 0, marginBottom: SPACE.md }}
        />
      ) : null}
    </View>
  );

  const tips = hasProducts ? (
    <LiftCard tone="business" style={styles.tips}>
      <View style={styles.tipsHead}>
        <LinearGradient colors={CHIP.amber} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tipsIcon}>
          <Icon name="lightbulb-outline" size={18} color={PALETTE.white} />
        </LinearGradient>
        <Text style={TYPE.heading}>Quick tips</Text>
      </View>
      {['Add clear photos and descriptions', 'Set competitive prices', 'Keep your catalog updated'].map((t) => (
        <View key={t} style={styles.tipRow}>
          <Icon name="check-circle" size={16} color={PALETTE.green} />
          <Text style={[TYPE.body, { flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </LiftCard>
  ) : null;

  const empty = isLoading ? (
    <CardSkeletons rows={3} tall />
  ) : hasProducts && filteredProducts.length === 0 ? (
    <LiftCard tone="business" style={styles.gutter}>
      <ArtEmptyState tone="business" compact art={<SearchLens3D tone="business" size={74} />} title="No products match your search" message="Try a different name or description." />
    </LiftCard>
  ) : (
    <LiftCard tone="business" style={styles.gutter}>
      <ArtEmptyState tone="business"
        compact
        art={<ProductCrate3D tone="business" size={76} />}
        title="No products yet"
        message="Add products to start showcasing your business and reach more customers."
        action="Add product"
        actionIcon="add"
        onAction={goAdd}
      />
    </LiftCard>
  );

  return (
    <>
    <BrandFrame tone="business" footer={<BusinessTabBar active="products" onPress={(key) => navigation.navigate(BUSINESS_TAB_ROUTES[key] as any)} />}>
      <FlatList
        data={isLoading ? [] : filteredProducts}
        keyExtractor={(item, index) => String(item?._id || (item as any)?.id || index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={tips}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ItemGap}
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 6) * 60} distance={12}>
            <ProductCard
              product={item}
              onOpen={() => navigation.navigate('EditProduct', { productId: item?._id })}
              onPhoto={() => setAlbumAt(index)}
              onDelete={() => handleDeleteProduct(item)}
            />
          </FadeInUp>
        )}
      />
    </BrandFrame>
    <CatalogueAlbum items={filteredProducts} startIndex={albumAt} tone="business" onClose={() => setAlbumAt(null)} />
    </>
  );
};

function ItemGap() {
  return <View style={{ height: SPACE.md }} />;
}

/** Stock level → the chip's colours (the Stock screen's rule). */
function stockTone(stock: number, min: number, PALETTE: AppTheme['palette']) {
  if (stock <= 0) return { fg: PALETTE.redDark, bg: PALETTE.redSoft, icon: 'remove-shopping-cart', label: 'Out of stock' };
  if (min > 0 && stock <= min) return { fg: PALETTE.amberDark, bg: PALETTE.amberSoft, icon: 'trending-down', label: `${stock} left` };
  return { fg: PALETTE.greenDark, bg: PALETTE.greenSoft, icon: 'layers', label: `${stock} in stock` };
}

/** One catalogue line: photo, name + category, status, then price and stock chips. */
function ProductCard({ product, onOpen, onDelete, onPhoto }: { product: Product; onOpen: () => void; onDelete: () => void; onPhoto: () => void }) {
  const { palette: PALETTE, type: TYPE, premiumTone } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const p = premiumTone('business');
  const hidden = (product as any)?.isActive === false;
  const img = product?.imageUrl ? resolveMediaUrl(product.imageUrl) : '';
  const stock = Number(product?.stock || 0);
  const st = stockTone(stock, Number((product as any)?.minStock || 0), PALETTE);
  return (
    <LiftCard tone="business" style={styles.productCard}>
      <View style={styles.productTop}>
        <PressableScale onPress={onPhoto} accessibilityRole="button" accessibilityLabel={`View photos of ${product?.name || 'product'}`}>
          {img ? (
            <FitImage uri={img} style={styles.thumb} />
          ) : (
            <LinearGradient colors={[PALETTE.violetSoft, PALETTE.violetTint]} style={[styles.thumb, styles.thumbEmpty]}>
              <Icon name="inventory-2" size={26} color={p.accent} />
            </LinearGradient>
          )}
        </PressableScale>
        <PressableScale onPress={onOpen} style={styles.productOpen} contentStyle={styles.productTop} accessibilityRole="button" accessibilityLabel={`Edit ${product?.name || 'product'}`}>
        <View style={styles.productText}>
          <Text style={styles.productName} numberOfLines={2} maxFontSizeMultiplier={1.3}>{product?.name || 'Untitled product'}</Text>
          <Text style={TYPE.caption} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {product?.category || 'General'}{product?.sku ? ` · SKU ${product.sku}` : ''}
          </Text>
          <Badge label={hidden ? 'Hidden' : 'Published'} status={hidden ? 'pending' : 'published'} size="sm" dot style={{ marginTop: SPACE.xs, alignSelf: 'flex-start' }} />
        </View>
        </PressableScale>
        <PressableScale onPress={onDelete} scaleTo={0.9} contentStyle={styles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Delete ${product?.name || 'product'}`} hitSlop={4}>
          <Icon name="delete-outline" size={20} color={PALETTE.danger} />
        </PressableScale>
      </View>

      {product?.description ? (
        <Text style={styles.productDesc} numberOfLines={3} maxFontSizeMultiplier={1.3}>{product.description}</Text>
      ) : null}

      <View style={styles.productFoot}>
        <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.priceChip}>
          <Text style={styles.price} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(Number(product?.price || 0))}</Text>
        </LinearGradient>
        <View style={[styles.stockPill, { backgroundColor: st.bg }]}>
          <Icon name={st.icon} size={14} color={st.fg} />
          <Text style={[styles.stockText, { color: st.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{st.label}</Text>
        </View>
      </View>
    </LiftCard>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  listContent: { paddingBottom: SPACE.xxl },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  figures: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, marginHorizontal: SPACE.lg, marginTop: SPACE.lg, marginBottom: SPACE.md },
  listTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 22, flex: 1, minWidth: 0 },
  addPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: SPACE.md, borderRadius: 999, backgroundColor: PALETTE.violet },
  addPillText: { color: PALETTE.white, fontSize: 13, lineHeight: 18, fontWeight: '800' },

  productCard: { marginHorizontal: SPACE.lg },
  productOpen: { flex: 1, minWidth: 0 },
  productTop: { flexDirection: 'row', alignItems: 'flex-start' },
  thumb: { width: 76, height: 76, borderRadius: 16, backgroundColor: PALETTE.field },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  productText: { flex: 1, minWidth: 0, marginLeft: SPACE.md, gap: SPACE.xxs },
  productName: { ...TYPE.subheading },
  deleteBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.dangerSoft, marginLeft: SPACE.sm },
  productDesc: { ...TYPE.body, marginTop: SPACE.md },
  productFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  priceChip: { paddingHorizontal: SPACE.md, paddingVertical: 6, borderRadius: 999, maxWidth: '60%' },
  price: { color: PALETTE.white, fontSize: 14, lineHeight: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stockPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.sm + 2, paddingVertical: 5, borderRadius: 999, flexShrink: 1 },
  stockText: { fontSize: 12, lineHeight: 16, fontWeight: '700', fontVariant: ['tabular-nums'], flexShrink: 1 },

  tips: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md },
  tipsIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.xs },
});

export default ProductsServicesScreen;
