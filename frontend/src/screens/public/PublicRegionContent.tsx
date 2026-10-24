import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ContentImage } from '../../ui/ContentImage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BRAND, PALETTE, GradientButton, GlassIconButton, PremiumPage, PremiumPageHeader, PremiumSelect, PressableScale, StateView, SurfaceCard } from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { openWebsitePage } from '../../services/websiteNavigation';
import { readPublicCms, submitPublicCms } from '../../services/publicContent';
import { PublicPageData, REGION_SECTIONS } from '../../services/nativePublicContent';
import { ActionLink, Body, ContentMedia, ExtraFields, Heading, Photo, contentStyles as s } from './PublicContentKit';
import { NewsMediaItem, NewsResourceLinks } from './PublicNewsArticleScreen';
import { newsMedia } from '../../utils/newsContent';
import { hasRegionContact as hasContact, regionContacts, regionLabels, regionLeaderContext, regionPanels, regionScope, regionTitle, visibleRegionItems as visible } from '../../utils/publicRegionContent';

const sectionIcon: Record<string, string> = { about: 'info-outline', gallery: 'photo-library', leaders: 'people-outline', events: 'event', achievements: 'emoji-events', keyAchievements: 'emoji-events', projects: 'work-outline', publications: 'menu-book', newsUpdates: 'article' };
export default function PublicRegionContent({ page, path, navigation, offset, onOffset }: {
  page: PublicPageData; path: string; navigation: any; offset: number; onOffset: (offset: number) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const stackPeople = width < 360 && fontScale > 1.1 || fontScale >= 1.5;
  const record = useMemo(() => page.page || {}, [page.page]);
  const [filter, setFilter] = useState('');
  useEffect(() => { setFilter(''); setProfile(null); }, [path]);
  const [profile, setProfile] = useState<{ person: any; context: any } | null>(null);
  const scope = regionScope(record, page.scope);
  const title = regionTitle(record, scope);
  const labels = regionLabels(record, scope);
  const context = regionLeaderContext(record, scope);
  const leaderList = (items: any[], ctx = context) => <View style={x.cardList}>{visible(items).map((person: any, index: number) => <Leader key={person.id || index} person={person} stacked={stackPeople} onPress={() => setProfile({ person, context: ctx })} />)}</View>;
  const panels = regionPanels(record, scope);
  const boards = panels.filter(board => visible(board.leaders).length || board.description || board.blurb);
  const districts = visible(record.districts).filter(board => visible(board.leaders).length || board.description || board.blurb);
  const ownUrl = '/' + page.scope + '/' + record.slug;
  const section = page.section;
  const custom = visible(record.customSections).find((item: any) => item.key === section);
  const feed = useMemo(() => visible(custom?.items || record[section || '']).filter(item => !filter.trim() || [item.title, item.summary, item.body, item.location, item.category].join(' ').toLowerCase().includes(filter.trim().toLowerCase())), [record, custom, section, filter]);
  const sections = [...Object.entries(REGION_SECTIONS).filter(([key]) => key === 'gallery' || key === 'about' && record.fullDescription || visible(record[key]).length > 0).map(([key, heading]) => ({ key, title: heading })), ...visible(record.customSections).filter(item => item.key && item.title)];
  const contacts = regionContacts(record);
  const contactGroups = [...visible(record.regionContactGroups), ...visible(record.districtContactGroups), ...panels, ...visible(record.districts)]
    .map(group => ({ ...group, contacts: regionContacts(group) })).filter(group => group.contacts.length);
  const linkedStates = visible(record.focusStates).filter(state => state.hasPage !== false && state.slug && !(scope === 'region' && panels.some(panel => panel.slug === state.slug)));
  const parent = record.region || record.regionPanel;
  const renderBoard = (board: any, index: number, district = false) => <View key={board.id || board.slug || index} style={x.board}>
    <View style={x.boardHeading}><View style={x.boardMark} /><Text accessibilityRole="header" style={x.boardName}>{board.name}{district && !/\bdistrict\b/i.test(board.name || '') ? ' District' : ''}</Text></View>
    <Body value={board.description || board.blurb} navigation={navigation} />
    {leaderList(board.leaders, regionLeaderContext(record, scope, board, district))}
    {board.slug && page.scope === 'regions' && board.hasPage !== false && <ActionLink navigation={navigation} href={'/' + (scope === 'national' ? 'regions' : 'states') + '/' + board.slug} label={'Explore ' + board.name} />}
  </View>;
  return <>
    {section ? <>
      <ActionLink navigation={navigation} href={ownUrl} label={'Back to ' + title} /><SectionTitle title={custom?.title || REGION_SECTIONS[section] || 'Details'} eyebrow={title} />
      {section === 'about' ? <SurfaceCard contentStyle={x.cardContent}><Body value={record.fullDescription || record.shortDescription} navigation={navigation} /></SurfaceCard> : section === 'leaders' ? leaderList(record.leaders) : section === 'gallery' ? <>
        {(page.items || []).map((photo: any, index: number) => <SurfaceCard key={photo.id || index} contentStyle={x.cardContent}><ContentMedia media={photo.media || { url: photo.url || photo.imageUrl, type: 'image' }} title={photo.caption || page.title} /><Body value={photo.title || photo.caption} />{(photo.slug || photo.id) && <ActionLink navigation={navigation} href={'/gallery/' + (photo.slug || photo.id)} label="View complete album" />}</SurfaceCard>)}
        {!(page.items || []).length && <StateView compact title="Photos coming soon" message="Community moments will appear here when they are published." />}
        {!!page.total && <Text style={s.meta}>{page.total} {page.total === 1 ? 'photograph' : 'photographs'}</Text>}<View style={x.row}>
          {offset > 0 && <GradientButton label="Previous photos" onPress={() => onOffset(Math.max(0, offset - 24))} />}
          {offset + (page.items || []).length < (page.total || 0) && <GradientButton label="More photos" onPress={() => onOffset(offset + 24)} />}
        </View>
      </> : <>{!!(custom?.intro || custom?.text) && <SurfaceCard contentStyle={x.cardContent}><Body value={custom?.intro || custom?.text} navigation={navigation} /></SurfaceCard>}<View style={x.search}><Icon name="search" size={22} color={PALETTE.textMuted} /><TextInput value={filter} onChangeText={setFilter} placeholder="Search this section" placeholderTextColor={PALETTE.textMuted} accessibilityLabel="Search this section" style={x.searchInput} /></View>{feed.map((item: any, index: number) => <FeedCard key={item.id || index} item={item} navigation={navigation} />)}{!feed.length && <StateView compact title={filter ? 'No matching results' : 'Updates coming soon'} message={filter ? 'Try another search.' : 'Published updates will appear here.'} />}</>}
    </> : <>
      {!!(record.hero?.blurb || record.shortDescription || record.hero?.sideImageUrl || visible(record.hero?.facts).length) && <SurfaceCard contentStyle={x.cardContent}>
        <Text style={x.eyebrow}>ABOUT {title.toUpperCase()}</Text><Body value={record.hero?.blurb || record.shortDescription} navigation={navigation} />
        {!!record.hero?.sideImageUrl && <Photo url={record.hero.sideImageUrl} alt={page.title} />}
        {!!visible(record.hero?.facts).length && <View style={x.facts}>{visible(record.hero?.facts).map((fact: any, index: number) => <View key={index} style={[x.fact, (width < 360 || fontScale >= 1.4) && x.factWide]}><Text style={s.meta}>{fact.label}</Text><Text style={x.factValue}>{fact.value}</Text></View>)}</View>}
      </SurfaceCard>}
      {scope === 'state' && parent?.slug && <ActionLink navigation={navigation} href={'/regions/' + parent.slug} label={'Explore ' + (parent.label || parent.name || 'zone')} />}
      {!!visible(record.leaders).length && <View style={x.section}><SectionTitle eyebrow={labels.ownTierEyebrow} title={title + ' Leaders'} />{leaderList(record.leaders)}</View>}
      {!!boards.length && <View style={x.section}><SectionTitle eyebrow={labels.tierBelowEyebrow} title={labels.tierBelowHeading} />{boards.map((board, index) => renderBoard(board, index))}</View>}
      {!!districts.length && <View style={x.section}><SectionTitle eyebrow={labels.districtsEyebrow} title={labels.districtsHeading} />{districts.map((board, index) => renderBoard(board, index, true))}</View>}
      {(contacts.length > 0 || contactGroups.length > 0) && <View style={x.section}>
        <SectionTitle eyebrow={labels.contactEyebrow} title={labels.contactHeading} />
        {!!contacts.length && <ContactGroup name={title} contacts={contacts} navigation={navigation} />}
        {contactGroups.map((group, i) => <ContactGroup key={group.id || `${group.name}-${i}`} name={group.name} contacts={group.contacts} navigation={navigation} />)}
      </View>}
      {!!sections.length && <View style={x.section}><SectionTitle title={'Explore ' + title} /><SurfaceCard padded={false}>{sections.map((item, index) => <PressableScale key={item.key} accessibilityRole="link" accessibilityLabel={item.title} onPress={() => openWebsitePage(navigation, ownUrl + '/' + item.key, item.title)} contentStyle={[x.sectionRow, index > 0 && x.divider]}><View style={x.sectionIcon}><Icon name={sectionIcon[item.key] || 'article'} size={22} color={BRAND.blue} /></View><Text style={x.sectionTitle}>{item.title}</Text><Icon name="chevron-right" size={22} color={BRAND.blue} /></PressableScale>)}</SurfaceCard></View>}
      {linkedStates.map((state: any) => <ActionLink key={state.slug} navigation={navigation} href={'/states/' + state.slug} label={state.name} />)}
      {panels.filter(board => !boards.includes(board) && board.slug && page.scope === 'regions' && board.hasPage !== false).map((board, i) => <ActionLink key={board.slug || i} navigation={navigation} href={'/' + (scope === 'national' ? 'regions' : 'states') + '/' + board.slug} label={'Explore ' + board.name} />)}
      {visible(record.relatedLinks).map((item: any, i: number) => <ActionLink key={i} navigation={navigation} href={item.href} label={item.label || 'Related link'} />)}
      <ExtraFields fields={record.extraFields} navigation={navigation} />
    </>}
    {!!profile && <LeaderProfile person={profile.person} context={profile.context} path={path} navigation={navigation} onClose={() => setProfile(null)} />}
  </>;
}
function SectionTitle({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return <View style={x.sectionHeading}>{!!eyebrow && <Text style={x.eyebrow}>{eyebrow.toUpperCase()}</Text>}<Text accessibilityRole="header" style={x.heading}>{title}</Text></View>;
}
function ContactGroup({ name, contacts, navigation }: { name: string; contacts: any[]; navigation: any }) {
  return <View style={x.contactGroup}>{!!name && <Text accessibilityRole="header" style={x.boardName}>{name}</Text>}<SurfaceCard padded={false}>{contacts.map((contact, index) => <View key={contact.id || index} style={index > 0 ? x.divider : undefined}><Contact contact={contact} navigation={navigation} /></View>)}</SurfaceCard></View>;
}
function Leader({ person, onPress, stacked = false }: { person: any; onPress: () => void; stacked?: boolean }) {
  const uri = resolveMediaUrl(person.photoUrl || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <SurfaceCard onPress={onPress} accessibilityLabel={'View profile: ' + person.name} style={x.leaderCard} contentStyle={x.cardContent}>
    <View style={[x.person, stacked && x.personStacked]}>
      {uri && !failed ? <ContentImage uri={uri} width={320} accessibilityLabel={person.name} onError={() => setFailed(true)} resizeMode="cover" style={x.portrait} /> : <View style={[x.portrait, x.initial]}><Text style={x.initialText}>{String(person.name || 'A').charAt(0)}</Text></View>}
      <View style={[s.flex, stacked && x.personCopy]}><Text style={x.personName}>{person.name}</Text><Text style={x.personRole}>{[person.role, person.designation, person.organisation].filter(Boolean).join('\n')}</Text><View style={x.profileAction}><Text style={x.profileLink}>View profile & contact</Text><Icon name="arrow-forward" size={16} color={BRAND.blue} /></View></View>
    </View>
  </SurfaceCard>;
}
function Contact({ contact, navigation, flush = false }: { contact: any; navigation: any; flush?: boolean }) {
  if (!hasContact(contact)) return null;
  return <View style={[x.contact, flush && x.contactFlush]}>
    {!!(contact.name || contact.personName || contact.designation || contact.organisation) && <Text style={x.personName}>{contact.name || contact.personName || contact.designation || contact.organisation}</Text>}
    <Body value={[(contact.name || contact.personName) && contact.designation, (contact.name || contact.personName || contact.designation) && contact.organisation, contact.address || (Array.isArray(contact.addressLines) ? contact.addressLines : []).join('\n'), [contact.city, contact.state, contact.pincode].filter(Boolean).join(', ')].filter(Boolean).join('\n')} />
    <ContactAction navigation={navigation} icon="call" href={contact.phone ? 'tel:' + String(contact.phone).replace(/[^\d+]/g, '') : ''} label={String(contact.phone || '')} />
    <ContactAction navigation={navigation} icon="mail-outline" href={contact.email ? 'mailto:' + contact.email : ''} label={contact.email} />
    <ContactAction navigation={navigation} icon="place" href={contact.mapUrl} label="Get directions" />
  </View>;
}
function ContactAction({ navigation, icon, href, label }: { navigation: any; icon: string; href?: string; label: string }) {
  if (!href || !/^(\/[^/]|https?:\/\/|mailto:|tel:)/i.test(href)) return null;
  return <PressableScale accessibilityRole="link" accessibilityLabel={label} onPress={() => openWebsitePage(navigation, href, label)} contentStyle={x.contactAction}><View style={x.contactIcon}><Icon name={icon} size={19} color={BRAND.blue} /></View><Text selectable style={x.contactValue}>{label}</Text><Icon name="chevron-right" size={18} color={PALETTE.textMuted} /></PressableScale>;
}
function FeedCard({ item, navigation }: { item: any; navigation: any }) {
  const [cover, ...photos] = newsMedia(item);
  return <SurfaceCard style={x.leaderCard} contentStyle={x.cardContent}>{!!cover && <NewsMediaItem media={cover} navigation={navigation} />}<Text style={s.meta}>{[item.date, item.location, item.category].filter(Boolean).join(' · ')}</Text><Heading>{item.title}</Heading>
    <Body value={item.summary} navigation={navigation} /><Body value={item.body} navigation={navigation} />
    {photos.map(photo => <NewsMediaItem key={photo.url} media={photo} navigation={navigation} />)}<NewsResourceLinks article={item} navigation={navigation} />
    <ActionLink navigation={navigation} href={item.href} label="View details" /><ActionLink navigation={navigation} href={item.fileUrl} label="Download document" download />
  </SurfaceCard>;
}
function LeaderProfile({ person, context, path, navigation, onClose }: { person: any; context: any; path: string; navigation: any; onClose: () => void }) {
  const inFlight = useRef(false);
  const [purposes, setPurposes] = useState<any[] | null>(null), [form, setForm] = useState(false), [loading, setLoading] = useState(false), [sending, setSending] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  const [values, setValues] = useState({ name: '', phone: '', email: '', organisation: '', district: '', purpose: '', note: '' });
  const showForm = async () => {
    setForm(true); setError(''); setLoading(true);
    try { const rows = await readPublicCms('/cms/leader-messages/purposes'); setPurposes(Array.isArray(rows) ? rows : []); }
    catch { setError('Could not load enquiry options. Please try again.'); }
    finally { setLoading(false); }
  };
  const submit = async () => {
    if (inFlight.current) return;
    const selected = purposes?.find(purpose => purpose.key === values.purpose);
    if (!values.name.trim() || values.phone.replace(/\D/g, '').length < 7 || !selected || selected.requiresNote && !values.note.trim()) { setError('Enter your name, a valid phone number and an enquiry purpose. Add a note if required.'); return; }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) { setError('Enter a valid email address.'); return; }
    inFlight.current = true; setSending(true); setError('');
    try {
      const receipt = await submitPublicCms('/cms/leader-messages', { leader: { id: person.id, name: person.name, role: person.role, designation: person.designation, organisation: person.organisation }, ...context, pagePath: path,
        sender: { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim(), organisation: values.organisation.trim(), district: values.district.trim() }, purpose: values.purpose, note: values.note.trim() });
      if (receipt?.sent !== true) { setError('Could not confirm your enquiry was sent. Please try again.'); return; }
      setSent(true);
    } catch (err: any) { setError(err?.response?.data?.message || 'Could not send your enquiry. Please try again.'); }
    finally { inFlight.current = false; setSending(false); }
  };
  return <Modal animationType="slide" onRequestClose={onClose} visible>
    <PremiumPage safeBottom header={<PremiumPageHeader title={person.name} eyebrow="ACTIV LEADERSHIP" subtitle={[person.role, person.designation, person.organisation].filter(Boolean).join(' · ')}
      right={<GlassIconButton icon="close" accessibilityLabel="Close profile" onPress={onClose} />} />}>
      <View style={s.content}><SurfaceCard padded={false}><View style={s.readingContent}>
        <Photo url={person.photoUrl} alt={person.name} /><Body value={person.bio} navigation={navigation} />
        {!!(person.phone || person.email || person.address || person.addressLines?.length || person.mapUrl) && <Contact contact={person} navigation={navigation} flush />}
        {sent ? <View style={x.successPanel}><Heading>Enquiry sent</Heading><Body value="The ACTIV office has received your request and will follow up using your contact details." /></View> : <>
          {!form || !purposes?.length ? <GradientButton label={loading ? 'Loading enquiry options…' : 'Request a callback'} disabled={loading} onPress={showForm} /> : null}
          {form && !!purposes?.length && <View style={x.formSection}><Heading>Request a callback</Heading><Body value="Your request goes to the ACTIV office, which coordinates contact with the office-bearer." />
            {(['name', 'phone', 'email', 'organisation', 'district'] as const).map(key => <View key={key}><Text style={s.meta}>{key[0].toUpperCase() + key.slice(1)}{key === 'name' || key === 'phone' ? ' *' : ' (optional)'}</Text><TextInput style={s.input} accessibilityLabel={'Your ' + key} value={values[key]} keyboardType={key === 'phone' ? 'phone-pad' : key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'words'} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))} /></View>)}
            <PremiumSelect label="Enquiry purpose" required value={purposes.find(item => item.key === values.purpose)?.label || ''} options={purposes.map(item => item.label)} placeholder="Choose a purpose" onChange={label => setValues(previous => ({ ...previous, purpose: purposes.find(item => item.label === label)?.key || '' }))} />
            <Body value={purposes.find(item => item.key === values.purpose)?.hint} /><TextInput style={[s.input, { minHeight: 96 }]} accessibilityLabel="Enquiry note" placeholder="Additional note" multiline maxLength={300} value={values.note} onChangeText={note => setValues(previous => ({ ...previous, note }))} />
            <GradientButton label={sending ? 'Sending…' : 'Send enquiry'} disabled={sending} onPress={submit} />
          </View>}
          {!!error && <Text accessibilityRole="alert" style={[s.body, { color: '#B91C1C' }]}>{error}</Text>}
        </>}
      </View></SurfaceCard></View>
    </PremiumPage>
  </Modal>;
}
const x = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardContent: { padding: 16, minWidth: 0 }, cardList: { gap: 12 },
  section: { gap: 16, marginTop: 8, minWidth: 0 }, sectionHeading: { gap: 5, minWidth: 0 },
  eyebrow: { color: BRAND.blue, fontSize: 11, lineHeight: 17, letterSpacing: 1.2, fontWeight: '700', flexShrink: 1, marginBottom: 4 },
  heading: { color: BRAND.navyDeep, fontSize: 21, lineHeight: 29, fontWeight: '700', flexShrink: 1 },
  person: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', minWidth: 0 }, personStacked: { flexDirection: 'column' }, personCopy: { flex: 0, alignSelf: 'stretch' },
  portrait: { width: 72, height: 90, borderRadius: 14, backgroundColor: PALETTE.blueSoft }, initial: { alignItems: 'center', justifyContent: 'center' }, initialText: { color: BRAND.blue900, fontSize: 28, fontWeight: '700' },
  personName: { color: BRAND.navyDeep, fontSize: 17, lineHeight: 24, fontWeight: '700', flexShrink: 1, marginBottom: 4 },
  personRole: { color: PALETTE.textMuted, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  profileAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }, profileLink: { flexShrink: 1, color: BRAND.blue, fontWeight: '600', fontSize: 13, lineHeight: 20 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, fact: { flexGrow: 1, flexBasis: '43%', minWidth: 0, backgroundColor: PALETTE.blueSoft, padding: 14, borderRadius: 14, gap: 4 }, factWide: { flexBasis: '100%' }, factValue: { color: BRAND.navyDeep, fontSize: 20, lineHeight: 27, fontWeight: '700', flexShrink: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 70, padding: 14 }, sectionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: PALETTE.blueSoft, alignItems: 'center', justifyContent: 'center' }, sectionTitle: { flex: 1, minWidth: 0, color: BRAND.navyDeep, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  divider: { borderTopWidth: 1, borderTopColor: PALETTE.border },
  board: { gap: 10, minWidth: 0, marginBottom: 8 }, boardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 }, boardMark: { width: 3, height: 22, backgroundColor: BRAND.blue, borderRadius: 2 }, boardName: { color: BRAND.navyDeep, fontSize: 17, lineHeight: 25, fontWeight: '700', flexShrink: 1 },
  leaderCard: { shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 }, contactGroup: { gap: 10, minWidth: 0 }, contact: { padding: 16, minWidth: 0 }, contactFlush: { padding: 0 },
  formSection: { borderTopWidth: 1, borderTopColor: PALETTE.border, paddingTop: 18, minWidth: 0 }, successPanel: { backgroundColor: PALETTE.blueSoft, padding: 16, borderRadius: 16 },
  contactAction: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 6 }, contactIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: PALETTE.blueSoft }, contactValue: { flex: 1, minWidth: 0, color: BRAND.blue900, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: PALETTE.border, borderRadius: 14, backgroundColor: PALETTE.white, paddingHorizontal: 14 }, searchInput: { flex: 1, minWidth: 0, minHeight: 50, color: PALETTE.text, fontSize: 15 },
});
