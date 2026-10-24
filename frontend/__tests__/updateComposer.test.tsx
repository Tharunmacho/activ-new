import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import SuperUpdateEditorScreen from '../src/screens/admin/super/SuperUpdateEditorScreen';
import { ConsoleButton, PremiumInput, PremiumSelect, FitImage } from '../src/ui';
import { createAnnouncement, updateAnnouncement, listMembershipPlans, uploadCmsMedia, uploadEventAttachment } from '../src/services/superApi';
import { pickEventDocument } from '../src/services/eventDocuments';
import { ToggleRow } from '../src/screens/admin/super/superKit';
import { findUpdateMembers, previewAssociationUpdate } from '../src/services/updatePersonalizationApi';

let mockParams: any = {};
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }), useRoute: () => ({ params: mockParams }),
}));
jest.mock('../src/services/superApi', () => ({
  createAnnouncement: jest.fn(), updateAnnouncement: jest.fn(), listMembershipPlans: jest.fn(),
  uploadCmsMedia: jest.fn(), uploadEventAttachment: jest.fn(), errorText: (error: any) => error?.message || 'Request failed',
}));
jest.mock('../src/services/eventDocuments', () => ({ pickEventDocument: jest.fn() }));
jest.mock('../src/services/updatePersonalizationApi', () => ({ findUpdateMembers: jest.fn(), previewAssociationUpdate: jest.fn() }));
jest.mock('../src/screens/admin/super/superKit', () => ({
  ...jest.requireActual('../src/screens/admin/super/superKit'),
  useRegionTreeAll: () => [{ name: 'Tamil Nadu', districts: [{ name: 'Chennai', blocks: [{ name: 'Central' }, { name: 'North' }] }, { name: 'Coimbatore', blocks: [{ name: 'West' }] }] }, { name: 'Kerala', districts: [] }],
  useRegionNames: () => ({ states: ['Tamil Nadu'], districts: ['Chennai'], blocks: ['Central'] }),
}));

let screen: Renderer.ReactTestRenderer;
const mount = async () => { await act(async () => { screen = Renderer.create(<SuperUpdateEditorScreen />); }); };
const button = (label: string) => screen.root.findAllByType(ConsoleButton).find(node => node.props.label === label)!;
const field = (label: string) => screen.root.findAllByType(PremiumInput).find(node => node.props.label === label)!;
const fill = async (label: string, value: string) => { await act(async () => { field(label).props.onChangeText(value); }); };
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const choose = async (label: string, value: string) => { await act(async () => { screen.root.findAllByType(PremiumSelect).find(node => node.props.label === label)!.props.onChange(value); }); };
const settle = async () => { await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 350)); }); };
const chooseAudience = async (label: string) => {
  await act(async () => { screen.root.findAllByType(PremiumSelect).find(node => node.props.label === 'Members')!.props.onChange(label); });
};
const channel = (label: string) => {
  const node = screen.root.findAllByType(TouchableOpacity).find(item => item.props.accessibilityRole === 'checkbox' && item.props.accessibilityLabel === label);
  if (!node) throw new Error(`Delivery checkbox missing: ${label}`);
  return node;
};
const toggleChannel = async (label: string) => { await act(async () => { channel(label).props.onPress(); }); };

beforeEach(() => {
  jest.clearAllMocks(); mockParams = {};
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  (createAnnouncement as jest.Mock).mockResolvedValue({ id: 'new' });
  (updateAnnouncement as jest.Mock).mockResolvedValue({ id: 'existing' });
  (listMembershipPlans as jest.Mock).mockResolvedValue({ plans: [
    { key: 'business-growth', name: 'Business Growth', active: true, audience: 'business' },
    { key: 'aspirant', name: 'Aspirant', active: true, audience: 'aspirant' },
    { key: 'business-legacy', name: 'Legacy Business', active: false, audience: 'business' },
  ] });
  (uploadCmsMedia as jest.Mock).mockResolvedValue({ url: '/uploads/poster.jpg', type: 'image' });
  (uploadEventAttachment as jest.Mock).mockResolvedValue({ url: '/uploads/guide.pdf', name: 'Membership guide.pdf' });
  (findUpdateMembers as jest.Mock).mockResolvedValue({ members: [
    { id: '111111111111111111111111', fullName: 'First Member', email: 'first@example.test' },
    { id: '222222222222222222222222', fullName: 'Second Member', email: 'second@example.test' },
  ], variables: [{ key: 'name', label: 'Member name', detail: 'Profile name; otherwise ACTIVian.' }, { key: 'company_name', label: 'Company name', detail: 'Recorded company.' }] });
  (previewAssociationUpdate as jest.Mock).mockResolvedValue({ announcement: { title: 'Dear ACTIVian', body: 'General preview from server' }, eligible: false, missing: [], values: { name: 'ACTIVian' }, recipient: null });
});
afterEach(async () => { if (screen) await act(async () => { screen.unmount(); }); });

