import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { resolveMediaUrl } from '../../../config/api.config';
import { pickEventDocument } from '../../../services/eventDocuments';
import { UPDATE_AUDIENCES, type UpdateAudience } from '../../../utils/memberAudience';
import { UPDATE_DELIVERY_CHANNELS, resolveUpdateDeliveryChannels, updateDeliverySummary } from '../../../utils/updateDeliveryChannels';
import {
  PALETTE, SPACE, ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleButton,
  GlassIconButton, PremiumInput, PremiumSelect, BottomActionBar, FitImage,
} from '../../../ui';
import {
  createAnnouncement, updateAnnouncement, listMembershipPlans, uploadCmsMedia, uploadEventAttachment,
  errorText, type UpdateCategory, type MembershipPlanRow,
} from '../../../services/superApi';
import { ToggleRow, openUrl } from './superKit';
import { DateField, toDateInput } from './events/eventKit';
import UpdateRegionPicker, { updateRegionLabel, type UpdateRegion } from './UpdateRegionPicker';
import UpdatePersonalizationEditor, { UpdateRecipientPreview } from './UpdatePersonalizationEditor';
import type { UpdateVariable, UpdateMember } from '../../../services/updatePersonalizationApi';

const CATEGORIES: { value: UpdateCategory; label: string }[] = [
  { value: 'general', label: 'General update' }, { value: 'notice', label: 'Notice' },
  { value: 'policy', label: 'Policy' }, { value: 'scheme', label: 'Scheme' },
  { value: 'achievement', label: 'Achievement' }, { value: 'urgent', label: 'Urgent' },
];
const messageFor = (error: any) => error?.response || error?.request ? errorText(error) : error?.message || 'Please try again.';
type InsertField = 'title' | 'body' | 'summary';
type Cursor = { start: number; end: number };
const insertLabels = { title: 'Title', body: 'Message', summary: 'Summary' };

