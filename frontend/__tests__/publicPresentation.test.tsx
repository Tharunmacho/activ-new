import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import { Body } from '../src/screens/public/PublicContentKit';
import { PublicContentCard } from '../src/screens/public/PublicExploreCards';
import WebsiteViewer from '../src/screens/member/website/WebsiteViewerScreen';
import { PremiumPage, PremiumPageHeader } from '../src/ui';
import { publicInline, publicPlainText, publicTextBlocks } from '../src/utils/publicRichText';
import { readPublicCms, submitPublicCms } from '../src/services/publicContent';
import { openWebsitePage } from '../src/services/websiteNavigation';

jest.mock('../src/services/publicContent', () => ({ readPublicCms: jest.fn(), submitPublicCms: jest.fn() }));
jest.mock('../src/services/websiteNavigation', () => ({ openWebsitePage: jest.fn(), openPublicAttachment: jest.fn() }));
const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true, isFocused: () => true };
let screen: Renderer.ReactTestRenderer | undefined;
const text = (node: any): string => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node?.children || []);
beforeEach(() => jest.clearAllMocks());
afterEach(async () => { await Renderer.act(async () => screen?.unmount()); screen = undefined; });

test('public online cards show Online while retaining the event detail action', async () => {
  const openPage = jest.fn();
  await Renderer.act(async () => { screen = Renderer.create(<PublicContentCard kind="events" openPage={openPage}
    item={{ id: 'webinar', title: 'Online workshop', mode: 'online', onlinePlatform: 'Zoom', venue: 'Old hall' }} />); });
  const labels = screen!.root.findAllByType(Text).map(node => text(node.props.children));
  expect(labels).toContain('Online');
  expect(text(screen!.toJSON())).not.toContain('Zoom');
  expect(text(screen!.toJSON())).not.toContain('Old hall');
  const button = screen!.root.findAll(node => node.props.accessibilityLabel === 'Online workshop' && typeof node.props.onPress === 'function')[0];
  await Renderer.act(async () => button.props.onPress());
  expect(openPage).toHaveBeenCalledWith('/events/webinar', 'Online workshop');
});

test('CMS news Markdown becomes readable native emphasis without changing its words', () => {
  const body = '*Social Vision TV* has published a report on **ACTIV** and ***SC/ST entrepreneurs***.';
  expect(publicPlainText(body)).toBe('Social Vision TV has published a report on ACTIV and SC/ST entrepreneurs.');
  expect(publicInline(body)).toEqual(expect.arrayContaining([
    { text: 'Social Vision TV', italic: true }, { text: 'ACTIV', bold: true }, { text: 'SC/ST entrepreneurs', bold: true, italic: true },
  ]));
});

test('editor HTML, entities, headings, lists and plain paragraph breaks keep their content', () => {
  const blocks = publicTextBlocks('<h2>Benefits &amp; eligibility</h2><p>Read <strong>carefully</strong>.<br>Second line</p><ul><li>Company proof</li><li>Application</li></ul><script>hidden()</script>');
  expect(blocks.map(block => block.kind)).toEqual(['heading', 'paragraph', 'list', 'list']);
  expect(publicPlainText('<p>First</p><p>Second &#x20b9; &#8377;</p>')).toBe('First\n\nSecond ₹ ₹');
  expect(blocks[1].spans).toContainEqual({ text: 'carefully', bold: true });
  expect(publicPlainText('### Apply\n1. Register\n2. Upload\n> Keep your reference')).toBe('Apply\n\n1. Register\n\n2. Upload\n\nKeep your reference');
  expect(publicPlainText('<style>body{}</style>Visible<script>secret()</script>')).toBe('Visible');
});

test('ordinary asterisks, escaped markup, identifiers and code remain literal', () => {
  expect(publicPlainText('2 * 3 = 6; account_id_v1; 10%')).toBe('2 * 3 = 6; account_id_v1; 10%');
  expect(publicPlainText('\\*Literal\\* and `**literal**`')).toBe('*Literal* and **literal**');
  expect(publicTextBlocks('```\nconst amount = 2 * 3\n```')[0]).toEqual({ kind: 'code', spans: [{ text: 'const amount = 2 * 3', code: true }] });
  expect(publicPlainText('Unmatched ** stays readable')).toBe('Unmatched ** stays readable');
});

test('HTML and Markdown links retain native navigation; unsupported schemes never become actions', async () => {
  await Renderer.act(async () => { screen = Renderer.create(<Body navigation={navigation} value={'<a href="/gallery/community">See album</a> and [Apply](https://government.example/apply). [Unsafe](javascript:alert)'} />); });
  const link = (label: string) => screen!.root.findAllByType(Text).find(node => node.props.accessibilityLabel === label && node.props.onPress);
  await Renderer.act(async () => link('See album')!.props.onPress());
  expect(openWebsitePage).toHaveBeenLastCalledWith(navigation, '/gallery/community', 'See album');
  await Renderer.act(async () => link('Apply')!.props.onPress());
  expect(openWebsitePage).toHaveBeenLastCalledWith(navigation, 'https://government.example/apply', 'Apply');
  expect(link('Unsafe')).toBeUndefined();
  expect(text(screen!.toJSON())).toContain('Unsafe');
});

test.each([true, false])('guest/member saved routes share the same complete story and premium page (publicAccess=%s)', async publicAccess => {
  const title = 'Media Coverage Highlights ACTIV’s SC/ST Economic Liberty Conference in Dharmapuri';
  (readPublicCms as jest.Mock).mockResolvedValue({ title, category: 'Media coverage', publishedAt: '2026-10-11T10:00:00Z', summary: '*Social Vision TV* report', body: '**ACTIV** supports entrepreneurs', externalUrl: 'https://example.test/story' });
  await Renderer.act(async () => { screen = Renderer.create(<WebsiteViewer navigation={navigation} route={{ params: { path: '/news/story', publicAccess } }} />); });
  expect(screen!.root.findByType(PremiumPage).props.safeBottom).toBe(true);
  const header = screen!.root.findByType(PremiumPageHeader);
  expect(header.props.title).toBe(title);
  expect(header.props.subtitle).toContain('11 Oct 2026');
  expect(text(screen!.toJSON())).toContain('Social Vision TV report');
  expect(text(screen!.toJSON())).toContain('ACTIV supports entrepreneurs');
  expect(text(screen!.toJSON())).not.toContain('**');
  expect(screen!.root.findAll(node => node.props.accessibilityLabel === 'Read the original source, opens external service').length).toBeGreaterThan(0);
  expect(submitPublicCms).not.toHaveBeenCalled();
});
