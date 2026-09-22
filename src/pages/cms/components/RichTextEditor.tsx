import { useMemo, useRef } from 'react';

/**
 * ============================================================================
 * A PLAIN TEXT BOX FOR THE FIELDS THAT ARE STORED AS HTML
 * ============================================================================
 *
 * This was a `contentEditable` with a B / I / link toolbar. The association
 * asked for it to go: "editable box don't keep like this in the CMS, that
 * makes it difficult — keep as a simple box so they can type easily, change it
 * wherever this box is."
 *
 * They are right, and the reason is worth writing down. `contentEditable` is
 * uncontrolled by nature, so the box could not be driven from React state the
 * way every other field on these screens is. The caret jumps to the end when
 * anything re-renders, a paste arrives as markup that then has to be stripped,
 * Enter produces a different tag in every browser, and the box looks nothing
 * like the input directly above it. Six fields on four screens behaved unlike
 * the two hundred others.
 *
 * So: an ordinary `<textarea>`, controlled, identical to `CmsTextarea`. The
 * component keeps its name and its props, because five call sites pass it a
 * `value` that is HTML and expect HTML back.
 *
 * ---------------------------------------------------------------- the trade
 *
 * The stored value is still HTML — the public pages render it as HTML and the
 * server sanitises it on the way in. What changed is what the editor types:
 * paragraphs separated by blank lines, and nothing else.
 *
 * WHAT HAPPENS TO FORMATTING THAT IS ALREADY THERE:
 *
 *   - a field nobody touches keeps every tag it has, exactly. See `emit`:
 *     when the text in the box round-trips to the same text the stored HTML
 *     produces, the ORIGINAL HTML is passed through untouched. Opening a page
 *     and pressing Save cannot flatten anything;
 *   - a field that is EDITED is re-serialised from what is in the box, so the
 *     bold that was in it becomes ordinary text. That is the trade the plain
 *     box buys, and it is the one that was asked for.
 *
 * A bare URL on its own is still turned into a link on save, because a URL an
 * editor typed and cannot click is the one piece of formatting they would
 * genuinely miss.
 */

interface Props {
    value: string;
    onChange: (html: string) => void;
    rows?: number;
    placeholder?: string;
}

/** `<` `&` `>` as text, never as markup. React escapes what it prints; this is
 *  what we are about to STORE, and it is read back as HTML. */
const escapeHtml = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * The stored HTML, as the plain text an editor reads and types.
 *
 * Block tags become line breaks, everything else is dropped, and the entities
 * come back as characters. `DOMParser` rather than a regular expression: the
 * value may contain anything the sanitiser allowed, and a regex that strips
 * tags is the one that mangles the first `<` in a sentence.
 */
const htmlToText = (html: string): string => {
    const source = String(html ?? '');
    if (!source) return '';
    // No tags at all: it is already text, and parsing would only cost a DOM.
    if (!/[<&]/.test(source)) return source;

    try {
        const doc = new DOMParser().parseFromString(
            source
                .replace(/<\s*br\s*\/?\s*>/gi, '\n')
                .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
                .replace(/<\s*li[^>]*>/gi, '• '),
            'text/html',
        );
        return (doc.body.textContent || '')
            // Three or more blank lines is never what anybody meant.
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+\n/g, '\n')
            .trim();
    } catch {
        return source;
    }
};

/**
 * Plain text, as the HTML the public pages render.
 *
 * One `<p>` per block of text, blank lines separating them, single line breaks
 * inside a block kept as `<br>` — which is how everybody types an address or a
 * list of names into a box.
 */
const textToHtml = (text: string): string => {
    const clean = String(text ?? '').replace(/\r\n/g, '\n').trim();
    if (!clean) return '';

    const linked = (line: string) => escapeHtml(line).replace(
        /(https?:\/\/[^\s<]+)/g,
        (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
    );

    return clean
        .split(/\n{2,}/)
        .map((block) => `<p>${block.split('\n').map(linked).join('<br>')}</p>`)
        .join('');
};

export default function RichTextEditor({ value, onChange, rows = 5, placeholder }: Props) {
    /*
     * The HTML this box was last shown, and the text it produced.
     *
     * Kept so `emit` can tell "they retyped it" from "they touched nothing" —
     * the difference between re-serialising the field and passing the stored
     * markup through untouched.
     */
    const original = useRef({ html: '', text: '' });

    const text = useMemo(() => {
        const asText = htmlToText(value);
        original.current = { html: String(value ?? ''), text: asText };
        return asText;
    }, [value]);

    const emit = (next: string) => {
        /*
         * UNCHANGED TEXT MEANS UNCHANGED HTML.
         *
         * Without this, simply focusing a field and tabbing out would rewrite
         * `<strong>ACTIV</strong>` as plain text — a silent edit nobody asked
         * for, on a save that was about something else entirely.
         */
        if (next === original.current.text) {
            onChange(original.current.html);
            return;
        }
        onChange(textToHtml(next));
    };

    return (
        <div>
            {/* The same textarea as every other multi-line field on these
                screens — `CmsTextarea`'s classes, deliberately, so this field
                is not the one that looks different. */}
            <textarea
                value={text}
                onChange={(e) => emit(e.target.value)}
                rows={rows}
                placeholder={placeholder}
                className="w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-[#2a2a2a]
                           rounded-lg px-3 py-2 text-[1.25rem] text-slate-900 dark:text-neutral-100
                           placeholder:text-neutral-400 focus:outline-none focus:border-blue-600
                           focus:ring-2 focus:ring-blue-600/30 transition-colors resize-y"
            />

            <p className="mt-1 text-[1.0625rem] text-neutral-500">
                Leave a blank line between paragraphs. A web address becomes a link.
            </p>
        </div>
    );
}
