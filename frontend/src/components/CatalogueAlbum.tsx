import { AppTheme, useAppTheme, useThemeStyles } from '../ui/AppTheme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler, FlatList, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FitImage, IconButton, SPACE, money } from '../ui';
import { resolveMediaUrl } from '../config/api.config';
import { PhotoViewer } from '../ui/PhotoViewer';

/**
 * ============================================================================
 * CatalogueAlbum — a business's catalogue as a full-screen photo album
 * ============================================================================
 *
 * One component for every place that lists a catalogue (member directory card,
 * public company page, the owner's Products & Services), so a product opens the
 * same way everywhere.
 *
 * The album is ONE horizontal, paging strip of "slides" — every image of every
 * product, in catalogue order. Swiping inside a product moves through its
 * photos; swiping past the last one moves on to the next product. Flattening
 * (instead of a carousel nested inside a carousel) is deliberate: two
 * same-direction scrollers fight over the touch on Android and the inner one
 * wins, so a user could never swipe out of a product.
 *
 * Under the picture: the current product's name, type, category, price,
 * availability (only when the API sent a stock figure) and its FULL
 * description in a scrollable panel.
 *
 * Rule 2: this is an absolute-fill View mounted at the top level of a Stack
 * screen, NOT a <Modal> (the nested-window crash on Android 14+). The hardware
 * Back button closes it (BackHandler) before it can pop the screen underneath.
 * Mount it as a sibling of the page, outside any ScrollView.
 */

export interface CatalogueItem {
  key: string;
  name: string;
  /** "Product" unless the API names a kind (e.g. a service). */
  kind: string;
  category: string;
  description: string;
  price: number;
  /** Company cover/logo photos are not items offered for sale. */
  showPrice: boolean;
  sku: string;
  /** null = the API did not send a stock figure; nothing is shown then. */
  stock: number | null;
  /** Resolved, absolute image URLs. Empty = show the placeholder. */
  images: string[];
}

const pickUrl = (v: any): string => {
  if (typeof v === 'string') return v;
  return typeof v?.url === 'string' ? v.url : (typeof v?.imageUrl === 'string' ? v.imageUrl : '');
};

/** Defensive normaliser: tolerates the directory, public-company and owner payload shapes. */
export function toCatalogueItem(raw: any, index: number): CatalogueItem {
  const urls: string[] = [];
  const push = (v: any) => {
    const u = String(pickUrl(v) || '').trim();
    if (!u) return;
    const resolved = resolveMediaUrl(u) || '';
    if (resolved && !urls.includes(resolved)) urls.push(resolved);
  };
  push(raw?.imageUrl);
  [raw?.images, raw?.imageUrls, raw?.gallery].forEach((list) => {
    if (Array.isArray(list)) list.forEach(push);
  });
  const stockRaw = raw?.stock;
  const hasStock = stockRaw !== null && stockRaw !== undefined && stockRaw !== '' && Number.isFinite(Number(stockRaw));
  return {
    key: String(raw?.id || raw?._id || `${raw?.name || 'item'}-${index}`),
    name: String(raw?.name || '').trim() || 'Product',
    kind: String(raw?.type || raw?.kind || '').trim() || 'Product',
    category: String(raw?.category || '').trim(),
    description: String(raw?.description || '').trim(),
    price: Number(raw?.price || 0),
    showPrice: raw?.showPrice !== false,
    sku: String(raw?.sku || '').trim(),
    stock: hasStock ? Number(stockRaw) : null,
    images: urls,
  };
}

interface Slide { id: string; itemIndex: number; imageIndex: number; uri: string }

interface Props {
  /** Raw catalogue rows, in the order the user saw them. */
  items: any[] | null | undefined;
  /** Index of the product to open on; null/undefined keeps the album closed. */
  startIndex: number | null | undefined;
  onClose: () => void;
  /** Fired once each time a product becomes the one on show (view counting). */
  onProductShown?: (item: CatalogueItem) => void;
  /** Accent for the price chip / active thumbnail. */
  tone?: 'member' | 'business';
}

const THUMB = 52;

