import { useLegacyAppearance } from './legacyAppearance';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageURISource, type StyleProp, type ViewStyle } from 'react-native';
import { ContentImage } from './ContentImage';
import { responsiveImageWidth } from '../utils/imageSizing';
import { PALETTE } from './tokens';

/**
 * ============================================================================
 * FitImage — an UPLOADED image, shown whole, in any frame
 * ============================================================================
 *
 * People upload whatever shape they have: a wide web banner, a square poster,
 * a portrait phone photo. A fixed box with `resizeMode="cover"` zooms and
 * crops every one of those that does not match it — the "banner not fitted"
 * problem. This never crops and never stretches:
 *
 *   mode="auto"   (hero banners) the frame TAKES THE IMAGE'S OWN SHAPE —
 *                 its real width:height, held between `minRatio` and
 *                 `maxRatio` so a freak upload cannot make the frame a
 *                 sliver or a tower.
 *   mode="frame"  (cards, grids, thumbnails) the frame keeps the size `style`
 *                 gives it, so a grid stays aligned.
 *
 * In both, the whole picture is drawn with `contain`, and whatever space its
 * shape leaves is filled with a soft, blurred copy of the same picture — not
 * grey bars. `fit="cover"` is the opt-out for an image the editor explicitly
 * chose to fill its frame (events carry `media.fit`).
 *
 * Avatars and logos are NOT this: a face or a mark cropped to a circle is
 * correct. Use this for content people upload to be looked at.
 */

export interface FitImageProps {
  uri?: string | null;
  mode?: 'auto' | 'frame';
  /** 'contain' (default): the whole image. 'cover': fill the frame, cropping. */
  fit?: 'contain' | 'cover';
  /** width / height bounds for mode="auto". Defaults suit a banner on a phone. */
  minRatio?: number;
  maxRatio?: number;
  /** The frame. For mode="auto" give it a width (or let it stretch); height is computed. */
  style?: StyleProp<ViewStyle>;
  /** Rounded corners etc. — applied to the clipping frame. */
  borderRadius?: number;
  accessibilityLabel?: string;
  onError?: () => void;
  /** Shown when there is no image, or it fails to load. */
  fallback?: React.ReactNode;
  /** Drawn over the image (a shade, a "Change cover" chip). Also over the fallback. */
  children?: React.ReactNode;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function FitImage({
  uri,
  mode = 'frame',
  fit = 'contain',
  minRatio = 1.2,
  maxRatio = 3.2,
  style,
  borderRadius = 0,
  accessibilityLabel,
  onError,
  fallback = null,
  children = null,
}: FitImageProps) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const src = typeof uri === 'string' ? uri.trim() : '';
  const { width: screenWidth } = useWindowDimensions();
  const frameWidth = StyleSheet.flatten(style)?.width;
  const imageWidth = responsiveImageWidth(typeof frameWidth === 'number' ? frameWidth : screenWidth);
  const [failed, setFailed] = useState(false);
  const [loadedSource, setLoadedSource] = useState<ImageURISource | null>(null);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // The image's own width:height, once known. Until then a sensible banner shape.
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setFailed(false);
    setRatio(null);
    setLoadedSource(null);
    setSlow(false);
  }, [src, imageWidth]);
  useEffect(() => {
    if (!src || loadedSource || failed) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [src, loadedSource, failed, attempt, imageWidth]);

  const frameStyle: StyleProp<ViewStyle> = [
    s.frame,
    borderRadius ? { borderRadius } : null,
    mode === 'auto' ? { aspectRatio: clamp(ratio || 16 / 9, minRatio, maxRatio) } : null,
    style,
  ];

  if (!src || failed) {
    return <View style={frameStyle}>
      {fallback || <View style={s.status}><Text style={s.statusText}>{src ? 'Image temporarily unavailable.' : 'No image available.'}</Text></View>}
      {src && <Pressable accessibilityRole="button" accessibilityLabel="Retry image" onPress={event => { event?.stopPropagation?.(); setAttempt(value => value + 1); setFailed(false); setLoadedSource(null); setSlow(false); }} style={s.retry}><Text style={s.retryText}>Retry image</Text></Pressable>}
      {children}
    </View>;
  }

  const fail = () => { setLoadedSource(null); setFailed(true); onError?.(); };

  return (
    <View style={frameStyle} accessible={!!accessibilityLabel} accessibilityRole={accessibilityLabel ? 'image' : undefined} accessibilityLabel={accessibilityLabel}>
      {!loadedSource && <View style={s.status} accessibilityLiveRegion="polite"><ActivityIndicator color={PALETTE.blue} /><Text style={s.statusText}>{slow ? 'This image is taking longer to load.' : 'Loading image...'}</Text></View>}
      {fit === 'contain' && loadedSource ? (
        // The fill behind: the same picture, blurred and dimmed, so the space a
        // shape leaves reads as part of the image rather than as empty bars.
        <>
          <Image source={loadedSource} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={18} accessible={false} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, s.dim]} />
        </>
      ) : null}
      <ContentImage
        key={`${src}:${attempt}`}
        uri={src}
        width={imageWidth}
        style={StyleSheet.absoluteFill}
        resizeMode={fit === 'cover' ? 'cover' : 'contain'}
        onError={fail}
        onSourceLoad={setLoadedSource}
        onLoad={event => {
          const loaded = event.nativeEvent?.source;
          if (loaded?.width > 0 && loaded?.height > 0) setRatio(loaded.width / loaded.height);
        }}
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', backgroundColor: PALETTE.blueSoft },
  status: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  statusText: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retry: { position: 'absolute', alignSelf: 'center', bottom: 8, minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: PALETTE.white },
  retryText: { fontSize: 13, fontWeight: '700', color: PALETTE.blue },
  dim: { backgroundColor: 'rgba(15,23,42,0.28)' },
});

export default FitImage;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
