import React from 'react';
import Renderer from 'react-test-renderer';
import { Image, Modal, PixelRatio, StyleSheet, Text, View } from 'react-native';
import { API_ORIGIN } from '../src/config/api.config';
import { imageSource, responsiveImageWidth, sizedMediaUrl } from '../src/utils/imageSizing';
import { ContentImage } from '../src/ui/ContentImage';
import { FitImage } from '../src/ui/FitImage';
import { Photo } from '../src/screens/public/PublicContentKit';

let screen: Renderer.ReactTestRenderer | undefined;
const failure = { nativeEvent: { error: 'Image unavailable' } };
const image = () => screen!.root.findByType(Image);
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const zoomDocuments = () => screen!.root.findAll(node => typeof node.props.source?.html === 'string');
beforeEach(() => { jest.useFakeTimers(); });
afterEach(async () => {
  await Renderer.act(async () => screen?.unmount());
  screen = undefined;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('display widths cap density and size before selecting a bounded cache bucket', () => {
  const density = jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  expect(responsiveImageWidth(390)).toBe(780);
  expect(density).toHaveBeenCalled();
  expect(responsiveImageWidth(390, 1)).toBe(390);
  expect(responsiveImageWidth(390, 1.5)).toBe(585);
  expect(responsiveImageWidth(3000, 4)).toBe(1280);
  expect(responsiveImageWidth(NaN, NaN)).toBe(800);
  expect(responsiveImageWidth(-1, 0)).toBe(800);
  expect(sizedMediaUrl('/uploads/photo.jpg', responsiveImageWidth(390))).toBe(`${API_ORIGIN}/uploads/photo.jpg?w=800`);
  expect(sizedMediaUrl('/uploads/photo.jpg', responsiveImageWidth(3000, 4))).toBe(`${API_ORIGIN}/uploads/photo.jpg?w=1280`);
});

test.each([[1, 320], [321, 480], [481, 640], [641, 800], [801, 1024], [1025, 1280], [1281, 1600], [1601, 1920], [10000, 1920], [NaN, 800]])(
  'requested width %s uses the shared cache bucket %s', (requested, expected) => {
    expect(sizedMediaUrl('/uploads/photo.PNG', requested)).toBe(`${API_ORIGIN}/uploads/photo.PNG?w=${expected}`);
  },
);

test('resizing replaces only the width and preserves other query values and the fragment', () => {
  expect(sizedMediaUrl('/uploads/photo.jpg?download=1&w=320&name=Summer%20meet&token=a%2Bb%3D&W=640#photo', 900))
    .toBe(`${API_ORIGIN}/uploads/photo.jpg?download=1&name=Summer%20meet&token=a%2Bb%3D&w=1024#photo`);
  expect(sizedMediaUrl('/uploads/photo.webp?quality=80', 640)).toBe(`${API_ORIGIN}/uploads/photo.webp?quality=80&w=640`);
  expect(sizedMediaUrl(undefined)).toBe('');
});

test('legacy uploads keep the existing API-origin repair before receiving a display width', () => {
  expect(sizedMediaUrl('http://10.0.2.2:5000/uploads/older-photo.jpg?revision=3', 480))
    .toBe(`${API_ORIGIN}/uploads/older-photo.jpg?revision=3&w=480`);
});

test.each([
  'https://cdn.example.test/images/photo.jpg?signature=a%2Bb&width=900',
  'https://images.example.test/photo.png#preview',
  'file:///storage/DCIM/photo.jpg', 'content://media/external/images/42',
  'asset:/photos/local.png', 'data:image/png;base64,AAAA',
])('external or local image stays unchanged: %s', uri => {
  expect(sizedMediaUrl(uri, 640)).toBe(uri);
  expect(imageSource(uri, 640)).toEqual({ uri });
});

test('supported uploads request WebP while other formats keep their original source', () => {
  for (const extension of ['jpg', 'jpeg', 'png', 'webp']) {
    expect(imageSource('/uploads/photo.' + extension, 480)).toEqual({
      uri: `${API_ORIGIN}/uploads/photo.${extension}?w=480`, headers: { Accept: 'image/webp,image/*;q=0.8' },
    });
  }
  for (const extension of ['gif', 'svg', 'heic', 'pdf']) {
    expect(imageSource('/uploads/photo.' + extension, 480)).toEqual({ uri: `${API_ORIGIN}/uploads/photo.${extension}` });
  }
});

test('a failed resized source tries the original once, then reports failure without looping', async () => {
  const onError = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ContentImage uri="/uploads/first.jpg" width={640} onError={onError} />); });
  expect(image().props.source).toEqual(imageSource('/uploads/first.jpg', 640));
  await Renderer.act(async () => image().props.onError(failure));
  expect(image().props.source).toEqual({ uri: `${API_ORIGIN}/uploads/first.jpg` });
  expect(onError).not.toHaveBeenCalled();
  await Renderer.act(async () => image().props.onError(failure));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError).toHaveBeenCalledWith(failure);
  expect(image().props.source).toEqual({ uri: `${API_ORIGIN}/uploads/first.jpg` });

  await Renderer.act(async () => screen!.update(<ContentImage uri="/uploads/second.jpg" width={640} onError={onError} />));
  expect(image().props.source).toEqual(imageSource('/uploads/second.jpg', 640));
  await Renderer.act(async () => image().props.onError(failure));
  expect(image().props.source).toEqual({ uri: `${API_ORIGIN}/uploads/second.jpg` });
  expect(onError).toHaveBeenCalledTimes(1);
});

