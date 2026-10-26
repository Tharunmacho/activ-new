import { useLegacyAppearance } from '../../ui/legacyAppearance';
import { AppearanceToggle } from '../../ui/AppearanceToggle';
import EventFilters from '../../components/EventFilters';
import { EMPTY_EVENT_FILTERS, matchesEventFilters } from '../../utils/eventFilters';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Keyboard, RefreshControl, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  BRAND, PALETTE, SPACE, BrandFrame, BrandHeaderBlock, BrandLogo, CardSkeletons, PREMIUM_OVERLAP,
  GradientButton,
  PressableScale, StateView, SurfaceCard,
} from '../../ui';
import { WEBSITE_PATHS } from '../../config/website.config';
import { loadExploreContent, ExploreContent, ExploreSection } from '../../services/publicContent';
import { isUpcomingEvent } from '../../utils/eventLifecycle';
import { useEventClock } from '../../utils/useEventClock';
import { clearPublicAction } from '../../services/publicNavigation';
import { openWebsitePage } from '../../services/websiteNavigation';
import ExploreActiv from '../member/dashboard/ExploreActiv';
import { PublicContentCard, publicRecordKey } from './PublicExploreCards';
import { ExploreZones } from '../../components/explore/ExploreDestinations';
import PublicNotificationsCard from '../../components/PublicNotificationsCard';

const TABS: { key: ExploreSection; label: string; icon: string; title: string; subtitle: string }[] = [
  { key: 'home', label: 'Home', icon: 'home', title: 'Connect. Empower. Grow.', subtitle: 'Your community. Your next opportunity.' },
  { key: 'events', label: 'Events', icon: 'event', title: 'Events & programmes', subtitle: 'Discover upcoming events and programmes.' },
  { key: 'gallery', label: 'Gallery', icon: 'collections', title: 'Community gallery', subtitle: 'A closer look at our community in action.' },
  { key: 'news', label: 'News', icon: 'newspaper', title: 'News from ACTIV', subtitle: 'The latest from the ACTIV community.' },
  { key: 'zones', label: 'Zones', icon: 'public', title: 'Our zones & states', subtitle: 'Find your region and explore local updates.' },
];
const EMPTY: ExploreContent = { events: [], news: [], gallery: [], zones: [] };