it('supports a text-only non-student update and sends no stale plan filters', async () => {
  mockParams = { announcement: { id: 'existing', title: 'Renewal', body: 'Dear members, thank you.', audience: 'plans', planKeys: ['business-growth'], status: 'draft' } };
  await mount();
  await chooseAudience('Paid members excluding students');
  await press('Publish update');
  expect(updateAnnouncement).toHaveBeenCalledWith('existing', expect.objectContaining({
    audience: 'paid_non_student', planKeys: [], status: 'published', bannerUrl: '', attachmentUrl: '',
  }));
  expect(mockGoBack).toHaveBeenCalled();
  expect(screen.root.findAllByType(PremiumInput).some(node => /URL/i.test(node.props.label))).toBe(false);
});

it('allows a title-only draft but rejects a title-only publication', async () => {
  await mount(); await fill('Title', 'Next membership meeting');
  await press('Publish update');
  expect(createAnnouncement).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Check your update', expect.stringContaining('Add a message'));
  await press('Save draft');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ title: 'Next membership meeting', status: 'draft' }));
});

it('requires a selected plan and supports active and retired plans by catalogue key', async () => {
  await mount(); await fill('Title', 'Business benefits'); await fill('Message', 'Dear members, your benefits are ready.');
  await chooseAudience('Specific membership plans');
  await press('Publish update');
  expect(createAnnouncement).not.toHaveBeenCalled();
  for (const label of ['Business Growth', 'Legacy Business']) {
    await act(async () => {
      screen.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === label)!.props.onPress();
    });
  }
  await press('Publish update');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ audience: 'plans', planKeys: ['business-growth', 'business-legacy'] }));
});

it('waits for image upload, previews the full poster and saves the uploaded media', async () => {
  let finishPick!: (value: any) => void;
  (launchImageLibrary as jest.Mock).mockReturnValue(new Promise(resolve => { finishPick = resolve; }));
  await mount(); await fill('Title', 'Membership plans');
  await act(async () => { void button('Upload image').props.onPress(); });
  expect(button('Publish update').props.disabled).toBe(true);
  await press('Publish update');
  expect(createAnnouncement).not.toHaveBeenCalled();
  await act(async () => { finishPick({ assets: [{ uri: 'file:///poster.jpg', fileName: 'poster.jpg', type: 'image/jpeg' }] }); });
  expect(uploadCmsMedia).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///poster.jpg' }));
  expect(screen.root.findAllByType(FitImage)[0].props.fit).not.toBe('cover');
  await press('Preview update');
  expect(screen.root.findAllByType(FitImage)).toHaveLength(2);
  await press('Publish update');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ bannerUrl: '/uploads/poster.jpg', status: 'published' }));
});

