import React from 'react';
import Renderer from 'react-test-renderer';
import { Image, TextInput } from 'react-native';
import PublicInfoScreen from '../src/screens/public/PublicInfoScreen';
import { infoPage, loadPublicInfo, sendPublicEnquiry } from '../src/services/publicInfo';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { GradientButton } from '../src/ui';

jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(), submitPublicCms: jest.fn() }));
jest.mock('../src/services/websiteNavigation', () => ({ openWebsitePage: jest.fn() }));
jest.mock('react-native-video', () => require('react-native').View);

const read = readPublicCms as jest.Mock, post = submitPublicCms as jest.Mock;
const navigation = { navigate: jest.fn(), goBack: jest.fn(), isFocused: () => true };
let screen: Renderer.ReactTestRenderer | undefined;
const fixture = { name: ' Member Test ', email: 'member@example.test', phone: ' 9999999999 ', subject: ' Membership query ', message: ' A test enquiry ' };
const policy = { slug: 'privacy-policy', status: 'published', title: 'Privacy Policy', sections: [{ heading: 'Data', body: ['Published policy wording'] }] };
const mount = async (path: string) => Renderer.act(async () => { screen = Renderer.create(<PublicInfoScreen navigation={navigation} route={{ params: { path } }} />); });
const renderedText = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(renderedText).join(' ') : renderedText(node?.children || []);
const text = () => renderedText(screen?.toJSON());
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const submit = (label: string) => screen!.root.findAllByType(GradientButton).find(node => node.props.label === label)!;
const fill = async (label: string, value: string) => Renderer.act(async () => {
  screen!.root.findAllByType(TextInput).find(input => input.props.accessibilityLabel === label)!.props.onChangeText(value);
});
beforeEach(() => { jest.clearAllMocks(); read.mockReset().mockResolvedValue({}); post.mockReset().mockResolvedValue({ id: 'received-123', receivedAt: '2026-10-14T00:00:00Z' }); });
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; });

test('canonical and /legal policy links use the same CMS slug; contact state is decoded', async () => {
  expect(infoPage('/contact?state=Tamil+Nadu')).toEqual({ kind: 'contact', slug: 'contact', state: 'Tamil Nadu' });
  expect(infoPage('/contact?state=%E0%A4')).toEqual({ kind: 'contact', slug: 'contact', state: '' });
  read.mockResolvedValue(policy);
  const signal = new AbortController().signal;
  expect((await loadPublicInfo('/legal/privacy-policy', signal))?.content).toEqual(policy);
  expect(read).toHaveBeenLastCalledWith('/cms/legal/privacy-policy', signal);
  await loadPublicInfo('/privacy-policy?source=footer', signal);
  expect(read).toHaveBeenLastCalledWith('/cms/legal/privacy-policy', signal);
});

test.each([{ ...policy, status: 'draft' }, { ...policy, status: undefined }, { ...policy, slug: 'terms-conditions' }, null, []])('policy loader rejects unpublished, wrong or malformed content: %j', async content => {
  read.mockResolvedValue(content);
  expect(await loadPublicInfo('/privacy-policy')).toBeNull();
});

test('contact and deletion use the existing staff enquiry endpoint with validated payloads', async () => {
  await sendPublicEnquiry(fixture);
  expect(post).toHaveBeenCalledWith('/cms/contact-messages', { name: 'Member Test', email: fixture.email, phone: '9999999999', subject: 'Membership query', message: 'A test enquiry' });
  await sendPublicEnquiry({ ...fixture, message: '', memberId: 'ACTIV-BEG-20261014-001' }, true, true);
  const [endpoint, body] = post.mock.calls.at(-1)!;
  expect(endpoint).toBe('/cms/contact-messages');
  expect(body.subject).toBe('ACTIV account and data deletion request');
  expect(body.message).toContain('Please verify my account ownership');
  expect(body.message).toContain('ACTIV-BEG-20261014-001');
  expect(body.message).toContain('expected completion date');
});

