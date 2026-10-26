import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { ContentImage } from '../../ui/ContentImage';
import { PhotoViewer } from '../../ui/PhotoViewer';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import Video from 'react-native-video';
import { BRAND, PALETTE, SPACE, CardSkeletons, GlassIconButton, PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, PressableScale, StateView, SurfaceCard } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { openPublicAttachment, openWebsitePage } from '../../services/websiteNavigation';
import { isPublicDownloadUrl } from '../../services/publicDownload';
import { publicWebsitePath } from '../../utils/publicBrowse';
import { publicPlainText, publicTextBlocks } from '../../utils/publicRichText';
import { PublicShareButton } from '../../components/PublicShareButton';

export const contentText = publicPlainText;

export function ContentLayout({ navigation, title, subtitle, art = 'news', resource, children, readingPanel = true, overlap = readingPanel, sharePath }: {
  navigation: any; title: string; subtitle?: string; art?: string; readingPanel?: boolean; overlap?: boolean; sharePath?: string;
  resource: { loading: boolean; refreshing: boolean; error: string; reload: () => any; data: any }; children?: React.ReactNode;
}) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  const section = ({ gallery: 'Gallery', schemes: 'Opportunities', zones: 'Community', news: 'News', about: 'About us', membership: 'Membership', contact: 'Contact', policy: 'Information' } as Record<string, string>)[art] || 'ACTIV';
  return <PremiumPage safeBottom refreshing={resource.refreshing} onRefresh={resource.reload} header={
    <View style={contentStyles.headerInner}><PremiumPageHeader title={contentText(title)} subtitle={contentText(subtitle)} eyebrow={'ACTIV / ' + section.toUpperCase()}
      onBack={() => navigation.canGoBack?.() === false ? navigation.navigate('PublicExplore') : navigation.goBack()}
      right={<>
        {!!sharePath && !!resource.data && <PublicShareButton path={sharePath} title={contentText(title)} compact appearance="glass" />}
        <GlassIconButton icon="refresh" accessibilityLabel="Refresh content" onPress={resource.reload} />
      </>} /></View>
  }>
    <View style={[contentStyles.content, !overlap && contentStyles.listContent]}>
      {resource.loading && !resource.data ? <CardSkeletons rows={2} variant="media" /> : <>
        {!!resource.error && <SurfaceCard><StateView compact kind="error" title="Content unavailable" message={resource.error} onAction={resource.reload} /></SurfaceCard>}
        {resource.data && (readingPanel ? <SurfaceCard padded={false} style={contentStyles.readingCard}><View style={contentStyles.readingContent}>{children}</View></SurfaceCard> : children)}
        {!resource.error && !resource.data && <SurfaceCard><StateView compact title="Not available" message="This content has not been published or is no longer available." /></SurfaceCard>}
      </>}
    </View>
  </PremiumPage>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles); return <Text accessibilityRole="header" style={contentStyles.heading}>{typeof children === 'string' ? contentText(children) : children}</Text>; }
