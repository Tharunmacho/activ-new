import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Link2, Link2Off, Eraser, Code2 } from 'lucide-react';

/**
 * A small formatting editor for the fields stored as HTML.
 *
 * The About body and each bullet were raw `<textarea>`s: to make a phrase bold
 * an admin had to type `<strong>` around it and know that was the right tag.
 * This gives them a toolbar instead.
 *
 * Deliberately not a library. TipTap or Quill would add ~100 KB to a bundle
 * that already warns about its size, to provide tables and images and
 * collaborative cursors that these two fields cannot store. The toolbar here
 * offers exactly what the server's whitelist accepts — bold, italic, a link —
 * so there is no button that produces markup the backend then strips, which is
 * the most confusing thing a rich editor can do.
 *
 * `contentEditable` is uncontrolled by nature: writing React state back into it
 * on every keystroke moves the caret to the end. So the DOM owns the text while
 * the field has focus, and `value` is only pushed in when it differs from what
 * is already there — which happens on load and after a save returns the
 * server's sanitised copy.
 */

interface Props {
    value: string;
    onChange: (html: string) => void;
    rows?: number;
    placeholder?: string;
}

export default function RichTextEditor({ value, onChange, rows = 5, placeholder }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [showSource, setShowSource] = useState(false);
    const [focused, setFocused] = useState(false);

    // Push `value` in only when it genuinely differs, so typing is not
    // interrupted by a re-render putting the caret back at the start.
    useEffect(() => {
        const el = ref.current;
        if (!el || showSource) return;
        if (el.innerHTML !== value) el.innerHTML = value || '';
    }, [value, showSource]);

    const emit = () => {
        if (ref.current) onChange(ref.current.innerHTML);
    };

    /**
     * `execCommand` is deprecated but not replaced.
     *
     * Every browser still implements it, and the alternative — hand-rolling
     * Selection and Range manipulation — is materially more code and more bugs
     * for the same three commands. Revisit if a browser actually removes it.
     */
    const run = (command: string, arg?: string) => {
        ref.current?.focus();
        try {
            document.execCommand(command, false, arg);
        } catch {
            // A command the browser refuses is not worth an error; the editor
            // stays usable and the admin can use the source view instead.
        }
        emit();
    };

    const addLink = () => {
        const selection = window.getSelection()?.toString();
        if (!selection) {
            window.alert('Select the words you want to turn into a link first.');
            return;
        }
        const href = window.prompt('Link to:', 'https://');
        if (!href) return;
        run('createLink', href);
    };

    const Btn = ({ onClick, title, children }: {
        onClick: () => void; title: string; children: React.ReactNode;
    }) => (
        <button
            type="button"
            // `onMouseDown` with preventDefault, not `onClick`: a click would
            // blur the editable area first and the selection would be gone by
            // the time the command ran.
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            title={title}
            aria-label={title}
            className="p-1.5 rounded text-slate-600 dark:text-neutral-300
                       hover:bg-slate-200 dark:hover:bg-[#242424] transition-colors"
        >
            {children}
        </button>
    );

    return (
        <div
            className={`rounded-lg border transition-colors ${
                focused
                    ? 'border-blue-600 ring-2 ring-blue-600/30'
                    : 'border-slate-300 dark:border-[#2a2a2a]'
            }`}
        >
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200
                            dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#1a1a1a] rounded-t-lg">
                <Btn onClick={() => run('bold')} title="Bold"><Bold size={15} /></Btn>
                <Btn onClick={() => run('italic')} title="Italic"><Italic size={15} /></Btn>

                <span className="w-px h-4 bg-slate-300 dark:bg-[#242424] mx-1" />

                <Btn onClick={addLink} title="Add link"><Link2 size={15} /></Btn>
                <Btn onClick={() => run('unlink')} title="Remove link"><Link2Off size={15} /></Btn>

                <span className="w-px h-4 bg-slate-300 dark:bg-[#242424] mx-1" />

                <Btn onClick={() => run('removeFormat')} title="Clear formatting"><Eraser size={15} /></Btn>

                {/* Kept because the sanitiser is the authority on what survives:
                    when a paste comes out unexpectedly, seeing the markup is the
                    only way to understand why. */}
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setShowSource(v => !v); }}
                    title={showSource ? 'Back to formatted view' : 'Edit the HTML directly'}
                    className={`ml-auto p-1.5 rounded transition-colors ${
                        showSource
                            ? 'bg-blue-600 text-white'
                            : 'text-neutral-500 hover:bg-slate-200 dark:hover:bg-[#242424]'
                    }`}
                >
                    <Code2 size={15} />
                </button>
            </div>

            {showSource ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={rows}
                    spellCheck={false}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    className="w-full bg-slate-50 dark:bg-black px-3 py-2 text-xs font-mono
                               text-slate-900 dark:text-neutral-100 rounded-b-lg focus:outline-none resize-y"
                />
            ) : (
                <div
                    ref={ref}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    onInput={emit}
                    onBlur={() => { setFocused(false); emit(); }}
                    onFocus={() => setFocused(true)}
                    // Paste as plain text: pasting from a word processor
                    // otherwise brings a page of inline styles that the server
                    // strips anyway, so what is stored would not match what the
                    // editor showed.
                    onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text/plain');
                        document.execCommand('insertText', false, text);
                        emit();
                    }}
                    data-placeholder={placeholder || ''}
                    style={{ minHeight: `${rows * 1.6}rem` }}
                    className="w-full bg-slate-50 dark:bg-black px-3 py-2 text-sm rounded-b-lg
                               text-slate-900 dark:text-neutral-100 focus:outline-none overflow-y-auto
                               [&_strong]:font-bold [&_b]:font-bold [&_em]:italic [&_i]:italic
                               [&_a]:text-blue-600 [&_a]:underline
                               [&:empty]:before:content-[attr(data-placeholder)]
                               [&:empty]:before:text-neutral-400 [&:empty]:before:pointer-events-none"
                />
            )}

            <p className="px-3 py-1.5 text-[11px] text-neutral-500 border-t border-slate-200 dark:border-[#1f1f1f]">
                Bold, italic and links are kept. Anything else is removed when saved.
            </p>
        </div>
    );
}