it('preserves existing files on a failed replacement and explicitly clears removed media', async () => {
  mockParams = { announcement: { id: 'existing', title: 'A guide', body: 'Please read.', bannerUrl: '/old.jpg', bannerAlt: 'Existing poster', attachmentUrl: '/old.pdf', attachmentLabel: 'Old guide', status: 'published' } };
  (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [{ uri: 'file:///new.jpg' }] });
  (uploadCmsMedia as jest.Mock).mockRejectedValueOnce(new Error('Upload failed'));
  (pickEventDocument as jest.Mock).mockResolvedValue({ uri: 'file:///guide.pdf', fileName: 'guide.pdf', type: 'application/pdf' });
  await mount(); await press('Replace image');
  expect(screen.root.findAllByType(FitImage)[0].props.uri).toContain('/old.jpg');
  await press('Replace document');
  expect(field('Document name').props.value).toBe('Membership guide.pdf');
  await press('Remove image'); await press('Remove document'); await press('Save & publish');
  expect(updateAnnouncement).toHaveBeenCalledWith('existing', expect.objectContaining({ bannerUrl: '', bannerAlt: '', attachmentUrl: '', attachmentLabel: '' }));
});

it('saves multiple independent regions and authored tokens while previewing server-rendered fallback values', async () => {
  mockParams = { announcement: { id: 'existing', title: 'Dear {Name}', body: 'Welcome {name}', audience: 'all', targets: [{ state: 'Tamil Nadu', district: 'Chennai', block: 'Central' }], status: 'draft' } };
  await mount();
  await act(async () => { screen.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityRole === 'checkbox' && node.props.accessibilityLabel === 'Kerala')!.props.onPress(); });
  await press('Preview update');
  await settle();
  expect(JSON.stringify(screen.toJSON())).toContain('General preview from server');
  expect(previewAssociationUpdate).toHaveBeenCalledWith(expect.objectContaining({ previewMemberId: '', title: 'Dear {Name}' }));
  await press('Publish update');
  expect(updateAnnouncement).toHaveBeenCalledWith('existing', expect.objectContaining({ title: 'Dear {Name}', body: 'Welcome {name}', includeVisitors: false,
    targets: [{ state: 'Tamil Nadu', district: 'Chennai', block: 'Central' }, { state: 'Kerala', district: '', block: '' }] }));
});

it('creates custom general and individual values, selects exact members, and previews the actual recipient', async () => {
  await mount(); await fill('Title', 'Meeting for {name}'); await fill('Message', 'Join on {meeting_date}');
  await choose('Choose members', 'Specific members');
  await fill('Find members', 'Member'); await settle();
  await act(async () => { screen.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'Select First Member · first@example.test')!.props.onPress(); });
  await fill('New custom variable', 'meeting_date'); await press('Create variable');
  await fill('General value for {meeting_date}', 'Monday');
  await choose('Member for individual value', 'First Member · first@example.test'); await press('Add individual value');
  await fill('Individual {meeting_date} value for First Member', 'Tuesday');
  (previewAssociationUpdate as jest.Mock).mockResolvedValue({ announcement: { title: 'Meeting for First Member', body: '<p>Join on Tuesday &amp; Wednesday</p>' }, eligible: true, missing: [], values: {}, recipient: { id: '111111111111111111111111', fullName: 'First Member' } });
  await press('Preview update');
  await choose('Preview for a member', 'First Member · first@example.test'); await settle();
  expect(JSON.stringify(screen.toJSON())).toContain('Join on Tuesday & Wednesday');
  expect(JSON.stringify(screen.toJSON())).not.toContain('<p>Join');
  expect(previewAssociationUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ previewMemberId: '111111111111111111111111', memberIds: ['111111111111111111111111'] }));
  await press('Publish update');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({
    recipientMode: 'selected', memberIds: ['111111111111111111111111'], includeVisitors: false,
    variables: [{ key: 'meeting_date', defaultValue: 'Monday', overrides: [{ memberId: '111111111111111111111111', value: 'Tuesday' }] }],
  }));
  expect((createAnnouncement as jest.Mock).mock.calls[0][0].previewMemberId).toBeUndefined();
});

it('requires selected members, permits builtin general fallbacks, and rejects invalid custom keys', async () => {
  await mount(); await fill('Title', 'Welcome'); await fill('Message', 'Dear {name}, from {company_name}');
  await choose('Choose members', 'Specific members'); await press('Publish update');
  expect(createAnnouncement).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Check your update', 'Choose at least one specific member.');
  await fill('New custom variable', '__proto__'); await press('Create variable');
  expect(JSON.stringify(screen.toJSON())).toContain('Start the variable name with a letter');
  await choose('Choose members', 'Members who match your choices');
  await choose('Variable', 'Company name'); await fill('General value for {company_name}', 'your organisation');
  await press('Save draft');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ recipientMode: 'audience', memberIds: [], variables: [{ key: 'company_name', defaultValue: 'your organisation', overrides: [] }] }));
});

