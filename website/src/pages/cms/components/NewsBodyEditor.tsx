import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Link2, Underline } from 'lucide-react';
import { escapeNewsText, newsBodyHtml, newsInlineHref, NEWS_TEXT_SIZES } from '@/lib/newsRichText';

/** News-only formatting controls. DOM updates preserve the active selection. */
export function NewsBodyEditor({ value, onChange, disabled = false }: { value: string; onChange: (html: string) => void; disabled?: boolean }) {
    const editor = useRef<HTMLDivElement>(null), selection = useRef<Range | null>(null), emitted = useRef<string | null>(null);
    const [linkOpen, setLinkOpen] = useState(false), [linkUrl, setLinkUrl] = useState(''), [error, setError] = useState('');
    const [size, setSize] = useState('18');
    useEffect(() => {
        if (editor.current && value !== emitted.current) {
            const clean = newsBodyHtml(value);
            if (editor.current.innerHTML !== clean) editor.current.innerHTML = clean;
        }
    }, [value]);
    const remember = () => {
        const current = window.getSelection();
        if (current?.rangeCount && editor.current?.contains(current.getRangeAt(0).commonAncestorContainer)) selection.current = current.getRangeAt(0).cloneRange();
    };
    const restore = () => {
        const box = editor.current;
        if (!box || disabled) return null;
        box.focus();
        const current = window.getSelection();
        if (!current) return null;
        const range = selection.current && box.contains(selection.current.commonAncestorContainer) ? selection.current : document.createRange();
        if (!box.contains(range.commonAncestorContainer)) { range.selectNodeContents(box); range.collapse(false); }
        current.removeAllRanges(); current.addRange(range);
        return range;
    };
    const commit = () => {
        remember();
        const clean = newsBodyHtml(editor.current?.innerHTML || '');
        emitted.current = clean; onChange(clean);
    };
    const command = (name: string) => { if (!restore()) return; document.execCommand(name, false); commit(); };
    const changeSize = (next: string) => {
        const range = restore();
        if (!range || !editor.current) return;
        if (!editor.current.textContent?.trim()) { setError('Type some text, then choose a text size.'); return; }
        if (range.collapsed) range.selectNodeContents(editor.current);
        const span = document.createElement('span'); span.style.fontSize = `${next}px`;
        const selected = range.extractContents();
        selected.querySelectorAll<HTMLElement>('[style]').forEach(node => node.style.removeProperty('font-size'));
        span.appendChild(selected); range.insertNode(span); range.selectNodeContents(span);
        window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range);
        selection.current = range.cloneRange(); setSize(next); setError(''); commit();
    };
    const addLink = () => {
        const href = newsInlineHref(linkUrl);
        if (!href) { setError('Enter a complete https://, http:// or mailto: link.'); return; }
        const range = restore(); if (!range) return;
        if (range.collapsed) document.execCommand('insertHTML', false, `<a href="${escapeNewsText(href)}">${escapeNewsText(href)}</a>`);
        else document.execCommand('createLink', false, href);
        commit(); setLinkOpen(false); setLinkUrl(''); setError('');
    };
    const toolbarButton = 'inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-ui-small text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white disabled:opacity-50';
    return <div className="min-w-0 space-y-3">
        <div role="toolbar" aria-label="Article formatting" className="flex flex-wrap items-center gap-2">
            {[['bold', 'Bold', Bold], ['italic', 'Italic', Italic], ['underline', 'Underline', Underline]].map(([name, label, Glyph]) => {
                const Icon = Glyph as typeof Bold;
                return <button key={String(name)} type="button" aria-label={String(label)} title={String(label)} disabled={disabled} className={toolbarButton}
                    onMouseDown={event => event.preventDefault()} onClick={() => command(String(name))}><Icon size={18} /></button>;
            })}
            <label className="flex min-h-12 max-w-full flex-wrap items-center gap-2 text-ui-small font-semibold">Text size
                <select aria-label="Article text size" value={size} disabled={disabled} onPointerDown={remember} onChange={event => changeSize(event.target.value)} className="min-h-12 min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-2 text-ui-small text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
                    {NEWS_TEXT_SIZES.map(value => <option key={value} value={value}>{value}px{value === 18 ? ' · Normal' : value === 22 ? ' · Large' : ' · Extra large'}</option>)}
                </select>
            </label>
            <button type="button" className={toolbarButton} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => { remember(); setLinkOpen(open => !open); setError(''); }}><Link2 size={18} /><span className="ml-2">Link</span></button>
        </div>
        {linkOpen && <div className="flex flex-wrap items-end gap-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
            <label className="min-w-0 flex-1 basis-52 text-ui-small font-semibold">Link address<input aria-label="Article link URL" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} type="url" placeholder="https://example.org" className="mt-1 block min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-ui-small text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" /></label>
            <button type="button" className={toolbarButton} disabled={disabled} onClick={addLink}>Insert link</button>
            <button type="button" className={toolbarButton} onClick={() => { setLinkOpen(false); setError(''); }}>Cancel link</button>
        </div>}
        {error && <p role="alert" className="text-ui-small text-red-700 dark:text-red-300">{error}</p>}
        <div ref={editor} role="textbox" aria-label="Article body" aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning
            onInput={commit} onMouseUp={remember} onKeyUp={remember} onBlur={remember}
            onPaste={event => { event.preventDefault(); const html = event.clipboardData.getData('text/html'); const plain = event.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, newsBodyHtml(html || plain)); commit(); }}
            onDrop={event => event.preventDefault()}
            className="min-h-80 max-h-[36rem] overflow-y-auto break-words rounded-lg border border-slate-300 bg-white p-4 text-[18px] leading-[1.7] text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-neutral-700 dark:bg-black dark:text-white [&_p]:mb-4 [&_a]:text-blue-700 [&_a]:underline" />
        <p className="text-ui-small leading-relaxed text-slate-600 dark:text-neutral-300">Select text to make it bold, italic, underlined, larger, or a link. With no text selected, text size applies to the whole article. Upload documents in the next section.</p>
    </div>;
}
