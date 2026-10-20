import { useEffect, useId, useRef, useState } from 'react';
import { Bold, Italic, Link2, Underline, Unlink, X } from 'lucide-react';
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { escapeNewsText, newsBodyHtml, newsInlineHref, NEWS_TEXT_SIZES } from '@/lib/newsRichText';

/** News-only formatting controls. DOM updates preserve the active selection. */
export function NewsBodyEditor({ value, onChange, disabled = false }: { value: string; onChange: (html: string) => void; disabled?: boolean }) {
    const editor = useRef<HTMLDivElement>(null), selection = useRef<Range | null>(null), emitted = useRef<string | null>(null);
    const linkSelection = useRef<Range | null>(null);
    const linkInput = useRef<HTMLInputElement>(null);
    const linkTrigger = useRef<HTMLButtonElement>(null);
    const linkAnchor = useRef({ getBoundingClientRect: () => {
        const box = editor.current?.getBoundingClientRect();
        // Keep the popup beside visible selected text, even when the toolbar has scrolled away.
        const selected = box && Array.from(linkSelection.current?.getClientRects() || []).find(rect =>
            rect.height > 0 && rect.top >= Math.max(0, box.top) && rect.bottom <= Math.min(window.innerHeight, box.bottom));
        return selected || linkTrigger.current?.getBoundingClientRect() || new DOMRect();
    }, get contextElement() { return editor.current || undefined; } });
    const linkTitleId = useId(), linkErrorId = useId();
    const [linkOpen, setLinkOpen] = useState(false), [linkUrl, setLinkUrl] = useState(''), [error, setError] = useState('');
    const [linkText, setLinkText] = useState(''), [selectedText, setSelectedText] = useState(''), [editingLink, setEditingLink] = useState(false);
    const [size, setSize] = useState('18');
    useEffect(() => {
        if (editor.current && value !== emitted.current) {
            const clean = newsBodyHtml(value);
            if (editor.current.innerHTML !== clean) {
                editor.current.innerHTML = clean;
                selection.current = null;
                linkSelection.current = null;
                setLinkOpen(false);
            }
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
    const openLink = (clickedAnchor?: HTMLAnchorElement) => {
        if (disabled || !editor.current) return;
        remember();
        let range = selection.current?.cloneRange() || null;
        const anchorAt = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest('a');
        const anchor = range ? anchorAt(range.startContainer) : null;
        const existing = clickedAnchor || (range && anchor && editor.current.contains(anchor) && anchor === anchorAt(range.endContainer) ? anchor : null);
        // Editing any part of an existing link updates its full label, without nesting links.
        if (existing) {
            range = document.createRange();
            range.selectNodeContents(existing);
        }
        linkSelection.current = range;
        setSelectedText(range?.toString() || '');
        setEditingLink(Boolean(existing));
        setLinkUrl(existing?.getAttribute('href') || '');
        setLinkText('');
        setError('');
        setLinkOpen(true);
    };
    const restoreLink = () => {
        if (linkSelection.current) selection.current = linkSelection.current.cloneRange();
        return restore();
    };
    const cancelLink = () => {
        setLinkOpen(false); setError(''); restoreLink();
    };
    const addLink = () => {
        const href = newsInlineHref(linkUrl);
        if (!href) { setError('Enter a complete https://, http:// or mailto: link.'); return; }
        const range = restoreLink(); if (!range) return;
        if (range.collapsed) document.execCommand('insertHTML', false, `<a href="${escapeNewsText(href)}">${escapeNewsText(linkText.trim() || href)}</a>`);
        else document.execCommand('createLink', false, href);
        commit(); setLinkOpen(false); setLinkUrl(''); setError('');
    };
    const removeLink = () => {
        if (!restoreLink()) return;
        document.execCommand('unlink', false);
        commit(); setLinkOpen(false); setError('');
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
            <Popover open={linkOpen} onOpenChange={open => { if (open) openLink(); else { setLinkOpen(false); setError(''); } }}>
                <PopoverTrigger asChild>
                    <button ref={linkTrigger} type="button" className={toolbarButton} disabled={disabled} title="Add or edit link (Ctrl/Cmd+K)" onMouseDown={event => event.preventDefault()}><Link2 size={18} /><span className="ml-2">Link</span></button>
                </PopoverTrigger>
                <PopoverAnchor virtualRef={linkAnchor} />
                <PopoverContent align="start" sideOffset={8} collisionPadding={12} aria-labelledby={linkTitleId}
                    className="w-[23rem] max-w-[calc(100vw-1.5rem)] space-y-3 rounded-xl border-slate-200 bg-white p-4 text-slate-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                    onOpenAutoFocus={event => { event.preventDefault(); linkInput.current?.focus(); }}
                    onCloseAutoFocus={event => event.preventDefault()}
                    onEscapeKeyDown={cancelLink}
                    onKeyDown={event => { if (event.key === 'Enter' && event.target instanceof HTMLInputElement) { event.preventDefault(); addLink(); } }}>
                    <div className="flex items-center justify-between gap-2">
                        <h3 id={linkTitleId} className="text-ui-body font-semibold">{editingLink ? 'Edit hyperlink' : 'Add hyperlink'}</h3>
                        <button type="button" aria-label="Close link editor" className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-neutral-800" onClick={cancelLink}><X size={18} /></button>
                    </div>
                    {selectedText ? <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-neutral-800">
                        <p className="text-ui-caption text-slate-500 dark:text-neutral-400">Link text</p>
                        <p className="max-h-20 overflow-auto break-words text-ui-small font-medium" data-link-selection>{selectedText}</p>
                    </div> : <label className="block text-ui-small font-semibold">Link text <span className="font-normal text-slate-500 dark:text-neutral-400">(optional)</span>
                        <input aria-label="Article link text" value={linkText} onChange={event => setLinkText(event.target.value)} placeholder="Text to display" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-ui-small font-normal text-slate-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
                    </label>}
                    <label className="block text-ui-small font-semibold">Link address
                        <input ref={linkInput} aria-label="Article link URL" aria-invalid={Boolean(error)} aria-describedby={error ? linkErrorId : undefined} value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setError(''); }} type="url" placeholder="https://example.org" autoComplete="off" spellCheck={false} className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-ui-small font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white" />
                    </label>
                    {error && <p id={linkErrorId} role="alert" className="text-ui-small text-red-700 dark:text-red-300">{error}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className={cn(toolbarButton, 'border-blue-700 bg-blue-700 text-white dark:border-blue-600 dark:bg-blue-600')} disabled={disabled} onClick={addLink}>{editingLink ? 'Save link' : 'Insert link'}</button>
                        <button type="button" className={toolbarButton} onClick={cancelLink}>Cancel</button>
                        {editingLink && <button type="button" className="inline-flex min-h-12 items-center gap-1 rounded-lg px-2 text-ui-small text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-red-300" disabled={disabled} onClick={removeLink}><Unlink size={16} />Remove link</button>}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
        {!linkOpen && error && <p role="alert" className="text-ui-small text-red-700 dark:text-red-300">{error}</p>}
        <div ref={editor} role="textbox" aria-label="Article body" aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning
            onInput={commit} onMouseUp={remember} onKeyUp={remember} onBlur={remember}
            onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openLink(); } }}
            onClick={event => { const anchor = (event.target as Element).closest('a'); if (anchor) { event.preventDefault(); openLink(anchor); } }}
            onPaste={event => { event.preventDefault(); const html = event.clipboardData.getData('text/html'); const plain = event.clipboardData.getData('text/plain'); document.execCommand('insertHTML', false, newsBodyHtml(html || plain)); commit(); }}
            onDrop={event => event.preventDefault()}
            className="min-h-80 max-h-[36rem] overflow-y-auto break-words rounded-lg border border-slate-300 bg-white p-4 text-[18px] leading-[1.7] text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:border-neutral-700 dark:bg-black dark:text-white [&_p]:mb-4 [&_a]:text-blue-700 [&_a]:underline" />
        <p className="text-ui-small leading-relaxed text-slate-600 dark:text-neutral-300">Select text to format it or add a hyperlink. Click an existing link to edit or remove it. With no text selected, text size applies to the whole article. Upload documents in the next section.</p>
    </div>;
}
