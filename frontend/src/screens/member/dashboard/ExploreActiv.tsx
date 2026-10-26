import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { isUpcomingEvent } from '../../../utils/eventLifecycle';
import { useEventClock } from '../../../utils/useEventClock';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, Skeleton, shortDate,
  BRAND, FadeInUp, PressableScale, PremiumSectionHeader, SiteArtKind, FitImage } from '../../../ui';
import {
  getSiteNav, getLegalLinks, getZones, getLatestNews, getGalleryStrip, getPublicEvents,
  FALLBACK_NAV, FALLBACK_LEGAL, SiteLink, Zone, NewsTeaser, GalleryThumb, EventTeaser,
  toExploreEvents, toExploreGallery, toExploreNews, toExploreZones,
} from '../../../services/websiteContent';
import { WEBSITE_PATHS } from '../../../config/website.config';
import { openWebsitePage } from '../../../services/websiteNavigation';
import { ExploreContact, ExploreSchemes, ExploreZones } from '../../../components/explore/ExploreDestinations';
import { ExploreGradientCard, exploreCardWidth } from '../../../components/explore/ExploreGradientCard';
import type { ExploreContent } from '../../../services/publicContent';

/**
 * ============================================================================
 * EXPLORE ACTIV — the association's public website, from the dashboard
 * ============================================================================
 *
 * Shared by guests and both member dashboards. Members open events in the
 * native booking flow. Guests see the same native programme with public reads.
 *
 *   Page tiles ....... the website's own header menu (GET /cms/site), plus
 *                      Donate and Zones; each with its own drawn glyph
 *   Latest news ...... GET /cms/news — newest three, a paging carousel
 *   Upcoming events .. GET /cms/events?scope=public — the next three
 *   Gallery strip .... GET /cms/gallery?limit=8
 *   Zones & states ... GET /cms/regions/map — /regions/:slug and /states/:slug
 *   Policies ......... GET /cms/legal/links
 *
 * All reads go through services/websiteContent (cached, null-safe). A failed
 * read hides that teaser; the tiles always render (fixed fallback menu).
 */

type Nav = { navigate: (route: string, params?: any) => void; isFocused?: () => boolean; addListener?: (event: string, callback: () => void) => () => void };
export type ExploreSection = 'intro' | 'nav' | 'news' | 'events' | 'gallery' | 'schemes' | 'zones' | 'contact' | 'legal';
const ALL_SECTIONS: readonly ExploreSection[] = ['intro', 'nav', 'news', 'events', 'gallery', 'schemes', 'zones', 'contact', 'legal'];

type TileMeta = { art: SiteArtKind; colors: string[]; blurb: string };

/** Meaning → colour and glyph, by the page's path. Member side: blues, teal, green, amber, rose. */
const TILE_BY_PATH: Record<string, TileMeta> = {
  '/': { art: 'home', colors: ['#1E3A8A', '#3B82F6'], blurb: 'The association at a glance' },
  '/about': { art: 'about', colors: ['#0F766E', '#2DD4BF'], blurb: 'Our story, vision and leaders' },
  '/membership': { art: 'membership', colors: ['#92400E', '#F59E0B'], blurb: 'Plans and what they include' },
  '/events': { art: 'events', colors: ['#9F1239', '#FB7185'], blurb: 'Conclaves, meets and webinars' },
  '/news': { art: 'news', colors: ['#075985', '#38BDF8'], blurb: 'Stories from the chapters' },
  '/schemes': { art: 'schemes', colors: ['#065F46', '#34D399'], blurb: 'Government schemes to use' },
  '/gallery': { art: 'gallery', colors: ['#C2410C', '#FDBA74'], blurb: 'Moments from across India' },
  '/contact': { art: 'contact', colors: ['#334155', '#64748B'], blurb: 'Offices, phone and email' },
  '/donate': { art: 'donate', colors: ['#BE123C', '#F43F5E'], blurb: 'Support ACTIV · 80G receipt' },
  zones: { art: 'zones', colors: ['#0B1A45', '#2563EB'], blurb: 'ACTIV zone by zone' },
  '/zones': { art: 'zones', colors: ['#0B1A45', '#2563EB'], blurb: 'ACTIV zone by zone' },
};

