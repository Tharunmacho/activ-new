import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { resolveMediaUrl } from '../../../config/api.config';
import {
  PALETTE, SPACE, RADIUS, BRAND,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton, GlassIconButton, PremiumInput, BottomActionBar, FitImage } from '../../../ui';
import {
  createCmsEvent, updateCmsEvent, getEventsSettingsCategories, uploadCmsMedia, uploadEventAttachment,
  errorText, EMPTY_EVENT_MEDIA,
  type CmsEventRow, type EventTarget, type EventDay, type EventAgendaItem, type EventSpeaker,
  type EventAttachment, type CmsEventMedia, type CategoryMode,
} from '../../../services/superApi';
import { useRegionTreeAll, useRegionNames, openUrl } from './superKit';
import {
  DateField, TimeField, Choice, CheckCard, InlineSelect, SubHead, Label, k,
  isDay, isTime, toDateInput, toTimeInput, toInstant, addDays, dayDelta, shiftDays, daysInRange, datesBetween,
  dayLabel, hasTargets, isOnPublicSite, targetText, sameTarget, coversTarget,
} from './events/eventKit';

/**
 * ============================================================================
 * SUPER ADMIN → EVENTS — one event's form (website EventsManager, channel
 * "members", opened as its own screen the way the website opens it)
 * ============================================================================
 *
 * The SAME payload the website's `handleSubmit` builds, sent to POST
 * /cms/events or PUT /cms/events/:id as JSON:
 *
 *   - NOTHING IS REQUIRED. A blank date is sent as `startAt: ''` and stored as
 *     null ("Date to be confirmed"); a MALFORMED one is refused here, because
 *     "not a date I can read" and "no date yet" are different answers.
 *   - `targets` AND `reachEveryone` are sent together, never one instead of the
 *     other, so a reopened event shows back both.
 *   - The legacy `state`/`district`/`block` mirror is NEVER sent: the server
 *     derives it from the first target.
 *   - `showOnOnboarding` is always offered on this surface; a new event opens
 *     with it ON, exactly as the website's `openNew` does.
 *   - Arrays are JSON-encoded, as the website sends them (`parseArray` reads
 *     them back on both transports).
 *
 * The banner and speaker photos go up first through POST /cms/media and the
 * documents through POST /cms/attachments (the website's MediaPicker and
 * EventFilesEditor); the form then carries their URLs.
 *
 * A plain Stack screen: every picker is an inline card, never a native Modal.
 */

interface Detail {
  audience: 'all' | 'paid';
  mode: 'offline' | 'online';
  onlinePlatform: string; onlineUrl: string;
  agenda: EventAgendaItem[]; speakers: EventSpeaker[];
  venueAddress: string; venueMapUrl: string;
  contactName: string; contactPhone: string; contactEmail: string;
  registrationEnabled: boolean; registrationDeadline: string;
  capacity: string; registrationFee: string; memberFee: string; registrationNote: string;
  topic: string; language: string; registrationFields: any[]; reminderOffsetsHours: number[];
}

interface Form {
  title: string; description: string; date: string; time: string; endDate: string; endTime: string;
  days: EventDay[]; location: string; category: string; targets: EventTarget[];
  showOnOnboarding: boolean; showQrOnPage: boolean; attachments: EventAttachment[]; videoUrl: string; whatsappChannelUrl: string;
  reachEveryone: boolean; media: CmsEventMedia; status: 'published' | 'draft'; detail: Detail;
}

const BLANK_DETAIL: Detail = {
  audience: 'all', mode: 'offline', onlinePlatform: '', onlineUrl: '', agenda: [], speakers: [],
  venueAddress: '', venueMapUrl: '', contactName: '', contactPhone: '', contactEmail: '',
  // New events accept registrations (website BLANK_DETAIL).
  registrationEnabled: true, registrationDeadline: '', capacity: '', registrationFee: '', memberFee: '',
  registrationNote: '', topic: '', language: '', registrationFields: [], reminderOffsetsHours: [],
};

/** A new event: everyone, published, and on the onboarding site (website `openNew`). */
const blankForm = (): Form => ({
  title: '', description: '', date: '', time: '', endDate: '', endTime: '', days: [], location: '', category: '',
  targets: [], showOnOnboarding: true, showQrOnPage: true, attachments: [], videoUrl: '', whatsappChannelUrl: '', reachEveryone: true,
  media: { ...EMPTY_EVENT_MEDIA }, status: 'published', detail: { ...BLANK_DETAIL, audience: 'all' },
});

const BLANK_SESSION: EventAgendaItem = { startTime: '', endTime: '', title: '', description: '', speaker: '', location: '' };
const BLANK_SPEAKER: EventSpeaker = { name: '', role: '', organization: '', bio: '', photoUrl: '' };