export function CatalogueAlbum({ items, startIndex, onClose, onProductShown, tone = 'member' }: Props) {
  const products = useMemo(() => (Array.isArray(items) ? items : []).filter(Boolean).map(toCatalogueItem), [items]);
  const open = typeof startIndex === 'number' && startIndex >= 0 && products.length > 0;

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    (products || []).forEach((p, itemIndex) => {
      const imgs = p.images.length ? p.images : [''];
      imgs.forEach((uri, imageIndex) => out.push({ id: `${p.key}:${imageIndex}`, itemIndex, imageIndex, uri }));
    });
    return out;
  }, [products]);

  const firstSlideOf = useCallback((itemIndex: number) => {
    const at = slides.findIndex((s) => s.itemIndex === itemIndex);
    return at < 0 ? 0 : at;
  }, [slides]);

  if (!open) return null;
  return (
    <AlbumBody
      products={products}
      slides={slides}
      initialSlide={firstSlideOf(Math.min(startIndex as number, products.length - 1))}
      onClose={onClose}
      onProductShown={onProductShown}
      tone={tone}
    />
  );
}

function AlbumBody({ products, slides, initialSlide, onClose, onProductShown, tone }: {
  products: CatalogueItem[]; slides: Slide[]; initialSlide: number; onClose: () => void;
  onProductShown?: (item: CatalogueItem) => void; tone: 'member' | 'business';
}) {
  const { palette: PALETTE, toneOf, isDark } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const thumbRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(initialSlide);
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);
  const accent = tone === 'business' ? PALETTE.violet : PALETTE.blue;
  const accentLight = toneOf(tone).accentDark;

  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))];
  const product = products[slide?.itemIndex || 0];
  const siblings = useMemo(() => (slides || []).filter((s) => s.itemIndex === (slide?.itemIndex || 0)), [slides, slide?.itemIndex]);

  // Android Back closes the album, not the screen underneath it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => { try { sub?.remove?.(); } catch { /* already removed */ } };
  }, [onClose]);

  // Report each product once per time it comes on screen.
  const shownKey = product?.key || '';
  useEffect(() => {
    if (!shownKey || !product) return;
    try { onProductShown?.(product); } catch (err) { console.warn('Product view not recorded:', err); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey]);

  // Keep the filmstrip centred on the slide in view.
  useEffect(() => {
    try { thumbRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }); } catch { /* strip not laid out yet */ }
  }, [index]);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setIndex(clamped);
    try { listRef.current?.scrollToIndex({ index: clamped, animated: true }); } catch { /* list not laid out yet */ }
  }, [slides.length]);

  const onSettle = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = Number(e?.nativeEvent?.contentOffset?.x || 0);
    const next = Math.max(0, Math.min(slides.length - 1, Math.round(x / Math.max(width, 1))));
    setIndex(next);
  }, [slides.length, width]);

  const stageHeight = Math.max(220, Math.min(width * 1.0, height * 0.46));
  const itemOrdinal = (slide?.itemIndex || 0) + 1;
  const photoOrdinal = siblings.findIndex((s) => s.id === slide?.id) + 1;
  const stock = product?.stock;

  return (
    <>
    <View style={[styles.root, { paddingTop: insets.top }]} accessibilityViewIsModal>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ---- top bar */}
      <View style={styles.bar}>
        <IconButton icon="close" onPress={onClose} accessibilityLabel="Close catalogue" />
        <View style={styles.barText}>
          <Text style={styles.barTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>{product?.name || 'Catalogue'}</Text>
          <Text style={styles.barSub} maxFontSizeMultiplier={1.2}>
            {`Item ${itemOrdinal} of ${products.length}`}
          </Text>
        </View>
        <View style={styles.counter} accessibilityLabel={`Photo ${index + 1} of ${slides.length}`}>
          <Text style={styles.counterText} maxFontSizeMultiplier={1.2}>{`${index + 1} / ${slides.length}`}</Text>
        </View>
      </View>

      {/* ---- the album strip: every photo of every product */}
      <View style={{ height: stageHeight }}>
        <FlatList
          key={`stage-${Math.round(width)}`}
          ref={listRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s, i) => String(s?.id || i)}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          initialScrollIndex={Math.min(initialSlide, Math.max(slides.length - 1, 0))}
          getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onSettle}
          onScrollToIndexFailed={() => { /* getItemLayout makes this unreachable; ignore */ }}
          renderItem={({ item: s }) => (
            <Pressable
              style={{ width, height: stageHeight }}
              disabled={!s?.uri}
              accessibilityRole={s?.uri ? 'button' : undefined}
              accessibilityLabel={`Enlarge ${products[s?.itemIndex || 0]?.name || 'product'}, photo ${(s?.imageIndex || 0) + 1}`}
              accessibilityHint="Opens the full photo. Pinch to zoom."
              onPress={() => {
                if (s?.uri) setZoomPhoto({
                  url: s.uri,
                  title: `${products[s.itemIndex]?.name || 'Product'} · Photo ${s.imageIndex + 1}`,
                });
              }}
            >
              <FitImage
                uri={s?.uri}
                style={{ width, height: stageHeight }}
                accessibilityLabel={`${products[s?.itemIndex || 0]?.name || 'Product'} photo`}
                fallback={<View style={styles.noPhoto}><Icon name="inventory-2" size={56} color="rgba(255,255,255,0.35)" /><Text style={styles.noPhotoText}>No photo added</Text></View>}
              />
              {s?.uri ? (
                <View style={styles.zoomHint} pointerEvents="none" accessible={false}>
                  <Icon name="zoom-in" size={18} color={PALETTE.white} />
                  <Text style={styles.zoomHintText}>Tap to zoom</Text>
                </View>
              ) : null}
            </Pressable>
          )}
        />
        {slides.length > 1 ? (
          <>
            {index > 0 ? (
              <Pressable style={[styles.arrow, styles.arrowLeft]} onPress={() => goTo(index - 1)} accessibilityRole="button" accessibilityLabel="Previous photo" hitSlop={8}>
                <Icon name="chevron-left" size={28} color={PALETTE.white} />
              </Pressable>
            ) : null}
            {index < slides.length - 1 ? (
              <Pressable style={[styles.arrow, styles.arrowRight]} onPress={() => goTo(index + 1)} accessibilityRole="button" accessibilityLabel="Next photo" hitSlop={8}>
                <Icon name="chevron-right" size={28} color={PALETTE.white} />
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>

      {/* ---- per-product dots + the filmstrip of the whole catalogue */}
      {siblings.length > 1 ? (
        <View style={styles.dots} accessibilityLabel={`Photo ${photoOrdinal} of ${siblings.length}`}>
          {siblings.map((s) => (
            <View key={s.id} style={[styles.dot, s.id === slide?.id && { width: 18, backgroundColor: accentLight }]} />
          ))}
        </View>
      ) : null}
      {slides.length > 1 ? (
        <FlatList
          ref={thumbRef}
          data={slides}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(s, i) => `t-${String(s?.id || i)}`}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          getItemLayout={(_d, i) => ({ length: THUMB + SPACE.sm, offset: (THUMB + SPACE.sm) * i, index: i })}
          onScrollToIndexFailed={() => { /* strip still measuring; ignore */ }}
          style={styles.strip}
          contentContainerStyle={styles.stripContent}
          renderItem={({ item: s, index: i }) => {
            const active = i === index;
            return (
              <Pressable
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${products[s?.itemIndex || 0]?.name || 'product'}, photo ${(s?.imageIndex || 0) + 1}`}
                style={[styles.thumb, active && { borderColor: accentLight, opacity: 1 }]}
              >
                {s?.uri ? <Image source={{ uri: s.uri }} style={styles.thumbImg} resizeMode="cover" /> : <Icon name="inventory-2" size={20} color="rgba(255,255,255,0.45)" />}
              </Pressable>
            );
          }}
        />
      ) : null}

      {/* ---- the product on show */}
      <ScrollView
        style={styles.details}
        contentContainerStyle={[styles.detailsContent, { paddingBottom: insets.bottom + SPACE.xl }]}
        showsVerticalScrollIndicator={false}
        key={`details-${shownKey}`}
      >
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Icon name="inventory-2" size={13} color={PALETTE.white} />
            <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{product?.kind || 'Product'}</Text>
          </View>
          {product?.category ? (
            <View style={[styles.badge, styles.badgeGhost]}>
              <Text style={[styles.badgeText, styles.badgeGhostText]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{product.category}</Text>
            </View>
          ) : null}
          {typeof stock === 'number' ? (
            <View style={[styles.badge, { backgroundColor: stock > 0 ? 'rgba(5,150,105,0.9)' : 'rgba(185,28,28,0.9)' }]}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{stock > 0 ? `${stock} in stock` : 'Out of stock'}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.name} maxFontSizeMultiplier={1.3}>{product?.name || 'Product'}</Text>
        {product?.showPrice !== false ? <Text style={[styles.price, { color: accentLight }]} maxFontSizeMultiplier={1.2}>
          {Number(product?.price || 0) > 0 ? money(product?.price) : 'Price on request'}
        </Text> : null}
        {product?.sku ? <Text style={styles.sku} maxFontSizeMultiplier={1.2}>{`SKU ${product.sku}`}</Text> : null}

        {product?.description || product?.showPrice !== false ? <>
        <Text style={styles.descLabel}>DESCRIPTION</Text>
        <Text style={styles.desc} maxFontSizeMultiplier={1.3}>
          {product?.description || 'The seller has not added a description for this item yet.'}
        </Text>
        </> : null}

        {products.length > 1 ? (
          <View style={styles.nav}>
            <Pressable
              style={[styles.navBtn, (slide?.itemIndex || 0) <= 0 && styles.navBtnOff]}
              disabled={(slide?.itemIndex || 0) <= 0}
              onPress={() => goTo(Math.max(0, slides.findIndex((s) => s.itemIndex === (slide?.itemIndex || 0) - 1)))}
              accessibilityRole="button" accessibilityLabel="Previous product"
            >
              <Icon name="arrow-back" size={18} color={PALETTE.text} />
              <Text style={styles.navText} maxFontSizeMultiplier={1.2}>Previous item</Text>
            </Pressable>
            <Pressable
              style={[styles.navBtn, (slide?.itemIndex || 0) >= products.length - 1 && styles.navBtnOff]}
              disabled={(slide?.itemIndex || 0) >= products.length - 1}
              onPress={() => goTo(Math.max(0, slides.findIndex((s) => s.itemIndex === (slide?.itemIndex || 0) + 1)))}
              accessibilityRole="button" accessibilityLabel="Next product"
            >
              <Text style={styles.navText} maxFontSizeMultiplier={1.2}>Next item</Text>
              <Icon name="arrow-forward" size={18} color={PALETTE.text} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
    {zoomPhoto && <PhotoViewer
      visible
      url={zoomPhoto.url}
      title={zoomPhoto.title}
      closeLabel="Close enlarged catalogue photo"
      onClose={() => setZoomPhoto(null)}
    />}
    </>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE }: AppTheme) => StyleSheet.create({
  // Over everything in the screen; zIndex + elevation so Android stacks it above the page.
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PALETTE.canvas, zIndex: 1000, elevation: 1000 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  barText: { flex: 1, minWidth: 0 },
  barTitle: { color: PALETTE.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  barSub: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 18, marginTop: 1 },
  counter: { paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: 999, backgroundColor: PALETTE.field },
  counterText: { color: PALETTE.text, fontSize: 12, lineHeight: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },

  noPhoto: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, backgroundColor: '#121C45' },
  noPhotoText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 18 },
  zoomHint: { position: 'absolute', right: SPACE.md, bottom: SPACE.sm, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.sm, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(11,19,48,0.75)' },
  zoomHintText: { color: PALETTE.white, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  arrow: { position: 'absolute', top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,19,48,0.55)' },
  arrowLeft: { left: SPACE.sm },
  arrowRight: { right: SPACE.sm },

  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACE.sm },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: PALETTE.borderStrong },
  strip: { flexGrow: 0, maxHeight: THUMB + SPACE.md },
  stripContent: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xs, gap: SPACE.sm },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121C45', borderWidth: 2, borderColor: 'transparent', opacity: 0.65 },
  thumbImg: { width: '100%', height: '100%' },

  details: { flex: 1, marginTop: SPACE.sm, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: PALETTE.card },
  detailsContent: { padding: SPACE.xl },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: SPACE.md, paddingVertical: 5, borderRadius: 999 },
  badgeText: { color: PALETTE.white, fontSize: 12, lineHeight: 16, fontWeight: '700', flexShrink: 1 },
  badgeGhost: { backgroundColor: PALETTE.field },
  badgeGhostText: { color: PALETTE.textSoft },
  name: { ...TYPE.heading, color: PALETTE.text, fontSize: 22, lineHeight: 28, marginTop: SPACE.md },
  price: { fontSize: 22, lineHeight: 28, fontWeight: '800', marginTop: SPACE.xs, fontVariant: ['tabular-nums'] },
  sku: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 18, marginTop: SPACE.xxs },
  descLabel: { color: PALETTE.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 1, marginTop: SPACE.xl },
  desc: { color: PALETTE.textSoft, fontSize: 15, lineHeight: 23, marginTop: SPACE.xs },
  nav: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xl },
  navBtn: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  navBtnOff: { opacity: 0.35 },
  navText: { color: PALETTE.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
});

export default CatalogueAlbum;