test('an external image reports errors directly without retrying the identical source', async () => {
  const uri = 'https://cdn.example.test/images/photo.jpg', onError = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<ContentImage uri={uri} onError={onError} />); });
  await Renderer.act(async () => image().props.onError(failure));
  expect(onError).toHaveBeenCalledTimes(1);
  expect(image().props.source).toEqual({ uri });
});

test('FitImage auto learns its aspect ratio from the display image without fetching original dimensions', async () => {
  const getSize = jest.spyOn(Image, 'getSize');
  jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  await Renderer.act(async () => { screen = Renderer.create(<FitImage uri="/uploads/banner.jpg" mode="auto" style={{ width: 300 }} accessibilityLabel="Banner" />); });
  const frame = () => screen!.root.findAllByType(View).find(node => node.props.accessibilityLabel === 'Banner')!;
  const foreground = () => screen!.root.findAllByType(Image).find(node => node.props.resizeMode === 'contain')!;
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBeCloseTo(16 / 9);
  expect(foreground().props.source.uri).toBe(`${API_ORIGIN}/uploads/banner.jpg?w=640`);
  expect(screen!.root.findAllByType(Image).every(node => node.props.source.uri === foreground().props.source.uri)).toBe(true);
  await Renderer.act(async () => foreground().props.onLoad({ nativeEvent: { source: { width: 640, height: 320 } } }));
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBe(2);
  await Renderer.act(async () => foreground().props.onLoad({ nativeEvent: { source: { width: 640, height: 1600 } } }));
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBe(1.2);
  await Renderer.act(async () => foreground().props.onLoad({ nativeEvent: { source: { width: 640, height: 80 } } }));
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBe(3.2);
  expect(getSize).not.toHaveBeenCalled();
});

test('FitImage retains its loaded image and dimensions when switching layout modes', async () => {
  const render = (mode: 'auto' | 'frame') => <FitImage uri="/uploads/banner.jpg" mode={mode} style={{ width: 300 }} accessibilityLabel="Banner" />;
  await Renderer.act(async () => { screen = Renderer.create(render('frame')); });
  const frame = () => screen!.root.findAllByType(View).find(node => node.props.accessibilityLabel === 'Banner')!;
  const foreground = () => screen!.root.findAllByType(Image).find(node => node.props.resizeMode === 'contain')!;
  await Renderer.act(async () => foreground().props.onLoad({ nativeEvent: { source: { width: 600, height: 300 } } }));
  const loadedSource = foreground().props.source;
  expect(screen!.root.findAllByType(Image)).toHaveLength(2);
  await Renderer.act(async () => screen!.update(render('auto')));
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBe(2);
  expect(screen!.root.findAllByType(Image).every(node => node.props.source.uri === loadedSource.uri)).toBe(true);
  expect(screen!.root.findAllByType(Text)).toHaveLength(0);
  await Renderer.act(async () => screen!.update(render('frame')));
  await Renderer.act(async () => { jest.advanceTimersByTime(8000); });
  expect(StyleSheet.flatten(frame().props.style).aspectRatio).toBeUndefined();
  expect(screen!.root.findAllByType(Image)).toHaveLength(2);
  expect(screen!.root.findAllByType(Text)).toHaveLength(0);
});

test('FitImage keeps content during its original retry and recovers when its URL changes', async () => {
  const onError = jest.fn();
  const render = (uri: string) => <FitImage uri={uri} mode="auto" fallback={<Text>Unavailable</Text>} onError={onError}><Text>Caption</Text></FitImage>;
  await Renderer.act(async () => { screen = Renderer.create(render('/uploads/missing.jpg')); });
  const foreground = () => screen!.root.findAllByType(Image).find(node => node.props.resizeMode === 'contain')!;
  await Renderer.act(async () => foreground().props.onError(failure));
  expect(foreground().props.source.uri).toBe(`${API_ORIGIN}/uploads/missing.jpg`);
  expect(onError).not.toHaveBeenCalled();
  await Renderer.act(async () => foreground().props.onError(failure));
  expect(screen!.root.findAllByType(Image)).toHaveLength(0);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(screen!.root.findAllByType(Text).map(node => node.props.children)).toEqual(['Unavailable', 'Retry image', 'Caption']);
  await Renderer.act(async () => screen!.update(render('/uploads/recovered.jpg')));
  expect(foreground().props.source.uri).toContain('/uploads/recovered.jpg?w=');
  expect(screen!.root.findAllByType(Text).map(node => node.props.children)).toEqual(['Loading image...', 'Caption']);
});

