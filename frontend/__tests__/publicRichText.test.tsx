import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { Body } from '../src/screens/public/PublicContentKit';
import { publicPlainText, publicTextBlocks } from '../src/utils/publicRichText';
import { openWebsitePage } from '../src/services/websiteNavigation';

jest.mock('../src/services/websiteNavigation', () => ({ openWebsitePage: jest.fn(), openPublicAttachment: jest.fn() }));

test('saved editor formatting preserves nested emphasis, selected font sizes and links', () => {
  const blocks = publicTextBlocks('<p>Normal <strong>bold <em>both</em></strong> <u>underlined</u></p><p><span style="font-size:28px"><a href="https://example.org/?a=1&amp;b=2">Large link</a></span><br>Next line</p>');
  expect(blocks).toHaveLength(2);
  expect(blocks[0].spans).toContainEqual({ text: 'both', bold: true, italic: true });
  expect(blocks[0].spans).toContainEqual({ text: 'underlined', underline: true });
  expect(blocks[1].spans).toContainEqual({ text: 'Large link', fontSize: 28, href: 'https://example.org/?a=1&b=2' });
  expect(blocks[1].spans.map(span => span.text).join('')).toBe('Large link\nNext line');
  expect(publicPlainText('<p><b>News</b> <span style="font-size:22px">today</span></p>')).toBe('News today');
});

test('unsupported HTML cannot supply native code, resources, arbitrary styles or active links', () => {
  const blocks = publicTextBlocks('<p><script>alert(1)</script><iframe src="https://bad.test">hidden</iframe><img src="https://bad.test/pixel"><span style="font-size:999px;color:red">Safe</span><a href="javascript:alert(1)">label</a><a href="https://good.test/&#10;bad">invalid</a></p>');
  expect(blocks.flatMap(block => block.spans)).toEqual([{ text: 'Safelabelinvalid' }]);
});

test('paragraph boundaries, legacy lists, headings, code and Markdown remain readable', () => {
  expect(publicPlainText('<h2>Title</h2><ol><li>First</li><li><b>Second</b></li></ol><p>Last</p>')).toBe('Title\n\n1. First\n\n2. Second\n\nLast');
  expect(publicTextBlocks('## Title\n\n**Bold** and *italic*\n\n1. Item\n\n```\na_b\n```')).toEqual([
    { kind: 'heading', spans: [{ text: 'Title' }] },
    { kind: 'paragraph', spans: [{ text: 'Bold', bold: true }, { text: ' and ' }, { text: 'italic', italic: true }] },
    { kind: 'list', marker: '1.', spans: [{ text: 'Item' }] },
    { kind: 'code', spans: [{ text: 'a_b', code: true }] },
  ]);
});

test('native reader renders all editor font sizes and only opens a hyperlink on tap', async () => {
  let screen!: Renderer.ReactTestRenderer;
  const navigation = { push: jest.fn() };
  await act(async () => { screen = Renderer.create(<Body navigation={navigation} value={'<p><span style="font-size:18px">Normal</span><span style="font-size:22px"><u>Larger</u></span><span style="font-size:28px"><strong><em>Largest</em></strong></span> <a href="https://example.org">Read more</a></p>'} />); });
  try {
    const text = (label: string) => screen.root.findAllByType(Text).find(node => node.props.children === label)!;
    expect(StyleSheet.flatten(text('Normal').props.style)).toMatchObject({ fontSize: 18 });
    expect(StyleSheet.flatten(text('Larger').props.style)).toMatchObject({ fontSize: 22, textDecorationLine: 'underline' });
    expect(StyleSheet.flatten(text('Largest').props.style)).toMatchObject({ fontSize: 28, lineHeight: 44, fontStyle: 'italic' });
    expect(openWebsitePage).not.toHaveBeenCalled();
    await act(async () => text('Read more').props.onPress());
    expect(openWebsitePage).toHaveBeenCalledWith(navigation, 'https://example.org', 'Read more');
  } finally { await act(async () => screen.unmount()); }
});
