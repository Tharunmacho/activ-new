import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Linking, NativeModules, Platform, Share, Text } from 'react-native';
import PublicNewsArticleScreen, { NewsArticleContent } from '../src/screens/public/PublicNewsArticleScreen';
import PublicContentScreen from '../src/screens/public/PublicContentScreen';
import PublicRegionContent from '../src/screens/public/PublicRegionContent';
import WebsiteViewer from '../src/screens/member/website/WebsiteViewerScreen';
import { PublicContentCard } from '../src/screens/public/PublicExploreCards';
import { Photo } from '../src/screens/public/PublicContentKit';
import { PublicShareButton } from '../src/components/PublicShareButton';
import { usePublicResource } from '../src/services/usePublicResource';
import { newsArticlePath, newsAttachments, newsLinks, newsMedia, newsWebUrl } from '../src/utils/newsContent';
import { toExploreNews } from '../src/services/websiteContent';

jest.mock('../src/services/usePublicResource', () => ({ usePublicResource: jest.fn() }));
jest.mock('../src/config/api.config', () => ({
  ...jest.requireActual('../src/config/api.config'), API_ORIGIN: 'https://api.activ.org.in',
  resolveMediaUrl: (value: string) => !value ? '' : /^https?:\/\//.test(value) ? value : 'https://api.activ.org.in/' + value.replace(/^\/+/, ''),
}));

const article = {
  _id: '607f1f77bcf86cd799439011', slug: 'community-news', title: 'Community news', body: 'Full news article', summary: 'Community summary',
  image: { url: '/uploads/news/cover.jpg', alt: 'Cover photograph' },
  photos: [{ url: '/uploads/news/cover.jpg' }, { url: '/uploads/news/second.jpg', alt: 'Second photograph', caption: 'Second caption' },
    { url: '/uploads/news/third.jpg', alt: 'Third photograph' }, { url: '/uploads/news/hidden.jpg', isHidden: true }],
  attachments: [{ url: '/uploads/news/meeting.pdf', label: 'Meeting papers', filename: 'Meeting pack.pdf', mimeType: 'application/pdf', size: 1024 }],
  links: [{ url: 'https://wa.me/919999999999', label: 'Contact on WhatsApp' }, { url: 'https://youtu.be/meeting123' }],
};
const navigation = { navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() };
let screen: Renderer.ReactTestRenderer | undefined;
const button = (label: string) => screen!.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const text = () => screen!.root.findAllByType(Text).map(node => node.props.children).join(' ');
const resource = (data: any) => (usePublicResource as jest.Mock).mockReturnValue({ data, loading: false, error: '', refreshing: false, reload: jest.fn() });

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
  NativeModules.ReportExport = { downloadPublicFile: jest.fn().mockResolvedValue({ id: '9001', filename: 'Meeting pack.pdf', status: 'started' }) };
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(async () => { await act(async () => screen?.unmount()); screen = undefined; delete NativeModules.ReportExport; jest.restoreAllMocks(); });

test.each(['article', 'native content', 'saved website'] as const)('%s route renders all news resources and one compact header share action', async entry => {
  resource(entry === 'article' ? article : { kind: 'article', title: article.title, item: article });
  await act(async () => { screen = Renderer.create(entry === 'article'
    ? <PublicNewsArticleScreen navigation={navigation} slug={article.slug} />
    : entry === 'native content' ? <PublicContentScreen navigation={navigation} route={{ params: { path: '/news/' + article.slug } }} />
      : <WebsiteViewer navigation={navigation} route={{ params: { path: '/news/' + article.slug } }} />); });
  expect(screen!.root.findAllByType(Photo).map(node => node.props.alt)).toEqual(['Cover photograph', 'Second photograph', 'Third photograph']);
  expect(text()).not.toContain('Share this news');
  expect(text()).toContain('Second caption');
  expect(text()).toContain('Documents');
  expect(text()).toContain('Related links');
  const shares = screen!.root.findAllByType(PublicShareButton);
  expect(shares).toHaveLength(1);
  const labeledShare = shares[0];
  expect(labeledShare.props.compact).toBe(true);
  await act(async () => { labeledShare!.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0].props.onPress({ stopPropagation: jest.fn() }); });
  expect(JSON.stringify((Share.share as jest.Mock).mock.calls[0][0])).toContain('https://activ.org.in/news/community-news');
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(NativeModules.ReportExport.downloadPublicFile).not.toHaveBeenCalled();
  expect(Linking.openURL).not.toHaveBeenCalled();
  const sources = screen!.root.findAll(node => node.props.source?.uri).map(node => node.props.source.uri);
  expect(sources.some(uri => /\/uploads\/news\/cover\.jpg\?w=1280$/.test(uri))).toBe(true);
  expect(sources.some(uri => /\.pdf|youtu\.be|wa\.me/.test(uri))).toBe(false);
});

