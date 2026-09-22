import { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    COUNTRIES,
    DEFAULT_COUNTRY,
    PRIORITY_ISO2,
    countryByIso2,
    countryFromDial,
    flagEmoji,
    type Country,
} from '@/lib/countryCodes';

/**
 * PHONE NUMBER — pick the country, then type the number.
 *
 * The field used to be a plain text input with `+91 XXXXXXXXXX` sitting in the
 * placeholder, which is not a country code: it is a picture of one. It told a
 * member outside India that their number did not belong in the form, and it
 * told the ones inside India nothing they did not know. The country is a real
 * answer now, stored separately from the digits and submitted with them.
 *
 * WHY A HAND-WRITTEN DROPDOWN AND NOT A `<select>`. 246 countries is past the
 * point where scrolling finds anything — the list has to be typeable, and a
 * native `<select>` searches by first letter only, so reaching the United Arab
 * Emirates means knowing it files under U. This filters on the name AND the
 * dialling code, so "971" and "emirates" both land on it. Same reasoning as
 * `ProductCategoryInput` and `RegionInput`; this follows their shape.
 *
 * WHAT IT HANDS BACK. `value` is the national number ONLY — no country code, no
 * plus, digits as typed. The country is `country`, an ISO2 code. Keeping them
 * apart is what lets the dropdown re-render the same number under a different
 * flag without rewriting the digits underneath the cursor. `validateMobile` in
 * `@/lib/phoneNumber` is what turns the pair into something submittable.
 */

const nonDigits = /[^0-9]/g;

/**
 * Does this browser actually draw flag emoji?
 *
 * Windows ships no colour flag font, so `🇮🇳` renders there as the letters "IN"
 * in the middle of a sentence — which looks like a bug rather than like a flag.
 * macOS, iOS and Android draw the real thing. Asking the canvas is the only
 * reliable way to tell: a drawn flag has colour in it, and two letters are
 * drawn in the fill colour, so a pixel whose red and green channels differ
 * means the glyph is a flag.
 *
 * Answered once per page and cached — it cannot change while the tab is open.
 */
let flagSupport: boolean | null = null;
const supportsFlagEmoji = (): boolean => {
    if (flagSupport !== null) return flagSupport;
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            flagSupport = false;
            return flagSupport;
        }
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#000';
        // Canada: solid red on white, so any rendered flag is unmistakably
        // coloured, whereas "CA" is pure black on transparent.
        ctx.fillText(flagEmoji('CA'), 0, 18);
        const { data } = ctx.getImageData(0, 0, 24, 24);
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0 && data[i] !== data[i + 1]) {
                flagSupport = true;
                return flagSupport;
            }
        }
        flagSupport = false;
        return flagSupport;
    } catch {
        // A locked-down canvas (privacy extensions block readback) is not a
        // reason to fail — it just means we use the drawn fallback.
        flagSupport = false;
        return flagSupport;
    }
};

/**
 * The flag, by whichever route this browser supports.
 *
 * Three levels, because each one can genuinely be unavailable: the emoji where
 * it renders, a flag image where it does not, and the ISO code in a chip when
 * the image will not load either. The chip is deliberately a designed object
 * rather than a broken-image icon — a member offline or behind a filter should
 * see a tidy "IN", not a torn page.
 */
function Flag({ iso2, className }: { iso2: string; className?: string }) {
    const [imageFailed, setImageFailed] = useState(false);
    const emoji = supportsFlagEmoji();

    if (emoji) {
        return (
            <span className={cn('text-[1.25rem] leading-none', className)} aria-hidden="true">
                {flagEmoji(iso2)}
            </span>
        );
    }

    if (!imageFailed) {
        return (
            <img
                src={`https://flagcdn.com/w40/${iso2.toLowerCase()}.png`}
                alt=""
                aria-hidden="true"
                loading="lazy"
                width={20}
                height={15}
                onError={() => setImageFailed(true)}
                className={cn('h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10', className)}
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex h-[15px] w-5 shrink-0 items-center justify-center rounded-[2px]',
                'bg-slate-200 text-[8px] font-bold leading-none tracking-tight text-slate-600',
                className,
            )}
        >
            {iso2}
        </span>
    );
}

