import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, BRAND, PressableScale, StateView } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { usePublicResource } from '../../services/usePublicResource';
import { loadNativePublicPage, PublicPageData } from '../../services/nativePublicContent';
import { readPublicCms } from '../../services/publicContent';
import { openWebsitePage } from '../../services/websiteNavigation';
import { PublicContentCard } from './PublicExploreCards';
import { ExploreZones } from '../../components/explore/ExploreDestinations';
import { galleryMediaUrl, galleryPath, galleryPhotos, relatedGalleryAlbums } from '../../utils/galleryContent';
import { ContentImage } from '../../ui/ContentImage';
import { ContentLayout, Body, Photo, ContentMedia, ActionLink, ExtraFields, Heading, contentStyles as s, contentText } from './PublicContentKit';
import PublicRegionContent from './PublicRegionContent';
import { NewsArticleContent, newsMetadata } from './PublicNewsArticleScreen';
import { regionScope, regionTitle, visibleRegionItems } from '../../utils/publicRegionContent';

export default function PublicContentScreen({ navigation, route }: any) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const path = String(route?.params?.path || '');
  const [query, setQuery] = useState(''), [offset, setOffset] = useState(0), [category, setCategory] = useState(''), [district, setDistrict] = useState('');
  useEffect(() => { setQuery(''); setOffset(0); setCategory(''); setDistrict(''); }, [path]);
  const resource = usePublicResource(navigation, path + ':' + offset, signal => loadNativePublicPage(path, signal, offset));
  const page = resource.data;
  const open = (href: string, title: string) => openWebsitePage(navigation, href, title);
  const categories = useMemo(() => Array.from(new Set<string>((page?.items || []).map(item => item.category).filter(value => typeof value === 'string' && value.trim()))).sort(), [page?.items]);
  const districts = useMemo(() => Array.from(new Set<string>((page?.items || []).map(item => item.district).filter(value => typeof value === 'string' && value.trim()))).sort(), [page?.items]);
  const records = useMemo(() => (page?.items || []).filter(item => (!category || item.category === category) && (!district || item.district === district) && (!query.trim() || [item.title, item.caption, item.summary, item.category, item.sector, item.state, item.district, item.location, item.label, item.name, ...(Array.isArray(item.states) ? item.states : []).map((state: any) => state?.name)].join(' ').toLowerCase().includes(query.trim().toLowerCase()))), [page?.items, category, district, query]);
  const list = page && ['news', 'gallery', 'schemeStates', 'schemes'].includes(page.kind);
  const ownCards = ['article', 'region', 'zones'].includes(page?.kind || '');
  const title = page?.kind === 'region' ? regionTitle(page.page || {}, regionScope(page.page || {}, page.scope)) || page.title : page?.title;
  const regionIntro = page?.page?.hero?.blurb || page?.page?.shortDescription || page?.page?.hero?.sideImageUrl || visibleRegionItems(page?.page?.hero?.facts).length;
  const overlap = !list && (page?.kind !== 'region' || !!page.section || !!regionIntro);
  return <ContentLayout navigation={navigation} title={title || route?.params?.title || 'ACTIV'} subtitle={page?.kind === 'article' ? newsMetadata(page.item) : undefined} sharePath={['article', 'album', 'scheme', 'region'].includes(page?.kind || '') ? path : undefined}
    readingPanel={!list && !ownCards} overlap={overlap} art={page?.kind === 'gallery' || page?.kind === 'album' ? 'gallery' : page?.kind?.startsWith('scheme') ? 'schemes' : page?.kind === 'region' || page?.kind === 'zones' ? 'zones' : 'news'} resource={resource}>
    {list && <>
      {page.kind.startsWith('scheme') && <View style={x.schemeTabs}>{[['/schemes/central', 'Central schemes'], ['/schemes/state', 'State schemes']].map(([href, label]) => {
        const selected = href === '/schemes/state' ? path.includes('/state') : !path.includes('/state');
        return <PressableScale key={href} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => open(href, label)} style={s.flex} contentStyle={[x.schemeTab, selected && x.schemeTabSelected]}><Text style={[x.schemeTabText, selected && x.schemeTabActive]}>{label}</Text></PressableScale>;
      })}</View>}
      {page.kind === 'gallery' && <Text style={x.intro}>Our community, in pictures. Explore gatherings, milestones and moments from across ACTIV.</Text>}
      <View style={x.search}><Icon name="search" size={22} color={PALETTE.textMuted} /><TextInput value={query} onChangeText={setQuery} accessibilityLabel="Search content" placeholder={page.kind === 'gallery' ? 'Search albums or places' : 'Search by title, place or category'} placeholderTextColor={PALETTE.textMuted} style={x.searchInput} returnKeyType="search" />{!!query && <PressableScale accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} contentStyle={x.clearSearch}><Icon name="close" size={20} color={PALETTE.textMuted} /></PressableScale>}</View>
      {categories.length > 1 && <FilterChips label="Category" allLabel="All categories" values={categories} value={category} onChange={setCategory} />}
      {districts.length > 0 && <FilterChips label="District" allLabel="All districts" values={districts} value={district} onChange={setDistrict} />}
      <View style={x.results}><Text style={s.meta}>{records.length} {page.kind === 'gallery' ? records.length === 1 ? 'album' : 'albums' : records.length === 1 ? 'result' : 'results'}</Text>{!!(query || category || district) && <PressableScale accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={() => { setQuery(''); setCategory(''); setDistrict(''); }} contentStyle={x.reset}><Text style={x.more}>Clear filters</Text></PressableScale>}</View>
      {records.length === 0 && <StateView compact title={query || category || district ? 'No matching results' : 'More to discover soon'} message={query || category || district ? 'Try another search or clear the filters.' : 'Published updates will appear here.'} />}
      {records.map((item, index) => page.kind === 'schemeStates' ?
        <PressableScale key={item.state} accessibilityRole="link" accessibilityLabel={`${item.state}, ${item.total} schemes`} onPress={() => open('/schemes/state/' + String(item.state).trim().toLowerCase().replace(/\s+/g, '-'), item.state + ' schemes')} contentStyle={x.stateRow}><View style={x.stateIcon}><Icon name="account-balance" size={22} color={BRAND.blue} /></View><View style={s.flex}><Text style={x.stateName}>{item.state}</Text><Text style={s.meta}>{item.total} {Number(item.total) === 1 ? 'scheme' : 'schemes'}</Text></View><Icon name="chevron-right" size={22} color={BRAND.blue} /></PressableScale> : page.kind === 'schemes' ?
          <SchemePreview key={item.id || item.slug || index} item={item} onPress={() => open('/schemes/view/' + encodeURIComponent(item.slug || item.id), item.title)} /> : <PublicContentCard key={item.id || item._id || item.slug || index} item={item} kind={page.kind as 'news' | 'gallery'} openPage={open} />)}
    </>}
    {page?.kind === 'zones' && <ExploreZones zones={page.items || []} openPage={open} />}
    {page?.kind === 'album' && <Album key={path} page={page} navigation={navigation} overview={!/\/photo\//.test(path)} />}
    {page?.kind === 'article' && <NewsArticleContent article={page.item} navigation={navigation} />}
    {page?.kind === 'scheme' && <Scheme item={page.item} navigation={navigation} />}
    {page?.kind === 'region' && <PublicRegionContent page={page} path={path} navigation={navigation} offset={offset} onOffset={setOffset} />}
  </ContentLayout>;
}

function SchemePreview({ item, onPress }: { item: any; onPress: () => void }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const uri = resolveMediaUrl(item.image?.url || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={x.schemeCard}>
    <PressableScale accessibilityRole="button" accessibilityLabel={'View scheme: ' + item.title} onPress={onPress}>
    {!!uri && !failed && <ContentImage uri={uri} width={800} accessibilityLabel={item.image?.alt || item.title} onError={() => setFailed(true)} resizeMode="contain" style={x.schemeImage} />}
    <View style={x.schemeCopy}><Text style={x.filterLabel}>{[item.tier === 'national' ? 'Central' : item.state, item.district, item.category].filter(Boolean).join(' · ')}</Text><Heading>{item.title}</Heading>
      {!!contentText(item.summary) && <Text numberOfLines={3} style={x.intro}>{contentText(item.summary)}</Text>}
      <View style={[x.schemeFooter, { flexWrap: 'wrap', gap: 10 }]}>
        <Text style={x.more}>Benefits & eligibility</Text><Icon name="arrow-forward" size={20} color={BRAND.blue} />
      </View>
    </View>
    </PressableScale>
  </View>;
}

function FilterChips({ label, allLabel, values, value, onChange }: { label: string; allLabel: string; values: string[]; value: string; onChange: (value: string) => void }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  return <View style={x.filters}><Text style={x.filterLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={x.chips}>
    {['', ...values].map(option => <PressableScale key={option} accessibilityRole="button" accessibilityLabel={option || allLabel} accessibilityState={{ selected: value === option }} onPress={() => onChange(option)} contentStyle={[x.chip, value === option && x.chipSelected]}>
      <Text style={[x.chipText, value === option && x.chipTextSelected]}>{option || allLabel}</Text>
    </PressableScale>)}
  </ScrollView></View>;
}

const dateLabel = (value: any) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
function AlbumThumbnail({ photo, index, singleColumn, onPress, cover = false, album = false }: { photo: any; index: number; singleColumn: boolean; onPress: () => void; cover?: boolean; album?: boolean }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const poster = galleryMediaUrl(photo.thumbnailUrl) || galleryMediaUrl(photo.posterUrl);
  const uri = resolveMediaUrl(poster || (photo.type !== 'video' ? galleryMediaUrl(photo.url) : ''));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const label = contentText(photo.title || photo.caption) || `Photo ${index + 1}`;
  return <PressableScale accessibilityRole="button" accessibilityLabel={(album ? 'Open album: ' : cover ? 'Open cover: ' : 'Open: ') + label} onPress={onPress} style={[x.thumbnailWrap, (singleColumn || cover) && x.singleColumn]} contentStyle={x.thumbnail}>
    {uri && !failed ? <ContentImage uri={uri} width={cover ? 1024 : 480} resizeMode="contain" accessibilityLabel={label} style={x.thumbnailImage} onError={() => setFailed(true)} /> : <View style={[x.thumbnailImage, x.thumbnailFallback]}><Icon name={photo.type === 'video' ? 'play-circle-outline' : 'photo-library'} size={28} color={BRAND.blue} /><Text style={s.meta}>{photo.type === 'video' ? 'Watch video' : album ? 'View album' : 'View photo'}</Text></View>}
    <View style={x.thumbnailCaption}><Text numberOfLines={2} style={x.thumbnailText}>{label}</Text><Icon name="north-east" size={16} color={BRAND.blue} /></View>
  </PressableScale>;
}

function Album({ page, navigation, overview }: { page: PublicPageData; navigation: any; overview: boolean }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 320 || fontScale >= 1.4;
  const item = page.item || {};
  const photos = galleryPhotos(item);
  const cover = photos.find(entry => entry.cover);
  const extraPhotos = photos.filter(entry => !entry.cover);
  const photoIndex = page.photo;
  const [related, setRelated] = useState<{ item: any; items: any[] } | null>(null);
  useEffect(() => {
    if (!page.item || !overview || photoIndex !== undefined) return;
    const controller = new AbortController();
    const currentItem = page.item;
    // Optional recommendations never delay the album's own photographs.
    readPublicCms('/cms/gallery', controller.signal).then(value => {
      if (!controller.signal.aborted) setRelated({ item: currentItem, items: relatedGalleryAlbums(currentItem, value) });
    }).catch(() => {
      if (!controller.signal.aborted) setRelated({ item: currentItem, items: [] });
    });
    return () => controller.abort();
  }, [page.item, photoIndex, overview]);
  const recommendations = related && related.item === item ? related.items : [];
  const position = photoIndex === undefined ? -1 : photos.findIndex(entry => entry.index === photoIndex);
  const selected = photos[position]?.photo;
  const metadata = selected || item;
  const albumUrl = galleryPath(item);
  const openPhoto = (entry: typeof photos[number]) => albumUrl && openWebsitePage(navigation, albumUrl + '/photo/' + entry.index, entry.photo.title || entry.photo.caption || item.title);
  const meta = [metadata.category || item.category, metadata.location || item.location, dateLabel(metadata.eventDate || item.eventDate)].filter(Boolean).join(' · ');
  return <>
    <PressableScale accessibilityRole="link" accessibilityLabel="All albums" onPress={() => openWebsitePage(navigation, '/gallery', 'All albums')} contentStyle={x.backLink}><Icon name="arrow-back" color={BRAND.blue} size={18} /><Text style={x.backText}>All albums</Text></PressableScale>
    {!!meta && <Text style={s.meta}>{meta}</Text>}
    {photoIndex !== undefined ? selected ? <>
      <View style={x.albumHeading}><Text style={x.filterLabel}>PHOTO {position + 1} OF {photos.length}</Text></View>
      {!!(selected.title || selected.caption) && <Heading>{selected.title || selected.caption}</Heading>}
      <ContentMedia media={selected} title={selected.title || item.title} />
      {!!selected.caption && selected.caption !== selected.title && <Body value={selected.caption} navigation={navigation} />}
      <Body value={selected.description} navigation={navigation} /><ExtraFields fields={selected.customFields || []} navigation={navigation} />
      <View style={x.photoPager}>
        {!!albumUrl && position > 0 && <View style={s.flex}><ActionLink navigation={navigation} href={albumUrl + '/photo/' + photos[position - 1].index} label="Previous photo" /></View>}
        {!!albumUrl && position + 1 < photos.length && <View style={s.flex}><ActionLink navigation={navigation} href={albumUrl + '/photo/' + photos[position + 1].index} label="Next photo" /></View>}
      </View>
      <ActionLink navigation={navigation} href={albumUrl || '/gallery'} label="View complete album" />
    </> : <><StateView compact title="Photo unavailable" message="This photo may have been removed from the album." /><ActionLink navigation={navigation} href={albumUrl || '/gallery'} label="View complete album" /></> : <>
      {!!cover && <AlbumThumbnail photo={cover.photo} index={cover.index} singleColumn cover onPress={() => openPhoto(cover)} />}
      <Body value={item.description || item.caption} navigation={navigation} />
      {Array.isArray(item.highlights) && item.highlights.length > 0 && <View style={x.highlightPanel}><Heading>Highlights</Heading>{item.highlights.filter(Boolean).map((value: string, i: number) => <View key={i} style={x.highlightRow}><Icon name="check-circle-outline" size={19} color={BRAND.blue} /><View style={s.flex}><Body value={value} navigation={navigation} /></View></View>)}</View>}
      <ExtraFields fields={item.customFields || []} navigation={navigation} />
      {extraPhotos.length > 0 && <><View style={x.albumHeading}><Heading>More photographs</Heading><Text style={s.meta}>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</Text></View><View style={x.photoGrid}>
        {extraPhotos.map(entry => <AlbumThumbnail key={entry.index} photo={entry.photo} index={entry.index} singleColumn={singleColumn} onPress={() => openPhoto(entry)} />)}
      </View></>}
      {!!recommendations.length && <><Heading>More from the gallery</Heading><View style={x.photoGrid}>
        {recommendations.map((other, index) => <AlbumThumbnail key={galleryPath(other) || index} photo={{ ...other.media, title: other.title || other.caption || 'Community album', thumbnailUrl: other.thumbnailUrl || other.media?.thumbnailUrl, posterUrl: other.posterUrl || other.media?.posterUrl }} index={index} singleColumn={singleColumn} album onPress={() => { const href = galleryPath(other); if (href) openWebsitePage(navigation, href, other.title || other.caption || 'Community album'); }} />)}
      </View></>}
    </>}
  </>;
}
function Scheme({ item, navigation }: { item: any; navigation: any }) {
  const x = useLegacyAppearance(legacyAppearance_x);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  return <>
    <Photo url={item.image?.url} alt={item.title} /><Body value={item.summary} navigation={navigation} />
    <View style={x.schemeFacts}><Text style={x.filterLabel}>{[item.tier === 'national' ? 'Central scheme' : item.state, item.district, item.category].filter(Boolean).join(' · ')}</Text>
      {!!item.authority && <View style={x.schemeFact}><Icon name="account-balance" color={BRAND.blue} size={20} /><View style={s.flex}><Text style={s.meta}>Run by</Text><Text style={x.stateName}>{item.authority}</Text></View></View>}{!!item.deadline && <View style={x.schemeFact}><Icon name="event" color={BRAND.blue} size={20} /><View style={s.flex}><Text style={s.meta}>Application status</Text><Text style={x.stateName}>{item.deadline}</Text></View></View>}
      <ActionLink navigation={navigation} href={item.applyUrl} label="Apply on official portal" /><ActionLink navigation={navigation} href={item.documentUrl} label="Official notification / document" download />
      <ActionLink navigation={navigation} href={item.helpline ? 'tel:' + String(item.helpline).replace(/[^\d+]/g, '') : ''} label={'Helpline: ' + item.helpline} />
    </View>
    {[['About this scheme', item.body], ['Benefits', item.benefits], ['Who can apply', item.eligibility], ['How to apply', item.howToApply], ['Documents required', (Array.isArray(item.documentsRequired) ? item.documentsRequired : []).filter(Boolean).map((doc: string) => '• ' + doc).join('\n')]].filter(([_, value]) => contentText(value)).map(([label, value]) =>
      <View key={label} style={x.readingSection}><Heading>{label}</Heading><Body value={value} navigation={navigation} /></View>)}
    <ExtraFields fields={item.extraFields} navigation={navigation} />
  </>;
}
const x = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, more: { color: BRAND.blue, fontSize: 14, fontWeight: '600' },
  intro: { color: PALETTE.textMuted, fontSize: 16, lineHeight: 24 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 14, paddingLeft: 14 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 50, color: PALETTE.text, fontSize: 16, paddingVertical: 10, paddingRight: 12 },
  clearSearch: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8 }, filterLabel: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  chips: { gap: 8, paddingRight: 4 }, chip: { borderRadius: 12, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.white, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  chipSelected: { backgroundColor: BRAND.navy, borderColor: BRAND.navy }, chipText: { fontSize: 14, fontWeight: '600', color: PALETTE.textSoft }, chipTextSelected: { color: PALETTE.white },
  results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 }, reset: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 },
  backLink: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' }, backText: { color: BRAND.blue, fontSize: 15, fontWeight: '600' },
  albumHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  photoPager: { flexDirection: 'row', gap: 12 }, photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbnailWrap: { width: '47%', flexGrow: 1, maxWidth: '49%' }, singleColumn: { width: '100%', maxWidth: '100%' }, thumbnail: { borderRadius: 16, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, overflow: 'hidden' },
  thumbnailImage: { width: '100%', aspectRatio: 4 / 3, backgroundColor: PALETTE.blueSoft }, thumbnailFallback: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  thumbnailCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, minHeight: 58 }, thumbnailText: { flex: 1, color: BRAND.navyDeep, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  highlightPanel: { padding: 18, borderRadius: 18, backgroundColor: PALETTE.blueSoft }, highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  schemeTabs: { flexDirection: 'row', gap: 6, padding: 4, backgroundColor: '#E8EDF5', borderRadius: 14 }, schemeTab: { minHeight: 46, padding: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, schemeTabSelected: { backgroundColor: PALETTE.white }, schemeTabText: { color: PALETTE.textMuted, fontSize: 15, fontWeight: '600' }, schemeTabActive: { color: BRAND.blue900 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, padding: 16, borderRadius: 16 }, stateIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.blueSoft, borderRadius: 12 }, stateName: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: BRAND.navyDeep },
  schemeCard: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 18, overflow: 'hidden' }, schemeImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: PALETTE.blueSoft }, schemeCopy: { padding: 18, gap: 8 }, schemeFooter: { borderTopWidth: 1, borderTopColor: PALETTE.border, paddingTop: 14, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, schemeFacts: { backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.border, padding: 18, borderRadius: 18, gap: 14 }, schemeFact: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  readingSection: { borderBottomWidth: 1, borderBottomColor: PALETTE.border, paddingTop: 8, paddingBottom: 8 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_x = x;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
