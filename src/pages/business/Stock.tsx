import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
    Boxes, AlertTriangle, Search, Loader2, Plus, Minus, History,
    Package, Check, X,
} from 'lucide-react';
import BusinessPageShell from './BusinessPageShell';
import { EmptyState, RowsSkeleton, StatTile } from '@/features/member/components/MemberUI';
import { useActiveCompanyStore } from '@/contexts/ActiveCompanyContext';
import { apiFetch, errorMessage } from '@/services/activApi';
import {
    adjustStock, listStockMovements, setProductPublished,
    type StockMovement, type StockReason,
} from '@/services/memberHubApi';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * Stock management (BUS-002).
 *
 * The screen is built around the one thing a member actually does with stock:
 * change a number, quickly, several times a day, usually against a delivery
 * note. So the adjustment is inline on the row — an expandable panel, never a
 * dialog — and it takes a reason, because a stock figure with no history cannot
 * distinguish a delivery from a typo after the fact.
 *
 * The minimum-stock threshold is per line and lives here rather than on the
 * product form. It is a stock decision, not a catalogue one, and a member
 * reviewing what needs reordering is exactly the person who knows what "low"
 * means for each line.
 */

interface StockRow {
    _id: string;
    name: string;
    category?: string;
    imageUrl?: string;
    price?: number;
    stock?: number;
    minStock?: number;
    isActive?: boolean;
}

const REASONS: { value: StockReason; label: string }[] = [
    { value: 'restock', label: 'Stock received' },
    { value: 'sale', label: 'Sold' },
    { value: 'damage', label: 'Damaged or lost' },
    { value: 'return', label: 'Returned' },
    { value: 'correction', label: 'Correcting the number' },
    { value: 'other', label: 'Other' },
];

/**
 * The one place a stock level becomes a word, mirroring `stockState` on the
 * server. The comparison is `<=` in both — a `<` here would list a line as low
 * that the warning count had not counted.
 */
const stockState = (row: StockRow): 'ok' | 'low' | 'out' => {
    const stock = Number(row.stock || 0);
    const minimum = Number(row.minStock || 0);

    if (stock <= 0) return 'out';
    if (minimum > 0 && stock <= minimum) return 'low';
    return 'ok';
};

const STATE_STYLE = {
    ok: { label: 'In stock', cls: 'text-emerald-700 bg-emerald-50' },
    low: { label: 'Low', cls: 'text-amber-700 bg-amber-50' },
    out: { label: 'Out of stock', cls: 'text-red-700 bg-red-50' },
} as const;

