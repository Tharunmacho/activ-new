import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { useAppTheme } from '../../../ui/AppTheme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Easing, Linking, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  BRAND, PREMIUM_GRADIENTS, GlassIconButton, GradientButton, FloatingIllustration, FadeInUp, WebsiteGlobe3D,
} from '../../../ui';
import { WEBSITE_ORIGIN, isWebsiteUrl, publicWebsiteUrl, websiteUrl } from '../../../config/website.config';
import { publicActionFor, publicWebsitePath } from '../../../utils/publicBrowse';
import { openPublicAction } from '../../../services/publicNavigation';
import PublicContentScreen from '../../public/PublicContentScreen';
import PublicInfoScreen from '../../public/PublicInfoScreen';
import PublicExploreScreen from '../../public/PublicExploreScreen';
import PublicEventDetailScreen from '../../public/PublicEventDetailScreen';
import { nativeContentRoute } from '../../../services/nativeContentRoute';

/*
 * The in-app browser, required lazily and guarded (RULE 2.4): a build without
 * the native module falls back to "Open in browser" instead of crashing.
 */
let WebViewComp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebViewComp = require('react-native-webview').WebView || null;
} catch {
  WebViewComp = null;
}

/**
 * ============================================================================
 * WEBSITE VIEWER — one page of activ.org.in, inside the app
 * ============================================================================
 *
 *   route params  { url?: string; path?: string; title?: string }
 *
 * Opened from "Explore ACTIV" on the member dashboards. A premium bar (back,
 * page title + host, reload, open in browser), a thin progress line while a
 * page loads, and an error state with retry.
 *
 * - Pages on the association's own site stay in the viewer; anything else
 *   (a news story's source, a social profile, tel:/mailto:/WhatsApp) is handed
 *   to the phone, so the viewer never becomes a general browser.
 * - Android back walks the page history first, then leaves the screen.
 * - No member session is passed. Public browsing uses an isolated web session;
 *   its small message bridge hands account actions back to native navigation.
 */

const hostOf = (url: string) => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(String(url || ''));
  return m ? m[1].replace(/^www\./i, '') : '';
};

