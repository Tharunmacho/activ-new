import { type ReactNode, useMemo, useState, useId } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Inbox, Loader2 } from 'lucide-react';
import { ADMIN_CARD, ADMIN_INPUT } from './AdminUI';

/**
 * The admin area's data table.
 *
 * WHY THIS EXISTS. Every admin screen that shows rows had grown its own table:
 * its own header weights, its own empty state, its own "no results" wording, its
 * own pager or none at all. Individually fine; together they made four screens
 * that do the same job read as four different products, and the two newest —
 * the booking list and the category list — would have been the fifth and sixth.
 *
 * It is modelled on the reference tables the association supplied: a tinted
 * header row in small bold capitals, a serial column, sortable headings, a
 * search box and a page-size control above, and "Showing 1 to 10 of 34 entries"
 * below. The treatment only — the type, the spacing and the controls come from
 * `AdminUI`, so this table is the same product as the cards around it.
 *
 * =========================================================================
 * SORTING AND PAGING HAPPEN HERE ONLY WHEN THE DATA IS ALL HERE
 * =========================================================================
 *
 * `rows` is the WHOLE set for a client-side table (categories, attendees) and
 * this component sorts, filters and pages it. For a server-paged table
 * (bookings, which the server already filters and pages), pass `serverPaged`
 * and the pager below becomes a readout of the server's own numbers with the
 * controls wired to your callbacks.
 *
 * Getting that backwards is the failure worth naming: a client-side sort over
 * ONE PAGE of a server-paged set silently sorts ten of forty rows and presents
 * it as the sorted list. The `serverPaged` flag makes a table declare which it
 * is rather than leaving it to whoever reads the call site.
 */

export interface AdminColumn<T> {
    /** Stable key. Also the sort key unless `sortValue` is given. */
    key: string;
    header: ReactNode;
    /** The cell. */
    render: (row: T, index: number) => ReactNode;
    /**
     * What to sort and search this column by. Omit to make the column neither.
     *
     * A STRING OR A NUMBER, never the rendered node: sorting by JSX compares
     * object references, which is stable, meaningless, and looks exactly like a
     * sort that is not working.
     */
    sortValue?: (row: T) => string | number;
    /** Column width class, e.g. `w-20`. */
    width?: string;
    align?: 'left' | 'right' | 'center';
    /** Hide below `sm`. For a column that is context rather than content. */
    hideOnMobile?: boolean;
    /**
     * PIN THIS COLUMN TO THE RIGHT EDGE while the rest of the table scrolls
     * under it.
     *
     * For the Action column, and effectively only for that. These tables are
     * deliberately wider than the pane — eight columns of 16px text do not fit
     * in 1100px and squeezing them to fit is what turns an email address into
     * four stacked lines — so the row scrolls sideways. Without pinning, the
     * button that opens the row is the FIRST thing off the right edge, and the
     * one control every row exists to offer has to be hunted for.
     */
    sticky?: 'right';
}

export interface AdminTableProps<T> {
    rows: T[];
    columns: AdminColumn<T>[];
    /** React key per row. Falls back to the index, which is only safe while nothing reorders. */
    rowKey: (row: T, index: number) => string;

    loading?: boolean;
    /** Shown in place of the rows when there are none at all. */
    empty?: ReactNode;
    /** Shown when a search matches nothing. Distinct from `empty` on purpose. */
    emptyFiltered?: ReactNode;

    /** A search box above the table, filtering on every column's `sortValue`. */
    searchable?: boolean;
    searchPlaceholder?: string;

    /** The "records per page" control. `0` shows every row and hides the pager. */
    pageSize?: number;
    pageSizeOptions?: number[];

    /** Anything to put beside the search box — an Add button, filter chips. */
    toolbar?: ReactNode;

    /**
     * The rows came from the server already filtered, sorted and paged.
     *
     * Supply the server's own figures and handlers; this component then renders
     * the controls and reports clicks rather than doing any of it itself.
     */
    serverPaged?: {
        page: number;
        pages: number;
        total: number;
        limit: number;
        onPage: (page: number) => void;
        onLimit?: (limit: number) => void;
    };