const pad = (n: number) => String(n).padStart(2, '0');
/** `datetime-local` shape, in LOCAL time (website toLocalDateTimeInput). */
const toLocalDateTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Read one stored event back into the form (website `openEdit`). */
const formFromEvent = (e: CmsEventRow): Form => ({
  title: e?.title || '',
  description: e?.description || '',
  date: toDateInput(e?.startAt),
  time: toTimeInput(e?.startAt),
  // Only a DIFFERENT day is an end date.
  endDate: toDateInput(e?.endAt) === toDateInput(e?.startAt) ? '' : toDateInput(e?.endAt),
  endTime: toTimeInput(e?.endAt),
  days: (Array.isArray(e?.days) ? e.days : []).map((d) => ({
    date: String(d?.date || '').slice(0, 10),
    startTime: d?.startTime || '',
    endTime: d?.endTime || '',
    agenda: Array.isArray(d?.agenda) ? d.agenda : [],
  })),
  location: e?.location || '',
  category: e?.category || '',
  // The list, with the legacy trio as the fallback for rows written before it.
  targets: Array.isArray(e?.targets) && (e?.targets || []).length
    ? (e.targets || []).map((t) => ({ state: t?.state || '', district: t?.district || '', block: t?.block || '' }))
    : (e?.state ? [{ state: e.state, district: e?.district || '', block: e?.block || '' }] : []),
  showOnOnboarding: isOnPublicSite(e),
  showQrOnPage: e?.showQrOnPage !== false,
  attachments: Array.isArray(e?.attachments) ? e.attachments : [],
  videoUrl: e?.videoUrl || '',
  whatsappChannelUrl: e?.whatsappChannelUrl || '',
  reachEveryone: e?.reachEveryone === true || !hasTargets(e),
  media: { ...EMPTY_EVENT_MEDIA, ...(e?.media || {}) } as CmsEventMedia,
  status: (e?.status === 'draft' ? 'draft' : 'published'),
  detail: {
    audience: e?.audience === 'paid' ? 'paid' : 'all',
    mode: e?.mode === 'online' ? 'online' : 'offline',
    onlinePlatform: e?.onlinePlatform || '',
    onlineUrl: e?.onlineUrl || '',
    agenda: Array.isArray(e?.agenda) ? e.agenda : [],
    speakers: Array.isArray(e?.speakers) ? e.speakers : [],
    venueAddress: e?.venueAddress || '',
    venueMapUrl: e?.venueMapUrl || '',
    contactName: e?.contactName || '',
    contactPhone: e?.contactPhone || '',
    contactEmail: e?.contactEmail || '',
    registrationEnabled: !!e?.registrationEnabled,
    registrationDeadline: toLocalDateTime(e?.registrationDeadline),
    capacity: e?.capacity ? String(e.capacity) : '',
    registrationFee: e?.registrationFee ? String(e.registrationFee) : '',
    // null AND undefined become blank; a numeric 0 survives as "0".
    memberFee: e?.memberFee === null || e?.memberFee === undefined ? '' : String(e.memberFee),
    registrationNote: e?.registrationNote || '',
    topic: e?.topic || '',
    language: e?.language || '',
    registrationFields: Array.isArray(e?.registrationFields) ? e.registrationFields : [],
    reminderOffsetsHours: Array.isArray(e?.reminderOffsetsHours) ? e.reminderOffsetsHours : [],
  },
});

const sizeLabel = (bytes?: number) => {
  const n = Number(bytes) || 0;
  if (!n) return '';
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
};

/** The member-price line (website MemberPriceHint): each mistake gets its own sentence. */
const memberPriceHint = (price: string, member: string): { text: string; color: string } => {
  const full = Math.max(0, Math.round(Number(price) || 0));
  const hasRate = String(member ?? '').trim() !== '';
  const rate = hasRate ? Math.max(0, Math.round(Number(member) || 0)) : 0;
  if (!hasRate) return { text: 'Leave blank and everyone pays the same. Fill it in and members with an active membership pay this instead.', color: PALETTE.textMuted };
  if (full <= 0) return { text: 'The event is free for everyone, so a member price changes nothing.', color: '#B45309' };
  if (rate > full) return { text: `That is more than the price above. Members are never charged more — this will be ignored and they will pay ₹${full.toLocaleString('en-IN')}.`, color: PALETTE.red };
  if (rate === full) return { text: 'The same as the price above, so members save nothing. Lower it to advertise a discount, or clear it to charge one price.', color: '#B45309' };
  const saving = full - rate;
  return { text: `Members save ₹${saving.toLocaleString('en-IN')} (${Math.round((saving / full) * 100)}% off). Shown on the booking page beside the full price.`, color: '#047857' };
};

/** Pick one image through the guarded native picker. */
const pickImage = (onAsset: (asset: any) => void) => {
  try {
    if (typeof launchImageLibrary !== 'function') {
      Alert.alert('Unavailable', 'The photo picker is not available on this device.');
      return;
    }
    launchImageLibrary({ mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.9, selectionLimit: 1 }, (response) => {
      if (response?.didCancel) return;
      if (response?.errorCode) { Alert.alert('Could not open the photos', response?.errorMessage || 'Please try again.'); return; }
      const asset = (response?.assets || [])[0];
      if (!asset?.uri) { Alert.alert('Could not read that image', 'Please pick another.'); return; }
      onAsset(asset);
    });
  } catch (err) {
    console.warn('Native module call safely caught:', err);
  }
};

/* ------------------------------------------------------------ sub-editors */

function SessionRows({ rows, onChange, withWhere }: { rows: EventAgendaItem[]; onChange: (rows: EventAgendaItem[]) => void; withWhere?: boolean }) {
  const list = Array.isArray(rows) ? rows : [];
  const patch = (i: number, p: Partial<EventAgendaItem>) => onChange(list.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <View style={{ gap: SPACE.sm }}>
      {list.map((row, i) => (
        <View key={`s${i}`} style={s.subCard}>
          <View style={s.subCardHead}>
            <Text style={s.subCardTitle}>Session {i + 1}</Text>
            <TouchableOpacity onPress={() => onChange(list.filter((_, j) => j !== i))} accessibilityLabel="Remove session" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="delete-outline" size={20} color={PALETTE.red} />
            </TouchableOpacity>
          </View>
          <View style={s.row2}>
            <TimeField label="Starts" value={row?.startTime || ''} onChange={(startTime) => patch(i, { startTime })} />
            <TimeField label="Ends" value={row?.endTime || ''} onChange={(endTime) => patch(i, { endTime })} />
          </View>
          <PremiumInput tone="admin" label="Session" value={row?.title || ''} placeholder="Inaugural address" onChangeText={(title) => patch(i, { title })} />
          <PremiumInput tone="admin" label="Speaker" value={row?.speaker || ''} placeholder="Name as it should be printed" onChangeText={(speaker) => patch(i, { speaker })} />
          {withWhere ? <PremiumInput tone="admin" label="Where" value={row?.location || ''} placeholder="Optional — hall or room" onChangeText={(location) => patch(i, { location })} style={{ marginBottom: 0 }} /> : null}
        </View>
      ))}
    </View>
  );
}