export function Body({ value, navigation, style }: { value: any; navigation?: any; style?: StyleProp<TextStyle> }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  return <>{publicTextBlocks(value).map((block, index) => {
    const text = <Text selectable accessibilityRole={block.kind === 'heading' ? 'header' : undefined}
      style={[contentStyles.body, style, block.kind === 'heading' && contentStyles.richHeading, block.kind === 'quote' && contentStyles.quote, block.kind === 'code' && contentStyles.code]}>
      {block.spans.map((span, i) => {
        const link = navigation && span.href && /^(\/[^/]|https?:\/\/|mailto:|tel:)/i.test(span.href);
        return span.bold || span.italic || span.underline || span.fontSize || span.code || link ? <Text key={i}
          style={[span.bold && contentStyles.bold, span.italic && contentStyles.italic, span.underline && { textDecorationLine: 'underline' }, span.fontSize && { fontSize: span.fontSize, lineHeight: Math.ceil(span.fontSize * 1.55) }, span.code && contentStyles.codeText, link && contentStyles.inlineLink]}
          accessibilityRole={link ? 'link' : undefined} accessibilityLabel={link ? span.text : undefined}
          onPress={link ? () => openWebsitePage(navigation, span.href!, span.text) : undefined}>{span.text}</Text> : span.text;
      })}
    </Text>;
    return block.kind === 'list' ? <View key={index} style={contentStyles.listRow}><Text style={contentStyles.listMarker}>{block.marker}</Text><View style={contentStyles.flex}>{text}</View></View> : <View key={index}>{text}</View>;
  })}</>;
}
export function ActionLink({ navigation, href, label, download = false, filename }: { navigation: any; href?: string; label: string; download?: boolean; filename?: string }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  if (!href) return null;
  const file = download || isPublicDownloadUrl(href);
  if (!file && !/^(\/[^/]|https?:\/\/|mailto:|tel:)/i.test(href)) return null;
  const external = !file && /^https?:\/\//i.test(href) && !publicWebsitePath(href);
  const fileHint = Platform.OS === 'ios' ? 'Open document' : 'Save to Downloads';
  return <PressableScale accessibilityRole="link" accessibilityLabel={label + (external ? ', opens external service' : file ? ', ' + (Platform.OS === 'ios' ? 'open document' : 'save to Downloads') : '')} onPress={() => file ? openPublicAttachment(href, filename) : openWebsitePage(navigation, href, label)} contentStyle={contentStyles.link}>
    <Text style={contentStyles.linkText}>{label}{external ? ' ↗' : ' →'}</Text>
    {external && <Text style={contentStyles.linkHint}>External service</Text>}
    {file && <Text style={contentStyles.linkHint}>{fileHint}</Text>}
  </PressableScale>;
}
export function Photo({ url, alt = 'ACTIV photo', caption, document = false, closeLabel = 'Close photo', edgeToEdge = false }: { url?: string; alt?: string; caption?: string; document?: boolean; closeLabel?: string; edgeToEdge?: boolean }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const [ratio, setRatio] = useState(4 / 3), [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const uri = resolveMediaUrl(url || '');
  useEffect(() => { setStatus('loading'); setOpen(false); setRatio(4 / 3); }, [uri, attempt]);
  useEffect(() => {
    if (!uri || status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), 20000);
    return () => clearTimeout(timer);
  }, [uri, attempt, status]);
  if (!uri) return null;
  return <>
    <View style={[contentStyles.photo, edgeToEdge && contentStyles.coverPhoto]}>
      {status === 'error' ? <View style={contentStyles.imageError}>
        <Icon name="image-not-supported" size={24} color={PALETTE.textMuted} />
        <View style={contentStyles.flex}><Text style={contentStyles.errorTitle}>Image couldn’t load</Text><Text style={contentStyles.meta}>Check your connection and try again.</Text></View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Retry image" onPress={() => setAttempt(value => value + 1)} contentStyle={contentStyles.retry}><Text style={contentStyles.linkText}>Retry</Text></PressableScale>
      </View> : <PressableScale disabled={status !== 'ready'} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={'Enlarge image: ' + alt}>
        <ContentImage key={uri + ':' + attempt} uri={uri} width={document ? 1280 : 1024} accessibilityLabel={alt} resizeMode="contain"
          style={{ width: '100%', ...(status === 'ready' ? { aspectRatio: document ? ratio : Math.max(0.65, Math.min(2.2, ratio)) } : { height: 144 }), opacity: status === 'ready' ? 1 : 0 }}
          onError={() => setStatus('error')} onLoad={event => { const source = event.nativeEvent?.source; if (source?.width && source?.height) setRatio(source.width / source.height); setStatus('ready'); }} />
        {status === 'loading' ? <View style={contentStyles.imageLoading}><ActivityIndicator color={BRAND.blue} /><Text style={contentStyles.meta}>Loading image…</Text></View>
          : <View style={contentStyles.expand}><Icon name="fullscreen" size={22} color="#fff" /></View>}
      </PressableScale>}
      {!!caption && <Text style={contentStyles.photoCaption}>{contentText(caption)}</Text>}
    </View>
    <PhotoViewer url={uri} visible={open} onClose={() => setOpen(false)} title={alt} closeLabel={closeLabel} fit={document ? 'width' : 'contain'} />
  </>;
}
/** Uploaded videos play in the native player. Embedded media stays in an
 * isolated player with no website chrome or external page navigation. */