    /** The minimum width the table needs before it scrolls sideways. */
    minWidth?: string;
    /** Row click, for a table whose rows open something. */
    onRowClick?: (row: T) => void;
    /** A footer strip under the pager — a totals row, a note. */
    footer?: ReactNode;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

/**
 * The pinned right-hand column.
 *
 * The hairline is drawn with `shadow` rather than `border-l`, because a border
 * is part of the cell and would show even when the table is not scrolled —
 * reading as a stray rule beside the last column. A shadow says "there is more
 * to the left of me", which is exactly the fact it is there to report.
 *
 * `bg-inherit` on the BODY cells, set at the call site: `background-color` is
 * not an inherited property, so a sticky cell over scrolling content is
 * transparent and the rows slide visibly through it. `inherit` resolves to the
 * `<tr>`'s own background, which keeps the zebra striping and the hover state
 * intact without restating either.
 */
const STICKY_RIGHT = 'sticky right-0 z-10 shadow-[-8px_0_12px_-8px_rgba(16,24,40,0.18)]';

/**
 * The header cell.
 *
 * `text-[0.8125rem] font-semibold uppercase tracking-wider` — the reference tables'
 * heading exactly, and the one place in the admin area that shouts. A heading
 * row in sentence case at the same weight as the data reads as a first row of
 * results rather than as the names of the columns.
 */
function HeadCell({ children, sortable, direction, onSort, width, align = 'left', hideOnMobile, sticky }: {
    children: ReactNode;
    sortable: boolean;
    direction: 'asc' | 'desc' | null;
    onSort: () => void;
    width?: string;
    align?: 'left' | 'right' | 'center';
    hideOnMobile?: boolean;
    sticky?: 'right';
}) {
    /*
     * 13px, not 11px.
     *
     * The first version set these at `text-[0.8125rem]` — small capitals are
     * already hard to read, and at 11px against 16px body text the heading row
     * read as a caption rather than as the names of the columns. 13px bold
     * capitals is the smallest size that still reads as a heading beside the
     * business area's 16px labels, which is the scale this table now sits in.
     */
    const base = `px-5 py-4 text-[1.0625rem] sm:text-[1rem] font-semibold uppercase tracking-wider
                  text-slate-500 whitespace-nowrap ${ALIGN[align]} ${width || ''}
                  ${hideOnMobile ? 'hidden sm:table-cell' : ''}
                  ${sticky === 'right' ? STICKY_RIGHT + ' bg-slate-50' : ''}`;

    if (!sortable) return <th scope="col" className={base}>{children}</th>;

    return (
        <th
            scope="col"
            className={base}
            /*
             * `aria-sort` on the CELL, not on the button. It is the column that
             * is sorted; a screen reader announces the state as it moves across
             * the header row, which is where the information is useful.
             */
            aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
        >
            <button
                type="button"
                onClick={onSort}
                className={`inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors
                            ${align === 'right' ? 'flex-row-reverse' : ''}`}
            >
                {children}
                {direction === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                    : direction === 'desc' ? <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                        : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />}
            </button>
        </th>
    );
}

export function AdminTable<T>({
    rows,
    columns,
    rowKey,
    loading = false,
    empty = 'Nothing here yet.',
    emptyFiltered,
    searchable = false,
    searchPlaceholder = 'Search',
    pageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    toolbar,
    serverPaged,
    minWidth,
    onRowClick,
    footer,
}: AdminTableProps<T>) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [limit, setLimit] = useState(pageSize);
    const [page, setPage] = useState(1);
    const searchId = useId();

    const client = !serverPaged;

    /* ------------------------------------------------------------ filter */

    const filtered = useMemo(() => {
        if (!client || !query.trim()) return rows;
        const needle = query.trim().toLowerCase();

        return rows.filter((row) =>
            columns.some((column) => {
                if (!column.sortValue) return false;
                // `String(...)` on a number too — searching "100" against a
                // seat count is the most natural thing to type into this box.
                return String(column.sortValue(row) ?? '').toLowerCase().includes(needle);
            }));
    }, [rows, columns, query, client]);