/** Write, add optional files, choose recipients and review before publishing. */
const SuperUpdateEditorScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const a = route?.params?.announcement || null;
  const editing = !!(a?.id || a?._id);
  const wasPublished = a?.status === 'published';
  const [title, setTitle] = useState(String(a?.title || ''));
  const [summary, setSummary] = useState(String(a?.summary || ''));
  const [body, setBody] = useState(String(a?.body || ''));
  const [insertField, setInsertField] = useState<InsertField>('body');
  const cursors = useRef<Partial<Record<InsertField, Cursor>>>({});
  const [insertCursor, setInsertCursor] = useState<{ field: InsertField; selection: Cursor }>();
  const [category, setCategory] = useState<UpdateCategory>(a?.category || 'general');
  const [targets, setTargets] = useState<UpdateRegion[]>(a?.targets?.length ? a.targets : a?.state ? [{ state: a.state, district: a.district || '', block: a.block || '' }] : []);
  const [regional, setRegional] = useState(!!(a?.targets?.length || a?.state));
  const [includeVisitors, setIncludeVisitors] = useState(!!a?.includeVisitors);
  const [deliveryChannels, setDeliveryChannels] = useState(() => resolveUpdateDeliveryChannels(a?.deliveryChannels, editing));
  const [recipientMode, setRecipientMode] = useState<'audience' | 'selected'>(a?.recipientMode === 'selected' ? 'selected' : 'audience');
  const [memberIds, setMemberIds] = useState<string[]>(Array.isArray(a?.memberIds) ? [...a.memberIds] : []);
  const [variables, setVariables] = useState<UpdateVariable[]>(Array.isArray(a?.variables) ? a.variables.map((row: UpdateVariable) => ({ ...row, overrides: (row.overrides || []).map(entry => ({ ...entry })) })) : []);
  const [knownMembers, setKnownMembers] = useState<UpdateMember[]>([]);
  const [audience, setAudience] = useState<UpdateAudience>(a?.audience || 'all');
  const [planKeys, setPlanKeys] = useState<string[]>(Array.isArray(a?.planKeys) ? [...a.planKeys] : []);
  const [plans, setPlans] = useState<MembershipPlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [pinned, setPinned] = useState(!!a?.pinned);
  const [expiresAt, setExpiresAt] = useState(toDateInput(a?.expiresAt));
  const [bannerUrl, setBannerUrl] = useState(String(a?.bannerUrl || ''));
  const [bannerAlt, setBannerAlt] = useState(String(a?.bannerAlt || ''));
  const [attachmentUrl, setAttachmentUrl] = useState(String(a?.attachmentUrl || ''));
  const [attachmentLabel, setAttachmentLabel] = useState(String(a?.attachmentLabel || ''));
  const [uploading, setUploading] = useState<'image' | 'document' | null>(null);
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState(!!(a?.summary || a?.pinned || a?.expiresAt || (a?.category && a.category !== 'general')));
  const [preview, setPreview] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const busy = !!(saving || uploading);
  const chosenAudience = UPDATE_AUDIENCES.find(row => row.value === audience) || UPDATE_AUDIENCES[0];

  const insertToken = (token: string, greeting = false) => {
    if (busy) return;
    const value = { title, body, summary }[insertField];
    const saved = cursors.current[insertField] || { start: value.length, end: value.length };
    const start = Math.max(0, Math.min(saved.start, value.length));
    const end = Math.max(start, Math.min(saved.end, value.length));
    const insertion = greeting && insertField === 'body' && !value ? `Dear ${token},\n\n` : token;
    const next = value.slice(0, start) + insertion + value.slice(end);
    if (insertField === 'title' && next.length > 200) {
      Alert.alert('Title is too long', 'Shorten the title before inserting this variable. The full variable must fit within 200 characters.');
      return;
    }
    ({ title: setTitle, body: setBody, summary: setSummary })[insertField](next);
    const selection = { start: start + insertion.length, end: start + insertion.length };
    cursors.current[insertField] = selection;
    setInsertCursor({ field: insertField, selection });
  };
  const insertionProps = (field: InsertField) => ({
    onFocus: () => setInsertField(field),
    onSelectionChange: (event: { nativeEvent: { selection: Cursor } }) => {
      cursors.current[field] = event.nativeEvent.selection;
      setInsertCursor(undefined);
    },
    selection: insertCursor?.field === field ? insertCursor.selection : undefined,
    onChangeText: (value: string) => {
      setInsertCursor(undefined);
      ({ title: setTitle, body: setBody, summary: setSummary })[field](value);
    },
  });

  const loadPlans = useCallback(async () => {
    setPlansLoading(true); setPlansError('');
    try {
      const result = await listMembershipPlans();
      if (mounted.current) setPlans(Array.isArray(result?.plans) ? result.plans : []);
    } catch (err) { if (mounted.current) setPlansError(messageFor(err)); }
    finally { if (mounted.current) setPlansLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; loadPlans();
    return () => { mounted.current = false; };
  }, [loadPlans]);

  // Keep saved selections visible if their plan has since been retired or removed.
  const planOptions = useMemo(() => [
    ...plans.map(plan => ({ key: plan.key, name: plan.name, retired: !plan.active })),
    ...planKeys.filter(key => !plans.some(plan => plan.key === key)).map(key => ({ key, name: key, retired: true })),
  ], [plans, planKeys]);
  const reach = audience === 'plans'
    ? planKeys.map(key => planOptions.find(plan => plan.key === key)?.name || key).join(', ') || 'Choose membership plans'
    : chosenAudience.title;
  const region = regional ? targets.map(updateRegionLabel).join(', ') || 'Choose at least one region' : 'All regions';
  const personalization = { recipientMode, memberIds: recipientMode === 'selected' ? memberIds : [], variables };
  const publicUpdate = includeVisitors && audience === 'all' && !regional && recipientMode !== 'selected';
  const previewPayload = {
    title, summary, body, category, bannerAlt, attachmentLabel, audience,
    planKeys: audience === 'plans' ? planKeys : [], targets: regional ? targets : [],
    includeVisitors: publicUpdate, ...personalization, ...(editing ? { announcementId: String(a.id || a._id) } : {}),
  };

  const uploadImage = async () => {
    if (pending.current) return;
    pending.current = true; setUploading('image'); setError('');
    try {
      const response = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 1 });
      if (response.didCancel) return;
      if (response.errorCode) throw new Error(response.errorMessage || 'The photo library could not be opened.');
      const asset = response.assets?.[0];
      if (!asset?.uri) throw new Error('Please choose an image from your photo library.');
      if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) throw new Error('Choose an image smaller than 50 MB.');
      const uploaded = await uploadCmsMedia(asset);
      if (!uploaded.url || uploaded.type !== 'image') throw new Error('The image was not uploaded. Please try again.');
      setBannerUrl(uploaded.url);
    } catch (err) { setError(`Image upload failed. ${messageFor(err)}`); }
    finally { pending.current = false; setUploading(null); }
  };
  const uploadDocument = async () => {
    if (pending.current) return;
    pending.current = true; setUploading('document'); setError('');
    try {
      const asset = await pickEventDocument();
      if (!asset) return;
      const uploaded = await uploadEventAttachment(asset);
      if (!uploaded.url) throw new Error('The document was not uploaded. Please try again.');
      setAttachmentUrl(uploaded.url); setAttachmentLabel(uploaded.name || asset.fileName || 'Document');
    } catch (err) { setError(`Document upload failed. ${messageFor(err)}`); }
    finally { pending.current = false; setUploading(null); }
  };
  const save = async (status: 'draft' | 'published') => {
    if (pending.current) return;
    const fail = (message: string) => { setError(message); Alert.alert('Check your update', message); };
    if (!title.trim()) return fail('Add a title so members know what this update is about.');
    if (status === 'published' && ![body, summary, bannerUrl, attachmentUrl].some(value => value.trim())) return fail('Add a message, an image or a document before publishing.');
    if (audience === 'plans' && !planKeys.length) return fail('Choose at least one membership plan.');
    if (regional && !targets.length) return fail('Choose at least one region, or turn off the region restriction.');
    if (recipientMode === 'selected' && !memberIds.length) return fail('Choose at least one specific member.');
    const day = expiresAt.trim();
    const expiry = day ? new Date(`${day}T23:59:59`) : null;
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !expiry || Number.isNaN(expiry.getTime()) || toDateInput(expiry.toISOString()) !== day)) return fail('Choose a valid expiry date, or leave it blank.');
    if (status === 'published' && expiry && expiry.getTime() < Date.now()) return fail('Choose today or a future expiry date to publish this update.');
    const payload = {
      title: title.trim(), summary: summary.trim(), body: body.trim(), category,
      targets: regional ? targets : [], includeVisitors: publicUpdate, ...personalization, deliveryChannels: { ...deliveryChannels },
      audience, planKeys: audience === 'plans' ? planKeys : [], pinned, status,
      bannerUrl: bannerUrl.trim(), bannerAlt: bannerUrl ? bannerAlt.trim() : '',
      attachmentUrl: attachmentUrl.trim(), attachmentLabel: attachmentUrl ? attachmentLabel.trim() : '', expiresAt: expiry ? expiry.toISOString() : '',
    };
    pending.current = true; setSaving(status); setError('');
    try {
      if (editing) await updateAnnouncement(String(a.id || a._id), payload);
      else await createAnnouncement(payload);
      navigation.goBack();
    } catch (err) { fail(messageFor(err)); }
    finally { pending.current = false; setSaving(null); }
  };

  return <ConsoleScroll avoidKeyboard footer={<BottomActionBar>
    <ConsoleButton kind="soft" icon="save" label={wasPublished ? 'Move to draft' : 'Save draft'} onPress={() => save('draft')}
      loading={saving === 'draft'} disabled={busy} style={s.action} />
    <ConsoleButton icon="publish" label={wasPublished ? 'Save & publish' : 'Publish update'} onPress={() => save('published')}
      loading={saving === 'published'} disabled={busy} style={s.action} />
  </BottomActionBar>}>
    <ConsoleHeader compact eyebrow="Super Admin · Updates" title={editing ? 'Edit update' : 'Create update'}
      subtitle="Write a message, choose its members and publish."
      left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation.goBack()} />} />
    <View style={[s.channelPicker, s.first]}>
      <Text style={s.sectionTitle}>Send notifications</Text>
      <View style={s.channelChoices}>
        {UPDATE_DELIVERY_CHANNELS.map(channel => <TouchableOpacity key={channel.key} accessibilityRole="checkbox" accessibilityLabel={channel.label}
          accessibilityHint={channel.detail} accessibilityState={{ checked: deliveryChannels[channel.key], disabled: busy }} disabled={busy}
          style={[s.channel, deliveryChannels[channel.key] && s.channelSelected, busy && s.channelDisabled]}
          onPress={() => { if (!pending.current) setDeliveryChannels(current => ({ ...current, [channel.key]: !current[channel.key] })); }}>
          <Icon name={deliveryChannels[channel.key] ? 'check-circle' : 'add-circle-outline'} size={19}
            color={deliveryChannels[channel.key] ? PALETTE.white : PALETTE.indigo} />
          <Text style={[s.channelLabel, deliveryChannels[channel.key] && s.channelSelectedLabel]}>{channel.key === 'push' ? 'Push' : channel.label}</Text>
        </TouchableOpacity>)}
      </View>
      <Text accessibilityLiveRegion="polite" style={s.small}>{updateDeliverySummary(deliveryChannels)}</Text>
      <Text style={s.small}>Choose any combination. Messages follow each person's settings and permissions.</Text>
    </View>
    <ConsoleCard style={s.card}>
      <Text style={s.title}>Write your update</Text>
      <PremiumInput tone="admin" label="Title" value={title} {...insertionProps('title')} required maxLength={200}
        placeholder="e.g. Membership renewal for this year" inputStyle={s.input} editable={!busy} />
      <PremiumInput tone="admin" label="Message" value={body} {...insertionProps('body')} multiline editable={!busy}
        placeholder={'Dear {Name},\n\nShare the details and what members should do next.\n\nThank you,\nTeam ACTIV'}
        hint="A text update is enough. Add a poster or document only if it helps." inputStyle={{ ...s.input, minHeight: 170 }} />
      <ConsoleButton kind="soft" icon="person" label="Insert member name" disabled={busy} onPress={() => insertToken('{Name}', true)} />
      <Text accessibilityLiveRegion="polite" style={s.small}>Inserts into {insertLabels[insertField].toLowerCase()} at your cursor. Tap the title, message or summary to choose where a variable goes.</Text>
      <Text style={s.hint}>Use {'{Name}'} or your own variables in the title, message or summary. Configure general and individual values below. Names without a value use ACTIVian.</Text>
    </ConsoleCard>
    <ConsoleCard style={s.card}>
      <Text style={s.title}>Add an image or document</Text>
      <Text style={s.hint}>Optional. Posters are shown in full, without cropping.</Text>
      {bannerUrl ? <FitImage uri={resolveMediaUrl(bannerUrl)} mode="auto" minRatio={0.7} maxRatio={2.5}
        style={s.poster} borderRadius={12} accessibilityLabel={bannerAlt || 'Update poster preview'} /> : null}
      <View style={s.actions}>
        <ConsoleButton kind="soft" icon="add-photo-alternate" label={bannerUrl ? 'Replace image' : 'Upload image'}
          onPress={uploadImage} loading={uploading === 'image'} disabled={busy} style={s.action} />
        {bannerUrl ? <ConsoleButton kind="ghost" icon="delete-outline" label="Remove image" disabled={busy}
          onPress={() => { setBannerUrl(''); setBannerAlt(''); }} style={s.action} /> : null}
      </View>
      {bannerUrl ? <PremiumInput tone="admin" label="Image description (optional)" value={bannerAlt} onChangeText={setBannerAlt}
        placeholder="Describe the poster for screen readers" inputStyle={s.input} editable={!busy} /> : null}
      <View style={s.divider} />
      {attachmentUrl ? <>
        <TouchableOpacity accessibilityRole="link" onPress={() => openUrl(resolveMediaUrl(attachmentUrl))} style={s.document}>
          <Icon name="description" size={22} color={PALETTE.indigo} /><Text style={s.documentText}>{attachmentLabel || 'Open attached document'}</Text>
          <Icon name="open-in-new" size={18} color={PALETTE.indigo} />
        </TouchableOpacity>
        <PremiumInput tone="admin" label="Document name" value={attachmentLabel} onChangeText={setAttachmentLabel}
          placeholder="e.g. Membership renewal guide" inputStyle={s.input} editable={!busy} />
      </> : <Text style={s.hint}>Attach a circular, application form or guide. Maximum 20 MB.</Text>}
      <View style={s.actions}>
        <ConsoleButton kind="soft" icon="upload-file" label={attachmentUrl ? 'Replace document' : 'Upload document'}
          onPress={uploadDocument} loading={uploading === 'document'} disabled={busy} style={s.action} />
        {attachmentUrl ? <ConsoleButton kind="ghost" icon="delete-outline" label="Remove document" disabled={busy}
          onPress={() => { setAttachmentUrl(''); setAttachmentLabel(''); }} style={s.action} /> : null}
      </View>
    </ConsoleCard>
    <ConsoleCard style={s.card}>
      <Text style={s.title}>Choose who receives it</Text>
      <PremiumSelect tone="admin" label="Members" value={chosenAudience.title} options={UPDATE_AUDIENCES.map(row => row.title)} disabled={busy}
        onChange={value => setAudience(UPDATE_AUDIENCES.find(row => row.title === value)?.value || 'all')} hint={chosenAudience.detail} />
      {audience === 'plans' ? <View style={s.planList}>
        {plansLoading ? <Text style={s.hint}>Loading membership plans…</Text> : null}
        {plansError ? <><Text style={s.error}>{plansError}</Text><ConsoleButton kind="soft" label="Retry loading plans" onPress={loadPlans} disabled={busy} /></> : null}
        {!plansLoading && !plansError && !planOptions.length ? <Text style={s.hint}>No plans are available. Add a membership plan first.</Text> : null}
        {planOptions.map(plan => <TouchableOpacity key={plan.key} accessibilityRole="checkbox" accessibilityLabel={plan.name}
          accessibilityState={{ checked: planKeys.includes(plan.key), disabled: busy }} disabled={busy} style={s.plan}
          onPress={() => setPlanKeys(keys => keys.includes(plan.key) ? keys.filter(key => key !== plan.key) : [...keys, plan.key])}>
          <Icon name={planKeys.includes(plan.key) ? 'check-box' : 'check-box-outline-blank'} size={23} color={PALETTE.indigo} />
          <View style={s.action}><Text style={s.planName}>{plan.name}</Text>{plan.retired ? <Text style={s.small}>Retired plan · existing holders</Text> : null}</View>
        </TouchableOpacity>)}
      </View> : null}
      <ToggleRow label="Limit to selected regions" value={regional} onChange={setRegional} last />
      {regional ? <UpdateRegionPicker value={targets} onChange={setTargets} disabled={busy} /> : <Text style={s.small}>Reaches the selected members in every region.</Text>}
      {audience === 'all' && !regional && recipientMode !== 'selected' ? <><ToggleRow label="Also show to visitors" value={includeVisitors} onChange={setIncludeVisitors} last /><Text style={s.small}>Makes this update public. Visitors can receive notifications only when push is selected above and they have enabled notifications.</Text></> : <Text style={s.small}>Visitor updates are available only when you choose all members in all regions.</Text>}
    </ConsoleCard>
    <ConsoleCard style={s.card}>
      <Text style={s.title}>Personalise your update</Text>
      <UpdatePersonalizationEditor mode={recipientMode} onMode={value => { setRecipientMode(value); if (value === 'selected') setIncludeVisitors(false); }}
        memberIds={memberIds} onMembers={setMemberIds} variables={variables} onVariables={setVariables}
        onInsert={insertToken} insertTarget={insertLabels[insertField]} onKnownMembers={setKnownMembers} disabled={busy} />
    </ConsoleCard>
    <ConsoleCard style={s.card}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: more }} onPress={() => setMore(value => !value)} style={s.disclosure}>
        <Text style={s.sectionTitle}>More options</Text><Icon name={more ? 'expand-less' : 'expand-more'} size={22} color={PALETTE.textMuted} />
      </TouchableOpacity>
      {more ? <View style={s.regionFields}>
        <PremiumSelect tone="admin" label="Category" value={CATEGORIES.find(row => row.value === category)?.label || 'General update'}
          options={CATEGORIES.map(row => row.label)} disabled={busy} onChange={value => setCategory(CATEGORIES.find(row => row.label === value)?.value || 'general')} />
        <PremiumInput tone="admin" label="Short summary (optional)" value={summary} {...insertionProps('summary')} editable={!busy}
          placeholder="One line for the update card" hint="Leave blank to use the opening of your message." inputStyle={s.input} />
        <DateField label="Hide after (optional)" value={expiresAt} onChange={setExpiresAt} hint="Visible until the end of this day. Leave blank to keep it available." />
        <ToggleRow label="Pin for selected members" value={pinned} onChange={setPinned} last />
      </View> : <Text style={s.small}>Category, summary, expiry and pinning.</Text>}
    </ConsoleCard>
    <ConsoleCard style={s.card}>
      <Text style={s.title}>Review before publishing</Text>
      <Text style={s.review}>{recipientMode === 'selected' ? `${memberIds.length} specific members · ${reach}` : reach}</Text><Text style={s.hint}>{region}{expiresAt ? ` · Until ${expiresAt}` : ''}</Text>
      <Text accessibilityLiveRegion="polite" style={s.review}>{updateDeliverySummary(deliveryChannels)}</Text>
      <Text style={s.hint}>Publishing shows this update to members who match your choices. Notifications use only the options you selected and follow each person's settings and permissions. A draft stays private and sends nothing.</Text>
      {wasPublished ? <Text style={s.hint}>Moving to draft removes this update from members’ feeds.</Text> : null}
      <ConsoleButton kind="soft" icon="visibility" label={preview ? 'Hide preview' : 'Preview update'} onPress={() => setPreview(value => !value)} />
      {preview ? <View style={s.preview}>
        {bannerUrl ? <FitImage uri={resolveMediaUrl(bannerUrl)} mode="auto" minRatio={0.7} maxRatio={2.5} style={s.poster} borderRadius={10} accessibilityLabel={bannerAlt || 'Update poster'} /> : null}
        <UpdateRecipientPreview payload={previewPayload} members={knownMembers} />
      </View> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      {uploading ? <Text accessibilityLiveRegion="polite" style={s.hint}>Uploading {uploading}… Please wait before saving.</Text> : null}
    </ConsoleCard>
  </ConsoleScroll>;
};

