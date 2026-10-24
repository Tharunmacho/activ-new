import React from 'react';
import Renderer from 'react-test-renderer';
import { AppState, Image, Text, View, StyleSheet } from 'react-native';
import PublicContentScreen from '../src/screens/public/PublicContentScreen';
import { loadNativePublicPage } from '../src/services/nativePublicContent';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { galleryMediaUrl, galleryPath, galleryPhotos, relatedGalleryAlbums } from '../src/utils/galleryContent';

jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(), submitPublicCms: jest.fn() }));
const read = readPublicCms as jest.Mock;
const nav = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn(), isFocused: () => true, addListener: jest.fn(() => () => {}) };
const album = {
  _id: 'album-id', slug: 'pharma-roundtable', title: 'Pharma & Life Sciences members’ roundtable', location: 'Hyderabad', category: 'Roundtables',
  media: { url: '/uploads/pharma-cover.jpg' }, banner: { url: '/uploads/decorative-banner.jpg' },
  photos: [{ url: '/uploads/roundtable-one.jpg', title: 'Members in discussion' }, { url: '/uploads/roundtable-two.jpg', title: 'Group photograph' }],
  customFields: [{ label: 'Created by', value: 'seed:gallery' }],
};
let screen: Renderer.ReactTestRenderer | undefined;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => screen!.root.findAllByType(Text).map(node => node.props.children).join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; jest.restoreAllMocks(); });

test('album shows the same cover and two additional photos in order, with exact individual routes', async () => {
  read.mockImplementation(async path => path === '/cms/gallery' ? [album] : album);
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable' } }} />); });
  expect(text()).toContain('Hyderabad');
  expect(text()).toContain('More photographs');
  expect(text()).not.toContain('seed:gallery');
  expect(screen!.root.findAllByType(Image).map(image => image.props.source.uri.replace(/\?.*$/, '').split('/').pop())).toEqual(['pharma-cover.jpg', 'roundtable-one.jpg', 'roundtable-two.jpg']);
  const entries = [['Open cover: ' + album.title, 0, album.title], ['Open: Members in discussion', 1, 'Members in discussion'], ['Open: Group photograph', 2, 'Group photograph']] as const;
  for (const [label, index, title] of entries) {
    await Renderer.act(async () => button(label).props.onPress());
    expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/pharma-roundtable/photo/' + index, title });
  }
  const grid = screen!.root.findAllByType(View).find(node => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.flexDirection === 'row' && style?.flexWrap === 'wrap' && node.findAllByType(Image).length === 2;
  });
  expect(grid).toBeDefined();
  expect(submitPublicCms).not.toHaveBeenCalled();
});

test('related albums match website category priority, stable list order, current exclusion and limit four', async () => {
  const albums = [
    { _id: 'other', title: 'Other album', media: { url: '/other.jpg' } }, album,
    { _id: 'first', slug: 'first-roundtable', title: 'First roundtable', category: album.category, media: { url: '/first.jpg' } },
    { _id: 'hidden', title: 'Hidden', category: album.category, visible: false },
    { _id: 'second', title: 'Second roundtable', category: album.category },
    { _id: 'third', title: 'Third roundtable', category: album.category },
    { _id: 'fifth', title: 'Fifth album' },
  ];
  expect(relatedGalleryAlbums(album, albums).map(row => row._id)).toEqual(['first', 'second', 'third', 'other']);
  read.mockImplementation(async path => path === '/cms/gallery' ? albums : album);
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable' } }} />); });
  expect(text()).toContain('More from the gallery');
  expect(button('Open album: Hidden')).toBeUndefined();
  expect(button('Open album: Fifth album')).toBeUndefined();
  for (const [title, path] of [['First roundtable', 'first-roundtable'], ['Second roundtable', 'second'], ['Third roundtable', 'third'], ['Other album', 'other']]) {
    await Renderer.act(async () => button('Open album: ' + title).props.onPress());
    expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/' + path, title });
  }
});

test('cover is counted once, absent covers start extras at zero and private photos keep canonical website positions', () => {
  expect(galleryPhotos(album).map(entry => [entry.index, entry.photo.url])).toEqual([[0, album.media.url], [1, album.photos[0].url], [2, album.photos[1].url]]);
  expect(galleryPhotos({ photos: album.photos }).map(entry => entry.index)).toEqual([0, 1]);
  expect(galleryPhotos({ ...album, photos: [null, {}, { url: '/hidden.jpg', isHidden: true }, album.photos[0], { url: { bad: true } }, album.photos[1]] }).map(entry => entry.index)).toEqual([0, 2, 4]);
  expect(galleryPhotos({ ...album, photos: 'invalid' }).map(entry => entry.index)).toEqual([0]);
});

