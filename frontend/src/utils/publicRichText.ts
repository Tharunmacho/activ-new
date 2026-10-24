/** CMS fields contain plain text, editor HTML, and Markdown. Keep the supported
 * formatting as native text; never execute HTML or load a document to read it. */
export type PublicTextSpan = { text: string; bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: number; code?: boolean; href?: string };
export type PublicTextBlock = { kind: 'paragraph' | 'heading' | 'quote' | 'list' | 'code'; spans: PublicTextSpan[]; marker?: string };

function entities(value: string): string {
  return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, raw) => {
      const code = /^x/i.test(raw) ? parseInt(raw.slice(1), 16) : Number(raw);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    });
}

/** Native text only: preserve the news editor's small formatting vocabulary.
 * Unknown tags cannot execute code, load resources or supply arbitrary styles. */
function htmlTextBlocks(value: string, preserveLines = false, parseMarkdown = true): PublicTextBlock[] {
  type Format = Omit<PublicTextSpan, 'text'>;
  type Frame = { tag: string; format: Format; kind?: PublicTextBlock['kind']; marker?: string; count?: number };
  const source = value.replace(/<(script|style|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const blocks: PublicTextBlock[] = [], stack: Frame[] = [];
  let spans: PublicTextSpan[] = [], kind: PublicTextBlock['kind'] = 'paragraph', marker: string | undefined;
  const format = () => stack[stack.length - 1]?.format || {};
  const flush = () => {
    while (spans[0] && !spans[0].text.trim()) spans.shift();
    while (spans.length && !spans[spans.length - 1].text.trim()) spans.pop();
    if (spans.length) blocks.push({ kind, spans, ...(marker ? { marker } : {}) });
    spans = [];
  };
  const append = (text: string) => {
    const inherited = format();
    const clean = entities(text).replace(/\r\n?/g, '\n');
    const textValue = inherited.code ? clean : clean.replace(preserveLines ? /[\t\r ]+/g : /[\t\r\n ]+/g, ' ');
    const next = inherited.code || !parseMarkdown ? [{ text: textValue, ...inherited }] : publicInline(textValue, inherited);
    for (const span of next) {
      if (!span.text) continue;
      const last = spans[spans.length - 1];
      if (last && ['bold', 'italic', 'underline', 'fontSize', 'code', 'href'].every(key => last[key as keyof PublicTextSpan] === span[key as keyof PublicTextSpan])) last.text += span.text;
      else spans.push({ ...span });
    }
  };
  for (const token of source.match(/<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</g) || []) {
    if (!token.startsWith('<') || token === '<') { append(token); continue; }
    const match = /^<\s*(\/?)\s*([a-z][a-z\d]*)\b([^>]*)>/i.exec(token);
    if (!match) continue;
    const closing = !!match[1], tag = match[2].toLowerCase();
    if (closing) {
      let index = stack.length - 1;
      while (index >= 0 && stack[index].tag !== tag) index--;
      if (index < 0) continue;
      if (stack[index].kind) flush();
      stack.splice(index);
      const parent = [...stack].reverse().find(frame => frame.kind);
      kind = parent?.kind || 'paragraph'; marker = parent?.marker;
      continue;
    }
    if (tag === 'br') { spans.push({ text: '\n', ...format() }); continue; }
    if (['img', 'hr', 'input', 'meta', 'link', 'source', 'embed'].includes(tag)) { if (tag === 'hr') flush(); continue; }
    const attrs: Record<string, string> = {};
    for (const attr of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1].toLowerCase()] = entities(attr[2] ?? attr[3] ?? attr[4] ?? '');
    const next: Format = { ...format() };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (tag === 'code' || tag === 'pre') next.code = true;
    if (tag === 'a' && /^(\/[^/]|https?:\/\/|mailto:|tel:)/i.test(attrs.href || '') && !/[\u0000-\u0020\u007f\\]/.test(attrs.href || '')) next.href = attrs.href;
    if (tag === 'span') {
      const size = /(?:^|;)\s*font-size\s*:\s*(18|22|28)px\s*(?:;|$)/i.exec(attrs.style || '');
      if (size) next.fontSize = Number(size[1]);
    }
    const blockKind: PublicTextBlock['kind'] | undefined = /^h[1-6]$/.test(tag) ? 'heading' : tag === 'blockquote' ? 'quote' : tag === 'li' ? 'list' : tag === 'pre' ? 'code' : ['p', 'div'].includes(tag) ? 'paragraph' : undefined;
    let blockMarker: string | undefined;
    if (blockKind) {
      flush(); kind = blockKind;
      if (tag === 'li') {
        const list = [...stack].reverse().find(frame => frame.tag === 'ol' || frame.tag === 'ul');
        if (list?.tag === 'ol') { list.count = (list.count || 0) + 1; blockMarker = list.count + '.'; }
        else blockMarker = '\u2022';
      }
      marker = blockMarker;
    }
    if (!/\/\s*>$/.test(token)) stack.push({ tag, format: next, ...(blockKind ? { kind: blockKind, marker: blockMarker } : {}), ...(['ol', 'ul'].includes(tag) ? { count: 0 } : {}) });
  }
  flush();
  return blocks;
}

export function publicInline(value: string, inherited: Omit<PublicTextSpan, 'text'> = {}, depth = 0): PublicTextSpan[] {
  if (depth > 8) return [{ text: value, ...inherited }];
  const spans: PublicTextSpan[] = [];
  let plain = '';
  const flush = () => { if (plain) { spans.push({ text: plain, ...inherited }); plain = ''; } };
  for (let i = 0; i < value.length;) {
    if (value[i] === '\\' && /[\\`*_\[\]#>~]/.test(value[i + 1] || '')) { plain += value[i + 1]; i += 2; continue; }
    const rest = value.slice(i);
    const link = /^!?\[([^\]]+)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/.exec(rest);
    if (link) {
      flush();
      // Images already have dedicated CMS media fields; retain their alt text.
      spans.push(...publicInline(link[1], { ...inherited, ...(rest[0] === '!' ? {} : { href: link[2] }) }, depth + 1));
      i += link[0].length; continue;
    }
    const token = rest.startsWith('***') ? '***' : rest.startsWith('**') ? '**' : rest.startsWith('__') ? '__' : /^[*_`]/.test(rest) ? rest[0] : '';
    // An underscore inside an identifier and a spaced multiplication sign are text.
    const wordBoundary = token !== '_' && token !== '__' || i === 0 || !/[\p{L}\p{N}]/u.test(value[i - 1]);
    if (token && wordBoundary && rest[token.length] && !/\s/.test(rest[token.length])) {
      const end = value.indexOf(token, i + token.length);
      if (end > i + token.length && !/\s/.test(value[end - 1])) {
        flush();
        const inside = value.slice(i + token.length, end);
        if (token === '`') spans.push({ text: inside, ...inherited, code: true });
        else spans.push(...publicInline(inside, { ...inherited, ...(token.length >= 2 ? { bold: true } : {}), ...(token.length !== 2 ? { italic: true } : {}) }, depth + 1));
        i = end + token.length; continue;
      }
    }
    plain += value[i++];
  }
  flush();
  return spans;
}

/** Parse Markdown once, preserving inline HTML across emphasis boundaries.
 * Tags are shielded from Markdown so underscores/asterisks inside hrefs and
 * attributes cannot rewrite a destination. Code contents stay literal text. */
function markdownInline(value: string): PublicTextSpan[] {
  const tags: string[] = [];
  let prefix = '\uFFF0ACTIV';
  while (value.includes(prefix)) prefix += '_';
  const protectedValue = value.replace(/<code\b[^>]*>[\s\S]*?<\/code\s*>|<(?:[^>"']|"[^"]*"|'[^']*')*>/gi, tag => `${prefix}${tags.push(tag) - 1}\uFFF1`);
  const restore = (text: string) => text.replace(new RegExp(prefix + '(\\d+)\\uFFF1', 'g'), (match, index) => tags[Number(index)] ?? match);
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const formatted = publicInline(protectedValue).map(span => {
    let text = restore(span.text);
    if (span.code) text = `<code>${escape(text)}</code>`;
    if (span.bold) text = `<strong>${text}</strong>`;
    if (span.italic) text = `<em>${text}</em>`;
    if (span.href) text = `<a href="${escape(restore(span.href))}">${text}</a>`;
    return text;
  }).join('');
  return htmlTextBlocks(formatted, true, false).flatMap(block => block.spans);
}

export function publicTextBlocks(value: unknown): PublicTextBlock[] {
  const source = String(value ?? '');
  // Inline HTML is also legal within Markdown. Only actual block HTML opts
  // into HTML whitespace rules; code examples never select that parser.
  const outsideCode = source.replace(/```[\s\S]*?(?:```|$)|`[^`\n]*`/g, '');
  if (/<\/?(?:p|div|h[1-6]|blockquote|ul|ol|li|pre)\b[^>]*>/i.test(outsideCode)) return htmlTextBlocks(source);
  const blocks: PublicTextBlock[] = [];
  let paragraph: string[] = [], code: string[] | null = null;
  const flush = () => { if (paragraph.length) { const spans = markdownInline(paragraph.join('\n')); if (spans.length) blocks.push({ kind: 'paragraph', spans }); paragraph = []; } };
  for (const line of source.replace(/\r\n?/g, '\n').trim().split('\n')) {
    if (/^\s*```/.test(line)) { flush(); if (code) { blocks.push({ kind: 'code', spans: [{ text: code.join('\n'), code: true }] }); code = null; } else code = []; continue; }
    if (code) { code.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = /^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?$/.exec(line);
    const quote = /^\s*>\s?(.*)$/.exec(line);
    const list = /^\s*(?:([-+*•])|(\d+)[.)])\s+(.+)$/.exec(line);
    if (heading || quote || list) {
      flush();
      blocks.push({ kind: heading ? 'heading' : quote ? 'quote' : 'list', spans: markdownInline(heading?.[1] ?? quote?.[1] ?? list![3]), ...(list ? { marker: list[2] ? list[2] + '.' : '•' } : {}) });
    } else if (/^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$/.test(line)) flush();
    else paragraph.push(line.trim());
  }
  if (code) blocks.push({ kind: 'code', spans: [{ text: code.join('\n'), code: true }] });
  flush();
  return blocks;
}

export const publicPlainText = (value: unknown): string => publicTextBlocks(value)
  .map(block => (block.marker ? block.marker + ' ' : '') + block.spans.map(span => span.text).join('')).join('\n\n').trim();