it('requires a region in restricted mode and only enables visitors for unrestricted updates', async () => {
  await mount(); await fill('Title', 'Join ACTIV'); await press('Insert member name');
  expect(field('Message').props.value).toBe('Dear {Name},\n\n');
  const toggle = async (label: string, value: boolean) => act(async () => { screen.root.findAllByType(ToggleRow).find(node => node.props.label === label)!.props.onChange(value); });
  await toggle('Also show to visitors', true);
  await toggle('Limit to selected regions', true);
  await press('Publish update');
  expect(createAnnouncement).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Check your update', expect.stringContaining('Choose at least one region'));
  await toggle('Limit to selected regions', false);
  await chooseAudience('Paid members excluding students');
  await press('Publish update');
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ includeVisitors: false, targets: [], body: 'Dear {Name},' }));
});

const deliveryCombinations = Array.from({ length: 8 }, (_, mask) => ({ email: !!(mask & 1), whatsapp: !!(mask & 2), push: !!(mask & 4) }));
it('inserts builtin variables at the title cursor without changing the message', async () => {
  await mount(); await fill('Title', 'Welcome, !'); await fill('Message', 'Existing message.');
  await act(async () => {
    field('Title').props.onFocus();
    field('Title').props.onSelectionChange({ nativeEvent: { selection: { start: 9, end: 9 } } });
  });
  await press('Insert {name} into title');
  expect(field('Title').props.value).toBe('Welcome, {name}!');
  expect(field('Title').props.selection).toEqual({ start: 15, end: 15 });
  expect(field('Message').props.value).toBe('Existing message.');
  await press('Insert {name} into title');
  expect(field('Title').props.value).toBe('Welcome, {name}{name}!');
});

it('replaces selected summary text with a custom variable and saves it in that field', async () => {
  mockParams = { announcement: { id: 'existing', title: 'Meeting', body: 'Existing message.', summary: 'Meet Monday now', status: 'draft' } };
  await mount();
  await act(async () => {
    field('Short summary (optional)').props.onFocus();
    field('Short summary (optional)').props.onSelectionChange({ nativeEvent: { selection: { start: 5, end: 11 } } });
  });
  await fill('New custom variable', 'meeting_date'); await press('Create variable');
  await press('Insert {meeting_date} into summary');
  expect(field('Short summary (optional)').props.value).toBe('Meet {meeting_date} now');
  expect(field('Message').props.value).toBe('Existing message.');
  await press('Save draft');
  expect(updateAnnouncement).toHaveBeenCalledWith('existing', expect.objectContaining({ summary: 'Meet {meeting_date} now', body: 'Existing message.' }));
});

it('preserves a full title rather than inserting a truncated variable', async () => {
  await mount(); await fill('Title', 'A'.repeat(199));
  await act(async () => { field('Title').props.onFocus(); });
  await press('Insert member name');
  expect(field('Title').props.value).toBe('A'.repeat(199));
  expect(field('Message').props.value).toBe('');
  expect(Alert.alert).toHaveBeenCalledWith('Title is too long', expect.stringContaining('full variable'));
});