export default function PublicExploreScreen({ navigation, route }: any) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<ExploreSection>(() => TABS.find(tab => tab.key === route?.params?.section)?.key || 'home');
  const [query, setQuery] = useState('');
  const [eventFilters, setEventFilters] = useState({ ...EMPTY_EVENT_FILTERS });
  const [data, setData] = useState<ExploreContent>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [contactRefresh, setContactRefresh] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [noticeId, setNoticeId] = useState<string | undefined>();
  const now = useEventClock();
  const abort = useRef<AbortController | null>(null);
  const list = useRef<FlatList<any>>(null);
  useEffect(() => {
    if (route?.params?.notifications !== 'open') return;
    setNoticeId(route.params.noticeId);
    setNotificationsOpen(true);
    navigation.setParams?.({ notifications: undefined, noticeId: undefined });
  }, [navigation, route?.params?.notifications, route?.params?.noticeId]);
  useEffect(() => {
    const requested = TABS.find(tab => tab.key === route?.params?.section)?.key;
    if (!requested) return;
    setSection(requested);
    setQuery('');
    list.current?.scrollToOffset({ offset: 0, animated: false });
    navigation.setParams?.({ section: undefined });
  }, [navigation, route?.params?.section]);
  const read = useCallback(async (refresh = false) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError('');
    setRefreshing(refresh);
    if (!refresh) setLoading(true);
    try {
      const result = await loadExploreContent(section, controller.signal);
      if (!controller.signal.aborted) setData(result);
    } catch {
      if (!controller.signal.aborted) setError('Check your connection and try again.');
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [section]);
  useEffect(() => {
    read();
    const visible = () => (!navigation.isFocused || navigation.isFocused()) && AppState.currentState !== 'background';
    const focus = navigation.addListener?.('focus', () => { if (abort.current?.signal.aborted) void read(true); });
    const blur = navigation.addListener?.('blur', () => abort.current?.abort());
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && visible()) void read(true); });
    const timer = setInterval(() => { if (visible()) void read(true); }, 60000);
    return () => { abort.current?.abort(); focus?.(); blur?.(); subscription.remove(); clearInterval(timer); };
  }, [read, navigation]);

  const switchTab = (tab: ExploreSection) => {
    Keyboard.dismiss();
    setQuery('');
    if (tab !== section) { setLoading(true); setError(''); setSection(tab); }
    list.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const openPage = (path: string, title: string) => {
    const eventPath = /^\/events\/([^/?#]+)\/?$/.exec(path);
    const tabs: Partial<Record<string, ExploreSection>> = { '/': 'home', '/events': 'events', '/news': 'news', '/gallery': 'gallery' };
    const nativeTab = tabs[path];
    if (eventPath) navigation.navigate('PublicEventDetail', { id: decodeURIComponent(eventPath[1]) });
    else if (nativeTab) switchTab(nativeTab);
    else openWebsitePage(navigation, path, title);
  };
  const signIn = () => { clearPublicAction(); navigation.navigate('Login'); };
  const join = () => { clearPublicAction(); navigation.navigate('RegistrationStep1'); };
  const records = useMemo(() => {
    let items = section === 'home' ? [] : data[section];
    if (section === 'events') items = items.filter(e => isUpcomingEvent(e, now) && matchesEventFilters(e, { ...eventFilters, q: query }))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    if (section === 'events') return items;
    const needle = query.trim().toLocaleLowerCase();
    return needle ? items.filter(item => [item.title, item.caption, item.label, item.name, item.category, item.summary,
      item.location, item.venue, item.state, ...(Array.isArray(item.states) ? item.states : []).map((state: any) => state?.name)]
      .join(' ').toLocaleLowerCase().includes(needle)) : items;
  }, [section, data, query, now, eventFilters]);
  const tab = TABS.find(item => item.key === section) || TABS[0];
  const compact = width < 360;
  const ready = !loading && !error;
  const home = <View style={s.homeContent}>
    {loading && <View style={s.gutter}><CardSkeletons rows={2} variant="media" /></View>}
    {!!error && <View style={s.gutter}><StateView kind="error" title="Unable to load content" message={error} onAction={() => read()} compact /></View>}
    {ready && <>
      <ExploreActiv navigation={navigation} sections={['events']} content={data} publicAccess showEmpty />
      <ExploreActiv navigation={navigation} sections={['gallery']} content={data} publicAccess showEmpty />
      <ExploreActiv navigation={navigation} sections={['news']} content={data} publicAccess showEmpty />
    </>}
    <ExploreActiv navigation={navigation} sections={['schemes', 'zones']} content={data} publicAccess refreshKey={contactRefresh} />
    <ExploreActiv navigation={navigation} sections={['nav']} content={data} publicAccess onOpenPage={openPage} />
    <View style={s.gutter}>
    <SurfaceCard padded={false} style={s.joinCard}>
        <LinearGradient colors={[BRAND.navyDeep, BRAND.blue900]} style={s.joinInner}>
          <View style={s.joinOrb} />
          <View style={s.joinHeading}>
            <View style={s.flex}><Text style={s.joinEyebrow}>GROW WITH ACTIV</Text>
              <Text style={s.joinTitle}>{'Your community.\nYour next chapter.'}</Text></View>
            <View style={s.joinArt}><Icon name="groups" size={30} color={PALETTE.white} /></View>
          </View>
          <Text style={s.joinCopy}>Build connections, discover opportunities and grow together.</Text>
          <GradientButton label="Become a member" iconRight="arrow-forward" variant="glass" onPress={join} style={s.joinButton} />
          <PressableScale onPress={() => openPage(WEBSITE_PATHS.membership, 'Membership')} accessibilityRole="link" accessibilityLabel="Discover membership benefits" contentStyle={s.joinBenefits}>
            <Text style={s.joinBenefitsText}>Discover membership benefits</Text><Icon name="arrow-forward" size={14} color={BRAND.onBrandSoft} />
          </PressableScale>
        </LinearGradient>
    </SurfaceCard>
    </View>
    <ExploreActiv navigation={navigation} sections={['contact']} publicAccess refreshKey={contactRefresh} />
  </View>;

  const tabs = <View style={[s.tabs, {
    paddingBottom: Math.max(insets.bottom, 8),
    paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12),
  }]}>
    <LinearGradient colors={[BRAND.navy, BRAND.blue900, '#234DB3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tabRow}>{TABS.map(item => {
      const selected = section === item.key;
      return <PressableScale key={item.key} onPress={() => switchTab(item.key)} accessibilityRole="tab" accessibilityLabel={item.label}
        accessibilityState={{ selected }} style={s.tab} contentStyle={[s.tabContent, selected && s.tabContentSelected]}>
        <View style={s.tabIcon}><Icon name={item.icon} size={24} color={selected ? BRAND.blue900 : '#DCE8FF'} /></View>
        <Text style={[s.tabText, selected && s.tabTextSelected]} numberOfLines={2} maxFontSizeMultiplier={1.5}>{item.label}</Text>
      </PressableScale>;
    })}</LinearGradient>
  </View>;

  return <BrandFrame footer={tabs}>
    <FlatList ref={list} data={section !== 'home' && section !== 'zones' && ready ? records : []}
      keyExtractor={(item, index) => publicRecordKey(item) || String(index)}
      renderItem={({ item }) => <View style={s.gutter}><PublicContentCard item={item} kind={section as 'events' | 'news' | 'gallery'} openPage={openPage} /></View>}
      contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setContactRefresh(value => value + 1); read(true); }} colors={[BRAND.blue]} tintColor={PALETTE.white} progressViewOffset={insets.top} />}
      ListHeaderComponent={<>
        <BrandHeaderBlock waveHeight={52}>
          <View style={s.heroContent}>
            <View style={s.topbar}><BrandLogo size="sm" />
              <View style={s.headerActions}>
              <PressableScale accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => { setNoticeId(undefined); setNotificationsOpen(true); }} contentStyle={[s.signIn, s.notificationButton]}>
                <Icon name="notifications-none" size={23} color={PALETTE.white} />
              </PressableScale>
              <PressableScale accessibilityRole="button" accessibilityLabel="Sign in" onPress={signIn} contentStyle={s.signIn}>
                <Icon name="login" size={17} color={PALETTE.white} /><Text style={s.signInText}>Sign in</Text>
              </PressableScale>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', marginTop: SPACE.sm }}><AppearanceToggle glass /></View>
            <View style={s.heroRow}>
              <View style={s.heroText}><Text style={s.eyebrow}>{section === 'home' ? 'WELCOME TO ACTIV' : 'EXPLORE / ' + tab.label.toUpperCase()}</Text>
                <Text style={[s.heroTitle, compact && s.heroTitleCompact]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>{tab.title}</Text>
              </View>
            </View>
            <Text style={s.heroSubtitle}>{tab.subtitle}</Text>
          </View>
        </BrandHeaderBlock>
        {section === 'home' ? home : section === 'zones' ? (ready && <View style={[s.gutter, s.directoryOverlap]}><ExploreZones zones={data.zones} openPage={openPage} /></View>) : <View style={[s.gutter, s.searchWrap]}>
          <SurfaceCard padded={false} contentStyle={s.searchInner}>
            <View style={s.searchIcon}><Icon name="search" size={23} color={BRAND.blue} /></View>
            <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder={'Search ' + tab.label.toLowerCase()}
              placeholderTextColor={PALETTE.textMuted} accessibilityLabel={'Search ' + tab.label.toLowerCase()} returnKeyType="search" autoCorrect={false} />
            {!!query && <PressableScale onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear search" contentStyle={s.clearSearch}>
              <Icon name="close" size={20} color={PALETTE.textMuted} />
            </PressableScale>}
          </SurfaceCard>
          {ready && <View style={s.resultHeading}><Text style={s.resultTitle}>{section === 'events' ? 'Upcoming events' : 'Discover ' + tab.label.toLowerCase()}</Text>
            <View style={s.count}><Text style={s.countText} accessibilityLabel={records.length + ' results'}>{records.length}</Text></View>
          </View>}
        </View>}
        {section === 'events' && <View style={s.gutter}><EventFilters events={data.events} value={eventFilters} onChange={setEventFilters} search={false} /></View>}
        {section !== 'home' && loading && <View style={s.gutter}><CardSkeletons rows={2} variant="media" /></View>}
        {section !== 'home' && !!error && <View style={s.gutter}><StateView kind="error" title="Unable to load content" message={error} onAction={() => read()} compact /></View>}
      </>}
      ListEmptyComponent={ready && section !== 'home' && section !== 'zones' && !records.length ? <View style={s.gutter}><StateView compact title={query.trim() ? 'No matching results' : section === 'events' ? 'More events on the way' : 'More to discover soon'}
        message={query.trim() ? 'Try another name or clear your search.' : section === 'events' ? 'Upcoming programmes will appear here when announced.' : 'Check back for updates from the ACTIV community.'}
        action={query.trim() ? 'Clear search' : undefined} onAction={query.trim() ? () => setQuery('') : undefined} /></View> : null}
      ListFooterComponent={section === 'home' ? <View style={[s.gutter, s.footer]}>
        <View style={s.legal}>{[
          ['Privacy policy', '/privacy-policy', 'shield'], ['Terms of use', '/terms-and-conditions', 'description'], ['Delete account', WEBSITE_PATHS.deleteAccount, 'manage-accounts'],
        ].map(([label, path, icon]) => <PressableScale key={path} accessibilityRole="link" accessibilityLabel={label} onPress={() => openPage(path, label)} style={s.legalItem} contentStyle={s.legalLink}>
          <Icon name={icon} size={19} color="#9AC7FF" /><Text style={s.legalText} maxFontSizeMultiplier={1.2}>{label}</Text>
        </PressableScale>)}</View>
        <Text style={s.footerText}>ACTIV · Connect. Empower. Grow.</Text>
      </View> : null}
    />
    <PublicNotificationsCard visible={notificationsOpen} noticeId={noticeId} onClose={() => setNotificationsOpen(false)} navigation={navigation} />
  </BrandFrame>;
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationButton: { width: 44, height: 44, paddingHorizontal: 0, justifyContent: 'center', borderRadius: 22 },
  flex: { flex: 1, minWidth: 0 }, body: { flexGrow: 1, backgroundColor: PALETTE.canvas, paddingBottom: SPACE.sm },
  contentRow: { paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.md, alignItems: 'stretch' },
  gutter: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: SPACE.lg },
  heroContent: { width: '100%', maxWidth: 680, alignSelf: 'center' }, topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  signIn: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, paddingHorizontal: 15, borderRadius: 16, backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder },
  signInText: { color: PALETTE.white, fontSize: 13, fontWeight: '700' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg }, heroText: { flex: 1, minWidth: 0 },
  eyebrow: { color: BRAND.onBrandSoft, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, fontWeight: '800', marginBottom: 9 },
  heroTitle: { color: PALETTE.white, fontSize: 28, lineHeight: 35, letterSpacing: -0.4, fontWeight: '700' }, heroTitleCompact: { fontSize: 25, lineHeight: 32 },
  heroSubtitle: { color: BRAND.onBrandSoft, fontSize: 16, lineHeight: 24, marginTop: SPACE.md, paddingBottom: SPACE.sm },
  homeContent: { marginTop: 0 }, directoryOverlap: { marginTop: -PREMIUM_OVERLAP },
  joinCard: { marginBottom: SPACE.md }, joinInner: { padding: SPACE.lg, overflow: 'hidden' }, joinTitle: { color: PALETTE.white, fontSize: 22, lineHeight: 30, fontWeight: '700' },
  joinOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -75, top: -70, backgroundColor: '#60A5FA22' },
  joinHeading: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  joinEyebrow: { color: '#A5C8FF', fontSize: 10, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  joinArt: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder },
  joinBenefits: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 3 },
  joinBenefitsText: { color: BRAND.onBrandSoft, fontSize: 12, fontWeight: '600' },
  joinCopy: { color: BRAND.onBrandSoft, fontSize: 14, lineHeight: 22, marginTop: SPACE.sm }, joinButton: { marginTop: SPACE.lg },
  searchWrap: { marginTop: -PREMIUM_OVERLAP, marginBottom: SPACE.sm }, searchInner: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  searchIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 12, paddingHorizontal: 0, color: PALETTE.text, fontSize: 15, fontWeight: '500' }, clearSearch: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: SPACE.lg, marginBottom: SPACE.sm }, resultTitle: { flexShrink: 1, color: BRAND.navyDeep, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  count: { backgroundColor: PALETTE.blueSoft, borderRadius: 9, minWidth: 26, paddingVertical: 4, paddingHorizontal: 8, alignItems: 'center' }, countText: { fontSize: 12, fontWeight: '700', color: BRAND.blue900 },
  footer: { paddingTop: SPACE.sm, paddingBottom: SPACE.md }, legal: { flexDirection: 'row', gap: 7, backgroundColor: BRAND.navy, padding: 9, borderRadius: 20 },
  legalItem: { flex: 1, minWidth: 0 }, legalLink: { minHeight: 70, paddingHorizontal: 3, paddingVertical: 10, gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FFFFFF0D' },
  legalText: { color: '#E5EEFF', fontSize: 10.5, lineHeight: 15, textAlign: 'center', fontWeight: '600' }, footerText: { color: PALETTE.textMuted, fontSize: 10, textAlign: 'center', marginTop: 10 },
  tabs: { backgroundColor: PALETTE.canvas, paddingTop: 8 },
  tabRow: { flexDirection: 'row', width: '100%', maxWidth: 720, alignSelf: 'center', gap: 2, padding: 5,
    borderRadius: 24, borderWidth: 1, borderColor: '#3158A8',
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 8 },
  tab: { flex: 1, minWidth: 0 }, tabContent: { flexGrow: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 18 },
  tabContentSelected: { backgroundColor: '#F0F6FF' },
  tabIcon: { height: 28, alignItems: 'center', justifyContent: 'center' },
  tabText: { alignSelf: 'stretch', flexShrink: 1, fontSize: 11, lineHeight: 15, textAlign: 'center', color: '#DCE8FF', fontWeight: '600' }, tabTextSelected: { color: BRAND.blue900, fontWeight: '800' },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