const metaFor = (path: string): TileMeta => {
  const base = `/${String(path || '').split(/[/?#]/)[1] || ''}`;
  return TILE_BY_PATH[path] || TILE_BY_PATH[base] || { art: 'web', colors: ['#1C2E68', '#60A5FA'], blurb: 'On the ACTIV website' };
};

const MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function MediaPlaceholder({ icon, label }: { icon: string; label: string }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  return <View style={x.mediaPlaceholder}><Icon name={icon} size={28} color={BRAND.blue} /><Text style={x.mediaPlaceholderText}>{label}</Text></View>;
}

export default function ExploreActiv({ navigation, refreshKey = 0, sections, showEmpty = false, content, publicAccess = false, onOpenPage }: {
  navigation: Nav; refreshKey?: number; sections?: readonly ExploreSection[]; showEmpty?: boolean; content?: ExploreContent; publicAccess?: boolean;
  onOpenPage?: (path: string, title: string) => void;
}) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const sectionKey = (sections || ALL_SECTIONS).join('|');
  const shown = useMemo(() => new Set(sectionKey.split('|')), [sectionKey]);
  const { width, fontScale } = useWindowDimensions();
  const tileWidth = exploreCardWidth(width, fontScale);
  const [nav, setNav] = useState<SiteLink[]>(FALLBACK_NAV);
  const [legal, setLegal] = useState<SiteLink[]>(FALLBACK_LEGAL);
  const [zones, setZones] = useState<Zone[]>([]);
  const [news, setNews] = useState<NewsTeaser[] | null>(null);
  const [gallery, setGallery] = useState<GalleryThumb[] | null>(null);
  const [events, setEvents] = useState<EventTeaser[] | null>(null);
  const eventNow = useEventClock();
  const upcomingEvents = events?.filter(event => isUpcomingEvent(event, eventNow)) ?? null;
  const [page, setPage] = useState(0);
  const [syncKey, setSyncKey] = useState(0);
  useEffect(() => {
    if (content) return;
    const visible = () => (!navigation.isFocused || navigation.isFocused()) && AppState.currentState !== 'background';
    const refresh = () => { if (visible()) setSyncKey(value => value + 1); };
    const focus = navigation.addListener?.('focus', refresh);
    const app = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = setInterval(refresh, 60000);
    return () => { focus?.(); app.remove(); clearInterval(timer); };
  }, [navigation, content]);

  useEffect(() => {
    // Guest onboarding supplies its anonymous feed; it never reads member credentials.
    if (content) {
      setEvents(toExploreEvents(content.events));
      setGallery(toExploreGallery(content.gallery));
      setNews(toExploreNews(content.news));
      setZones(toExploreZones(content.zones));
      return;
    }
    let cancelled = false;
    const force = refreshKey > 0 || syncKey > 0;
    const safe = <T,>(p: Promise<T>, set: (v: T) => void, fallback: T) => {
      p.then((v) => { if (!cancelled) set(v); }).catch(() => { if (!cancelled) set(fallback); });
    };
    if (shown.has('nav')) safe(getSiteNav(force), (v) => setNav(Array.isArray(v) && v.length ? v : FALLBACK_NAV), FALLBACK_NAV);
    if (shown.has('legal')) safe(getLegalLinks(force), (v) => setLegal(Array.isArray(v) && v.length ? v : FALLBACK_LEGAL), FALLBACK_LEGAL);
    if (shown.has('zones')) safe(getZones(force), (v) => setZones(Array.isArray(v) ? v : []), []);
    if (shown.has('news')) safe(getLatestNews(3, force), (v) => setNews(Array.isArray(v) ? v : []), []);
    if (shown.has('gallery')) safe(getGalleryStrip(8, force), (v) => setGallery(Array.isArray(v) ? v : []), []);
    if (shown.has('events')) safe(getPublicEvents(3, force), (v) => setEvents(Array.isArray(v) ? v : []), []);
    return () => { cancelled = true; };
  }, [refreshKey, syncKey, shown, content]);

  const open = useCallback((path: string, title?: string) => {
    try {
      if (onOpenPage) { onOpenPage(path, title || 'ACTIV'); return; }
      if (path === WEBSITE_PATHS.events) {
        if (publicAccess) navigation.navigate('PublicExplore', { section: 'events' });
        else navigation.navigate('MemberEvents');
        return;
      }
      openWebsitePage(navigation, path, title || 'ACTIV');
    } catch (err) {
      console.warn('Opening the website viewer safely caught:', err);
    }
  }, [navigation, publicAccess, onOpenPage]);

  const tiles = useMemo(() => {
    const quickPaths: string[] = [WEBSITE_PATHS.about, WEBSITE_PATHS.membership, WEBSITE_PATHS.schemes, WEBSITE_PATHS.contact];
    const allNav = [...(nav || [])];
    for (const path of quickPaths) {
      if (!allNav.some(link => link.path === path)) {
        const link = FALLBACK_NAV.find(item => item.path === path);
        if (link) allNav.push(link);
      }
    }
    const list = allNav
      .filter(link => !publicAccess || !['/', '/events', '/news', '/gallery'].includes(link.path))
      .map((l) => ({ key: l.path, label: l.path === WEBSITE_PATHS.about ? 'About ACTIV' : l.path === WEBSITE_PATHS.contact ? 'Contact us' : l.label, path: l.path, meta: metaFor(l.path) }));
    if (!list.some((t) => t.path === WEBSITE_PATHS.donate)) {
      list.push({ key: 'donate', label: 'Donate', path: WEBSITE_PATHS.donate, meta: TILE_BY_PATH['/donate'] });
    }
    if (!list.some(t => t.path === WEBSITE_PATHS.zones)) {
      list.push({ key: 'zones', label: 'Zones & States', path: WEBSITE_PATHS.zones, meta: TILE_BY_PATH.zones });
    }
    return list;
  }, [nav, publicAccess]);

  const cardW = Math.round(Math.min(340, (width || 360) * 0.8));

  return (
    <View>
      {shown.has('intro') && <>
      <PremiumSectionHeader
        title="Explore ACTIV"
        subtitle="News, moments and opportunities in your app"
        action="Explore"
        onAction={() => open(WEBSITE_PATHS.home, 'ACTIV')}
      />

      {/* ---- intro banner */}
      <FadeInUp delay={60}>
        <PressableScale
          onPress={() => open(WEBSITE_PATHS.about, 'About ACTIV')}
          style={x.gutter}
          scaleTo={0.985}
          contentStyle={x.bannerShadow}
          accessibilityRole="button"
          accessibilityLabel="Discover ACTIV. Open the About page."
        >
          <LinearGradient
            colors={[BRAND.navyDeep, BRAND.navy, BRAND.blue900, BRAND.blue]}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={x.banner}
          >
            <View style={x.bannerOrb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={x.bannerEyebrow} maxFontSizeMultiplier={1.2}>ACTIV · activ.org.in</Text>
              <Text style={x.bannerTitle} maxFontSizeMultiplier={1.25}>Adidravidar Confederation of Trade & Industrial Vision</Text>
              <View style={x.bannerCta}>
                <Text style={x.bannerCtaText} maxFontSizeMultiplier={1.2}>Discover our story</Text>
                <Icon name="arrow-forward" size={16} color={BRAND.navy} />
              </View>
            </View>
            <Icon name="public" size={42} color="#C8DBFF" />
          </LinearGradient>
        </PressableScale>
      </FadeInUp>
      </>}

      {/* ---- latest news */}
      {shown.has('news') && (showEmpty || news === null || news.length > 0) ? (
        <>
          <View style={x.subHead}>
            <Text style={x.subTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>Latest news</Text>
            <PressableScale onPress={() => open(WEBSITE_PATHS.news, 'News')} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="All news" hitSlop={8}>
              <Text style={x.subAction} maxFontSizeMultiplier={1.3}>All news</Text>
            </PressableScale>
          </View>
          {news === null ? (
            <View style={x.gutter}><Skeleton width="100%" height={220} radius={22} /></View>
          ) : news.length === 0 ? (
            <Text style={x.empty}>News and chapter updates will appear here.</Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardW + SPACE.md}
                decelerationRate="fast"
                contentContainerStyle={x.newsRow}
                onScroll={(e) => {
                  const xOff = Number(e?.nativeEvent?.contentOffset?.x || 0);
                  const idx = Math.round(xOff / (cardW + SPACE.md));
                  if (idx !== page) setPage(Math.max(0, Math.min(news.length - 1, idx)));
                }}
                scrollEventThrottle={32}
              >
                {news.map((n) => (
                  <View key={n.key} style={[x.newsCard, { width: cardW }]}>
                  <PressableScale
                    onPress={() => open(n.path, 'News')}
                    scaleTo={0.98}
                    style={{ flex: 1 }}
                    contentStyle={{ flex: 1 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.title}. ${n.category}. Read story.`}
                  >
                    <View style={x.newsImgWrap}>
                      {n.image ? (
                        <FitImage uri={n.image} style={x.newsImg} fallback={<MediaPlaceholder icon="article" label="Association news" />} />
                      ) : (
                        <MediaPlaceholder icon="article" label="Association news" />
                      )}
                      <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.75)']} style={x.newsFade} />
                      {n.category ? <View style={x.newsCat}><Text style={x.newsCatText} numberOfLines={1}>{n.category.toUpperCase()}</Text></View> : null}
                      {n.external ? <View style={x.newsExt}><Icon name="open-in-new" size={14} color={PALETTE.white} /></View> : null}
                    </View>
                    <View style={x.newsBody}>
                      <Text style={x.newsTitle} numberOfLines={2} maxFontSizeMultiplier={1.25}>{n.title}</Text>
                      {n.summary ? <Text style={x.newsSummary} numberOfLines={2} maxFontSizeMultiplier={1.25}>{n.summary}</Text> : null}
                      {n.date ? <Text style={x.newsDate} maxFontSizeMultiplier={1.2}>{shortDate(n.date) || n.date}</Text> : null}
                    </View>
                  </PressableScale>
                  </View>
                ))}
              </ScrollView>
              {news.length > 1 ? (
                <View style={x.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {news.map((n, i) => <View key={n.key} style={[x.dot, i === page && x.dotOn]} />)}
                </View>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {/* ---- upcoming public events */}
      {shown.has('events') && (showEmpty || (upcomingEvents && upcomingEvents.length > 0)) ? (
        <>
          <View style={x.subHead}>
            <Text style={x.subTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{sections ? 'Upcoming events' : 'On the public calendar'}</Text>
            <PressableScale onPress={() => open(WEBSITE_PATHS.events, 'Events')} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="All events" hitSlop={8}>
              <Text style={x.subAction} maxFontSizeMultiplier={1.3}>All events</Text>
            </PressableScale>
          </View>
          {upcomingEvents === null ? <View style={x.gutter}><Skeleton width="100%" height={160} radius={22} /></View> : upcomingEvents.length === 0 ? (
            <Text style={x.empty}>New upcoming events will appear here. Open All events to explore the calendar.</Text>
          ) : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.newsRow} snapToInterval={cardW + SPACE.md} decelerationRate="fast">
            {upcomingEvents.map((e) => {
              const d = e.startAt ? new Date(e.startAt) : null;
              const ok = !!d && !Number.isNaN(d.getTime());
              return (
                <View key={e.key} style={[x.eventCard, { width: cardW }]}><View style={x.eventSurface}>
                <PressableScale
                  onPress={() => publicAccess ? navigation.navigate('PublicEventDetail', { id: e.id || e.key }) : e.id
                    ? navigation.navigate('MemberEventDetail', { id: e.id }) : navigation.navigate('MemberEvents')}
                  scaleTo={0.985}
                  style={{ flex: 1 }}
                  contentStyle={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.title}. ${ok && d ? shortDate(e.startAt) : 'Date to be confirmed'}. View event details.`}
                >
                  {e.image && <FitImage uri={e.image} style={x.eventBanner} fallback={<MediaPlaceholder icon="event" label="ACTIV event" />} />}
                  <View style={x.eventRow}>
                  <LinearGradient colors={TILE_BY_PATH['/events'].colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={x.date}>
                    <Text style={x.dateDay} maxFontSizeMultiplier={1.1}>{ok && d ? String(d.getDate()).padStart(2, '0') : '--'}</Text>
                    <Text style={x.dateMon} maxFontSizeMultiplier={1.1}>{ok && d ? MONTHS3[d.getMonth()] : 'TBC'}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={x.eventTitle} numberOfLines={2} maxFontSizeMultiplier={1.25}>{e.title}</Text>
                    <View style={x.eventMeta}>
                      <Icon name={e.mode === 'online' ? 'videocam' : 'place'} size={13} color={PALETTE.textMuted} />
                      <Text style={x.eventMetaText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                        {e.mode === 'online' ? 'Online' : (e.place || 'Venue to be announced')}{e.category ? ` · ${e.category}` : ''}
                      </Text>
                    </View>
                  </View>
                  <Icon name="chevron-right" size={20} color={PALETTE.textFaint} />
                  </View>
                </PressableScale>
                </View></View>
              );
            })}
          </ScrollView>}
        </>
      ) : null}

      {/* ---- gallery strip */}
      {shown.has('gallery') && (showEmpty || gallery === null || gallery.length > 0) ? (
        <>
          <View style={x.subHead}>
            <Text style={x.subTitle} accessibilityRole="header" maxFontSizeMultiplier={1.3}>From the gallery</Text>
            <PressableScale onPress={() => open(WEBSITE_PATHS.gallery, 'Gallery')} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Open the gallery" hitSlop={8}>
              <Text style={x.subAction} maxFontSizeMultiplier={1.3}>Gallery</Text>
            </PressableScale>
          </View>
          {gallery?.length === 0 ? <Text style={x.empty}>Photographs from ACTIV events will appear here.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.photoRow}>
            {gallery === null
              ? [0, 1, 2, 3].map((i) => <Skeleton key={i} width={112} height={112} radius={18} />)
              : gallery.map((g, i) => (
                <FadeInUp key={g.key} delay={Math.min(i, 5) * 50} distance={8}>
                  <PressableScale
                    onPress={() => open(g.path, 'Gallery')}
                    scaleTo={0.95}
                    contentStyle={x.photo}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.title || 'Photo'}. Opens in the gallery.`}
                  >
                    <FitImage uri={g.image} style={x.photoImg} fallback={<MediaPlaceholder icon="photo-library" label="Gallery" />} />
                    {g.title ? (
                      <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.8)']} style={x.photoCap}>
                        <Text style={x.photoCapText} numberOfLines={2} maxFontSizeMultiplier={1.1}>{g.title}</Text>
                      </LinearGradient>
                    ) : null}
                  </PressableScale>
                </FadeInUp>
              ))}
          </ScrollView>}
        </>
      ) : null}

      {shown.has('schemes') && <View style={x.gutter}><ExploreSchemes openPage={open} /></View>}
      {shown.has('zones') && <View style={x.gutter}><ExploreZones zones={zones} openPage={open} variant="preview" /></View>}
      {shown.has('contact') && <View style={x.gutter}><ExploreContact openPage={open} refreshKey={refreshKey + syncKey} /></View>}

      {/* ---- page directory */}
      {shown.has('nav') && <View style={x.directory}>
        <Text style={x.directoryTitle} accessibilityRole="header">Explore more</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.tileRow}
          snapToInterval={tileWidth + 12} decelerationRate="fast" keyboardShouldPersistTaps="handled">
          {tiles.map(t => <ExploreGradientCard key={t.key} title={t.label} description={t.meta.blurb}
            colors={t.meta.colors} art={t.meta.art} width={tileWidth} onPress={() => open(t.path, t.label)}
            accessibilityLabel={`${t.label}. ${t.meta.blurb}. Explore in ACTIV.`} />)}
        </ScrollView>
      </View>}

      {/* ---- policies */}
      {shown.has('legal') && <View style={x.legal}>
        {legal.map((l, i) => (
          <React.Fragment key={l.path}>
            {i > 0 ? <Text style={x.legalDot}>·</Text> : null}
            <PressableScale onPress={() => open(l.path, l.label)} scaleTo={0.95} accessibilityRole="link" accessibilityLabel={l.label} hitSlop={6}>
              <Text style={x.legalText} maxFontSizeMultiplier={1.2}>{l.label}</Text>
            </PressableScale>
          </React.Fragment>
        ))}
      </View>}
    </View>
  );
}

const x = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  empty: { ...TYPE.body, color: PALETTE.textMuted, marginHorizontal: SPACE.lg, padding: SPACE.lg, borderRadius: 18, backgroundColor: PALETTE.white },
  center: { alignItems: 'center', justifyContent: 'center' },

  bannerShadow: {
    borderRadius: 22, backgroundColor: BRAND.navy, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 8,
  },
  banner: { borderRadius: 22, padding: SPACE.lg, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, overflow: 'hidden' },
  bannerOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -80, backgroundColor: 'rgba(96,165,250,0.2)' },
  bannerEyebrow: { ...TYPE.eyebrow, fontSize: 10, color: BRAND.onBrandFaint },
  bannerTitle: { ...TYPE.subheading, color: PALETTE.white, marginTop: SPACE.xs, lineHeight: 21 },
  bannerCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: PALETTE.white,
    borderRadius: 999, paddingHorizontal: SPACE.md, minHeight: 32, marginTop: SPACE.md,
  },
  bannerCtaText: { fontSize: 13, fontWeight: '800', color: BRAND.navy },

  directory: { paddingTop: 24, paddingBottom: 8 },
  directoryTitle: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 28, fontWeight: '700', marginBottom: 6, marginHorizontal: SPACE.lg },
  tileRow: { paddingHorizontal: SPACE.lg, paddingTop: 8, paddingBottom: 12, gap: 12, alignItems: 'stretch' },

  subHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.xl, marginBottom: SPACE.md },
  subTitle: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 28, fontWeight: '700', flexShrink: 1 },
  subAction: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blue },

  newsRow: { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.sm, alignItems: 'stretch' },
  newsCard: {
    backgroundColor: PALETTE.white, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
  },
  newsImgWrap: { height: 138, borderTopLeftRadius: 21, borderTopRightRadius: 21, overflow: 'hidden', backgroundColor: PALETTE.field },
  newsImg: { width: '100%', height: '100%' },
  mediaPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: '#EDF2FA' },
  mediaPlaceholderText: { color: BRAND.navy, fontSize: 13, lineHeight: 19, fontWeight: '500', textAlign: 'center' },
  newsFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  newsCat: { position: 'absolute', left: SPACE.md, bottom: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: SPACE.sm, paddingVertical: 2, maxWidth: '70%' },
  newsCatText: { fontSize: 10, lineHeight: 14, fontWeight: '800', color: PALETTE.white, letterSpacing: 0.8 },
  newsExt: { position: 'absolute', right: SPACE.md, top: SPACE.md, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(11,26,69,0.5)', alignItems: 'center', justifyContent: 'center' },
  newsBody: { padding: SPACE.md, paddingBottom: SPACE.lg, flexGrow: 1 },
  newsTitle: { color: BRAND.navyDeep, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  newsSummary: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 22, marginTop: SPACE.xs },
  newsDate: { fontSize: 12, lineHeight: 18, color: PALETTE.textMuted, marginTop: 'auto', paddingTop: SPACE.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACE.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE.borderStrong },
  dotOn: { width: 18, backgroundColor: PALETTE.blue },

  eventCard: {
    backgroundColor: PALETTE.white, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)',
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2,
  },
  eventSurface: { overflow: 'hidden', borderRadius: 22, backgroundColor: PALETTE.white, flex: 1 },
  eventBanner: { width: '100%', aspectRatio: 16 / 9, backgroundColor: PALETTE.blueSoft },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.md, minHeight: 104, flexGrow: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  date: { width: 48, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'] },
  dateMon: { fontSize: 9.5, lineHeight: 12, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1 },
  eventTitle: { ...TYPE.bodyStrong },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  eventMetaText: { ...TYPE.caption, fontWeight: '400', flexShrink: 1 },

  photoRow: { paddingHorizontal: SPACE.lg, gap: SPACE.sm, paddingBottom: SPACE.xs },
  photo: { width: 112, height: 112, borderRadius: 18, overflow: 'hidden', backgroundColor: PALETTE.field },
  photoImg: { width: '100%', height: '100%' },
  photoCap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: SPACE.sm, paddingTop: SPACE.lg, paddingBottom: SPACE.sm },
  photoCapText: { fontSize: 10.5, lineHeight: 13, fontWeight: '700', color: PALETTE.white },

  legal: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.lg, marginHorizontal: SPACE.lg },
  legalDot: { color: PALETTE.textFaint },
  legalText: { fontSize: 12, lineHeight: 18, color: PALETTE.textMuted, fontWeight: '600', paddingVertical: SPACE.xs },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_x = x;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