export function ContentMedia({ media, title }: { media: any; title: string }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaUrl(media?.url || '');
  useEffect(() => { setFailed(false); }, [uri, media?.type]);
  if (!uri) return null;
  if (media.type !== 'video') return <Photo url={uri} alt={media.alt || title} />;
  if (failed) return <View>
    <Text accessibilityRole="alert" style={contentStyles.body}>This video could not be played. Try again.</Text>
    <PressableScale accessibilityRole="button" accessibilityLabel="Retry video" onPress={() => setFailed(false)} contentStyle={contentStyles.link}>
      <Text style={contentStyles.linkText}>Retry video</Text>
    </PressableScale>
  </View>;
  const youtube = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/i.exec(uri);
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(uri);
  if (youtube || vimeo) {
    const source = youtube ? `https://www.youtube.com/embed/${youtube[1]}` : `https://player.vimeo.com/video/${vimeo?.[1] || ''}`;
    return <View style={contentStyles.video}><WebView key={uri} source={{ uri: source }} allowsFullscreenVideo mediaPlaybackRequiresUserAction originWhitelist={['https://*']} onShouldStartLoadWithRequest={req => !req.isTopFrame || req.url === source || req.url === 'about:blank'} onError={() => setFailed(true)} /></View>;
  }
  return <Video key={uri} source={{ uri }} controls resizeMode="contain" paused style={contentStyles.video} onError={() => setFailed(true)} />;
}
export function ExtraFields({ fields, navigation }: { fields: any[]; navigation: any }) {
  const contentStyles = useLegacyAppearance(legacyAppearance_contentStyles);
  return <>{(Array.isArray(fields) ? fields : []).filter(field => field && field.value && !field.isHidden
    && !/^(created\s*by|updated\s*by|seed|source\s*id|internal|database|imported\s*by)/i.test(String(field.label || field.key || '').trim())
    && !/^seed[:\s-]/i.test(String(field.value).trim())).map((field, i) => <SurfaceCard key={i} style={contentStyles.section}>
    {!!field.label && <Heading>{field.label}</Heading>}<Body value={field.value} navigation={navigation} />
  </SurfaceCard>)}</>;
}
export const contentStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.canvas }, flex: { flex: 1, minWidth: 0 },
  headerInner: { width: '100%', maxWidth: 760 - SPACE.lg * 2, alignSelf: 'center' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: SPACE.lg, marginTop: -PREMIUM_OVERLAP, gap: SPACE.md }, section: { marginBottom: SPACE.sm },
  listContent: { marginTop: 0 },
  readingCard: { borderRadius: 24 }, readingContent: { padding: SPACE.lg, gap: SPACE.md },
  heading: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 28, fontWeight: '700', marginBottom: 10 }, body: { color: PALETTE.textSoft, fontSize: 16, lineHeight: 26, marginBottom: 12 },
  richHeading: { color: BRAND.navyDeep, fontSize: 19, lineHeight: 27, fontWeight: '700', marginTop: 8 },
  bold: { fontWeight: '700', color: BRAND.navyDeep }, italic: { fontStyle: 'italic' },
  inlineLink: { color: BRAND.blue900, textDecorationLine: 'underline', fontWeight: '600' },
  quote: { borderLeftWidth: 3, borderLeftColor: BRAND.blue, paddingLeft: 14, fontStyle: 'italic' },
  code: { backgroundColor: PALETTE.blueSoft, borderRadius: 10, padding: 12 }, codeText: { fontFamily: 'monospace', fontSize: 14 },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, listMarker: { minWidth: 18, color: BRAND.blue900, fontSize: 16, lineHeight: 26, fontWeight: '600' },
  meta: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 21 }, title: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  photo: { marginBottom: 8, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#E0E6EF', backgroundColor: '#EDF2F8' },
  coverPhoto: { marginBottom: 0, borderRadius: 0, borderWidth: 0 },
  photoCaption: { color: PALETTE.textSoft, fontSize: 14, lineHeight: 21, padding: 12, backgroundColor: '#fff' },
  imageLoading: { ...StyleSheet.absoluteFillObject, gap: 10, alignItems: 'center', justifyContent: 'center' },
  imageError: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0F4FA' },
  errorTitle: { fontSize: 15, lineHeight: 22, color: BRAND.navy, fontWeight: '600' }, retry: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  expand: { position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 10, backgroundColor: '#10234BBB', alignItems: 'center', justifyContent: 'center' },
  link: { borderWidth: 1, borderColor: '#D5E0F0', borderRadius: 12, backgroundColor: PALETTE.white, minHeight: 48, padding: 14, marginVertical: 4 }, linkText: { color: BRAND.blue900, fontSize: 15, lineHeight: 22, fontWeight: '600' }, linkHint: { color: PALETTE.textMuted, fontSize: 12, marginTop: 4 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#071332', marginBottom: 14 },
  input: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, color: PALETTE.text, fontSize: 16, marginBottom: 12 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_contentStyles = contentStyles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