test('document taps use Android Downloads with a filename, while WhatsApp and YouTube open only when tapped', async () => {
  await act(async () => { screen = Renderer.create(<NewsArticleContent article={article} navigation={navigation} />); });
  expect(NativeModules.ReportExport.downloadPublicFile).not.toHaveBeenCalled();
  await act(async () => button('Meeting papers, save to Downloads').props.onPress());
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledWith('https://api.activ.org.in/uploads/news/meeting.pdf', 'Meeting pack.pdf');
  expect(NativeModules.ReportExport.downloadPublicFile.mock.calls[0]).toHaveLength(2);
  expect(Alert.alert).toHaveBeenCalledWith('Download started', expect.stringContaining('Downloads'));
  await act(async () => button('Contact on WhatsApp, opens external service').props.onPress());
  await act(async () => button('Watch on YouTube, opens external service').props.onPress());
  expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'https://wa.me/919999999999');
  expect(Linking.openURL).toHaveBeenNthCalledWith(2, 'https://youtu.be/meeting123');
});

test('region news cards reuse attachments/photos without outside share actions', async () => {
  const item = { ...article, image: undefined, imageUrl: article.image.url, href: undefined };
  await act(async () => { screen = Renderer.create(<PublicRegionContent navigation={navigation} path="/states/tamil-nadu/newsUpdates" offset={0} onOffset={jest.fn()}
    page={{ kind: 'region', title: 'Tamil Nadu', scope: 'states', section: 'newsUpdates', page: { slug: 'tamil-nadu', newsUpdates: [item] } }} />); });
  expect(screen!.root.findAllByType(Photo)).toHaveLength(3);
  expect(screen!.root.findAllByType(PublicShareButton)).toHaveLength(0);
  expect(button('Meeting papers, save to Downloads')).toBeDefined();
  expect(Share.share).not.toHaveBeenCalled();
});

