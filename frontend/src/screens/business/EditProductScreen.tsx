import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../../types';
import {
  BottomActionBar, Notice, ToggleRow, PALETTE, SPACE, TYPE, money,
  BrandScrollPage, BrandTopBar, BrandHero, PREMIUM_OVERLAP, FadeInUp, PremiumSection, PremiumInput,
  GradientButton, PressableScale, GrowBar, ProductCrate3D,
} from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import {
  getProduct, updateProduct, deleteProduct, setProductPublished, errorMessage, Product,
} from '../../services/businessApi';
import { BizStatePage, GlassTag, PhotoWell } from './businessKit';
import { ChipChoice, Label } from './companyForm/controls';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProduct'>;

/**
 * EDIT A PRODUCT — the website's /business/edit-product/:id, plus the publish
 * switch and stock shortcut the website's Products/Stock pages carry.
 *
 *   GET    /products/:id              load
 *   PUT    /products/:id  (multipart) name, description, category, price, sku,
 *                                     minStock, image (only when a new one is picked)
 *   PATCH  /products/:id/publish      { published }  — shown to other members or hidden
 *   DELETE /products/:id
 *
 * Stock is NOT edited here as a plain number: changes go through the stock log
 * (POST /products/:id/stock) on the Stock screen, like the website, so every
 * movement is recorded.
 */

/** The same list the website uses (website/src/lib/productCategories.ts). */
const CATEGORIES = [
  'Software', 'Services', 'Education', 'Product', 'Hardware', 'Electronics', 'Clothing',
  'Food', 'Books', 'Toys', 'Furniture', 'Sports', 'Beauty', 'Other',
];

const normalizeCategory = (value?: string | null) => {
  const raw = String(value || '').trim().toLowerCase();
  return CATEGORIES.find((c) => c.toLowerCase() === raw) || '';
};

type PickedImage = { uri: string; type?: string; name?: string } | null;

const EditProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const productId = route?.params?.productId || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [featuring, setFeaturing] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [minStock, setMinStock] = useState('');
  const [image, setImage] = useState<PickedImage>(null);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const load = useCallback(async () => {
    if (!productId) { setError('No product selected.'); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const p = await getProduct(productId);
      if (!p) throw new Error('Product not found');
      setProduct(p);
      setName(p?.name || '');
      setDescription(p?.description || '');
      setCategory(normalizeCategory(p?.category));
      setPrice(String(p?.price ?? ''));
      setSku(p?.sku || '');
      setMinStock(Number(p?.minStock || 0) > 0 ? String(p?.minStock) : '');
    } catch (err: any) {
      setError(err?.response ? errorMessage(err, 'Could not load this product.') : String(err?.message || 'Could not load this product.'));
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const pickImage = () => {
    try {
      if (typeof launchImageLibrary !== 'function') {
        Alert.alert('Unavailable', 'The photo picker is not available on this device.');
        return;
      }
      launchImageLibrary(
        { mediaType: 'photo', maxWidth: 1200, maxHeight: 1200, quality: 0.8, selectionLimit: 1 },
        (res) => {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            Alert.alert('Error', res?.errorMessage || 'Could not open the photo.');
            return;
          }
          const a = (res?.assets || [])[0];
          if (!a?.uri) return;
          if (Number(a?.fileSize || 0) > 5 * 1024 * 1024) {
            Alert.alert('Image too large', 'Please choose an image under 5 MB.');
            return;
          }
          setImage({ uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || 'product.jpg' });
        },
      );
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const save = async () => {
    const e: { name?: string; price?: string } = {};
    if (!(name || '').trim()) e.name = 'A product needs a name';
    const priceNum = parseFloat(price || '');
    if (!Number.isFinite(priceNum) || priceNum < 0) e.price = 'Enter a valid price';
    setErrors(e);
    if (e.name || e.price) return;

    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('description', (description || '').trim());
      if (category) form.append('category', category);
      if ((sku || '').trim()) form.append('sku', sku.trim());
      form.append('price', String(priceNum));
      form.append('minStock', String(Math.max(0, parseInt(minStock || '0', 10) || 0)));
      if (image?.uri) {
        form.append('image', { uri: image.uri, type: image.type || 'image/jpeg', name: image.name || 'product.jpg' } as any);
      }
      await updateProduct(productId, form);
      Alert.alert('Saved', 'Product updated.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert('Not saved', errorMessage(err, 'Failed to update the product.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (next: boolean) => {
    setPublishing(true);
    try {
      await setProductPublished(productId, next);
      setProduct((p) => (p ? { ...p, isActive: next } : p));
    } catch (err) {
      Alert.alert('Not changed', errorMessage(err));
    } finally {
      setPublishing(false);
    }
  };

  const remove = () => {
    Alert.alert('Delete product', `Delete "${product?.name || 'this product'}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(productId);
            navigation.goBack();
          } catch (err) {
            Alert.alert('Not deleted', errorMessage(err));
          }
        },
      },
    ]);
  };

  // Featured: `isFeatured` is on the product and counted by /products/stats
  // ("Featured" on the dashboard), but no screen could set it. PUT
  // /products/:id updates only the fields present, so this sends the flag alone.
  const toggleFeatured = async (next: boolean) => {
    setFeaturing(true);
    try {
      const form = new FormData();
      form.append('isFeatured', next ? 'true' : 'false');
      await updateProduct(productId, form);
      setProduct((p) => (p ? { ...p, isFeatured: next } : p));
    } catch (err) {
      Alert.alert('Not changed', errorMessage(err, 'Could not change whether this is featured.'));
    } finally {
      setFeaturing(false);
    }
  };

  if (loading) return <BizStatePage title="Edit product" eyebrow="Your catalogue" onBack={() => navigation.goBack()} />;
  if (error || !product) {
    return <BizStatePage title="Edit product" eyebrow="Your catalogue" onBack={() => navigation.goBack()} error={error} onRetry={load} />;
  }

  const preview = image?.uri || (product?.imageUrl ? resolveMediaUrl(product.imageUrl) : '');
  const published = product?.isActive !== false;
  const featured = product?.isFeatured === true;
  const stock = Number(product?.stock || 0);
  const min = Number(product?.minStock || 0);
  const stockState = stock <= 0 ? 'Out of stock' : min > 0 && stock <= min ? 'Running low' : 'In stock';

  return (
    <BrandScrollPage tone="business"
      footer={(
        <BottomActionBar>
          <GradientButton tone="business" label="Save changes" icon="check" onPress={save} loading={saving} style={{ flex: 1 }} />
        </BottomActionBar>
      )}
      header={(
        <View style={styles.headerPad}>
          <BrandTopBar onBack={() => navigation.goBack()} title="Edit product" />
          <BrandHero
            eyebrow="Your catalogue"
            title={product?.name || 'Edit product'}
            subtitle={`${published ? 'Published' : 'Hidden'} · ${money(Number(product?.price || 0))}`}
            art={<ProductCrate3D tone="business" size={88} />}
            artSize={88}
          >
            <View style={styles.headTags}>
              <GlassTag icon={published ? 'visibility' : 'visibility-off'} label={published ? 'Published' : 'Hidden'} />
              <GlassTag icon="inventory" label={`${stock} in stock`} />
              {featured ? <GlassTag icon="star" label="Featured" /> : null}
            </View>
          </BrandHero>
        </View>
      )}
    >
      {/* ---- photo (4:3, the same ratio as Add product) */}
      <FadeInUp delay={160} style={styles.overlap}>
        <PremiumSection tone="business" icon="photo-camera" title="Photo" subtitle="Tap to change it">
          <PhotoWell uri={preview} onPress={pickImage} />
        </PremiumSection>
      </FadeInUp>

      {/* ---- visibility + stock */}
      <FadeInUp delay={220}>
        <PremiumSection tone="business" icon="tune" title="Visibility & stock" subtitle="Saved as soon as you switch">
          <ToggleRow tone="business"
            icon={published ? 'visibility' : 'visibility-off'}
            title={published ? 'Published' : 'Hidden'}
            subtitle={published ? 'Other members see it in ACTIV Network and on your company page.' : 'Only you can see it.'}
            value={published}
            onValueChange={togglePublish}
            disabled={publishing}
          />
          <ToggleRow tone="business"
            icon={featured ? 'star' : 'star-outline'}
            title="Featured"
            subtitle={featured ? 'Promoted first on your company page and in ACTIV Network.' : 'Promote this item ahead of the rest of your catalogue.'}
            value={featured}
            onValueChange={toggleFeatured}
            disabled={featuring}
          />
          <PressableScale
            onPress={() => navigation.navigate('StockCentre', { productId })}
            contentStyle={styles.stockRow}
            accessibilityRole="button"
            accessibilityLabel={`${stock} in stock. Add, remove or count stock`}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.stockHead}>
                <Text style={styles.stockTitle} maxFontSizeMultiplier={1.3}>{`${stock} in stock`}</Text>
                <Text style={[styles.stockState, { color: stock <= 0 ? PALETTE.redDark : min > 0 && stock <= min ? PALETTE.amberDark : PALETTE.greenDark }]} maxFontSizeMultiplier={1.3}>{stockState}</Text>
              </View>
              <GrowBar
                progress={min > 0 ? Math.min(1, stock / (min * 3)) : stock > 0 ? 1 : 0}
                colors={stock <= 0 ? ['#F87171', '#B91C1C'] : min > 0 && stock <= min ? ['#FBBF24', '#B45309'] : ['#34D399', '#047857']}
                style={{ marginTop: SPACE.sm }}
              />
              <Text style={styles.stockSub} maxFontSizeMultiplier={1.3}>Add, remove or count stock — every change is logged</Text>
            </View>
            <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
          </PressableScale>
          {!published ? <Notice kind="warning" text="This product is hidden. Turn on Published to show it to other members." style={{ marginHorizontal: 0, marginTop: SPACE.md, marginBottom: 0 }} /> : null}
        </PremiumSection>
      </FadeInUp>

      {/* ---- details */}
      <FadeInUp delay={280}>
        <PremiumSection tone="business" icon="sell" title="Details" subtitle="Saved with Save changes">
          <PremiumInput tone="business" label="Product name" required value={name} onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }} error={errors.name} icon="sell" />
          <PremiumInput tone="business" label="Price (₹)" required value={price} onChangeText={(t) => { setPrice((t || '').replace(/[^0-9.]/g, '')); setErrors((e) => ({ ...e, price: undefined })); }} keyboardType="decimal-pad" error={errors.price} icon="currency-rupee" hint={price ? `Shown as ${money(Number(price))}` : undefined} />
          <Label text="Category" />
          <ChipChoice options={CATEGORIES} value={category} onChange={setCategory} />
          <PremiumInput tone="business" label="SKU (optional)" value={sku} onChangeText={setSku} autoCapitalize="characters" icon="qr-code" />
          <PremiumInput tone="business" label="Low-stock warning at (optional)" value={minStock} onChangeText={(t) => setMinStock((t || '').replace(/[^0-9]/g, ''))} keyboardType="number-pad" icon="notifications-active" hint="You are warned when stock falls to this number." />
          <PremiumInput tone="business" label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ marginBottom: 0 }} />
        </PremiumSection>
      </FadeInUp>

      {/* ---- danger zone: kept out of the sticky bar so it is never a mis-tap away from Save */}
      <PressableScale onPress={remove} style={styles.gutter} contentStyle={styles.danger} accessibilityRole="button" accessibilityLabel="Delete product">
        <Icon name="delete-outline" size={20} color={PALETTE.redDark} />
        <Text style={styles.dangerText} maxFontSizeMultiplier={1.3}>Delete product</Text>
      </PressableScale>
    </BrandScrollPage>
  );
};

const styles = StyleSheet.create({
  headerPad: { paddingBottom: SPACE.sm },
  headTags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md, marginBottom: SPACE.sm },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.md, padding: SPACE.md, borderRadius: 16, backgroundColor: PALETTE.violetTint, borderWidth: 1, borderColor: PALETTE.violetBorder },
  stockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  stockTitle: { ...TYPE.bodyStrong, fontVariant: ['tabular-nums'] },
  stockState: { ...TYPE.caption, fontWeight: '700' },
  stockSub: { ...TYPE.caption, marginTop: SPACE.sm },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, minHeight: 52, borderRadius: 999, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  dangerText: { color: PALETTE.redDark, fontSize: 15, lineHeight: 20, fontWeight: '700' },
});

export default EditProductScreen;
