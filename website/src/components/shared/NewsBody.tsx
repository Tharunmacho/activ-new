import { createElement, useMemo } from 'react';
import { newsTextNodes, type NewsTextNode } from '@/lib/newsRichText';

export function NewsBody({ text }: { text: string }) {
    const nodes = useMemo(() => newsTextNodes(text), [text]);
    const render = (node: NewsTextNode, key: string): React.ReactNode => node.tag
        ? createElement(node.tag, { key, ...(node.href ? { href: node.href, target: '_blank', rel: 'noopener noreferrer' } : {}), ...(node.size ? { style: { fontSize: node.size } } : {}) },
            node.tag === 'br' ? undefined : (node.children || []).map((child, index) => render(child, `${key}-${index}`)))
        : node.text || '';
    return <div data-news-body className="break-words text-[18px] leading-[1.75] text-gray-700 [&_p]:mb-5 [&_div]:mb-5 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:break-all [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:mb-4 [&_h2]:text-[28px] [&_h2]:font-bold [&_h3]:mb-4 [&_h3]:text-[22px] [&_h3]:font-bold [&_h4]:font-bold [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_pre]:whitespace-pre-wrap">{nodes.map((node, index) => render(node, String(index)))}</div>;
}
