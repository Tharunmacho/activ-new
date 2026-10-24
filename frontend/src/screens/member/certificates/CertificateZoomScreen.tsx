import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaxCertificateView, MembershipCertificateView } from './CertificateViews';
import { A4_WIDTH, A4_HEIGHT, certificateFitWidth } from './certificateLayout';

/**
 * The 80G certificate, full screen — the SAME A4 page (CertificateViews'
 * `TaxCertificateView`) at up to 3x, so it can be read without printing.
 *
 * A dedicated Stack screen, not a <Modal>: the certificate is opened from
 * screens that can sit under the member tabs (CLAUDE.md Rule 2).
 *
 *   Fit / 2x / 3x   re-lays the page out wider and pans it in both directions
 *                   (vertical ScrollView around a horizontal one) — works on
 *                   both platforms with no native dependency.
 *   Fit            fits both page dimensions and clears previous pan offsets.
 * Only the explicit zoom controls enlarge the page; tapping a document must
 * not accidentally hide half of it.
 *
 * Params: { cert, stamp?, receiptColumn?, amountInWords? } — exactly the
 * props the calling screen drew the page with, so the zoom is the same page.
 */

const ZOOMS = [1, 2, 3];
const GUTTER = 12;
const BG = '#0B1330';

const CertificateZoomScreen = ({ navigation, route }: any) => {
  const params = route?.params || {};
  const cert = params?.cert || null;
  const membership = params?.kind === 'membership';
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState({ width: Number(winW || 1), height: Math.max(1, Number(winH || 1) - 160) });
  const vertical = useRef<ScrollView>(null);
  const horizontal = useRef<ScrollView>(null);

  const fitW = certificateFitWidth(viewport.width - GUTTER * 2, viewport.height - GUTTER * 2, membership);
  const pageW = fitW * zoom;
  const pageH = pageW * (membership ? A4_WIDTH / A4_HEIGHT : A4_HEIGHT / A4_WIDTH);
  const contentWidth = Math.max(viewport.width, pageW + GUTTER * 2);
  const contentHeight = Math.max(viewport.height, pageH + GUTTER * 2);

  // Reused routes and rotation always reopen the entire document.
  useLayoutEffect(() => { setZoom(1); }, [cert, membership, winW, winH]);
  useEffect(() => {
    vertical.current?.scrollTo?.({ y: 0, animated: false });
    horizontal.current?.scrollTo?.({ x: 0, animated: false });
  }, [zoom, cert, membership, viewport.width, viewport.height]);

  const close = () => {
    try {
      if (navigation?.canGoBack?.()) navigation.goBack();
    } catch (err) {
      console.warn('Certificate zoom close safely caught:', err);
    }
  };
  return (
    <View style={[s.root, { paddingTop: Number(insets?.top || 0), paddingBottom: Number(insets?.bottom || 0) }]}>
      <StatusBar barStyle="light-content" />
      <View style={s.bar}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={s.iconBtn}>
          <Icon name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={s.titleCol}>
          <Text style={s.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>{membership ? 'Membership certificate' : 'Tax exemption certificate'}</Text>
          <Text style={s.subtitle} numberOfLines={1} maxFontSizeMultiplier={1.3}>{membership ? 'A4 landscape · 297 × 210 mm' : 'A4 · 210 × 297 mm'}</Text>
        </View>
      </View>
      <View style={s.toolbar}>
        <Text style={s.viewLabel} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.3}>{zoom === 1 ? 'Full page' : 'Drag to move around'}</Text>
        <View style={s.zooms} accessibilityRole="radiogroup">
          {ZOOMS.map((z) => {
            const on = z === zoom;
            return (
              <Pressable
                key={z}
                onPress={() => setZoom(z)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={z === 1 ? 'Fit to screen' : `Zoom ${z} times`}
                style={[s.zoomBtn, on && s.zoomBtnOn]}
              >
                <Text style={[s.zoomText, on && s.zoomTextOn]} maxFontSizeMultiplier={1.2}>{z === 1 ? 'Fit' : `${z}×`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {cert ? (
        <View style={s.flex} testID="certificate-viewport" onLayout={event => {
          const width = Number(event?.nativeEvent?.layout?.width || 0);
          const height = Number(event?.nativeEvent?.layout?.height || 0);
          if (width > 0 && height > 0) setViewport(current =>
            Math.abs(current.width - width) > 0.5 || Math.abs(current.height - height) > 0.5 ? { width, height } : current);
        }}>
          <ScrollView ref={vertical} testID="certificate-vertical-pan" style={s.flex}
            contentContainerStyle={s.panContent} nestedScrollEnabled scrollEnabled={zoom > 1}
            showsVerticalScrollIndicator={zoom > 1} bounces={false}>
          <ScrollView
            ref={horizontal} testID="certificate-horizontal-pan" horizontal nestedScrollEnabled
            style={{ width: viewport.width, height: contentHeight }}
            contentContainerStyle={{ width: contentWidth, height: contentHeight, padding: GUTTER, alignItems: 'center', justifyContent: 'center' }}
            scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1} bounces={false}
          >
            {membership ? <MembershipCertificateView cert={cert} width={pageW} /> : <TaxCertificateView
              cert={cert}
              stamp={String(params?.stamp || '')}
              receiptColumn={params?.receiptColumn === true}
              amountInWords={String(params?.amountInWords || '')}
              width={pageW}
            />}
          </ScrollView>
          </ScrollView>
        </View>
      ) : (
        <View style={s.empty}>
          <Icon name="description" size={40} color="rgba(255,255,255,0.6)" />
          <Text style={s.emptyText}>This certificate is not available. Go back and open it again.</Text>
        </View>
      )}
      {cert ? <Text style={s.help} maxFontSizeMultiplier={1.3}>
        {zoom === 1 ? 'The full certificate is visible · Use 2× or 3× to read details' : 'Drag across or down · Tap Fit to see the full certificate'}
      </Text> : null}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  flex: { flex: 1 },
  panContent: { flexGrow: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  titleCol: { flex: 1, minWidth: 0 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  viewLabel: { flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  zooms: { flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: 3 },
  zoomBtn: { minWidth: 40, height: 32, paddingHorizontal: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  zoomBtnOn: { backgroundColor: '#FFFFFF' },
  zoomText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  zoomTextOn: { color: BG },
  help: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center' },
});

export default CertificateZoomScreen;