    /* -------------------------------------------------------------- sort */

    const sorted = useMemo(() => {
        if (!client || !sort) return filtered;
        const column = columns.find((c) => c.key === sort.key);
        // Hoisted to a local, so the comparator below closes over a value TS has
        // already narrowed. Reading `column.sortValue` inside the callback needs
        // a `!` to compile — the narrowing does not survive the closure — and the
        // house rule is that a `!` is never the answer.
        const valueOf = column?.sortValue;
        if (!valueOf) return filtered;

        // A COPY. `Array.prototype.sort` mutates, and mutating the `rows` prop
        // reorders the caller's own state behind its back — which shows up as a
        // list that has quietly rearranged itself after an unrelated re-render.
        const copy = [...filtered];
        const direction = sort.direction === 'asc' ? 1 : -1;

        copy.sort((a, b) => {
            const left = valueOf(a);
            const right = valueOf(b);

            // Numbers compared as numbers. Compared as strings, 100 sorts before
            // 20, which on a seat-count column reads as a broken sort.
            if (typeof left === 'number' && typeof right === 'number') {
                return (left - right) * direction;
            }
            return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
                numeric: true, sensitivity: 'base',
            }) * direction;
        });

        return copy;
    }, [filtered, sort, columns, client]);

    /* -------------------------------------------------------------- page */

    const total = serverPaged ? serverPaged.total : sorted.length;
    const perPage = serverPaged ? serverPaged.limit : limit;
    const pages = serverPaged ? serverPaged.pages : Math.max(1, Math.ceil(total / (perPage || 1)));
    /*
     * Clamped to the last page that exists.
     *
     * Deleting the only row on page 3 leaves the pager pointing at a page that
     * is gone: the table renders empty beside "Showing 21 to 30 of 18 entries",
     * which reads as data loss rather than as a stale page number. The same trap
     * the bookings screen fixed by resetting the page on a filter change.
     */
    const current = serverPaged ? serverPaged.page : Math.min(page, pages);

    const visible = useMemo(() => {
        if (serverPaged || !perPage) return sorted;
        return sorted.slice((current - 1) * perPage, current * perPage);
    }, [sorted, current, perPage, serverPaged]);

    const from = total === 0 ? 0 : (current - 1) * (perPage || total) + 1;
    const to = perPage ? Math.min(current * perPage, total) : total;

    const goTo = (next: number) => {
        const clamped = Math.min(Math.max(1, next), pages);
        if (serverPaged) serverPaged.onPage(clamped);
        else setPage(clamped);
    };

    const setPerPage = (next: number) => {
        if (serverPaged) serverPaged.onLimit?.(next);
        else { setLimit(next); setPage(1); }
    };

    const toggleSort = (key: string) => {
        setSort((previous) => {
            if (previous?.key !== key) return { key, direction: 'asc' };
            // asc -> desc -> unsorted. The third press restores the order the
            // rows arrived in, which is the only way back to it.
            if (previous.direction === 'asc') return { key, direction: 'desc' };
            return null;
        });
        setPage(1);
    };

    const showPager = (perPage > 0 && (pages > 1 || total > 0));
    const filtering = client && !!query.trim();

    return (
        <div className={`${ADMIN_CARD} overflow-hidden`}>

            {/* ------------------------------------------------------ toolbar */}
            {(searchable || toolbar || (client && pageSizeOptions.length > 1)) && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5
                                border-b border-slate-100">
                    {client && perPage > 0 && (
                        <label className="flex items-center gap-2 text-[1.25rem] text-slate-500 shrink-0">
                            <select
                                value={perPage}
                                onChange={(e) => setPerPage(Number(e.target.value))}
                                className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-[1.25rem]
                                           font-semibold text-slate-800 outline-none
                                           focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                            >
                                {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="whitespace-nowrap">per page</span>
                        </label>
                    )}

                    {searchable && (
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[1.125rem] h-[1.125rem]
                                               text-slate-400" />
                            <input
                                id={searchId}
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                className={`${ADMIN_INPUT} pl-11`}
                            />
                        </div>
                    )}

                    {toolbar && <div className="flex flex-wrap gap-2 shrink-0">{toolbar}</div>}
                </div>
            )}

            {/* -------------------------------------------------------- table */}
            <div className="overflow-x-auto">
                <table
                    className="w-full text-left border-collapse"
                    style={minWidth ? { minWidth } : undefined}
                >
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {columns.map((column) => (
                                <HeadCell
                                    key={column.key}
                                    sortable={client && !!column.sortValue}
                                    direction={sort?.key === column.key ? sort.direction : null}
                                    onSort={() => toggleSort(column.key)}
                                    width={column.width}
                                    align={column.align}
                                    hideOnMobile={column.hideOnMobile}
                                    sticky={column.sticky}
                                >
                                    {column.header}
                                </HeadCell>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={columns.length} className="px-5 py-20 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                                    <p className="mt-4 text-[1.25rem] font-semibold text-slate-500">Loading…</p>
                                </td>
                            </tr>
                        )}

                        {!loading && !visible.length && (
                            <tr>
                                <td colSpan={columns.length} className="px-5 py-20 text-center">
                                    <Inbox className="w-12 h-12 text-slate-300 mx-auto" />
                                    <div className="mt-4 text-[1.25rem] font-semibold text-slate-500
                                                    max-w-md mx-auto leading-relaxed">
                                        {/*
                                          "Nothing matches" and "nothing here" are
                                          different situations and only one of them
                                          is worth acting on. One message for both
                                          tells an admin their event has no
                                          bookings when in fact their search has a
                                          typo in it.
                                        */}
                                        {filtering ? (emptyFiltered || `Nothing matches “${query.trim()}”.`) : empty}
                                    </div>
                                </td>
                            </tr>
                        )}

                        {!loading && visible.map((row, index) => (
                            <tr
                                key={rowKey(row, index)}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                /*
                                 * The stripe and the hover both live HERE, on
                                 * the row, so the pinned cell's `bg-inherit`
                                 * picks up whichever is current. Putting the
                                 * hover on the cells instead would leave the
                                 * pinned one a different colour from the row it
                                 * belongs to.
                                 */
                                className={`border-b border-slate-100 last:border-0 transition-colors
                                            ${index % 2 === 1 ? 'bg-slate-50' : 'bg-white'}
                                            hover:bg-blue-50
                                            ${onRowClick ? 'cursor-pointer' : ''}`}
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        /* 16px and a taller row: the business
                                           forms set every label at 16px, and a
                                           14px table beside them is what made
                                           the admin area read as the thinner
                                           half of the same product. */
                                        className={`px-5 py-4 text-[1.25rem] text-slate-700 align-middle
                                                    ${ALIGN[column.align || 'left']}
                                                    ${column.hideOnMobile ? 'hidden sm:table-cell' : ''}
                                                    ${column.sticky === 'right'
                                                        ? `${STICKY_RIGHT} bg-inherit` : ''}`}
                                    >
                                        {/*
                                          The row's own index within the PAGE plus
                                          the page offset, so S.No reads 11..20 on
                                          page two rather than restarting at 1.
                                        */}
                                        {column.render(row, (current - 1) * (perPage || 0) + index)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {footer}

            {/* -------------------------------------------------------- pager */}
            {showPager && !loading && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3
                                px-5 py-4 border-t border-slate-100 bg-slate-50/60">
                    <p className="text-[1.25rem] text-slate-500">
                        Showing <span className="font-semibold text-slate-800">{from}</span> to{' '}
                        <span className="font-semibold text-slate-800">{to}</span> of{' '}
                        <span className="font-semibold text-slate-800">{total}</span>{' '}
                        {total === 1 ? 'entry' : 'entries'}
                    </p>

                    {pages > 1 && (
                        <div className="flex items-center gap-1">
                            <PagerButton onClick={() => goTo(current - 1)} disabled={current <= 1}>
                                ← Previous
                            </PagerButton>

                            {pageNumbers(current, pages).map((n, i) =>
                                n === '…' ? (
                                    <span key={`gap-${i}`} className="px-2 text-[1.1875rem] text-slate-400">…</span>
                                ) : (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => goTo(n as number)}
                                        aria-current={n === current ? 'page' : undefined}
                                        className={`h-11 min-w-11 px-3.5 rounded-xl text-[1.25rem] font-semibold
                                                    transition-colors ${n === current
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        {n}
                                    </button>
                                ))}

                            <PagerButton onClick={() => goTo(current + 1)} disabled={current >= pages}>
                                Next →
                            </PagerButton>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PagerButton({ children, onClick, disabled }: {
    children: ReactNode; onClick: () => void; disabled: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-[1.25rem] font-semibold
                       text-slate-600 transition-colors hover:bg-slate-50
                       disabled:opacity-40 disabled:hover:bg-white"
        >
            {children}
        </button>
    );
}

/**
 * The page numbers to draw: first, last, and a window around the current one.
 *
 * A table of 34 events at 10 a page is four buttons and needs no elision; the
 * attendee list of a 400-seat conclave is forty, and forty buttons is a second
 * scroll bar under the first.
 */
function pageNumbers(current: number, pages: number): (number | '…')[] {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

    const out: (number | '…')[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(pages - 1, current + 1);

    if (from > 2) out.push('…');
    for (let n = from; n <= to; n += 1) out.push(n);
    if (to < pages - 1) out.push('…');
    out.push(pages);

    return out;
}

/**
 * A status pill — the coloured cell the reference tables use for Paid, Online,
 * Active. One implementation so the same status is the same colour everywhere.
 */
export function AdminChip({ tone = 'slate', children, title }: {
    tone?: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'slate';
    children: ReactNode;
    title?: string;
}) {
    const TONES = {
        emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
        rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
        blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
        violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
        slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    } as const;

    return (
        <span
            title={title}
            /* `rounded-full`, 14px — the business area's `Chip`. A pill reads
               as a status; a small rounded rectangle reads as a button. */
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[1.1875rem] font-semibold
                        ring-1 ring-inset whitespace-nowrap ${TONES[tone] || TONES.slate}`}
        >
            {children}
        </span>
    );
}

/**
 * A number in a table cell, set the way the reference tables set them: a solid
 * tinted block rather than plain text, so a row of counts is read across in one
 * pass instead of one cell at a time.
 */
export function AdminCount({ tone = 'slate', children }: {
    tone?: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'slate';
    children: ReactNode;
}) {
    const TONES = {
        emerald: 'bg-emerald-500/90 text-white',
        amber: 'bg-amber-500/90 text-white',
        rose: 'bg-rose-500/90 text-white',
        blue: 'bg-blue-600/90 text-white',
        violet: 'bg-violet-500/90 text-white',
        slate: 'bg-slate-400/90 text-white',
    } as const;

    return (
        <span className={`inline-flex items-center justify-center min-w-[3.25rem] px-3 py-1.5 rounded-xl
                          text-[1.25rem] font-bold tabular-nums ${TONES[tone] || TONES.slate}`}>
            {children}
        </span>
    );
}

/** A small square action button — the eye / pencil / bin row in the reference. */
export function AdminIconButton({ tone = 'blue', title, onClick, disabled, children }: {
    tone?: 'blue' | 'emerald' | 'rose' | 'slate' | 'amber';
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    const TONES = {
        blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100',
        rose: 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100',
        amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100',
        slate: 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200',
    } as const;

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            className={`w-11 h-11 rounded-xl border inline-flex items-center justify-center
                        transition-colors disabled:opacity-40 ${TONES[tone] || TONES.blue}`}
        >
            {children}
        </button>
    );
}