test('FitImage explains stalled loading, reuses the successful original for blur, and retries a later failure', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<FitImage uri="/uploads/banner.jpg" mode="auto" />); });
  const foreground = () => screen!.root.findAllByType(Image).find(node => node.props.resizeMode === 'contain')!;
  expect(screen!.root.findAllByType(Image)).toHaveLength(1);
  await Renderer.act(async () => { jest.advanceTimersByTime(8000); });
  expect(screen!.root.findAllByType(Text).some(node => node.props.children === 'This image is taking longer to load.')).toBe(true);
  await Renderer.act(async () => foreground().props.onError(failure));
  await Renderer.act(async () => foreground().props.onLoad({ nativeEvent: { source: { width: 1280, height: 720 } } }));
  expect(screen!.root.findAllByType(Image)).toHaveLength(2);
  expect(screen!.root.findAllByType(Image).every(node => node.props.source.uri === `${API_ORIGIN}/uploads/banner.jpg`)).toBe(true);
  expect(screen!.root.findAllByType(Text)).toHaveLength(0);
  await Renderer.act(async () => foreground().props.onError(failure));
  expect(screen!.root.findAllByType(Image)).toHaveLength(0);
  expect(button('Retry image')).toBeDefined();
  await Renderer.act(async () => button('Retry image').props.onPress());
  expect(foreground().props.source.uri).toContain('/uploads/banner.jpg?w=');
  expect(button('Retry image')).toBeUndefined();
});

test('Photo loads a 1024px preview and creates the original-image zoom only while open', async () => {
  const getSize = jest.spyOn(Image, 'getSize');
  await Renderer.act(async () => { screen = Renderer.create(<Photo url="/uploads/album.jpg?revision=2" alt="Community gathering" />); });
  expect(image().props.source).toEqual(imageSource('/uploads/album.jpg?revision=2', 1024));
  expect(zoomDocuments()).toHaveLength(0);
  expect(button('Enlarge image: Community gathering').props.disabled).toBe(true);
  await Renderer.act(async () => image().props.onLoad({ nativeEvent: { source: { width: 1024, height: 768 } } }));
  expect(button('Enlarge image: Community gathering').props.disabled).toBe(false);
  expect(zoomDocuments()).toHaveLength(0);
  await Renderer.act(async () => button('Enlarge image: Community gathering').props.onPress());
  expect(screen!.root.findByType(Modal).props.visible).toBe(true);
  expect(zoomDocuments().length).toBeGreaterThan(0);
  for (const document of zoomDocuments()) {
    expect(document.props.source.html).toContain(`src="${API_ORIGIN}/uploads/album.jpg?revision=2"`);
    expect(document.props.source.html).not.toContain('w=1024');
    expect(document.props.javaScriptEnabled).toBe(false);
  }
  await Renderer.act(async () => screen!.root.findByType(Modal).props.onRequestClose());
  expect(zoomDocuments()).toHaveLength(0);
  expect(image().props.source.uri).toContain('w=1024');
  expect(getSize).not.toHaveBeenCalled();
});

test('Photo waits for both sources to fail, retries explicitly and resets for a different URL', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<Photo url="/uploads/missing.jpg" alt="First photo" />); });
  await Renderer.act(async () => image().props.onError(failure));
  expect(button('Retry image')).toBeUndefined();
  expect(image().props.source.uri).toBe(`${API_ORIGIN}/uploads/missing.jpg`);
  await Renderer.act(async () => image().props.onError(failure));
  expect(button('Retry image')).toBeDefined();
  expect(screen!.root.findAllByType(Image)).toHaveLength(0);
  await Renderer.act(async () => button('Retry image').props.onPress());
  expect(image().props.source.uri).toBe(`${API_ORIGIN}/uploads/missing.jpg?w=1024`);
  await Renderer.act(async () => screen!.update(<Photo url="/uploads/new.jpg" alt="New photo" />));
  expect(image().props.source.uri).toBe(`${API_ORIGIN}/uploads/new.jpg?w=1024`);
  expect(button('Enlarge image: New photo').props.disabled).toBe(true);
  expect(zoomDocuments()).toHaveLength(0);
});