export default function Stock() {
    const { activeCompanyId } = useActiveCompanyStore();

    const [rows, setRows] = useState<StockRow[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
    const [openRow, setOpenRow] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const path = activeCompanyId
                ? `/products?companyId=${encodeURIComponent(activeCompanyId)}`
                : '/products';

            const [productsResponse, history] = await Promise.all([
                apiFetch(path),
                listStockMovements({ limit: 20 }).catch(() => [] as StockMovement[]),
            ]);

            const payload = await productsResponse.json().catch(() => null);
            const list = Array.isArray(payload?.data) ? payload.data : [];

            setRows(list);
            setMovements(history || []);
            setError('');
        } catch (err) {
            setError(errorMessage(err, 'Could not load your catalogue'));
        } finally {
            setLoading(false);
        }
    }, [activeCompanyId]);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => {
        const all = rows || [];
        return {
            total: all.length,
            low: all.filter((row) => stockState(row) === 'low').length,
            out: all.filter((row) => stockState(row) === 'out').length,
            value: all.reduce(
                (sum, row) => sum + Number(row.stock || 0) * Number(row.price || 0), 0),
        };
    }, [rows]);

    const visible = useMemo(() => {
        const term = (query || '').trim().toLowerCase();

        return (rows || []).filter((row) => {
            const state = stockState(row);
            if (filter === 'low' && state !== 'low') return false;
            if (filter === 'out' && state !== 'out') return false;
            if (!term) return true;

            return [row.name, row.category].some((field) => (field || '').toLowerCase().includes(term));
        });
    }, [rows, query, filter]);

    const FILTERS: { key: 'all' | 'low' | 'out'; label: string; count: number }[] = [
        { key: 'all', label: 'All lines', count: counts.total },
        { key: 'low', label: 'Low', count: counts.low },
        { key: 'out', label: 'Out', count: counts.out },
    ];

    return (
        <BusinessPageShell
            title="Stock"
            subtitle="What you have on hand, and what needs reordering"
            width="standard"
        >
            <div className="space-y-5">
                {/* ---------- at a glance ---------- */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <StatTile label="Lines" value={counts.total} icon={<Package className="w-4 h-4" />} />
                    <StatTile
                        label="Low stock"
                        value={counts.low}
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone={counts.low > 0 ? 'warn' : 'neutral'}
                    />
                    <StatTile
                        label="Out of stock"
                        value={counts.out}
                        icon={<AlertTriangle className="w-4 h-4" />}
                        tone={counts.out > 0 ? 'warn' : 'neutral'}
                    />
                    <StatTile
                        label="Stock value"
                        value={`₹${Math.round(counts.value).toLocaleString('en-IN')}`}
                        hint="At list price"
                        icon={<Boxes className="w-4 h-4" />}
                    />
                </div>

                {/* ---------- filters ---------- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search your catalogue"
                            className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                       focus:border-blue-400"
                        />
                    </div>

                    {/* A responsive flex row so all three fit at every width. */}
                    <div className="flex gap-1.5">
                        {FILTERS.map(({ key, label, count }) => {
                            const active = filter === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFilter(key)}
                                    className={`flex-1 min-w-0 px-2 py-2 rounded-xl text-[12.5px] font-semibold
                                                inline-flex items-center justify-center gap-1.5
                                                transition-colors ${
                                        active
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <span className="truncate">{label}</span>
                                    <span className={`shrink-0 text-[10.5px] font-bold px-1.5 rounded-full ${
                                        active ? 'bg-white/25' : 'bg-white text-slate-600'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ---------- the lines ---------- */}
                {loading ? (
                    <RowsSkeleton rows={5} />
                ) : error ? (
                    <EmptyState icon={<Boxes className="w-6 h-6" />} title="Stock could not be loaded" detail={error} />
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={<Boxes className="w-6 h-6" />}
                        title={rows.length === 0 ? 'Nothing in your catalogue yet' : 'Nothing matches that'}
                        detail={
                            rows.length === 0
                                ? 'Add a product or service and its stock level appears here.'
                                : 'Try a different search, or switch back to all lines.'
                        }
                    />
                ) : (
                    <div className="space-y-2.5">
                        {visible.map((row) => (
                            <StockCard
                                key={row._id}
                                row={row}
                                open={openRow === row._id}
                                onToggle={() => setOpenRow(openRow === row._id ? null : row._id)}
                                onChanged={load}
                            />
                        ))}
                    </div>
                )}

                {/* ---------- history ---------- */}
                {movements.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <History className="w-4 h-4 text-slate-400" /> Recent adjustments
                        </h2>
                        <p className="text-[12.5px] text-slate-500 mt-0.5 mb-4">
                            Every change, and the reason given for it.
                        </p>

                        <ul className="divide-y divide-slate-100">
                            {movements.map((movement) => (
                                <li key={movement.id} className="py-2.5 flex items-center gap-3 text-[13px]">
                                    <span className={`shrink-0 w-14 text-right font-bold tabular-nums ${
                                        movement.delta > 0 ? 'text-emerald-600' : 'text-red-600'
                                    }`}>
                                        {movement.delta > 0 ? '+' : ''}{movement.delta}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium text-slate-800 truncate">
                                            {movement.productName || 'Product'}
                                        </span>
                                        <span className="block text-[11.5px] text-slate-400 truncate">
                                            {REASONS.find((r) => r.value === movement.reason)?.label || movement.reason}
                                            {movement.note ? ` — ${movement.note}` : ''}
                                        </span>
                                    </span>

                                    <span className="shrink-0 text-[11.5px] text-slate-400 tabular-nums">
                                        {movement.at ? new Date(movement.at).toLocaleDateString('en-GB') : ''}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </div>
        </BusinessPageShell>
    );
}

// ---------------------------------------------------------------- row

/**
 * One line, with its adjustment panel.
 *
 * The panel is an inline expandable card and not a dialog — the member area's
 * rule throughout, and the right shape here regardless: the member is looking
 * at the row they are adjusting and a dialog would cover it.
 */
function StockCard({
    row,
    open,
    onToggle,
    onChanged,
}: {
    row: StockRow;
    open: boolean;
    onToggle: () => void;
    onChanged: () => void;
}) {
    const [delta, setDelta] = useState('');
    const [reason, setReason] = useState<StockReason>('restock');
    const [note, setNote] = useState('');
    const [minimum, setMinimum] = useState(String(row.minStock || 0));
    const [working, setWorking] = useState(false);

    const state = stockState(row);
    const style = STATE_STYLE[state];
    const image = resolveMediaUrl(row.imageUrl);

    const apply = async (signed: number) => {
        if (!signed) {
            toast.error('Enter how many to add or remove');
            return;
        }

        setWorking(true);
        try {
            const result = await adjustStock(row._id, { delta: signed, reason, note });
            toast.success(`${row.name} — now ${result.stock} in stock`);
            setDelta('');
            setNote('');
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not adjust the stock'));
        } finally {
            setWorking(false);
        }
    };

    /**
     * The threshold is saved through the product endpoint, not the stock one.
     *
     * `POST /products/:id/stock` moves a level and logs a movement; the minimum
     * is a setting, not a movement, and recording "changed the threshold" as a
     * stock adjustment of zero would corrupt the history it is there to keep.
     */
    const saveMinimum = async () => {
        const value = Math.max(0, Math.round(Number(minimum) || 0));

        setWorking(true);
        try {
            const response = await apiFetch(`/products/${row._id}`, {
                method: 'PUT',
                body: JSON.stringify({ minStock: value }),
            });

            if (!response.ok) throw new Error('Could not save the threshold');

            toast.success(value > 0
                ? `You will be warned below ${value}`
                : 'This line will no longer be flagged as low');
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not save the threshold'));
        } finally {
            setWorking(false);
        }
    };

    const togglePublished = async () => {
        setWorking(true);
        try {
            const result = await setProductPublished(row._id, !row.isActive);
            toast.success(result.isActive ? 'Published' : 'Unpublished — hidden from other members');
            onChanged();
        } catch (err) {
            toast.error(errorMessage(err, 'Could not change whether this is published'));
        } finally {
            setWorking(false);
        }
    };

    return (
        <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-colors ${
            open ? 'border-blue-400' : 'border-slate-200'
        }`}>
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            >
                {image ? (
                    <img src={image} alt="" loading="lazy"
                        className="w-11 h-11 rounded-lg object-cover shrink-0 bg-slate-100" />
                ) : (
                    <span className="w-11 h-11 rounded-lg bg-slate-100 text-slate-400 shrink-0
                                     flex items-center justify-center">
                        <Package className="w-5 h-5" />
                    </span>
                )}

                <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-slate-900 truncate">
                        {row.name}
                    </span>
                    <span className="block text-[12px] text-slate-500 truncate">
                        {row.category}
                        {row.isActive === false ? ' · Unpublished' : ''}
                    </span>
                </span>

                <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold text-slate-900 tabular-nums leading-none">
                        {Number(row.stock || 0)}
                    </span>
                    <span className={`inline-block mt-1 text-[10.5px] font-bold uppercase tracking-wide
                                      px-2 py-0.5 rounded-full ${style.cls}`}>
                        {style.label}
                    </span>
                </span>
            </button>

            {open ? (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/60">
                    {/* ---- adjust ---- */}
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                            Adjust stock
                        </p>

                        <div className="flex flex-wrap gap-2">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={delta}
                                onChange={(e) => setDelta(e.target.value)}
                                placeholder="Quantity"
                                className="w-28 h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white
                                           focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                           focus:border-blue-400"
                            />

                            <select
                                value={reason}
                                onChange={(e) => setReason(e.target.value as StockReason)}
                                className="flex-1 min-w-[150px] h-11 px-3 rounded-xl border border-slate-200
                                           text-sm bg-white focus:outline-none focus:ring-2
                                           focus:ring-blue-500/30 focus:border-blue-400"
                            >
                                {REASONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>

                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Note (optional) — invoice number, who took it"
                            className="w-full h-11 px-3 mt-2 rounded-xl border border-slate-200 text-sm bg-white
                                       focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                       focus:border-blue-400"
                        />

                        <div className="flex gap-2 mt-2">
                            <button
                                type="button"
                                disabled={working}
                                onClick={() => apply(Math.abs(Math.round(Number(delta) || 0)))}
                                className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-[13px] font-bold
                                           hover:bg-emerald-700 disabled:opacity-60 transition-colors
                                           inline-flex items-center justify-center gap-1.5"
                            >
                                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add
                            </button>
                            <button
                                type="button"
                                disabled={working}
                                onClick={() => apply(-Math.abs(Math.round(Number(delta) || 0)))}
                                className="flex-1 h-11 rounded-xl bg-slate-700 text-white text-[13px] font-bold
                                           hover:bg-slate-800 disabled:opacity-60 transition-colors
                                           inline-flex items-center justify-center gap-1.5"
                            >
                                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
                                Remove
                            </button>
                        </div>
                    </div>

                    {/* ---- threshold ---- */}
                    <div className="pt-3 border-t border-slate-200">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                            Warn me below
                        </p>

                        <div className="flex gap-2">
                            <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={minimum}
                                onChange={(e) => setMinimum(e.target.value)}
                                className="w-28 h-11 px-3 rounded-xl border border-slate-200 text-sm bg-white
                                           focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                           focus:border-blue-400"
                            />
                            <button
                                type="button"
                                disabled={working}
                                onClick={saveMinimum}
                                className="px-4 h-11 rounded-xl border border-slate-200 bg-white text-[13px]
                                           font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60
                                           inline-flex items-center gap-1.5"
                            >
                                <Check className="w-4 h-4" /> Save
                            </button>
                        </div>

                        <p className="text-[11.5px] text-slate-400 mt-1.5">
                            Zero means this line is never flagged as low.
                        </p>
                    </div>

                    {/* ---- publish (BUS-001) ---- */}
                    <div className="pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            disabled={working}
                            onClick={togglePublished}
                            className="inline-flex items-center gap-1.5 text-[13px] font-semibold
                                       text-slate-600 hover:text-slate-900 disabled:opacity-60"
                        >
                            {row.isActive === false ? (
                                <><Check className="w-4 h-4" /> Publish to the directory</>
                            ) : (
                                <><X className="w-4 h-4" /> Unpublish — hide from other members</>
                            )}
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
