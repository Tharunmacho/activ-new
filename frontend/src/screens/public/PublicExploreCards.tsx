import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FitImage } from '../../ui/FitImage';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BRAND, PALETTE, SPACE, PressableScale, SurfaceCard } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { WEBSITE_PATHS } from '../../config/website.config';
import { publicPlainText } from '../../utils/publicRichText';
import { newsMedia } from '../../utils/newsContent';

export const publicText = (value: any) => String(value || '').trim();
export const publicRecordKey = (item: any) => publicText(item.slug || item.id || item._id);
export type PublicPageOpener = (path: string, title: string) => void;
type ContentKind = 'events' | 'news' | 'gallery';
const cleanText = publicPlainText;
const date = (value: any) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value) : null;
const calendar = (value: any, options: Intl.DateTimeFormatOptions) => date(value)?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...options }) || '';

function EventDate({ value }: { value: any }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  return <View style={s.dateShadow} accessibilityLabel={calendar(value, { day: 'numeric', month: 'long', year: 'numeric' }) || 'Date to be announced'}>
    <LinearGradient colors={[BRAND.blue900, BRAND.blue]} style={s.dateMonthBand}>
      <Text style={s.dateMonth}>{calendar(value, { month: 'short' }).toUpperCase() || 'DATE'}</Text>
    </LinearGradient>
    <View style={s.dateBody}>
      <Text style={[s.dateDay, !date(value) && s.datePending]}>{calendar(value, { day: '2-digit' }) || 'TBC'}</Text>
      {!!date(value) && <Text style={s.dateYear}>{calendar(value, { year: 'numeric' })}</Text>}
    </View>
  </View>;
}

function Fact({ icon, children }: { icon: string; children: React.ReactNode }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  return <View style={s.fact}><Icon name={icon} size={17} color={BRAND.blue} /><Text style={s.factText}>{children}</Text></View>;
}

