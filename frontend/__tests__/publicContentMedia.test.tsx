import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ContentMedia } from '../src/screens/public/PublicContentKit';

jest.mock('react-native-video', () => ({ __esModule: true, default: 'UploadedVideo' }));
jest.mock('react-native-webview', () => ({ __esModule: true, WebView: 'EmbeddedVideo' }));

let screen: Renderer.ReactTestRenderer | undefined;
const renderVideo = (url: string) => <ContentMedia media={{ type: 'video', url }} title="ACTIV event video" />;
const player = (type: string) => screen!.root.findByType(type as any);
const retry = () => screen!.root.findAll(node => node.props.accessibilityLabel === 'Retry video' && typeof node.props.onPress === 'function')[0];
const text = () => screen!.root.findAllByType(Text).map(node => node.props.children).join(' ');
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; });

test.each([
  ['uploaded', 'https://cdn.example.test/event.mp4', 'UploadedVideo', 'https://cdn.example.test/event.mp4'],
  ['YouTube', 'https://youtu.be/event123', 'EmbeddedVideo', 'https://www.youtube.com/embed/event123'],
  ['Vimeo', 'https://vimeo.com/123456', 'EmbeddedVideo', 'https://player.vimeo.com/video/123456'],
])('%s video can be retried after each playback failure', async (_label, url, type, source) => {
  await Renderer.act(async () => { screen = Renderer.create(renderVideo(url)); });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const previousPlayer = player(type);
    await Renderer.act(async () => previousPlayer.props.onError({}));
    expect(screen!.root.findAllByType(type as any)).toHaveLength(0);
    expect(text()).toContain('This video could not be played. Try again.');
    expect(text()).not.toContain('Pull down to reload');
    expect(retry()).toBeDefined();

    await Renderer.act(async () => retry().props.onPress());
    expect(player(type)).not.toBe(previousPlayer);
    expect(player(type).props.source).toEqual({ uri: source });
    expect(retry()).toBeUndefined();
    expect(text()).not.toContain('This video could not be played');
  }
});

test.each([
  ['https://cdn.example.test/old.mp4', 'https://cdn.example.test/new.mp4', 'UploadedVideo', 'https://cdn.example.test/new.mp4'],
  ['https://youtu.be/old123', 'https://youtu.be/new456', 'EmbeddedVideo', 'https://www.youtube.com/embed/new456'],
])('a replacement video URI clears the previous failure: %s', async (oldUrl, newUrl, type, source) => {
  await Renderer.act(async () => { screen = Renderer.create(renderVideo(oldUrl)); });
  await Renderer.act(async () => player(type).props.onError({}));
  expect(retry()).toBeDefined();

  await Renderer.act(async () => screen!.update(renderVideo(newUrl)));
  expect(player(type).props.source).toEqual({ uri: source });
  expect(retry()).toBeUndefined();
  expect(text()).not.toContain('This video could not be played');
});