const s = StyleSheet.create({
  card: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg }, first: { marginTop: -SPACE.lg },
  title: { color: PALETTE.text, fontSize: 22, lineHeight: 30, fontWeight: '600', marginBottom: SPACE.md },
  sectionTitle: { color: PALETTE.text, fontSize: 20, lineHeight: 28, fontWeight: '600' },
  input: { fontSize: 18, lineHeight: 27, fontWeight: '400' as const },
  hint: { color: PALETTE.textMuted, fontSize: 16, lineHeight: 24, fontWeight: '400', marginBottom: SPACE.md },
  small: { color: PALETTE.textMuted, fontSize: 16, lineHeight: 24, fontWeight: '400' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginBottom: SPACE.md }, action: { flex: 1 },
  poster: { marginBottom: SPACE.md }, divider: { borderTopWidth: 1, borderTopColor: PALETTE.divider, marginBottom: SPACE.md },
  document: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md },
  documentText: { flex: 1, color: PALETTE.indigo, fontSize: 18, lineHeight: 27, fontWeight: '500' },
  planList: { marginBottom: SPACE.md },
  plan: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  channelPicker: { marginHorizontal: SPACE.lg, gap: SPACE.sm },
  channelChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: PALETTE.indigo, borderRadius: 24 },
  channelSelected: { backgroundColor: PALETTE.indigo },
  channelDisabled: { opacity: 0.6 },
  channelLabel: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: PALETTE.indigo },
  channelSelectedLabel: { color: PALETTE.white },
  planName: { fontSize: 18, lineHeight: 27, color: PALETTE.text, fontWeight: '500' }, regionFields: { marginTop: SPACE.md },
  disclosure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, marginBottom: SPACE.sm },
  review: { color: PALETTE.text, fontSize: 18, lineHeight: 27, fontWeight: '500', marginBottom: SPACE.xs },
  preview: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: PALETTE.divider, borderRadius: 12, padding: SPACE.md, marginTop: SPACE.md, gap: SPACE.sm },
  previewTitle: { color: PALETTE.text, fontSize: 22, lineHeight: 30, fontWeight: '600' },
  previewSummary: { color: PALETTE.text, fontSize: 18, lineHeight: 27, fontWeight: '500' },
  previewBody: { color: PALETTE.textSoft, fontSize: 18, lineHeight: 27, fontWeight: '400' },
  error: { color: PALETTE.red, fontSize: 16, lineHeight: 24, marginVertical: SPACE.md },
});
export default SuperUpdateEditorScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