/** Shared by the home preview and each public tab. No account is needed to open it. */
export function PublicContentCard({ item, kind, openPage }: { item: any; kind: ContentKind; openPage: PublicPageOpener }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const title = cleanText(item.title || item.caption) || (kind === 'gallery' ? 'From our community' : 'ACTIV update');
  const image = resolveMediaUrl(kind === 'events' ? item.imageUrl || item.bannerUrl || item.media?.url
    : kind === 'news' ? newsMedia(item).find(media => media.type === 'image')?.url
      : item.media?.type === 'video' ? item.thumbnailUrl || item.posterUrl : item.media?.url);
  const hasImage = !!image;
  const key = publicRecordKey(item);
  const path = kind === 'events' ? WEBSITE_PATHS.event(key) : kind === 'news' ? WEBSITE_PATHS.article(key) : WEBSITE_PATHS.galleryItem(key);
  const summary = cleanText(item.summary || item.description);
  const fee = Number(item.registrationFee);
  const showPrice = kind === 'events' && item.registrationEnabled && item.registrationFee != null && Number.isFinite(fee);
  const place = item.mode === 'online' ? (item.onlinePlatform || 'Online event') : (item.location || item.venue || item.state);
  const time = calendar(item.startAt, { hour: 'numeric', minute: '2-digit', hour12: true });

  return <SurfaceCard padded={false} style={s.card}>
    <PressableScale accessibilityRole="button" accessibilityLabel={title} onPress={() => openPage(path, title)}>
    {hasImage && <View style={s.imageFrame}>
      <FitImage uri={image} style={s.image} accessibilityLabel={title} />
      {kind === 'gallery' && item.media?.type === 'video' && <View style={s.play}><Icon name="play-arrow" size={28} color={PALETTE.white} /></View>}
    </View>}
    {!hasImage && <View style={s.artCover}>
      <View style={s.placeholderIcon}><Icon name={kind === 'events' ? 'event' : kind === 'news' ? 'article' : 'photo-library'} size={25} color={BRAND.blue} /></View>
      <Text style={s.placeholderText}>{kind === 'events' ? 'ACTIV event' : kind === 'news' ? 'Association news' : 'Community gallery'}</Text>
    </View>}
    {kind === 'events' ? <LinearGradient colors={[PALETTE.blueSoft, PALETTE.white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.eventHeader}>
      <EventDate value={item.startAt} />
      <View style={s.eventIntro}>
        <View style={s.category}><View style={s.dot} /><Text style={s.categoryText}>{publicText(item.category) || 'Upcoming event'}</Text></View>
        <Text style={s.title} numberOfLines={3}>{title}</Text>
      </View>
    </LinearGradient> : null}
    <View style={s.body}>
      {kind !== 'events' && <>
        {!!item.category && <Text style={s.kicker}>{publicText(item.category)}</Text>}
        <Text style={s.title} numberOfLines={3}>{title}</Text>
      </>}
      {!!summary && <Text style={s.summary} numberOfLines={2}>{summary}</Text>}
      {kind === 'events' && <View style={s.facts}>
        {!!place && <Fact icon={item.mode === 'online' ? 'videocam' : 'location-on'}>{publicText(place)}</Fact>}
        {!!time && <Fact icon="schedule">{time} IST</Fact>}
      </View>}
      {kind === 'news' && !!date(item.publishedAt || item.createdAt) && <View style={s.facts}><Fact icon="schedule">{calendar(item.publishedAt || item.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}</Fact></View>}
      <View style={s.footerSpacer} />
      <View style={s.cardFoot}>
        {showPrice ? <View style={[s.price, fee > 0 && s.paidPrice]}><Text style={[s.priceText, fee > 0 && s.paidPriceText]}>{fee > 0 ? '₹' + fee.toLocaleString('en-IN') : 'Free entry'}</Text></View>
          : <Text style={s.footNote}>{kind === 'events' ? 'Event information' : kind === 'gallery' ? item.media?.type === 'video' ? 'Video' : 'Community gallery' : 'ACTIV news'}</Text>}
        <View style={s.cardLink}><Text style={s.cardLinkText}>{kind === 'gallery' ? 'View gallery' : kind === 'news' ? 'Read story' : 'View details'}</Text><View style={s.arrow}><Icon name="arrow-forward" size={17} color={BRAND.blue} /></View></View>
      </View>
    </View>
    </PressableScale>
  </SurfaceCard>;
}

export function PublicZoneCard({ item, openPage }: { item: any; openPage: PublicPageOpener }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const states = (Array.isArray(item.states) ? item.states : []).filter((state: any) => state.hasPage !== false && (!state.status || state.status === 'published'));
  const title = publicText(item.label || item.name || item.slug);
  return <SurfaceCard padded={false} style={s.card}>
    <PressableScale contentStyle={s.zoneHead} accessibilityRole="button"
      onPress={() => openPage(WEBSITE_PATHS.region(item.slug), title)} accessibilityLabel={'Explore ' + title}>
      <View style={s.zoneArt}><Icon name={/national/i.test(item.slug) ? 'public' : 'explore'} size={26} color={BRAND.blue} /></View>
      <View style={s.eventIntro}><Text style={s.zoneEyebrow}>ACTIV COMMUNITY</Text><Text style={s.zoneTitle}>{title}</Text></View>
      <Icon name="arrow-forward" size={21} color={BRAND.blue} />
    </PressableScale>
    {states.length > 0 ? <View style={s.zoneBody}>
      <Text style={s.statesLabel}>Explore a state</Text>
      <View style={s.states}>{states.map((state: any) => <StateLink key={state.slug} state={state} openPage={openPage} />)}</View>
    </View> : <Text style={s.zoneHint}>Explore leadership, news and events.</Text>}
  </SurfaceCard>;
}

function StateLink({ state, openPage }: { state: any; openPage: PublicPageOpener }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  return <PressableScale onPress={() => openPage(WEBSITE_PATHS.state(state.slug), publicText(state.name))}
    accessibilityRole="button" accessibilityLabel={'Explore ' + publicText(state.name)} style={s.stateOuter} contentStyle={s.stateInner}>
    <Text style={s.stateText}>{publicText(state.name)}</Text><Icon name="chevron-right" size={18} color={BRAND.blue} />
  </PressableScale>;
}

const s = StyleSheet.create({
  card: { marginBottom: SPACE.lg },
  imageFrame: { backgroundColor: PALETTE.blueTint, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  image: { width: '100%', aspectRatio: 16 / 9 },
  play: { position: 'absolute', alignSelf: 'center', top: '40%', width: 48, height: 48, borderRadius: 24, backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  eventIntro: { flex: 1, minWidth: 0 },
  dateShadow: { width: 64, flexShrink: 0, borderRadius: 15, backgroundColor: PALETTE.white, shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  dateMonthBand: { borderTopLeftRadius: 15, borderTopRightRadius: 15, paddingVertical: 6, alignItems: 'center' },
  dateMonth: { color: PALETTE.white, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dateBody: { alignItems: 'center', paddingVertical: 6 }, dateDay: { color: BRAND.navy, fontSize: 27, lineHeight: 32, fontWeight: '800' }, datePending: { fontSize: 17 }, dateYear: { color: PALETTE.textMuted, fontSize: 10, fontWeight: '600' },
  category: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: BRAND.blue }, categoryText: { flex: 1, color: BRAND.blue900, fontSize: 11, fontWeight: '700' },
  title: { color: BRAND.navyDeep, fontSize: 19, lineHeight: 27, fontWeight: '700' },
  body: { padding: SPACE.lg, paddingTop: SPACE.md, flexGrow: 1 }, footerSpacer: { flexGrow: 1 }, kicker: { fontSize: 12, fontWeight: '700', color: BRAND.blue, marginBottom: 6 },
  summary: { color: PALETTE.textMuted, fontSize: 15, lineHeight: 23, marginTop: 7 }, facts: { gap: 9, marginTop: SPACE.md },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, factText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, color: PALETTE.textSoft },
  cardFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1, borderTopColor: PALETTE.divider, marginTop: SPACE.lg, paddingTop: SPACE.md },
  price: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: PALETTE.greenSoft }, priceText: { color: PALETTE.greenDark, fontSize: 12, fontWeight: '800' },
  paidPrice: { backgroundColor: PALETTE.blueSoft }, paidPriceText: { color: BRAND.blue900 }, footNote: { color: PALETTE.textMuted, fontSize: 11, flexShrink: 1 },
  cardLink: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardLinkText: { color: BRAND.blue, fontSize: 13, fontWeight: '700' }, arrow: { width: 30, height: 30, borderRadius: 10, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' },
  artCover: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F1F5FC' },
  placeholderIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E4EDFF', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: BRAND.navy, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  zoneHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  zoneArt: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#EDF2FF', alignItems: 'center', justifyContent: 'center' },
  zoneEyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1, fontWeight: '600', color: PALETTE.textMuted, marginBottom: 3 },
  zoneTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: BRAND.navyDeep },
  zoneBody: { padding: 18, paddingTop: 0 }, statesLabel: { fontSize: 13, lineHeight: 20, color: PALETTE.textMuted, marginBottom: 10 },
  states: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stateOuter: { maxWidth: '100%' },
  stateInner: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F1F5FC' },
  stateText: { flexShrink: 1, fontSize: 14, lineHeight: 21, fontWeight: '500', color: BRAND.navy },
  zoneHint: { paddingHorizontal: 18, paddingBottom: 18, color: PALETTE.textMuted, fontSize: 14, lineHeight: 21 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_BRAND = BRAND;
const legacyAppearance_PALETTE = PALETTE;