export interface PhoneInputProps {
    id?: string;
    name?: string;
    /** The national number only — no dialling code, no plus. */
    value: string;
    onChange: (national: string) => void;
    /** ISO 3166-1 alpha-2. */
    country: string;
    onCountryChange: (iso2: string) => void;
    disabled?: boolean;
    autoComplete?: string;
    className?: string;
    placeholder?: string;
    onBlur?: () => void;
}

export function PhoneInput({
    id,
    name,
    value,
    onChange,
    country,
    onCountryChange,
    disabled = false,
    autoComplete = 'tel',
    className,
    placeholder,
    onBlur,
}: PhoneInputProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    // No `!` — the last fallback is a row that is always there.
    const selected = countryByIso2(country) || countryByIso2(DEFAULT_COUNTRY) || COUNTRIES[0];

    /**
     * The rows, in the order they are offered.
     *
     * Unfiltered, the handful of countries the membership actually lives in
     * come first — scrolling past 240 rows to reach India on an Indian form is
     * the thing this avoids. Once there is a query that grouping is dropped:
     * somebody who typed "uni" wants the matches ranked by the match, and a
     * priority list floating India to the top of a search for "united" is the
     * dropdown arguing with them.
     */
    const { rows, priorityCount } = useMemo(() => {
        const q = (query || '').trim().toLowerCase();

        if (!q) {
            const top = PRIORITY_ISO2
                .map((iso) => COUNTRIES.find((c) => c.iso2 === iso))
                .filter((c): c is Country => Boolean(c));
            const topSet = new Set(top.map((c) => c.iso2));
            return {
                rows: [...top, ...COUNTRIES.filter((c) => !topSet.has(c.iso2))],
                priorityCount: top.length,
            };
        }

        // A leading '+' or a run of digits is a dialling code, not a name.
        const digits = q.replace(nonDigits, '');
        const matches = COUNTRIES.filter((c) => {
            const byName = (c.name || '').toLowerCase().includes(q);
            const byIso = (c.iso2 || '').toLowerCase() === q;
            const byDial = digits ? c.dial.startsWith(digits) : false;
            return byName || byIso || byDial;
        });

        // A name that STARTS with the query beats one that merely contains it,
        // so "india" is the first India rather than "British Indian Ocean
        // Territory" winning on alphabetical order.
        matches.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
            const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return a.name.localeCompare(b.name, 'en');
        });

        return { rows: matches, priorityCount: 0 };
    }, [query]);

    useEffect(() => {
        setHighlight(0);
    }, [query]);

    /** Close on an outside click — the panel overlays the rest of the form. */
    useEffect(() => {
        if (!open) return undefined;
        const onDocPointerDown = (event: MouseEvent | TouchEvent) => {
            const node = rootRef.current;
            if (node && event.target instanceof Node && !node.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocPointerDown);
        document.addEventListener('touchstart', onDocPointerDown);
        return () => {
            document.removeEventListener('mousedown', onDocPointerDown);
            document.removeEventListener('touchstart', onDocPointerDown);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setQuery('');
        // Focus the search rather than the list: the list is 246 rows and
        // typing is the only way through it that is not scrolling.
        const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
        // eslint-disable-next-line consistent-return
        return () => window.clearTimeout(timer);
    }, [open]);

    /** Keep the highlighted row in view while the arrows walk the list. */
    useEffect(() => {
        if (!open) return;
        const list = listRef.current;
        const row = list?.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
        row?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const choose = useCallback(
        (iso2: string) => {
            onCountryChange(iso2);
            setOpen(false);
        },
        [onCountryChange],
    );

    const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const row = rows[highlight];
            if (row) choose(row.iso2);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
        }
    };

    /**
     * Typing or pasting a number that carries its own country code switches the
     * country rather than being silently mangled.
     *
     * Somebody pasting `+44 20 7123 4567` has stated their country as clearly
     * as the dropdown could have. Without this the '+' is stripped, the 44 is
     * read as the front of an Indian number, and the field rejects a number
     * that was correct when they pasted it.
     */
    const handleChange = (raw: string) => {
        if (raw.trim().startsWith('+')) {
            const hit = countryFromDial(raw);
            if (hit) {
                const digits = raw.replace(nonDigits, '');
                onCountryChange(hit.iso2);
                onChange(digits.slice(hit.dial.length));
                return;
            }
        }
        onChange(raw.replace(nonDigits, ''));
    };

    const maxDigits = selected.max || 15;

    return (
        <div ref={rootRef} className={cn('relative', className)}>
            <div
                className={cn(
                    // `border-black bg-white`, not the shadcn tokens: that is what
                    // this project's `Input` uses, and a field bordered any
                    // other way reads as a different KIND of control sitting
                    // between Full Name and WhatsApp Number.
                    'flex h-11 w-full items-stretch overflow-hidden rounded-md border border-black bg-white',
                    'ring-offset-background transition-colors',
                    'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                    disabled && 'cursor-not-allowed opacity-50',
                )}
            >
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={open ? listId : undefined}
                    aria-label={`Country code: ${selected.name}, +${selected.dial}`}
                    className={cn(
                        'flex shrink-0 items-center gap-1.5 border-r border-black bg-slate-50 px-3',
                        'text-[1.1875rem] font-medium text-slate-700 transition-colors',
                        'hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100',
                        'disabled:cursor-not-allowed disabled:hover:bg-slate-50',
                    )}
                >
                    <Flag iso2={selected.iso2} />
                    <span className="tabular-nums">+{selected.dial}</span>
                    <ChevronDown
                        className={cn('h-3.5 w-3.5 text-slate-400 transition-transform', open && 'rotate-180')}
                        aria-hidden="true"
                    />
                </button>

                <input
                    id={id}
                    name={name}
                    type="tel"
                    inputMode="tel"
                    autoComplete={autoComplete}
                    disabled={disabled}
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={onBlur}
                    maxLength={maxDigits + 4}
                    placeholder={placeholder || 'X'.repeat(Math.min(selected.min || 10, 12))}
                    className={cn(
                        'min-w-0 flex-1 bg-transparent px-3 text-[1.25rem] text-black md:text-[1.1875rem]',
                        'placeholder:text-gray-500 focus:outline-none',
                        'disabled:cursor-not-allowed',
                    )}
                />
            </div>

            {open && (
                <div
                    className={cn(
                        'absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-slate-200',
                        'bg-white shadow-lg',
                    )}
                >
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onSearchKeyDown}
                            placeholder="Search country or code"
                            aria-label="Search for a country or dialling code"
                            className="w-full bg-transparent text-[1.1875rem] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                    </div>

                    <div
                        ref={listRef}
                        id={listId}
                        role="listbox"
                        aria-label="Country"
                        className="max-h-64 overflow-y-auto overscroll-contain py-1"
                    >
                        {rows.length === 0 && (
                            <p className="px-3 py-6 text-center text-[1.1875rem] text-slate-500">
                                No country matches “{query}”.
                            </p>
                        )}

                        {rows.map((row, index) => (
                            <div key={row.iso2}>
                                {/*
                                    The line under the shortlist. Without it the
                                    top group reads as the list being in a
                                    random order rather than as a shortlist.
                                */}
                                {priorityCount > 0 && index === priorityCount && (
                                    <div className="my-1 border-t border-slate-100" role="presentation" />
                                )}
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={row.iso2 === selected.iso2}
                                    data-index={index}
                                    onMouseEnter={() => setHighlight(index)}
                                    onClick={() => choose(row.iso2)}
                                    className={cn(
                                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[1.1875rem] transition-colors',
                                        index === highlight ? 'bg-blue-50' : 'bg-transparent',
                                    )}
                                >
                                    <Flag iso2={row.iso2} />
                                    <span className="min-w-0 flex-1 truncate text-slate-700">{row.name}</span>
                                    <span className="shrink-0 tabular-nums text-slate-400">+{row.dial}</span>
                                    {row.iso2 === selected.iso2 && (
                                        <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PhoneInput;