function SpeakerRow({ row, index, onPatch, onRemove }: {
  row: EventSpeaker; index: number; onPatch: (p: Partial<EventSpeaker>) => void; onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = () => pickImage(async (asset) => {
    setBusy(true);
    try {
      const { url } = await uploadCmsMedia(asset);
      if (url) onPatch({ photoUrl: url });
    } catch (err) {
      Alert.alert('Could not upload the photo', errorText(err));
    } finally { setBusy(false); }
  });
  const photo = resolveMediaUrl(row?.photoUrl);
  return (
    <View style={s.subCard}>
      <View style={s.subCardHead}>
        <Text style={s.subCardTitle}>Speaker {index + 1}</Text>
        <TouchableOpacity onPress={onRemove} accessibilityLabel="Remove speaker" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="delete-outline" size={20} color={PALETTE.red} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md }}>
        <TouchableOpacity onPress={upload} style={s.avatar} activeOpacity={0.8} accessibilityLabel="Speaker photo">
          {busy ? <ActivityIndicator color={PALETTE.indigo} /> : photo
            ? <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : <Icon name="person" size={30} color={PALETTE.textFaint} />}
        </TouchableOpacity>
        <View style={{ gap: 6 }}>
          <TouchableOpacity onPress={upload}><Text style={s.link}>{photo ? 'Change photo' : 'Add a photo'}</Text></TouchableOpacity>
          {photo ? <TouchableOpacity onPress={() => onPatch({ photoUrl: '' })}><Text style={[s.link, { color: PALETTE.textMuted }]}>Remove</Text></TouchableOpacity> : null}
        </View>
      </View>
      <PremiumInput tone="admin" label="Name" value={row?.name || ''} placeholder="As it should be printed" onChangeText={(name) => onPatch({ name })} />
      <PremiumInput tone="admin" label="Designation" value={row?.role || ''} placeholder="Managing Director" onChangeText={(role) => onPatch({ role })} />
      <PremiumInput tone="admin" label="Organisation" value={row?.organization || ''} placeholder="Company or department" onChangeText={(organization) => onPatch({ organization })} />
      <PremiumInput tone="admin" label="Short bio" value={row?.bio || ''} placeholder="One line, optional" onChangeText={(bio) => onPatch({ bio })} style={{ marginBottom: 0 }} />
    </View>
  );
}

