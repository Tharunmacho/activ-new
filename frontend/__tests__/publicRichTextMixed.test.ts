import { publicPlainText, publicTextBlocks } from '../src/utils/publicRichText';

test('inline editor HTML preserves Markdown headings, paragraphs and lists', () => {
  const blocks = publicTextBlocks('# Heading\n\nFirst with <u>underlined</u> words.\nSecond line.\n\n- Item **one**\n- Item <em>two</em>');
  expect(blocks.map(block => block.kind)).toEqual(['heading', 'paragraph', 'list', 'list']);
  expect(blocks[1].spans).toContainEqual({ text: 'underlined', underline: true });
  expect(blocks[1].spans.map(span => span.text).join('')).toBe('First with underlined words.\nSecond line.');
  expect(blocks[2].spans).toContainEqual({ text: 'one', bold: true });
  expect(blocks[3].spans).toContainEqual({ text: 'two', italic: true });
});

test('inline styles and Markdown emphasis can surround each other', () => {
  const blocks = publicTextBlocks('<u>Some **bold** and normal</u> with **bold <em>italic</em>**.');
  expect(blocks[0].spans).toEqual(expect.arrayContaining([
    { text: 'Some ', underline: true }, { text: 'bold', underline: true, bold: true },
    { text: ' and normal', underline: true }, { text: 'italic', bold: true, italic: true },
  ]));
  expect(publicPlainText('<span style="font-size:22px">Large **news**</span>\n\nNext paragraph')).toBe('Large news\n\nNext paragraph');
  expect(publicTextBlocks('<span style="font-size:22px">Large **news**</span>')[0].spans).toContainEqual({ text: 'news', fontSize: 22, bold: true });
});

test('inline and fenced code keep literal HTML without selecting HTML whitespace rules', () => {
  const inline = publicTextBlocks('Use `<span>` and `<p>literal</p>` for examples.\n\nNext paragraph.');
  expect(inline).toHaveLength(2);
  expect(inline[0].spans).toContainEqual({ text: '<span>', code: true });
  expect(inline[0].spans).toContainEqual({ text: '<p>literal</p>', code: true });
  expect(publicTextBlocks('<code>**literal** [label](https://example.test)</code>')[0].spans)
    .toEqual([{ text: '**literal** [label](https://example.test)', code: true }]);
  const fenced = publicTextBlocks('# Example\n\n```\n<p><strong>Literal</strong></p>\n<script>example()</script>\n```\n\nOrdinary <u>text</u>.');
  expect(fenced.map(block => block.kind)).toEqual(['heading', 'code', 'paragraph']);
  expect(fenced[1].spans).toEqual([{ text: '<p><strong>Literal</strong></p>\n<script>example()</script>', code: true }]);
});

test('HTML attributes do not become Markdown and safe destinations remain exact', () => {
  const href = 'https://example.test/_private_/**path**?x=1&y=2';
  const spans = publicTextBlocks(`<a href="${href.replace('&', '&amp;')}">Read **more**</a>`)[0].spans;
  expect(spans).toEqual([{ text: 'Read ', href }, { text: 'more', bold: true, href }]);
  expect(publicTextBlocks('[Mail](mailto:person@example.test) and <u>text</u>')[0].spans[0]).toEqual({ text: 'Mail', href: 'mailto:person@example.test' });
});

test('full HTML blocks retain the editor formatting and explicit line breaks', () => {
  const blocks = publicTextBlocks('<p><span style="font-size:28px"><strong>Big <em>news</em></strong></span><br>Second line</p><p><u>More</u></p>');
  expect(blocks).toHaveLength(2);
  expect(blocks[0].spans).toContainEqual({ text: 'news', fontSize: 28, bold: true, italic: true });
  expect(blocks[0].spans.map(span => span.text).join('')).toBe('Big news\nSecond line');
  expect(blocks[1].spans).toEqual([{ text: 'More', underline: true }]);
});

test('plain Markdown, escaped markers, identifiers and entities remain readable', () => {
  expect(publicPlainText('### Apply\n1. Register\n2. Upload\n> Keep your reference')).toBe('Apply\n\n1. Register\n\n2. Upload\n\nKeep your reference');
  expect(publicPlainText('\\*Literal\\* and `**literal**`; account_id_v1; 2 * 3')).toBe('*Literal* and **literal**; account_id_v1; 2 * 3');
  expect(publicPlainText('First &amp; second\n\n&#8377; 200')).toBe('First & second\n\n₹ 200');
  expect(publicPlainText('<style>body{}</style>Visible<script>hidden()</script>')).toBe('Visible');
  const unsafe = publicTextBlocks('[Unsafe](javascript:alert) and <a href="data:text/html,unsafe">hidden scheme</a>');
  expect(unsafe.flatMap(block => block.spans).some(span => span.href)).toBe(false);
});