test('invalid input and unconfirmed deletion never post, and missing receipt never claims success', async () => {
  for (const form of [{ ...fixture, name: '' }, { ...fixture, email: 'invalid' }, { ...fixture, message: ' ' }, { ...fixture, name: 'x'.repeat(121) }]) {
    await expect(sendPublicEnquiry(form)).rejects.toThrow();
  }
  await expect(sendPublicEnquiry(fixture, true, false)).rejects.toThrow('Confirm');
  expect(post).not.toHaveBeenCalled();
  post.mockResolvedValue({});
  await expect(sendPublicEnquiry(fixture)).rejects.toThrow('could not confirm receipt');
});

test('contact form prevents rapid duplicate submissions and shows only a confirmed receipt', async () => {
  read.mockResolvedValue({ formCard: { title: 'Talk to ACTIV', namePlaceholder: 'Your full name' }, regionsBand: { enabled: false } });
  await mount('/contact');
  await fill('Name *', fixture.name); await fill('Email *', fixture.email); await fill('Message *', fixture.message);
  expect(screen!.root.findAllByType(TextInput).find(input => input.props.accessibilityLabel === 'Name *')?.props.placeholder).toBe('Your full name');
  let finish!: (value: any) => void;
  post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const onPress = submit('Send message').props.onPress;
  await Renderer.act(async () => { void onPress(); void onPress(); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(submit('Sending…').props.disabled).toBe(true);
  expect(text()).not.toContain('Your message was received');
  await Renderer.act(async () => finish({ id: 'received-once' }));
  expect(text()).toContain('received-once');
  expect(text()).toContain('Your message was received');
  expect(screen!.root.findAllByType(TextInput)).toHaveLength(0);
});

test('failed contact request preserves input and reports uncertainty without an automatic resend', async () => {
  await mount('/contact');
  await fill('Name *', fixture.name); await fill('Email *', fixture.email); await fill('Message *', fixture.message);
  post.mockRejectedValueOnce({ request: {}, message: 'Network request failed' });
  await Renderer.act(async () => submit('Send message').props.onPress());
  expect(text()).toContain('could not confirm receipt');
  expect(text()).not.toContain('Your message was received');
  expect(screen!.root.findAllByType(TextInput).find(input => input.props.accessibilityLabel === 'Message *')?.props.value).toBe(fixture.message);
  expect(post).toHaveBeenCalledTimes(1);
});

test('deletion is a verified request, requires confirmation and never reports immediate deletion', async () => {
  await mount('/delete-account');
  expect(read).not.toHaveBeenCalled();
  expect(text()).toContain('Submitting this form does not immediately delete your account');
  await fill('Name *', fixture.name); await fill('Email *', fixture.email);
  await Renderer.act(async () => submit('Submit deletion request').props.onPress());
  expect(post).not.toHaveBeenCalled();
  expect(text()).toContain('Confirm that this is your account');
  await Renderer.act(async () => button('I confirm this is my account and request deletion').props.onPress());
  await Renderer.act(async () => submit('Submit deletion request').props.onPress());
  expect(post).toHaveBeenCalledTimes(1);
  expect(text()).toContain('Your deletion request was received');
  expect(text()).toContain('verify account ownership before taking action');
  expect(screen!.root.findAllByType(TextInput)).toHaveLength(0);
  expect(screen!.root.findAllByType(GradientButton)).toHaveLength(0);
});

test('hidden CMS sections stay hidden while visible custom fields and refreshed copy render', async () => {
  const about = { heading: 'Original heading', body: 'About body', bullets: [{ text: 'Hidden bullet' }],
    sections: [{ key: 'about.points', hidden: true }, { key: 'about.statsBar', fields: [{ label: 'Community fact', value: 'Local custom field' }] }],
    extraFields: [{ label: 'Extra', value: 'Visible custom note' }] };
  read.mockResolvedValue(about);
  await mount('/about');
  expect(text()).toContain('Original heading'); expect(text()).toContain('Local custom field');
  expect(text()).toContain('Visible custom note'); expect(text()).not.toContain('Hidden bullet');
  read.mockResolvedValueOnce({ ...about, heading: 'Updated website heading' });
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(text()).toContain('Updated website heading'); expect(text()).not.toContain('Original heading');
});

test('membership custom sections and closing copy are complete, with expandable benefits', async () => {
  read.mockResolvedValue({ title: 'Membership benefits', advantages: [{ slug: 'community', title: 'Connections', body: ['Expanded benefit details'] }],
    callHeading: 'Get involved', callLines: ['Meet other founders'], enquiriesHeading: 'Questions',
    sections: [{ key: 'membership.matters', fields: [{ label: 'Community result', value: 'Additional result' }] }, { key: 'membership.closing', fields: [{ label: 'Final note', value: 'Closing custom note' }] }] });
  await mount('/membership');
  expect(text()).toContain('Meet other founders'); expect(text()).toContain('Additional result'); expect(text()).toContain('Closing custom note');
  expect(text()).not.toContain('Expanded benefit details');
  await Renderer.act(async () => button('Connections').props.onPress());
  expect(text()).toContain('Expanded benefit details');
});

test('contact honours hidden headings, office/form/social sections and state-selected offices', async () => {
  const contact = { heading: 'Hidden custom heading', offices: [
    { id: 'head', label: 'Chennai HQ', state: 'Tamil Nadu', isHeadOffice: true, email: 'hq@example.test' },
    { id: 'kerala', label: 'Kerala office', state: 'Kerala', email: 'kerala@example.test' },
  ], social: { facebook: 'https://facebook.com/activ' }, sections: [{ key: 'contact.header', hidden: true }, { key: 'contact.social', hidden: true }, { key: 'contact.form', hidden: true }] };
  read.mockResolvedValue(contact);
  await mount('/contact?state=Kerala');
  expect(text()).toContain('kerala@example.test'); expect(text()).not.toContain('hq@example.test');
  expect(text()).not.toContain('Hidden custom heading'); expect(text()).not.toContain('facebook.com/activ');
  expect(screen!.root.findAllByType(TextInput)).toHaveLength(0);
  read.mockResolvedValueOnce({ ...contact, sections: [...contact.sections, { key: 'contact.info', hidden: true }] });
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(text()).not.toContain('kerala@example.test');
});

test('policy text stays hidden on refresh failure and during retries until current published content arrives', async () => {
  read.mockResolvedValue(policy);
  await mount('/privacy-policy');
  expect(text()).toContain('Published policy wording');
  read.mockRejectedValueOnce(new Error('offline'));
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(text()).not.toContain('Published policy wording'); expect(text()).toContain('Content unavailable');
  let finish!: (value: any) => void;
  read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await Renderer.act(async () => { void button('Refresh content').props.onPress(); });
  expect(text()).not.toContain('Published policy wording');
  await Renderer.act(async () => finish({ ...policy, sections: [{ body: ['New published wording'] }] }));
  expect(text()).toContain('New published wording'); expect(text()).not.toContain('Published policy wording');
});


test('About uses authored mission, figures and leadership portrait without an empty media panel', async () => {
  read.mockResolvedValue({ heading: 'About our community', body: 'Supporting entrepreneurs.', media: { url: '' }, bullets: [{ text: 'Build shared opportunities' }],
    statsBar: [{ value: 12, label: 'Regional programmes' }, { label: 'Unpublished figure' }],
    quote: { text: 'Together we grow.', author: 'ACTIV Chairperson', role: 'Founder & Chairperson', photo: { url: '/chair.jpg' } } });
  await mount('/about');
  expect(text()).toContain('Build shared opportunities');
  expect(text()).toContain('Regional programmes');
  expect(text()).not.toContain('Unpublished figure');
  expect(text()).toContain('Together we grow.');
  expect(text()).toContain('Founder & Chairperson');
  expect(screen?.root.findAllByType(Image)).toHaveLength(1);
  const portrait = screen?.root.findByType(Image);
  await Renderer.act(async () => portrait?.props.onError());
  expect(screen?.root.findAllByType(Image)).toHaveLength(0);
  expect(text()).toContain('ACTIV Chairperson');
  expect(button('Meet your regional community')).toBeDefined();
});