const WebsiteViewerScreen = ({ navigation, route }: any) => {
  const { isDark } = useAppTheme();
  const initialAppearance = useRef(isDark ? 'dark' : 'light').current;
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const publicMode = params.publicAccess === true;
  const startUrl = useMemo(() => {
    const raw = String(params?.url || params?.path || '').trim();
    const base = websiteUrl(raw || '/');
    const publicUrl = publicMode ? publicWebsiteUrl(base) : base;
    const hashAt = publicUrl.indexOf('#');
    const page = hashAt < 0 ? publicUrl : publicUrl.slice(0, hashAt);
    const fragment = hashAt < 0 ? '' : publicUrl.slice(hashAt);
    const url = publicMode ? `${page}${page.includes('?') ? '&' : '?'}appTheme=${initialAppearance}${fragment}` : publicUrl;
    // Only the association's own site is ever loaded here.
    return isWebsiteUrl(url) ? url : `${WEBSITE_ORIGIN}/`;
  }, [params?.url, params?.path, publicMode, initialAppearance]);
  const fallbackTitle = String(params?.title || 'ACTIV');

  const web = useRef<any>(null);
  const appearanceScript = `window.__ACTIV_APP_THEME__ = '${isDark ? 'dark' : 'light'}'; window.dispatchEvent(new CustomEvent('activ:theme-changed', {detail: {mode: window.__ACTIV_APP_THEME__}})); true;`;
  useEffect(() => {
    if (publicMode) web.current?.injectJavaScript?.(appearanceScript);
  }, [publicMode, appearanceScript]);
  const [currentUrl, setCurrentUrl] = useState(startUrl);
  const [pageTitle, setPageTitle] = useState(fallbackTitle);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const openingAction = useRef(false);
  useEffect(() => {
    setCurrentUrl(startUrl);
    setPageTitle(fallbackTitle);
    setCanGoBack(false);
    setFailed(false);
    setLoading(true);
    setReloadKey(0);
    progress.setValue(0);
  }, [startUrl, fallbackTitle, progress]);
  const memberAction = useCallback(async (path: string) => {
    const action = publicActionFor(path);
    if (!action || openingAction.current) return;
    openingAction.current = true;
    try { await openPublicAction(navigation, action); }
    catch (err: any) { Alert.alert('ACTIV', err?.response?.data?.message || err?.message || 'Please try again.'); }
    finally { openingAction.current = false; }
  }, [navigation]);

  const openInBrowser = useCallback(async (url?: string) => {
    try {
      if (typeof Linking?.openURL === 'function') await Linking.openURL(url || currentUrl || startUrl);
    } catch (err) {
      console.warn('Open in browser safely caught:', err);
    }
  }, [currentUrl, startUrl]);

  const close = useCallback(() => {
    try {
      if (navigation?.canGoBack?.()) navigation.goBack();
      else navigation?.reset?.({ index: 0, routes: [{ name: publicMode ? 'PublicExplore' : 'MemberMain' }] });
    } catch (err) {
      console.warn('Closing the viewer safely caught:', err);
    }
  }, [navigation, publicMode]);

  // Android back: the page's own history first.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && web.current && !failed) {
        try { web.current.goBack(); return true; } catch { return false; }
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, failed]);

  const setBar = (v: number) => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(1, v)),
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const reload = () => {
    setFailed(false);
    setLoading(true);
    progress.setValue(0);
    // A remount recovers from a hard failure where reload() would not.
    setReloadKey((k) => k + 1);
  };

  const onShouldStart = (req: any) => {
    const url = String(req?.url || '');
    // Embedded frames (a map, a video) load inside the page; only top-level navigations are routed.
    if (req?.isTopFrame === false) return true;
    if (!url || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
    if (isWebsiteUrl(url)) {
      if (publicMode && publicActionFor(url)) { memberAction(url); return false; }
      return true;
    }
    // Anything else leaves the app: other sites, tel:, mailto:, whatsapp:, intent:.
    openInBrowser(url);
    return false;
  };

  const host = hostOf(currentUrl) || hostOf(startUrl);
  const top = Number(insets?.top || 0);
  const scaleX = progress.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] });

  const bar = (
    <LinearGradient
      colors={PREMIUM_GRADIENTS.memberHeader}
      locations={[0, 0.38, 0.72, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.bar, { paddingTop: top + SPACE.sm }]}
    >
      <View style={s.barOrb} />
      <GlassIconButton
        icon={canGoBack && !failed ? (Platform.OS === 'ios' ? 'arrow-back-ios-new' : 'arrow-back') : 'close'}
        onPress={() => {
          if (canGoBack && web.current && !failed) {
            try { web.current.goBack(); return; } catch { /* fall through to close */ }
          }
          close();
        }}
        accessibilityLabel={canGoBack && !failed ? 'Previous page' : 'Close'}
      />
      <View style={s.titleBox}>
        <Text style={s.title} numberOfLines={1} maxFontSizeMultiplier={1.2}>{pageTitle || fallbackTitle}</Text>
        <View style={s.hostRow}>
          <Icon name="lock" size={11} color={BRAND.onBrandFaint} />
          <Text style={s.host} numberOfLines={1} maxFontSizeMultiplier={1.2}>{host || 'activ.org.in'}</Text>
        </View>
      </View>
      <GlassIconButton icon="refresh" onPress={reload} accessibilityLabel="Reload page" />
      <GlassIconButton icon="open-in-new" onPress={() => openInBrowser()} accessibilityLabel="Open in browser" style={{ marginLeft: SPACE.sm }} />
    </LinearGradient>
  );

  const progressLine = (
    <View style={s.progressTrack} pointerEvents="none">
      {loading && !failed ? (
        <Animated.View style={[s.progressFill, { transform: [{ scaleX }] }]}>
          <LinearGradient colors={['#60A5FA', '#34D399']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );

  const errorView = (
    <View style={s.error}>
      <FadeInUp scaleFrom={0.85}>
        <View style={s.errorArt}>
          <FloatingIllustration size={120}>
            <WebsiteGlobe3D size={120} />
          </FloatingIllustration>
        </View>
      </FadeInUp>
      <FadeInUp delay={80}>
        <Text style={s.errorTitle} maxFontSizeMultiplier={1.3}>This page did not load</Text>
        <Text style={s.errorText} maxFontSizeMultiplier={1.3}>
          Check your connection and try again, or open it in your browser.
        </Text>
        <GradientButton label="Try again" icon="refresh" onPress={reload} style={{ marginTop: SPACE.xl }} />
        <GradientButton label="Open in browser" icon="open-in-new" variant="outline" onPress={() => openInBrowser()} style={{ marginTop: SPACE.sm }} />
      </FadeInUp>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      {bar}
      {progressLine}
      {!WebViewComp ? errorView : failed ? errorView : (
        <WebViewComp
          key={`${startUrl}#${reloadKey}`}
          ref={web}
          source={{ uri: startUrl }}
          style={s.web}
          originWhitelist={['https://*', 'http://*']}
          javaScriptEnabled
          domStorageEnabled
          incognito={publicMode}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          injectedJavaScriptBeforeContentLoaded={publicMode ? `window.__ACTIV_PUBLIC_APP__ = true; ${appearanceScript}` : undefined}
          onMessage={(event: any) => {
            if (!publicMode || !publicWebsitePath(String(event?.nativeEvent?.url || ''))) return;
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message?.type === 'ACTIV_MEMBER_ACTION' && typeof message.path === 'string' && message.path.length < 2048) memberAction(message.path);
            } catch { /* Unrecognised web messages never become app commands. */ }
          }}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={onShouldStart}
          onLoadStart={() => { setLoading(true); setBar(0.1); }}
          onLoadProgress={(e: any) => setBar(Number(e?.nativeEvent?.progress || 0))}
          onLoadEnd={() => { if (publicMode) web.current?.injectJavaScript?.(appearanceScript); setBar(1); setTimeout(() => setLoading(false), 220); }}
          onNavigationStateChange={(nav: any) => {
            setCanGoBack(!!nav?.canGoBack);
            if (nav?.url) setCurrentUrl(String(nav.url));
            const t = String(nav?.title || '').trim();
            // Some pages report the URL as the title while loading.
            if (t && !/^https?:\/\//i.test(t)) setPageTitle(t.replace(/\s*[|–-]\s*ACTIV.*$/i, '') || fallbackTitle);
          }}
          onError={() => { setFailed(true); setLoading(false); }}
          onHttpError={(e: any) => {
            // A 5xx on the page itself is a failed load; a missing image is not.
            const code = Number(e?.nativeEvent?.statusCode || 0);
            if (code >= 500) { setFailed(true); setLoading(false); }
          }}
        />
      )}
      <View style={{ height: Number(insets?.bottom || 0), backgroundColor: PALETTE.canvas }} />
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.white },
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingBottom: SPACE.md, overflow: 'hidden' },
  barOrb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -60, top: -110, backgroundColor: 'rgba(96,165,250,0.18)' },
  titleBox: { flex: 1, minWidth: 0, marginHorizontal: SPACE.xs },
  title: { ...TYPE.subheading, color: PALETTE.white },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  host: { fontSize: 11.5, lineHeight: 15, color: BRAND.onBrandFaint },
  progressTrack: { height: 3, backgroundColor: PALETTE.blueSoft, overflow: 'hidden' },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transformOrigin: 'left' } as any,
  web: { flex: 1, backgroundColor: PALETTE.white },
  error: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACE.xl, backgroundColor: PALETTE.canvas },
  errorArt: {
    alignSelf: 'center', width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center',
    backgroundColor: BRAND.navy, marginBottom: SPACE.xl,
  },
  errorTitle: { ...TYPE.title, textAlign: 'center' },
  errorText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.sm },
});

export default function WebsiteOrArticleScreen(props: any) {
  const destination = nativeContentRoute(String(props.route?.params?.path || props.route?.params?.url || '/'), props.route?.params?.title);
  const Screen = destination?.name === 'PublicContent' ? PublicContentScreen : destination?.name === 'PublicInfo' ? PublicInfoScreen
    : destination?.name === 'PublicExplore' ? PublicExploreScreen : destination?.name === 'PublicEventDetail' ? PublicEventDetailScreen : null;
  return Screen ? <Screen {...props} route={{ ...props.route, params: destination?.params }} /> : <WebsiteViewerScreen {...props} />;
}

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