/** Who sees this (RegionTargetPicker): exactly one of two, both answers SAVED. */
function RegionTargets({ targets, onChange, reachEveryone, onReachEveryone }: {
  targets: EventTarget[]; onChange: (t: EventTarget[]) => void; reachEveryone: boolean; onReachEveryone: (v: boolean) => void;
}) {
  // `/regions/tree?include=all` — the UNPRUNED tree (content targeting).
  const tree = useRegionTreeAll();
  const [st, setSt] = useState('');
  const [di, setDi] = useState('');
  const [bl, setBl] = useState('');
  const names = useRegionNames(tree, st, di);
  const list = Array.isArray(targets) ? targets : [];

  const add = () => {
    if (!st) return;
    const target = { state: st, district: di, block: bl };
    if (list.some((t) => coversTarget(t, target))) { setDi(''); setBl(''); return; } // already reached
    onChange([...list.filter((t) => !coversTarget(target, t)), target]);
    setDi(''); setBl('');
  };

  return (
    <View>
      <Choice<'everyone' | 'regions'>
        value={reachEveryone ? 'everyone' : 'regions'}
        onChange={(v) => onReachEveryone(v === 'everyone')}
        options={[
          {
            value: 'everyone', icon: 'public', title: 'Everyone in the association',
            detail: list.length
              ? `Every member, wherever they are. Your ${list.length} ${list.length === 1 ? 'region is' : 'regions are'} kept, and come back if you switch.`
              : 'Every member, wherever they are.',
          },
          {
            value: 'regions', icon: 'place', title: 'Only chosen regions',
            detail: list.length ? `${list.length} ${list.length === 1 ? 'region' : 'regions'} chosen.` : 'Choose a state, then narrow it if you want to.',
          },
        ]}
      />
      {!reachEveryone ? (
        <View style={{ marginTop: SPACE.lg }}>
          {(tree || []).length === 0 ? (
            <Text style={k.hint}>Loading regions… If none appear, create an admin for a state, district or block to open one for targeting.</Text>
          ) : null}
          <InlineSelect label="1 · State" value={st} options={names.states} placeholder="Choose a state"
            onChange={(v) => { setSt(v); setDi(''); setBl(''); }} />
          <InlineSelect label="2 · District" value={di} options={names.districts} disabled={!st}
            placeholder={!st ? 'Choose a state first' : names.districts.length ? 'All districts' : 'No districts in this state'}
            note={st ? 'Leave as All districts to take the whole state.' : undefined}
            onChange={(v) => { setDi(v); setBl(''); }} />
          <InlineSelect label="3 · Block" value={bl} options={names.blocks} disabled={!di}
            placeholder={!di ? 'Choose a district first' : names.blocks.length ? 'All blocks' : 'No blocks in this district'}
            note={di ? 'Leave as All blocks to take the whole district.' : undefined}
            onChange={setBl} />
          <ConsoleButton kind="soft" icon="add" label={st ? `Add ${targetText({ state: st, district: di, block: bl })}` : 'Start by choosing a state'}
            onPress={add} disabled={!st} />
          {list.length ? (
            <View style={{ marginTop: SPACE.lg }}>
              <Text style={s.eyebrow}>CHOSEN REGIONS</Text>
              <View style={s.pills}>
                {list.map((t) => (
                  <View key={`${t.state}|${t.district}|${t.block}`} style={s.pill}>
                    <Text style={s.pillText}>{targetText(t)}</Text>
                    <TouchableOpacity onPress={() => onChange(list.filter((x) => !sameTarget(x, t)))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={`Remove ${t.block || t.district || t.state}`}>
                      <Icon name="close" size={16} color={PALETTE.indigo} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* ================================================================= screen */

const SuperEventEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const original: CmsEventRow | null = route?.params?.event || null;
  const editingId = String(original?.id || '');

  const [form, setForm] = useState<Form>(() => (original ? formFromEvent(original) : blankForm()));
  const [categories, setCategories] = useState<{ label: string; mode: CategoryMode }[]>([]);
  const [saving, setSaving] = useState(false);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);

  useEffect(() => {
    let alive = true;
    getEventsSettingsCategories().then((c) => { if (alive) setCategories(c || []); }).catch(() => null);
    return () => { alive = false; };
  }, []);

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const setDetail = (p: Partial<Detail>) => setForm((f) => ({ ...f, detail: { ...f.detail, ...p } }));
  const d = form.detail;
  const multiDay = !!form.endDate && form.endDate !== form.date;
  const dayDates = useMemo(() => datesBetween(form.date, form.endDate), [form.date, form.endDate]);

  /* Only the categories this kind of event can be filed under; the event's own is always kept. */
  const categoryOptions = useMemo(() => {
    const fit = (categories || []).filter((c) => c.mode === 'both' || c.mode === d.mode).map((c) => c.label);
    if (form.category && !(categories || []).some((c) => c.label === form.category)) return [form.category, ...fit];
    return fit;
  }, [categories, d.mode, form.category]);

  /* Moving the start moves the event: the last day and every day go with it (website). */
  const setStartDate = (next: string) => {
    const delta = dayDelta(form.date, next);
    if (!next || !Number.isFinite(delta) || delta === 0) { set({ date: next }); return; }
    set({
      date: next,
      endDate: form.endDate ? addDays(form.endDate, delta) || form.endDate : form.endDate,
      days: shiftDays(form.days || [], delta),
    });
  };

  const dayFor = (iso: string): EventDay =>
    (form.days || []).find((x) => String(x?.date || '').slice(0, 10) === iso) || { date: iso, startTime: '', endTime: '', agenda: [] };
  const setDay = (iso: string, p: Partial<EventDay>) =>
    set({ days: dayDates.map((dd) => (dd === iso ? { ...dayFor(dd), ...p, date: dd } : dayFor(dd))) });

  const uploadBanner = () => pickImage(async (asset) => {
    setBannerBusy(true);
    try {
      const { url, type } = await uploadCmsMedia(asset);
      if (url) set({ media: { ...form.media, url, type } });
    } catch (err) {
      Alert.alert('Could not upload the banner', errorText(err));
    } finally { setBannerBusy(false); }
  });

  /* Documents: the phone picker offers images (PDFs and Office files are added on the website). */
  const uploadFile = () => {
    if ((form.attachments || []).length >= 10) { Alert.alert('Ten at most', 'An event carries up to ten documents.'); return; }
    pickImage(async (asset) => {
      if (Number(asset?.fileSize || 0) > 20 * 1024 * 1024) { Alert.alert('Too large', 'Files must be 20 MB or smaller.'); return; }
      setFilesBusy(true);
      try {
        const up = await uploadEventAttachment(asset);
        if (up?.url) setForm((f) => ({ ...f, attachments: [...(f.attachments || []), up] }));
      } catch (err) {
        Alert.alert('Could not upload the file', errorText(err));
      } finally { setFilesBusy(false); }
    });
  };

  const save = async () => {
    // Nothing is required — but a date that cannot be read is an error, not "no date".
    const bad: string[] = [];
    if (form.date && !isDay(form.date)) bad.push('the date');
    if (form.endDate && !isDay(form.endDate)) bad.push('the last day');
    if (form.time && !isTime(form.time)) bad.push('the start time');
    if (form.endTime && !isTime(form.endTime)) bad.push('the end time');
    if (form.endDate && form.date && form.endDate < form.date) bad.push('the last day (it is before the first)');
    if (bad.length) { Alert.alert('Check the dates', `This cannot be read: ${bad.join(', ')}.`); return; }

    const payload: Record<string, any> = {
      title: form.title,
      description: form.description,
      startAt: toInstant(form.date, form.time),
      endAt: (form.endDate || form.endTime) ? toInstant(form.endDate || form.date, form.endTime || '23:59') : '',
      days: JSON.stringify(daysInRange(form.days || [], form.date, form.endDate)),
      location: form.location,
      category: form.category,
      // The list; the legacy state/district/block mirror is derived by the server.
      targets: JSON.stringify(form.targets || []),
      imageUrl: form.media.url,
      bannerAlt: form.media.alt,
      bannerFit: form.media.fit,
      bannerPosition: form.media.position,
      status: form.status,
      audience: d.audience,
      channel: 'members',
      showOnOnboarding: form.showOnOnboarding,
      showQrOnPage: form.showQrOnPage,
      attachments: JSON.stringify(form.attachments || []),
      videoUrl: form.videoUrl || '',
      whatsappChannelUrl: form.whatsappChannelUrl || '',
      reachEveryone: form.reachEveryone,
      agenda: JSON.stringify(d.agenda || []),
      speakers: JSON.stringify(d.speakers || []),
      reminderOffsetsHours: JSON.stringify(d.reminderOffsetsHours || []),
      mode: d.mode,
      onlinePlatform: d.onlinePlatform,
      onlineUrl: d.onlineUrl,
      venueAddress: d.venueAddress,
      venueMapUrl: d.venueMapUrl,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      contactEmail: d.contactEmail,
      registrationEnabled: d.registrationEnabled,
      registrationDeadline: d.registrationDeadline ? new Date(d.registrationDeadline).toISOString() : '',
      capacity: Number(d.capacity) || 0,
      registrationFee: Number(d.registrationFee) || 0,
      // '' clears the member rate; a typed 0 is a real "members attend free".
      memberFee: String(d.memberFee ?? '').trim() === '' ? '' : Number(d.memberFee) || 0,
      registrationNote: d.registrationNote,
      topic: d.topic,
      language: d.language,
      registrationFields: JSON.stringify(d.registrationFields || []),
    };
    if (d.registrationDeadline && Number.isNaN(new Date(d.registrationDeadline).getTime())) {
      Alert.alert('Check the dates', 'The registration closing date cannot be read.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateCmsEvent(editingId, payload);
        Alert.alert('Event saved', form.title ? `“${form.title}” is saved.` : 'The event is saved.');
        navigation.goBack();
      } else {
        const created = await createCmsEvent(payload);
        const id = String(created?.id || created?._id || '');
        if (id) {
          // The website opens the QR panel on a new event ("Event created — QR
          // ready"); here it is its own screen, replacing the form.
          navigation.replace('SuperEventQr', {
            justCreated: true,
            event: { id, slug: created?.slug || '', title: form.title, startAt: created?.startAt || null, showQrOnPage: form.showQrOnPage },
          });
        } else {
          Alert.alert('Event created', 'The event is saved.');
          navigation.goBack();
        }
      }
    } catch (err) {
      Alert.alert('Could not save the event', errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const banner = resolveMediaUrl(form.media?.url);
  const hint = memberPriceHint(d.registrationFee, d.memberFee);

  return (
    <ConsoleScroll
      avoidKeyboard
      footer={(
        <BottomActionBar>
          <ConsoleButton kind="soft" label="Cancel" onPress={() => navigation.goBack()} disabled={saving} style={s.footCancel} />
          <ConsoleButton icon="save" label={editingId ? 'Save event' : 'Create event'} onPress={save} loading={saving} style={s.footSave} />
        </BottomActionBar>
      )}
    >
      <ConsoleHeader
        compact
        eyebrow="Super Admin · events"
        title={editingId ? 'Edit event' : 'New event'}
        subtitle="Nothing here is required — save it now and finish it later. Published events reach members in their region."
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />}
      />

      {/* ------------------------------------------------ what and when */}
      <ConsoleCard style={[s.card, s.firstCard]}>
        <PremiumInput tone="admin" label="Title" value={form.title} onChangeText={(title) => set({ title })} placeholder="Untitled event" />
        <PremiumInput tone="admin" label="Description" value={form.description} onChangeText={(description) => set({ description })} multiline
          placeholder="What is happening, and who should attend" inputStyle={{ minHeight: 110 }} style={{ marginBottom: 0 }} />
      </ConsoleCard>

      <ConsoleCard style={s.card}>
        <SubHead title="When" hint="Leave the date blank if it is not fixed yet — the event shows “Date to be confirmed”." />
        <DateField label="Date" value={form.date} onChange={setStartDate} />
        <View style={s.row2}>
          <TimeField label="Starts" value={form.time} onChange={(time) => set({ time })} />
          <TimeField label="Ends" value={form.endTime} onChange={(endTime) => set({ endTime })} />
        </View>
        <DateField label="Last day" value={form.endDate} min={form.date || undefined} onChange={(endDate) => set({ endDate })}
          hint="Only for an event that runs over more than one day. Leave it blank and the event is on the date above." />

        {dayDates.length >= 2 ? (
          <View style={{ marginTop: SPACE.sm }}>
            <SubHead title="Each day’s hours and programme"
              hint={`${dayDates.length} days, taken from the dates above. Leave a day’s times blank and the page shows the event’s own hours for it.`} />
            {dayDates.map((iso, i) => {
              const day = dayFor(iso);
              return (
                <View key={iso} style={[s.subCard, { marginBottom: SPACE.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                    <View style={s.dayTag}><Text style={s.dayTagText}>Day {i + 1}</Text></View>
                    <Text style={s.dayLabel}>{dayLabel(iso)}</Text>
                  </View>
                  <View style={s.row2}>
                    <TimeField label="Starts" value={day.startTime || ''} onChange={(startTime) => setDay(iso, { startTime })} />
                    <TimeField label="Ends" value={day.endTime || ''} onChange={(endTime) => setDay(iso, { endTime })} />
                  </View>
                  <SubHead title="Sessions on this day" action="Add session"
                    onAction={() => setDay(iso, { agenda: [...(day.agenda || []), { ...BLANK_SESSION }] })} />
                  {(day.agenda || []).length === 0 ? <Text style={k.hint}>No sessions listed for this day.</Text> : null}
                  <SessionRows rows={day.agenda || []} withWhere onChange={(agenda) => setDay(iso, { agenda })} />
                </View>
              );
            })}
          </View>
        ) : null}
      </ConsoleCard>

      {/* ----------------------------------------------- kind and place */}
      <ConsoleCard style={s.card}>
        <InlineSelect label="Category" value={form.category} options={categoryOptions} placeholder="No category"
          onChange={(category) => set({ category })} />
        <PremiumInput tone="admin" label="Topic" value={d.topic} onChangeText={(topic) => setDetail({ topic })} maxLength={120}
          placeholder="What the event is about" hint="The subject in a few words — printed in the booking email and WhatsApp." />
        <PremiumInput tone="admin" label="Language" value={d.language} onChangeText={(language) => setDetail({ language })} maxLength={60}
          placeholder="Tamil & English" style={{ marginBottom: 0 }} />
      </ConsoleCard>

      <ConsoleCard style={s.card}>
        <SubHead title="How this event is attended" />
        <Choice<'offline' | 'online'>
          value={d.mode}
          onChange={(mode) => setDetail({ mode })}
          options={[
            { value: 'offline', icon: 'place', title: 'In person', detail: 'People come to a venue. The page shows the address and a Directions button.' },
            { value: 'online', icon: 'videocam', title: 'Online', detail: 'People join on a link. The page names the platform; the link goes only to those who book.' },
          ]}
        />
        <View style={{ marginTop: SPACE.lg }}>
          {d.mode === 'online' ? (
            <>
              <PremiumInput tone="admin" label="Platform" value={d.onlinePlatform} onChangeText={(onlinePlatform) => setDetail({ onlinePlatform })} placeholder="Zoom"
                hint="Zoom, Google Meet, Microsoft Teams — whatever people will need open." />
              <PremiumInput tone="admin" label="Registration link" value={d.onlineUrl} onChangeText={(onlineUrl) => setDetail({ onlineUrl })} autoCapitalize="none"
                keyboardType="url" placeholder="https://zoom.us/meeting/register/…" style={{ marginBottom: 0 }}
                hint="Not shown publicly — it is sent to the people who book." />
            </>
          ) : (
            <>
              <PremiumInput tone="admin" label="Location / venue" value={form.location} onChangeText={(location) => set({ location })} placeholder="Chennai Trade Centre" />
              <PremiumInput tone="admin" label="Venue address" value={d.venueAddress} onChangeText={(venueAddress) => setDetail({ venueAddress })} multiline />
              <PremiumInput tone="admin" label="Map link" value={d.venueMapUrl} onChangeText={(venueMapUrl) => setDetail({ venueMapUrl })} autoCapitalize="none"
                keyboardType="url" placeholder="https://maps.app.goo.gl/…" style={{ marginBottom: 0 }} />
            </>
          )}
        </View>
      </ConsoleCard>

      {/* ------------------------------------------------------- banner */}
      <ConsoleCard style={s.card}>
        <SubHead title="Banner" hint="Best at 1600 × 900 (16:9, landscape) — the shape the event page and cards draw." />
        <TouchableOpacity onPress={uploadBanner} activeOpacity={0.85} style={s.banner} accessibilityLabel="Choose a banner">
          {bannerBusy ? <ActivityIndicator color={PALETTE.indigo} />
            : banner ? <FitImage uri={banner} style={{ width: '100%', height: '100%' }} fit={form.media.fit === 'cover' ? 'cover' : 'contain'} />
              : (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Icon name="add-photo-alternate" size={30} color={PALETTE.indigo} />
                  <Text style={s.link}>Add a banner image</Text>
                </View>
              )}
        </TouchableOpacity>
        {banner ? (
          <>
            <View style={{ flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm, marginBottom: SPACE.md }}>
              <TouchableOpacity onPress={uploadBanner}><Text style={s.link}>Change</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => set({ media: { ...EMPTY_EVENT_MEDIA } })}><Text style={[s.link, { color: PALETTE.red }]}>Remove</Text></TouchableOpacity>
            </View>
            <Label text="Fit" />
            <Choice<'cover' | 'contain'>
              value={form.media.fit === 'contain' ? 'contain' : 'cover'}
              onChange={(fit) => set({ media: { ...form.media, fit } })}
              options={[
                { value: 'cover', icon: 'crop', title: 'Fill frame', detail: 'Cropped to the 16:9 frame.' },
                { value: 'contain', icon: 'fit-screen', title: 'Show whole', detail: 'The whole picture, padded either side.' },
              ]}
            />
            <PremiumInput tone="admin" label="Description of the picture" value={form.media.alt} onChangeText={(alt) => set({ media: { ...form.media, alt } })}
              placeholder="For screen readers" style={{ marginTop: SPACE.md, marginBottom: 0 }} />
          </>
        ) : null}
      </ConsoleCard>

      {/* ------------------------------------------------ who it reaches */}
      <ConsoleCard style={s.card}>
        <SubHead title="Who sees this event"
          hint="Members, block admins, district admins and state admins only see events aimed at where they are. Choose one of the two below." />
        <RegionTargets targets={form.targets} onChange={(targets) => set({ targets })}
          reachEveryone={form.reachEveryone} onReachEveryone={(reachEveryone) => set({ reachEveryone })} />
        <View style={{ marginTop: SPACE.lg, gap: SPACE.sm }}>
          <CheckCard checked={form.showOnOnboarding} onChange={(showOnOnboarding) => set({ showOnOnboarding })} icon="language"
            title="Also post it in the onboarding events section" detail="Members see it either way. This adds it to the public site too." />
          {form.showOnOnboarding && (form.targets || []).length > 0 ? (
            <Text style={s.infoLine}>
              Aimed at {(form.targets || []).length === 1 ? '1 region' : `${(form.targets || []).length} regions`}, and now readable by anyone on the public
              site. Visitors can filter the events page down to a state, district or block.
            </Text>
          ) : null}
          <CheckCard checked={form.showQrOnPage} onChange={(showQrOnPage) => set({ showQrOnPage })} icon="qr-code-2"
            title="Show the event's QR code on its page" detail="Scanning it opens this event on a phone." />
        </View>
      </ConsoleCard>

      {/* ---------------------------------------- documents and video */}
      <ConsoleCard style={s.card}>
        <SubHead title="Agenda, documents & video"
          hint="They go to the people who register — linked in the booking email and sent on WhatsApp. Not shown on the public event page." />
        <PremiumInput tone="admin" label="YouTube or video link" icon="smart-display" value={form.videoUrl} onChangeText={(videoUrl) => set({ videoUrl })}
          autoCapitalize="none" keyboardType="url" placeholder="https://www.youtube.com/watch?v=…" />
        <PremiumInput tone="admin" label="WhatsApp channel link" icon="link" value={form.whatsappChannelUrl}
          onChangeText={(whatsappChannelUrl) => set({ whatsappChannelUrl })} autoCapitalize="none" keyboardType="url"
          placeholder="https://whatsapp.com/channel/..." />
        {(form.attachments || []).map((a, i) => (
          <View key={`${a?.url}-${i}`} style={s.fileRow}>
            <Icon name="description" size={20} color={PALETTE.indigo} />
            <TextInput value={a?.name || ''} onChangeText={(name) => set({ attachments: (form.attachments || []).map((x, n) => (n === i ? { ...x, name } : x)) })}
              style={s.fileName} accessibilityLabel="Document name" />
            {sizeLabel(a?.size) ? <Text style={s.fileSize}>{sizeLabel(a?.size)}</Text> : null}
            <TouchableOpacity onPress={() => openUrl(resolveMediaUrl(a?.url))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.link}>Open</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => set({ attachments: (form.attachments || []).filter((_, n) => n !== i) })}
              accessibilityLabel={`Remove ${a?.name || 'document'}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="delete-outline" size={20} color={PALETTE.red} />
            </TouchableOpacity>
          </View>
        ))}
        <ConsoleButton kind="soft" icon="upload-file" label={filesBusy ? 'Uploading…' : 'Upload an image document'}
          onPress={uploadFile} loading={filesBusy} disabled={(form.attachments || []).length >= 10} style={{ marginTop: SPACE.sm }} />
        <Text style={k.hint}>PDF, Word and Excel files can be added from the website; they appear here once saved.</Text>
      </ConsoleCard>

      {/* ------------------------- programme, speakers and registration */}
      <ConsoleCard style={s.card}>
        <TouchableOpacity onPress={() => setDetailOpen((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center' }} activeOpacity={0.8}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.cardTitle}>Programme, speakers and registration</Text>
            <Text style={k.hint}>{[
              d.audience === 'paid' ? 'Members only' : 'Open to everyone',
              (d.agenda || []).length ? `${(d.agenda || []).length} sessions` : '',
              (d.speakers || []).length ? `${(d.speakers || []).length} speakers` : '',
              d.registrationEnabled ? (Number(d.capacity) > 0 ? `${d.capacity} seats` : 'registration open') : '',
              d.registrationEnabled && String(d.memberFee ?? '').trim() !== '' && Number(d.memberFee) < Number(d.registrationFee)
                ? `members ₹${Number(d.memberFee).toLocaleString('en-IN')}` : '',
            ].filter(Boolean).join(' · ')}</Text>
          </View>
          <Icon name={detailOpen ? 'expand-less' : 'expand-more'} size={24} color={PALETTE.textMuted} />
        </TouchableOpacity>

        {detailOpen ? (
          <View style={{ marginTop: SPACE.lg }}>
            {multiDay ? (
              <View style={s.infoBox}>
                <Text style={s.infoTitle}>This event runs over more than one day.</Text>
                <Text style={s.infoText}>
                  Its programme is written day by day under the dates above.
                  {(d.agenda || []).length ? ` The ${(d.agenda || []).length} session${(d.agenda || []).length === 1 ? '' : 's'} listed before it became multi-day ${(d.agenda || []).length === 1 ? 'is' : 'are'} kept and show again if you make it a one-day event.` : ''}
                </Text>
              </View>
            ) : (
              <>
                <SubHead title="Agenda" action="Add session" onAction={() => setDetail({ agenda: [...(d.agenda || []), { ...BLANK_SESSION }] })} />
                {(d.agenda || []).length === 0 ? <Text style={k.hint}>No agenda. The event page shows its description instead.</Text> : null}
                <SessionRows rows={d.agenda || []} onChange={(agenda) => setDetail({ agenda })} />
              </>
            )}

            <View style={s.divider} />
            <SubHead title="Speakers" hint="Shown as cards on the event page." action="Add speaker"
              onAction={() => setDetail({ speakers: [...(d.speakers || []), { ...BLANK_SPEAKER }] })} />
            {(d.speakers || []).length === 0 ? <Text style={k.hint}>No speakers yet. The event page simply leaves the section out.</Text> : null}
            <View style={{ gap: SPACE.sm }}>
              {(d.speakers || []).map((row, i) => (
                <SpeakerRow key={`sp${i}`} row={row} index={i}
                  onPatch={(p) => setDetail({ speakers: (d.speakers || []).map((x, j) => (j === i ? { ...x, ...p } : x)) })}
                  onRemove={() => setDetail({ speakers: (d.speakers || []).filter((_, j) => j !== i) })} />
              ))}
            </View>

            <View style={s.divider} />
            <SubHead title="Contact" />
            <PremiumInput tone="admin" label="Contact name" value={d.contactName} onChangeText={(contactName) => setDetail({ contactName })} />
            <PremiumInput tone="admin" label="Contact phone" value={d.contactPhone} onChangeText={(contactPhone) => setDetail({ contactPhone })} keyboardType="phone-pad" />
            <PremiumInput tone="admin" label="Contact email" value={d.contactEmail} onChangeText={(contactEmail) => setDetail({ contactEmail })} keyboardType="email-address" autoCapitalize="none" />

            <View style={s.divider} />
            <SubHead title="Note for everyone attending" />
            <PremiumInput tone="admin" label="Please note" value={d.registrationNote} onChangeText={(registrationNote) => setDetail({ registrationNote })} multiline maxLength={1000}
              placeholder={'Carry a government photo ID.\nBring your business card.'}
              hint="One point per line. Shown on the event and booking pages, and sent in the confirmation and reminder emails." />

            <View style={s.divider} />
            <SubHead title="Registration" />
            <CheckCard checked={d.registrationEnabled} onChange={(registrationEnabled) => setDetail({ registrationEnabled })} icon="how-to-reg"
              title="Members can register for this event" />
            {d.registrationEnabled ? (
              <View style={{ marginTop: SPACE.md }}>
                <PremiumInput tone="admin" label="Capacity" value={d.capacity} onChangeText={(capacity) => setDetail({ capacity: capacity.replace(/[^\d]/g, '') })}
                  keyboardType="number-pad" placeholder="No limit" />
                <PremiumInput tone="admin" label="Price (₹)" value={d.registrationFee} onChangeText={(registrationFee) => setDetail({ registrationFee: registrationFee.replace(/[^\d]/g, '') })}
                  keyboardType="number-pad" placeholder="0" />
                <PremiumInput tone="admin" label="Member price (₹)" value={d.memberFee} onChangeText={(memberFee) => setDetail({ memberFee: memberFee.replace(/[^\d]/g, '') })}
                  keyboardType="number-pad" placeholder="Same as the price above" style={{ marginBottom: 4 }} />
                <Text style={[s.priceHint, { color: hint.color }]}>{hint.text}</Text>
                <DateField label="Registration closes" value={(d.registrationDeadline || '').slice(0, 10)}
                  onChange={(v) => setDetail({ registrationDeadline: v ? `${v}T23:59` : '' })}
                  hint="Registration stays open to the end of that day." />
              </View>
            ) : (
              <Text style={[k.hint, { marginTop: SPACE.sm }]}>
                This event is an announcement — nobody can book a seat on it. Tick the box to set the number of seats, the price and the member price.
              </Text>
            )}
          </View>
        ) : null}
      </ConsoleCard>

      {/* ---------------------------------------------------- visibility */}
      <ConsoleCard style={s.card}>
        <SubHead title="Visibility" />
        <Choice<'published' | 'draft'>
          value={form.status}
          onChange={(status) => set({ status })}
          options={[
            { value: 'published', icon: 'campaign', title: 'Published', detail: 'Members in the chosen regions see it now.' },
            { value: 'draft', icon: 'edit-note', title: 'Draft', detail: 'Saved, and seen by nobody until you publish it.' },
          ]}
        />
      </ConsoleCard>

    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  card: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  firstCard: { marginTop: -SPACE.lg },
  cardTitle: { fontSize: 15, fontWeight: '800', color: PALETTE.text },
  row2: { flexDirection: 'row', gap: SPACE.md },
  subCard: { borderWidth: 1, borderColor: 'rgba(84,64,212,0.14)', borderRadius: 16, padding: SPACE.md, backgroundColor: BRAND.inputFillAdmin },
  subCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm },
  subCardTitle: { fontSize: 12, fontWeight: '800', color: PALETTE.textMuted, letterSpacing: 0.4, textTransform: 'uppercase' },
  dayTag: { backgroundColor: PALETTE.indigoSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  dayTagText: { fontSize: 12, fontWeight: '800', color: PALETTE.indigo },
  dayLabel: { fontSize: 13, fontWeight: '700', color: PALETTE.textSoft },
  banner: { height: 180, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#C7D2FE', backgroundColor: PALETTE.indigoSoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 13, fontWeight: '800', color: PALETTE.indigo },
  avatar: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: PALETTE.field, borderWidth: 1, borderColor: PALETTE.border, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', color: PALETTE.textFaint, letterSpacing: 1, marginBottom: SPACE.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', backgroundColor: PALETTE.indigoSoft, borderRadius: RADIUS.pill, paddingLeft: 12, paddingRight: 8, paddingVertical: 6 },
  pillText: { fontSize: 13, fontWeight: '700', color: PALETTE.indigo, flexShrink: 1 },
  infoLine: { fontSize: 12, lineHeight: 17, color: PALETTE.indigoDark, backgroundColor: PALETTE.indigoSoft, borderRadius: 14, padding: SPACE.md, overflow: 'hidden' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: SPACE.md, paddingVertical: 6, marginBottom: SPACE.sm, backgroundColor: BRAND.inputFillAdmin },
  fileName: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', color: PALETTE.text, paddingVertical: 6 },
  fileSize: { fontSize: 11, color: PALETTE.textMuted },
  infoBox: { backgroundColor: PALETTE.indigoSoft, borderRadius: 14, padding: SPACE.md },
  infoTitle: { fontSize: 13, fontWeight: '800', color: PALETTE.indigoDark },
  infoText: { fontSize: 12, color: PALETTE.indigoDark, marginTop: 4, lineHeight: 17 },
  divider: { height: 1, backgroundColor: PALETTE.border, marginVertical: SPACE.lg },
  priceHint: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginBottom: SPACE.md },
  footCancel: { flex: 1 },
  footSave: { flex: 2 },
});

export default SuperEventEditorScreen;
