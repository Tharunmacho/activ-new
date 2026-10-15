import { EMPTY_EVENT_FILTERS, eventDateError, eventFilterOptions, type EventFilters as Filters } from '@/lib/eventFilters';
const control = 'w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-800';
export default function EventFilters({ events, value, onChange }: { events: any[]; value: Filters; onChange: (v: Filters) => void }) {
  const set = (key: keyof Filters, v: string) => onChange({ ...value, [key]: v });
  const error = eventDateError(value.from, value.to);
  return <section aria-label="Event filters" className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <label className="block text-sm font-semibold text-slate-600">Search events<input className={`${control} mt-1`} placeholder="Name, topic or place" value={value.q} onChange={e => set('q', e.target.value)} /></label>
    <details><summary className="cursor-pointer py-2 font-semibold text-blue-800">Filter by language, category, area and date</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(['category', 'language', 'area'] as const).map(key => <label key={key} className="text-sm font-semibold text-slate-600">{key === 'area' ? 'Area / venue' : key[0].toUpperCase() + key.slice(1)}
          <select className={`${control} mt-1`} value={value[key]} onChange={e => set(key, e.target.value)}><option value="">All</option>{eventFilterOptions(events, key).map(v => <option key={v}>{v}</option>)}</select>
        </label>)}
        <label className="text-sm font-semibold text-slate-600">Attendance<select className={`${control} mt-1`} value={value.mode} onChange={e => set('mode', e.target.value)}><option value="">All formats</option><option value="online">Online</option><option value="offline">In person</option></select></label>
        {(['from', 'to'] as const).map(key => <label key={key} className="text-sm font-semibold text-slate-600">{key === 'from' ? 'From date' : 'To date'}<input type="date" className={`${control} mt-1`} value={value[key]} onChange={e => set(key, e.target.value)} /></label>)}
      </div>
      <p role={error ? 'alert' : undefined} className={`mt-3 text-sm ${error ? 'text-red-700' : 'text-slate-500'}`}>{error || 'Includes programmes running during the selected period (India time).'}</p>
    </details>
    {Object.values(value).some(Boolean) && <button type="button" className="min-h-10 font-semibold text-blue-700" onClick={() => onChange({ ...EMPTY_EVENT_FILTERS })}>Clear all filters</button>}
  </section>;
}
