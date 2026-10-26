import { useAppTheme, useThemeStyles } from '../../ui/AppTheme';
import type { AppTheme } from '../../ui/AppTheme';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../../types';
import { BottomActionBar, Notice, SPACE, money, BrandScrollPage, BrandTopBar, BrandHero, PREMIUM_OVERLAP, FadeInUp, PremiumSection, PremiumInput, GradientButton, ProductCrate3D, FitImage } from '../../ui';
import api from '../../services/api';
import { errorMessage } from '../../services/businessApi';
import { useActiveCompany } from '../../stores/activeCompanyStore';
import { PhotoWell } from './businessKit';

type Props = NativeStackScreenProps<RootStackParamList, 'AddProduct'>;

/**
 * ADD A PRODUCT / SERVICE — the website's /business/add-product, same request:
 *
 *   POST /products  (multipart)  companyId, name, description, price, image
 *
 * Nothing else. No category (the server falls back to the company's NIC
 * category), no stock (stock moves through the logged Stock screen), no
 * invented SKU — all three are edited later on Edit product. `companyId` is
 * always sent: without it the server files the product under the member's
 * NEWEST company rather than the one they are working on.
 */

type PickedImage = { uri: string; type: string; name: string } | null;

const AddProductScreen: React.FC<Props> = ({ navigation, route }) => {
  const { palette: PALETTE, premiumTone } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const activeCompany = useActiveCompany();
  const companyId = String(route?.params?.companyId || activeCompany?._id || '');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<PickedImage>(null);
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [saving, setSaving] = useState(false);

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
          if (a?.type && !String(a.type).startsWith('image/')) {
            Alert.alert('Not an image', 'Please choose an image file.');
            return;
          }
          if (Number(a?.fileSize || 0) > 5 * 1024 * 1024) {
            Alert.alert('Image too large', 'Please choose an image under 5 MB.');
            return;
          }
          setImage({ uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `product-${Date.now()}.jpg` });
        },
      );
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const save = async () => {
    if (saving) return;
    const e: { name?: string; price?: string } = {};
    if (!(name || '').trim()) e.name = 'Product name is required';
    const priceNum = parseFloat(price || '');
    if (!(price || '').trim()) e.price = 'Price is required';
    else if (!Number.isFinite(priceNum) || priceNum < 0) e.price = 'Please enter a valid price';
    setErrors(e);
    if (e.name || e.price) return;

    setSaving(true);
    try {
      const form = new FormData();
      if (companyId) form.append('companyId', companyId);
      form.append('name', name.trim());
      form.append('description', (description || '').trim());
      form.append('price', String(priceNum));
      if (image?.uri) form.append('image', { uri: image.uri, type: image.type, name: image.name } as any);

      const res = await api.post('/products', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res?.data?.success === false) throw new Error(res?.data?.message || 'Failed to add product');
      Alert.alert('Product added', `${name.trim()} is in your catalogue.`, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert('Not saved', err?.response ? errorMessage(err, 'Failed to add product.') : String(err?.message || 'Failed to add product.'));
    } finally {
      setSaving(false);
    }
  };

  const p = premiumTone('business');
  const priceNum = parseFloat(price || '');
  const priceShown = (price || '').trim() && Number.isFinite(priceNum) ? money(priceNum) : '₹ —';

  return (
    <BrandScrollPage tone="business"
      footer={(
        <BottomActionBar note={!companyId ? 'Select a company before publishing.' : undefined}>
          <GradientButton tone="business" label="Publish product" icon="check" onPress={save} loading={saving} disabled={!companyId} style={{ flex: 1 }} />
        </BottomActionBar>
      )}
      header={(
        <View style={styles.headerPad}>
          <BrandTopBar onBack={() => navigation.goBack()} title="Add product" />
          <BrandHero
            eyebrow={activeCompany?.businessName ? `Adding to ${activeCompany.businessName}` : 'New listing'}
            title="Add product or service"
            subtitle="A photo, a name and a price — that is all it takes to be found."
            art={<ProductCrate3D tone="business" size={92} />}
            artSize={92}
          />
        </View>
      )}
    >
      {!companyId ? (
        <View style={styles.overlap}>
          <Notice kind="warning" text="No active company is selected. Create or switch to a company first." style={{ marginTop: 0, marginBottom: SPACE.md }} />
        </View>
      ) : null}

      <FadeInUp delay={200} style={companyId ? styles.overlap : undefined}>
        <PremiumSection tone="business" icon="photo-camera" title="Photo" subtitle="The first thing a buyer sees">
          <PhotoWell uri={image?.uri} onPress={pickImage} />
        </PremiumSection>
      </FadeInUp>

      <FadeInUp delay={280}>
        <PremiumSection tone="business" icon="sell" title="Details" subtitle="What buyers see in ACTIV Network and on your company page">
          <PremiumInput tone="business"
            label="Product / service name"
            required
            value={name}
            onChangeText={(t) => { setName(t); setErrors((x) => ({ ...x, name: undefined })); }}
            placeholder="Enter product / service name"
            error={errors.name}
            icon="sell"
          />
          <PremiumInput tone="business"
            label="Price (₹)"
            required
            value={price}
            onChangeText={(t) => { setPrice((t || '').replace(/[^0-9.]/g, '')); setErrors((x) => ({ ...x, price: undefined })); }}
            placeholder="0.00"
            keyboardType="decimal-pad"
            error={errors.price}
            icon="currency-rupee"
            hint={price && Number.isFinite(parseFloat(price)) ? `Shown as ${money(Number(price))}` : undefined}
          />
          <PremiumInput tone="business"
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your product features & specifications…"
            multiline
            numberOfLines={4}
            style={{ marginBottom: 0 }}
          />
        </PremiumSection>
      </FadeInUp>

      {/* How it will look — a live preview of the card buyers see. */}
      <FadeInUp delay={340}>
        <PremiumSection tone="business" icon="visibility" title="Preview" subtitle="How it appears to other members">
          <View style={[styles.preview, { shadowColor: p.shadow }]}>
            {image?.uri ? <FitImage uri={image.uri} style={styles.previewImg} /> : (
              <LinearGradient colors={[PALETTE.violetSoft, PALETTE.violetTint]} style={[styles.previewImg, styles.previewEmpty]}>
                <Icon name="inventory-2" size={26} color={p.accent} />
              </LinearGradient>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewName} numberOfLines={2} maxFontSizeMultiplier={1.3}>{(name || '').trim() || 'Your product name'}</Text>
              <Text style={styles.previewCo} numberOfLines={1} maxFontSizeMultiplier={1.3}>{activeCompany?.businessName || 'Your company'}</Text>
              <LinearGradient colors={p.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewPrice}>
                <Text style={styles.previewPriceText} numberOfLines={1} maxFontSizeMultiplier={1.2}>{priceShown}</Text>
              </LinearGradient>
            </View>
          </View>
        </PremiumSection>
      </FadeInUp>

      <Notice kind="info" icon="tips-and-updates" style={{ marginTop: 0 }} text="Category, SKU and low-stock alerts can be set from Edit product. Stock is added on the Stock screen so every movement is logged." />
    </BrandScrollPage>
  );
};

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  headerPad: { paddingBottom: SPACE.md },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  preview: {
    flexDirection: 'row', gap: SPACE.md, padding: SPACE.md, borderRadius: 18, backgroundColor: PALETTE.card,
    borderWidth: 1, borderColor: PALETTE.border, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  previewImg: { width: 84, height: 84, borderRadius: 14, backgroundColor: PALETTE.field },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewName: { ...TYPE.subheading },
  previewCo: { ...TYPE.caption, marginTop: 2 },
  previewPrice: { alignSelf: 'flex-start', marginTop: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: 999 },
  previewPriceText: { color: PALETTE.white, fontSize: 13, lineHeight: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
});

export default AddProductScreen;