test('iOS opens the validated public document without invoking the Android download bridge', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await act(async () => { screen = Renderer.create(<NewsArticleContent article={article} navigation={navigation} />); });
  await act(async () => button('Meeting papers, open document').props.onPress());
  expect(Linking.openURL).toHaveBeenCalledWith('https://api.activ.org.in/uploads/news/meeting.pdf');
  expect(NativeModules.ReportExport.downloadPublicFile).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('public cards and member teasers use the first available photo and preserve ID-based article links', async () => {
  const record = { ...article, slug: undefined, image: undefined, photos: [{ url: '/uploads/news/second.jpg' }] };
  await act(async () => { screen = Renderer.create(<PublicContentCard kind="news" item={record} openPage={navigation.push} />); });
  expect(screen!.root.findAllByType(PublicShareButton)).toHaveLength(0);
  await act(async () => button('Community news').props.onPress());
  expect(navigation.push).toHaveBeenCalledWith('/news/' + article._id, article.title);
  expect(toExploreNews([record])[0]).toMatchObject({ path: '/news/' + article._id, image: 'https://api.activ.org.in/uploads/news/second.jpg' });
  expect(newsArticlePath({})).toBe('');
});

test('legacy video media remains a tap-to-open link and never mounts a player', async () => {
  await act(async () => { screen = Renderer.create(<NewsArticleContent article={{ slug: 'video', title: 'Video news', photos: [{ type: 'video', url: 'https://www.youtube.com/watch?v=meeting123', alt: 'Watch the meeting' }] }} navigation={navigation} />); });
  expect(button('Watch the meeting, opens external service')).toBeDefined();
  expect(screen!.root.findAll(node => node.props.source?.uri)).toHaveLength(0);
  expect(Linking.openURL).not.toHaveBeenCalled();
});

test.each(['javascript:alert(1)', 'file:///private/doc.pdf', 'content://private', '//evil.example/doc.pdf', 'https://user:secret@host.test/file.pdf', 'https://host.test/line%0Abreak', 'https://host.test/bad%zz', 'https://host.test:99999/file.pdf', 'whatsapp://send?phone=123'])('rejects unsafe or unsupported news links: %s', value => {
  expect(newsWebUrl(value)).toBe('');
  expect(newsLinks({ links: [{ url: value }] })).toEqual([]);
  expect(newsAttachments({ attachments: [{ url: value, filename: 'Guide.pdf' }] })).toEqual([]);
});

test('safe link labels, limits and hidden rows are normalized without loading the resources', () => {
  expect(newsLinks({ links: [{ url: 'http://example.test/page', label: '<b>Official page</b>' }, { url: 'https://chat.whatsapp.com/group' }, { url: 'https://youtube.com/shorts/clip' }, { url: 'https://hidden.test', isHidden: true }] }))
    .toEqual([{ url: 'http://example.test/page', label: 'Official page' }, { url: 'https://chat.whatsapp.com/group', label: 'Open WhatsApp' }, { url: 'https://youtube.com/shorts/clip', label: 'Watch on YouTube' }]);
  expect(newsLinks({ links: Array.from({ length: 12 }, (_, i) => ({ url: 'https://example.test/' + i })) })).toHaveLength(10);
  expect(newsLinks({ links: null })).toEqual([]);
});

test('documents support metadata-named HTTPS files, reject HTTP/oversized/hidden rows, and cap the collection', () => {
  expect(newsAttachments({ attachments: [
    { url: 'https://files.example.test/download/123', filename: 'Guide.pdf', label: '' },
    { url: 'http://files.example.test/guide.pdf' }, { url: '/uploads/../private.pdf' },
    { url: '/uploads/%2e%2e/private.pdf' }, { url: '/uploads/large.pdf', size: 21 * 1024 * 1024 },
    { url: '/uploads/hidden.pdf', visible: false }, { url: '/uploads/installer.exe', mimeType: 'application/x-msdownload' },
  ] })).toEqual([{ url: 'https://files.example.test/download/123', filename: 'Guide.pdf', label: 'Guide.pdf' }]);
  expect(newsAttachments({ attachments: Array.from({ length: 12 }, (_, i) => ({ url: '/uploads/document-' + i + '.pdf' })) })).toHaveLength(10);
});

test('photos deduplicate the cover, omit hidden and unsafe media, and retain the existing 20-photo limit', () => {
  expect(newsMedia(article)).toHaveLength(3);
  expect(newsMedia({ image: '/uploads/cover.jpg', photos: [{ url: 'data:image/png;base64,AA' }, { url: '/uploads/hidden.jpg', visible: false }] })).toEqual([
    { url: 'https://api.activ.org.in/uploads/cover.jpg', type: 'image', alt: '', caption: '' },
  ]);
  expect(newsMedia({ photos: Array.from({ length: 25 }, (_, i) => ({ url: '/uploads/photo-' + i + '.jpg' })) })).toHaveLength(20);
  expect(newsMedia({ image: {}, imageUrl: '/uploads/legacy-cover.jpg', photos: [{ url: '/uploads/extra.jpg', alt: 'Published photo caption' }] })).toEqual([
    { url: 'https://api.activ.org.in/uploads/legacy-cover.jpg', type: 'image', alt: '', caption: '' },
    { url: 'https://api.activ.org.in/uploads/extra.jpg', type: 'image', alt: 'Published photo caption', caption: 'Published photo caption' },
  ]);
});
