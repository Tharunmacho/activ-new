import React from 'react';
import Renderer from 'react-test-renderer';
import { AppState, Image, Text, TextInput } from 'react-native';
import { PremiumSelect } from '../src/ui';
import PublicContentScreen from '../src/screens/public/PublicContentScreen';
import { loadNativePublicPage } from '../src/services/nativePublicContent';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { usePublicResource } from '../src/services/usePublicResource';

jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(), submitPublicCms: jest.fn() }));
const read = readPublicCms as jest.Mock;
const nav = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), isFocused: () => true, addListener: jest.fn(() => () => {}) };
let screen: Renderer.ReactTestRenderer;
const button = (label: string) => screen.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => screen.root.findAllByType(Text).map(node => node.props.children).join(' ');
beforeEach(() => {
  jest.clearAllMocks(); jest.useRealTimers();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); jest.useRealTimers(); });

test('gallery list hides unpublished content and album photos are loaded from the shared API', async () => {
  read.mockImplementation(async (path: string) => path === '/cms/gallery' ? [{ _id: 'album1', slug: 'community-album', title: 'Community album', media: { url: '/cover.jpg' } }, { _id: 'draft', title: 'Hidden album', status: 'draft' }] : { _id: 'album1', title: 'Community album', description: 'Event story', media: { url: '/cover.jpg' }, photos: [{ url: '/one.jpg', caption: 'First photo' }, { url: '/two.jpg', caption: 'Second photo' }] });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery' } }} />); });
  expect(button('Community album')).toBeDefined(); expect(button('Hidden album')).toBeUndefined();
  await Renderer.act(async () => button('Community album').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/community-album', title: 'Community album' });
  await Renderer.act(async () => screen.update(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/community-album' } }} />));
  expect(read).toHaveBeenCalledWith('/cms/gallery/community-album', expect.anything(), undefined);
  expect(text()).toContain('Event story'); expect(text()).toContain('First photo'); expect(text()).toContain('Second photo');
  expect(submitPublicCms).not.toHaveBeenCalled();
});
test('news is readable in app and an internal article link pushes another native screen', async () => {
  read.mockResolvedValue({ slug: 'story', title: 'News story', summary: 'Summary', body: '<p>Full article</p><a href="/gallery/community-album">See album</a>', image: { url: '/letter.png' } });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/news/story' } }} />); });
  expect(text()).toContain('Full article');
  await Renderer.act(async () => button('See album').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/community-album', title: 'See album' });
});
test('individual gallery photos retain their own details and navigate to adjacent photos', async () => {
  read.mockResolvedValue({ slug: 'album', title: 'Album', category: 'Community', location: 'Chennai', media: { url: '/cover.jpg' }, photos: [{ url: '/photo.jpg', title: 'Signing ceremony', category: 'Partnership', location: 'Madurai', eventDate: '2026-10-14', description: 'Photo story', customFields: [{ label: 'Host', value: 'ACTIV office' }] }, { url: '/last.jpg' }] });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/album/photo/1' } }} />); });
  for (const detail of ['Signing ceremony', 'Partnership', 'Madurai', 'Photo story', 'ACTIV office']) expect(text()).toContain(detail);
  await Renderer.act(async () => button('Next photo').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/album/photo/2', title: 'Next photo' });
  await Renderer.act(async () => button('Previous photo').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/album/photo/0', title: 'Previous photo' });
});
test('leader callback validates required details and submits only an intentional enquiry', async () => {
  read.mockImplementation(async (path: string) => path === '/cms/leader-messages/purposes' ? [{ key: 'business', label: 'Business enquiry', requiresNote: true }] : { slug: 'south', regionName: 'South', regionKey: 'south', leaders: [{ id: 'chair', name: 'Regional Chair', role: 'Chairman' }] });
  (submitPublicCms as jest.Mock).mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ sent: true });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/regions/south' } }} />); });
  await Renderer.act(async () => button('View profile: Regional Chair').props.onPress());
  await Renderer.act(async () => button('Request a callback').props.onPress());
  await Renderer.act(async () => button('Send enquiry').props.onPress());
  expect(submitPublicCms).not.toHaveBeenCalled();
  const field = (label: string) => screen.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;
  await Renderer.act(async () => {
    field('Your name').props.onChangeText('Test member');
    field('Your phone').props.onChangeText('9999999999');
    field('Enquiry note').props.onChangeText('Ask about business support');
    screen.root.findByType(PremiumSelect).props.onChange('Business enquiry');
  });
  await Renderer.act(async () => button('Send enquiry').props.onPress());
  expect(submitPublicCms).toHaveBeenCalledTimes(1);
  expect(submitPublicCms).toHaveBeenCalledWith('/cms/leader-messages', expect.objectContaining({ pagePath: '/regions/south', tier: 'region', purpose: 'business', note: 'Ask about business support', sender: expect.objectContaining({ name: 'Test member', phone: '9999999999' }) }));
  expect(text()).toContain('Could not confirm your enquiry was sent');
  expect(text()).not.toContain('Enquiry sent');
  await Renderer.act(async () => button('Send enquiry').props.onPress());
  expect(submitPublicCms).toHaveBeenCalledTimes(2);
  expect(text()).toContain('Enquiry sent');
});
test('schemes resolve state names from the shared region directory and render benefits and eligibility', async () => {
  read.mockImplementation(async (path: string) => path === '/cms/regions/map' ? { regions: [{ states: [{ slug: 'tamil-nadu', name: 'Tamil Nadu' }] }] } : [{ id: 'scheme', title: 'Enterprise grant', tier: 'state', state: 'Tamil Nadu' }]);
  const controller = new AbortController();
  const list = await loadNativePublicPage('/schemes/state/tamil-nadu', controller.signal);
  expect(list?.title).toBe('Tamil Nadu schemes');
  expect(read).toHaveBeenLastCalledWith('/cms/schemes', controller.signal, { state: 'Tamil Nadu' });
  read.mockResolvedValue({ slug: 'grant', title: 'Enterprise grant', benefits: 'Shared funding', eligibility: 'Registered enterprises', documentsRequired: ['Company proof'], howToApply: 'Complete the application', applyUrl: 'https://government.example/apply' });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/schemes/view/grant' } }} />); });
  for (const value of ['Shared funding', 'Registered enterprises', 'Company proof', 'Complete the application']) expect(text()).toContain(value);
  expect(button('Apply on official portal, opens external service')).toBeDefined();
});
test('region leadership, state links and all feed data remain inside the app', async () => {
  read.mockResolvedValue({ slug: 'south', regionName: 'South', regionKey: 'south', leaders: [{ id: 'chair', name: 'Regional Chair', role: 'Chairman' }], statePanels: [{ slug: 'tamil-nadu', name: 'Tamil Nadu', leaders: [{ id: 'statechair', name: 'State Chair' }] }], projects: [{ id: 'project', title: 'Enterprise programme', body: 'Full programme details' }] });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/regions/south' } }} />); });
  expect(button('View profile: Regional Chair')).toBeDefined(); expect(button('View profile: State Chair')).toBeDefined();
  await Renderer.act(async () => button('Explore Tamil Nadu').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/states/tamil-nadu', title: 'Explore Tamil Nadu' });
  await Renderer.act(async () => button('Projects').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/regions/south/projects', title: 'Projects' });
  await Renderer.act(async () => screen.update(<PublicContentScreen navigation={nav} route={{ params: { path: '/regions/south/projects' } }} />));
  expect(text()).toContain('Full programme details');
});
test('region gallery requests real pagination and album links rather than dropping photos after page one', async () => {
  read.mockImplementation(async (path: string) => path === '/cms/states/tamil-nadu' ? { slug: 'tamil-nadu', stateName: 'Tamil Nadu' } : { items: [{ id: 'photo', media: { url: '/photo.jpg' } }], total: 25 });
  const controller = new AbortController();
  await loadNativePublicPage('/states/tamil-nadu/gallery', controller.signal, 24);
  expect(read).toHaveBeenLastCalledWith('/cms/regions/gallery', controller.signal, { state: 'Tamil Nadu', limit: 24, offset: 24 });
});
test('content removed from the CMS disappears after refresh and can retry a network failure', async () => {
  read.mockResolvedValueOnce({ title: 'Old story', body: 'Old content' }).mockRejectedValueOnce(Object.assign(new Error('gone'), { response: { status: 404 } }));
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/news/old' } }} />); });
  expect(text()).toContain('Old content');
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(text()).not.toContain('Old content'); expect(text()).toContain('no longer available');
  read.mockResolvedValueOnce({ title: 'New story', body: 'Updated content' });
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(text()).toContain('Updated content');
});
test('unknown or external page values never turn into arbitrary API requests', async () => {
  const controller = new AbortController();
  expect(await loadNativePublicPage('https://other.example/news', controller.signal)).toBeNull();
  expect(await loadNativePublicPage('/not-a-page', controller.signal)).toBeNull();
  expect(read).not.toHaveBeenCalled();
});

test('visible content refreshes on foreground, focus and timer and ignores stale responses', async () => {
  jest.useFakeTimers();
  const events: Record<string, () => void> = {};
  const navigation = { ...nav, addListener: (event: string, fn: () => void) => { events[event] = fn; return jest.fn(); } };
  const app = jest.spyOn(AppState, 'addEventListener');
  let finish: ((value: string) => void) | undefined;
  const load = jest.fn().mockResolvedValue('First');
  function Probe({ id }: { id: string }) { const result = usePublicResource<string>(navigation, id, load); return <Text>{result.data}</Text>; }
  await Renderer.act(async () => { screen = Renderer.create(<Probe id="one" />); });
  expect(text()).toBe('First');
  await Renderer.act(async () => { jest.advanceTimersByTime(60000); }); expect(load).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => events.blur());
  await Renderer.act(async () => events.focus()); expect(load).toHaveBeenCalledTimes(3);
  await Renderer.act(async () => app.mock.calls.at(-1)?.[1]('active')); expect(load).toHaveBeenCalledTimes(4);
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await Renderer.act(async () => app.mock.calls.at(-1)?.[1]('active'));
  const oldSignal = load.mock.calls.at(-1)?.[0];
  load.mockResolvedValueOnce('Second');
  await Renderer.act(async () => screen.update(<Probe id="two" />));
  expect(oldSignal.aborted).toBe(true);
  await Renderer.act(async () => finish?.('Stale')); expect(text()).toBe('Second');
  await Renderer.act(async () => screen.unmount()); app.mockRestore();
});


test('gallery category chips and place search compose correctly and can be cleared', async () => {
  read.mockResolvedValue([
    { id: 'one', title: 'Business forum', category: 'Meetings', location: 'Chennai', district: 'Chennai' },
    { id: 'two', title: 'Annual celebration', category: 'Awards', location: 'Bengaluru', district: 'Bengaluru' },
    { id: 'three', title: 'Enterprise gathering', category: 'Meetings', location: 'Bengaluru', district: 'Bengaluru' },
  ]);
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery' } }} />); });
  expect(button('All categories')).toBeDefined();
  expect(button('Meetings')).toBeDefined();
  await Renderer.act(async () => button('Meetings').props.onPress());
  expect(button('Meetings').props.accessibilityState.selected).toBe(true);
  expect(button('Annual celebration')).toBeUndefined();
  await Renderer.act(async () => screen.root.findByType(TextInput).props.onChangeText('Bengaluru'));
  expect(button('Business forum')).toBeUndefined();
  expect(button('Enterprise gathering')).toBeDefined();
  await Renderer.act(async () => button('Clear all filters').props.onPress());
  for (const title of ['Business forum', 'Annual celebration', 'Enterprise gathering']) expect(button(title)).toBeDefined();
  expect(screen.root.findByType(TextInput).props.value).toBe('');
});

test('album thumbnails retain photo routes when images fail and remove redundant cover navigation', async () => {
  read.mockResolvedValue({ slug: 'album', title: 'Community album', media: { url: '/cover.jpg' }, photos: [{ url: '/missing.jpg', caption: 'Signing ceremony' }] });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/album' } }} />); });
  expect(button('Open cover photo')).toBeUndefined();
  const thumbnail = screen.root.findAllByType(Image).find(node => node.props.accessibilityLabel === 'Signing ceremony');
  expect(thumbnail).toBeDefined();
  await Renderer.act(async () => thumbnail?.props.onError());
  expect(text()).toContain('View photo');
  expect(button('Open: Signing ceremony')).toBeDefined();
  await Renderer.act(async () => button('Open: Signing ceremony').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/album/photo/1', title: 'Signing ceremony' });
});

test('out-of-range album photo offers recovery instead of a dead-end and ignores invalid dates', async () => {
  read.mockResolvedValue({ slug: 'album', title: 'Community album', eventDate: 'invalid-date', media: { url: '/cover.jpg' } });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/album/photo/99' } }} />); });
  expect(text()).toContain('Photo unavailable');
  expect(text()).not.toContain('Invalid Date');
  await Renderer.act(async () => button('View complete album').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/album', title: 'View complete album' });
});

test('regions omit empty contacts and hidden feeds while failed leader portraits retain accessible profiles', async () => {
  read.mockResolvedValue({ slug: 'south', regionName: 'South', leaders: [{ name: 'Regional Chair', photoUrl: '/missing.jpg' }], projects: [{ title: 'Hidden project', isHidden: true }] });
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/regions/south' } }} />); });
  expect(text()).not.toContain('Get in touch');
  expect(button('Projects')).toBeUndefined();
  const portrait = screen.root.findAllByType(Image).find(node => node.props.accessibilityLabel === 'Regional Chair');
  await Renderer.act(async () => portrait?.props.onError());
  expect(screen.root.findAllByType(Image).some(node => node.props.accessibilityLabel === 'Regional Chair')).toBe(false);
  expect(button('View profile: Regional Chair')).toBeDefined();
  await Renderer.act(async () => button('Photo gallery').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/regions/south/gallery', title: 'Photo gallery' });
});

test('malformed and hidden CMS records never become public detail pages', async () => {
  const signal = new AbortController().signal;
  for (const value of [null, [], 'bad payload', { title: 'Hidden', isHidden: true }, { title: 'Hidden', visible: false }]) {
    read.mockResolvedValueOnce(value);
    expect(await loadNativePublicPage('/gallery/album', signal)).toBeNull();
  }
  read.mockResolvedValueOnce([null, 'bad row', { id: 'valid', title: 'Published album' }, { id: 'hidden', isHidden: true }]);
  expect((await loadNativePublicPage('/gallery', signal))?.items?.map(item => item.id)).toEqual(['valid']);
  read.mockResolvedValueOnce({ regions: null }).mockResolvedValueOnce([]);
  expect((await loadNativePublicPage('/schemes/state/tamil-nadu', signal))?.title).toBe('Tamil Nadu schemes');
});