test('first photo without cover opens zero and failed thumbnails remain navigable', async () => {
  const noCover = { ...album, media: undefined };
  read.mockImplementation(async path => path === '/cms/gallery' ? [] : noCover);
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable' } }} />); });
  const thumbnail = screen!.root.findAllByType(Image)[0];
  await Renderer.act(async () => thumbnail.props.onError());
  // A resized-image miss first retries the original upload before showing a placeholder.
  await Renderer.act(async () => screen!.root.findAllByType(Image)[0].props.onError());
  expect(text()).toContain('View photo');
  await Renderer.act(async () => button('Open: Members in discussion').props.onPress());
  expect(nav.push).toHaveBeenLastCalledWith('PublicContent', { path: '/gallery/pharma-roundtable/photo/0', title: 'Members in discussion' });
});

test('recommendation failure preserves album and photo pages avoid unnecessary list requests', async () => {
  const signal = new AbortController().signal;
  read.mockImplementation(async path => { if (path === '/cms/gallery') throw new Error('offline'); return album; });
  expect(await loadNativePublicPage('/gallery/pharma-roundtable', signal)).toEqual(expect.objectContaining({ item: album }));
  expect(read).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable' } }} />); });
  expect(button('Open cover: ' + album.title)).toBeDefined();
  expect(text()).not.toContain('More from the gallery');
  read.mockClear();
  await Renderer.act(async () => screen!.update(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable/photo/2' } }} />));
  expect(text()).toContain('Group photograph');
  expect(read).toHaveBeenCalledTimes(1);
});

test('pending recommendations do not delay photographs and are aborted and refreshed with the album', async () => {
  let finishOld: ((value: any[]) => void) | undefined;
  const pendingList = new Promise<any[]>(resolve => { finishOld = resolve; });
  let refresh = false;
  read.mockImplementation((path: string) => path === '/cms/gallery'
    ? refresh ? Promise.resolve([{ _id: 'fresh', title: 'Current recommendation' }]) : pendingList
    : Promise.resolve(refresh ? { ...album, description: 'Updated album' } : album));
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentScreen navigation={nav} route={{ params: { path: '/gallery/pharma-roundtable' } }} />); });
  expect(button('Open cover: ' + album.title)).toBeDefined();
  expect(button('Open: Members in discussion')).toBeDefined();
  expect(button('Open: Group photograph')).toBeDefined();
  const oldSignal = read.mock.calls.find(([path]) => path === '/cms/gallery')![1] as AbortSignal;
  expect(oldSignal.aborted).toBe(false);
  refresh = true;
  await Renderer.act(async () => button('Refresh content').props.onPress());
  expect(oldSignal.aborted).toBe(true);
  expect(text()).toContain('Updated album');
  expect(button('Open album: Current recommendation')).toBeDefined();
  await Renderer.act(async () => finishOld?.([{ _id: 'stale', title: 'Stale recommendation' }]));
  expect(button('Open album: Stale recommendation')).toBeUndefined();
  expect(button('Open album: Current recommendation')).toBeDefined();
  const currentSignal = read.mock.calls.filter(([path]) => path === '/cms/gallery').at(-1)![1] as AbortSignal;
  await Renderer.act(async () => screen!.unmount());
  screen = undefined;
  expect(currentSignal.aborted).toBe(true);
});

test('gallery media and recommendations safely reject malformed routes and local URI schemes', () => {
  for (const uri of [null, {}, 'javascript:alert(1)', 'file:///secret.jpg', 'content://image', '//unknown/image', '/image\n.jpg']) expect(galleryMediaUrl(uri)).toBe('');
  expect(galleryMediaUrl('https://cdn.example/photo.jpg')).toBe('https://cdn.example/photo.jpg');
  expect(galleryMediaUrl('/uploads/photo.jpg')).toBe('/uploads/photo.jpg');
  expect(galleryPath({ slug: '../bad' })).toBeNull();
  expect(relatedGalleryAlbums(album, [null, {}, { ...album, _id: 'duplicate', slug: album.slug }, { slug: 'bad/path' }, { id: 'ok', title: 'OK' }]).map(row => row.id)).toEqual(['ok']);
});
