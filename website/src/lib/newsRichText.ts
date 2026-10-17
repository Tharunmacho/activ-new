export type NewsTextNode = { text?: string; tag?: string; children?: NewsTextNode[]; href?: string; size?: 18 | 22 | 28 };
export const NEWS_TEXT_SIZES = [18, 22, 28] as const;
const blocks = new Set(['p', 'div', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'h4', 'pre', 'code']);
const allowed = new Set([...blocks, 'span', 'strong', 'em', 'u', 'a', 'br']);
const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'head', 'meta', 'link', 'base', 'form', 'input', 'button', 'textarea', 'img', 'video', 'audio']);

export function newsInlineHref(value: string): string {
    const raw = String(value || '').trim();
    if (!raw || /[\u0000-\u0020\\]/.test(raw)) return '';
    try { const url = new URL(raw); return /^(https?:|mailto:)$/.test(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

const text = (value: string): NewsTextNode => ({ text: value });
const plainNodes = (value: string): NewsTextNode[] => value.replace(/\r\n?/g, '\n').split(/\n{2,}/).map(paragraph => ({
    tag: 'p', children: paragraph.split('\n').flatMap((line, index) => index ? [{ tag: 'br' }, text(line)] : [text(line)]),
}));

/** Parse inert HTML into a small data tree. No source attributes reach React. */
export function newsTextNodes(value: string): NewsTextNode[] {
    const source = String(value || '');
    if (!source) return [];
    if (!/<\/?[a-z][a-z\d]*\b[^>]*>/i.test(source)) return plainNodes(source);
    if (typeof DOMParser === 'undefined') return plainNodes(source);
    const document = new DOMParser().parseFromString(source, 'text/html');
    const walk = (node: Node, depth = 0): NewsTextNode[] => {
        if (node.nodeType === 3) return [text(node.textContent || '')];
        if (node.nodeType !== 1) return [];
        const element = node as Element;
        const rawTag = element.tagName.toLowerCase();
        if (blocked.has(rawTag)) return [];
        if (depth > 40) return [text(element.textContent || '')];
        const children = Array.from(element.childNodes).flatMap(child => walk(child, depth + 1));
        const tag = ({ b: 'strong', i: 'em', h1: 'h2', h5: 'h4', h6: 'h4', font: 'span' } as Record<string, string>)[rawTag] || rawTag;
        if (!allowed.has(tag)) return children;
        const result: NewsTextNode = { tag, children };
        if (tag === 'a') { const href = newsInlineHref(element.getAttribute('href') || ''); if (!href) return children; result.href = href; }
        const style = (element as HTMLElement).style?.fontSize || '';
        const match = /^(18|22|28)px$/.exec(style);
        if (match && tag !== 'br') {
            const size = Number(match[1]) as 18 | 22 | 28;
            if (tag === 'span') result.size = size;
            else result.children = [{ tag: 'span', size, children }];
        }
        return [result];
    };
    return Array.from(document.body.childNodes).flatMap(node => walk(node));
}

export const escapeNewsText = (value: string) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function newsBodyHtml(value: string): string {
    const serialize = (node: NewsTextNode): string => {
        if (!node.tag) return escapeNewsText(node.text || '');
        if (node.tag === 'br') return '<br>';
        const attributes = (node.href ? ` href="${escapeNewsText(node.href)}" target="_blank" rel="noopener noreferrer"` : '')
            + (node.size ? ` style="font-size:${node.size}px"` : '');
        return `<${node.tag}${attributes}>${(node.children || []).map(serialize).join('')}</${node.tag}>`;
    };
    return newsTextNodes(value).map(serialize).join('');
}
