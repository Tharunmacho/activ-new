import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { CmsLink } from '@/services/cmsApi';
import { headerNavigationLinks, isZonesNavLink } from '@/components/shared/headerNavigation';
import { CmsField, CmsInput } from './CmsUI';

/** Header entries share one stored order, including the automatic Zones menu. */
export function NavigationLinksEditor({ items, onChange }: {
    items: CmsLink[];
    onChange: (items: CmsLink[]) => void;
}) {
    const links = headerNavigationLinks(items, true);
    const update = (index: number, patch: Partial<CmsLink>) =>
        onChange(links.map((item, i) => i === index ? { ...item, ...patch } : item));
    const move = (index: number, delta: number) => {
        const next = [...links];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };
    const control = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 dark:border-neutral-700 dark:text-neutral-300';
    return <div className="space-y-3" data-navigation-editor>
        <div className="flex justify-end">
            <button type="button" className={`${control} gap-2 px-3 text-ui-caption font-semibold`}
                onClick={() => onChange([...links, { label: '', href: '' }])}>
                <Plus size={16} /> Add nav link
            </button>
        </div>
        {links.map((item, index) => {
            const automatic = isZonesNavLink(item.href);
            const name = item.label || `link ${index + 1}`;
            return <div key={index} data-navigation-entry={automatic ? 'zones' : 'link'}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-950">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-0 text-ui-body font-bold text-slate-900 dark:text-white">{index + 1}. {name}</p>
                    <div className="flex items-center gap-2">
                        <button type="button" className={control} aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                        <button type="button" className={control} aria-label={`Move ${name} down`} disabled={index === links.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                        {!automatic && <button type="button" className={control} aria-label={`Remove ${name}`} onClick={() => {
                            if (window.confirm(`Remove ${name} from the navigation? This takes effect when you save.`)) onChange(links.filter((_, i) => i !== index));
                        }}><Trash2 size={16} /></button>}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <CmsField label="Label"><CmsInput value={item.label} onChange={event => update(index, { label: event.target.value })} placeholder="About" /></CmsField>
                    {automatic ? <div className="flex flex-col justify-center text-ui-caption text-slate-500 dark:text-neutral-400">
                        <p>National, zone and state pages update automatically.</p>
                        <a href="/cms/regions" className="mt-1 w-fit font-semibold text-blue-700 dark:text-blue-400">Edit Zones &amp; States</a>
                    </div> : <CmsField label="Link" hint="A path like /about, or a full https:// address."><CmsInput value={item.href} onChange={event => update(index, { href: event.target.value })} placeholder="/about" /></CmsField>}
                </div>
            </div>;
        })}
    </div>;
}