it('places compact independent channel choices above the update content', async () => {
  await mount();
  const content = JSON.stringify(screen.toJSON());
  expect(content.indexOf('Send notifications')).toBeLessThan(content.indexOf('Write your update'));
  for (const label of ['Email', 'WhatsApp', 'Push notifications']) {
    const choice = channel(label);
    expect(StyleSheet.flatten(choice.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(choice.props.accessibilityState.checked).toBe(false);
  }
  await toggleChannel('Email'); await toggleChannel('Push notifications');
  expect(channel('Email').props.accessibilityState.checked).toBe(true);
  expect(channel('Push notifications').props.accessibilityState.checked).toBe(true);
  expect(channel('WhatsApp').props.accessibilityState.checked).toBe(false);
});

it.each(deliveryCombinations)('saves and publishes exactly the selected channels %j', async deliveryChannels => {
  await mount(); await fill('Title', 'Channel selection'); await fill('Message', 'Association update.');
  for (const [key, label] of [['email', 'Email'], ['whatsapp', 'WhatsApp'], ['push', 'Push notifications']] as const) {
    expect(channel(label).props.accessibilityState.checked).toBe(false);
    if (deliveryChannels[key]) await toggleChannel(label);
  }
  const content = JSON.stringify(screen.toJSON());
  const selected = [['email', 'Email'], ['whatsapp', 'WhatsApp'], ['push', 'Push notifications']].filter(([key]) => deliveryChannels[key as keyof typeof deliveryChannels]).map(([, label]) => label);
  expect(content).toContain(selected.length ? `Selected channels: ${selected.join(', ')}` : 'In ACTIV only: no email, WhatsApp or push notifications.');
  await press('Save draft');
  expect(createAnnouncement).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'draft', deliveryChannels }));
  await press('Publish update');
  expect(createAnnouncement).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'published', deliveryChannels }));
});

it('retains legacy all-channel behavior and allows an existing published update to become feed-only', async () => {
  mockParams = { announcement: { id: 'legacy', title: 'Existing update', body: 'Legacy message', status: 'published' } };
  await mount();
  for (const label of ['Email', 'WhatsApp', 'Push notifications']) expect(channel(label).props.accessibilityState.checked).toBe(true);
  await press('Save & publish');
  expect(updateAnnouncement).toHaveBeenLastCalledWith('legacy', expect.objectContaining({ deliveryChannels: { email: true, whatsapp: true, push: true } }));
  for (const label of ['Email', 'WhatsApp', 'Push notifications']) await toggleChannel(label);
  await press('Move to draft');
  expect(updateAnnouncement).toHaveBeenLastCalledWith('legacy', expect.objectContaining({ status: 'draft', deliveryChannels: { email: false, whatsapp: false, push: false } }));
});

it('keeps saved WhatsApp-only settings on edit, including after a failed save', async () => {
  const deliveryChannels = { email: false, whatsapp: true, push: false };
  mockParams = { announcement: { id: 'whatsapp-only', title: 'Existing update', body: 'Saved message', status: 'draft', deliveryChannels } };
  (updateAnnouncement as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));
  await mount();
  expect(channel('Email').props.accessibilityState.checked).toBe(false);
  expect(channel('WhatsApp').props.accessibilityState.checked).toBe(true);
  expect(channel('Push notifications').props.accessibilityState.checked).toBe(false);
  await press('Publish update');
  expect(mockGoBack).not.toHaveBeenCalled();
  expect(JSON.stringify(screen.toJSON())).toContain('Connection lost');
  expect(JSON.stringify(screen.toJSON())).toContain('Selected channels: WhatsApp');
  await press('Publish update');
  expect(updateAnnouncement).toHaveBeenNthCalledWith(2, 'whatsapp-only', expect.objectContaining({ status: 'published', deliveryChannels }));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(mockParams.announcement.deliveryChannels).toEqual(deliveryChannels);
});

it('holds channel selection while saving and blocks duplicate publish requests', async () => {
  let finishSave: ((value: unknown) => void) | undefined;
  (createAnnouncement as jest.Mock).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
  await mount(); await fill('Title', 'Only email'); await fill('Message', 'Message'); await toggleChannel('Email');
  await act(async () => { void button('Publish update').props.onPress(); });
  expect(channel('Email').props.disabled).toBe(true);
  await toggleChannel('Push notifications'); await press('Publish update');
  expect(channel('Push notifications').props.accessibilityState.checked).toBe(false);
  expect(createAnnouncement).toHaveBeenCalledTimes(1);
  expect(createAnnouncement).toHaveBeenCalledWith(expect.objectContaining({ deliveryChannels: { email: true, whatsapp: false, push: false } }));
  await act(async () => { finishSave?.({ id: 'new' }); });
});
