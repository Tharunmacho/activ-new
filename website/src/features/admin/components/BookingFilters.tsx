import { useEffect, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { ADMIN_INPUT, ADMIN_PRIMARY_BTN, ADMIN_SECONDARY_BTN } from './AdminUI';

export type BookingFiltersValue = Partial<Record<'category' | 'language' | 'mode' | 'state' | 'district' | 'city' | 'attendeeState'
    | 'eventFrom' | 'eventTo' | 'bookedFrom' | 'bookedTo' | 'paymentStatus' | 'status' | 'registrationType'
    | 'responseKey' | 'responseValue' | 'search' | 'eventSearch', string>>;
export const BOOKING_FILTER_KEYS = ['category', 'language', 'mode', 'state', 'district', 'city', 'attendeeState',
    'eventFrom', 'eventTo', 'bookedFrom', 'bookedTo', 'paymentStatus', 'status', 'registrationType',
    'responseKey', 'responseValue', 'search', 'eventSearch'];
export interface BookingFilterOptions {
    categories?: string[]; languages?: string[]; states?: string[]; cities?: string[]; attendeeStates?: string[];
    districts?: { state: string; name: string }[]; questions?: { key: string; label: string }[];
}
export default function BookingFilters({ value, options = {}, onChange }: {
    value: BookingFiltersValue; options?: BookingFilterOptions; onChange: (value: BookingFiltersValue) => void;
}) {
    const [draft, setDraft] = useState(value);
    useEffect(() => setDraft(value), [value]);
    const count = Object.values(value).filter(Boolean).length;
    const update = (key: keyof BookingFiltersValue, v: string) => setDraft(old => ({ ...old, [key]: v,
        ...(key === 'state' ? { district: '' } : {}), ...(key === 'responseKey' ? { responseValue: '' } : {}) }));
    const control = `${ADMIN_INPUT} min-w-0 font-sans font-medium`;
    const select = (key: keyof BookingFiltersValue, label: string, items: (string | { value: string; label: string })[]) => (
        <label className="min-w-0 text-ui-small font-semibold text-slate-600" key={key}>{label}
            <select aria-label={label} className={control + ' mt-1.5'} value={draft[key] || ''} onChange={e => update(key, e.target.value)}>
                <option value="">All</option>{items.map(item => {
                    const v = typeof item === 'string' ? item : item.value;
                    return <option key={v} value={v}>{typeof item === 'string' ? item : item.label}</option>;
                })}
            </select>
        </label>
    );
    const input = (key: keyof BookingFiltersValue, label: string, type = 'text') => (
        <label className="min-w-0 text-ui-small font-semibold text-slate-600" key={key}>{label}
            <input aria-label={label} type={type} value={draft[key] || ''} onChange={e => update(key, e.target.value)}
                className={control + ' mt-1.5'} maxLength={200} />
        </label>
    );
    return <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 py-3 text-ui-body font-bold text-slate-800">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" /> Filters
            {!!count && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-ui-caption text-blue-700">{count} active</span>}
            <ChevronDown className="ml-auto h-4 w-4" />
        </summary>
        <form className="space-y-5 border-t border-slate-100 p-4" onSubmit={e => { e.preventDefault(); onChange(draft); }}>
            <fieldset><legend className="mb-3 text-ui-caption font-semibold text-slate-900">Event details · dates in IST</legend>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {input('eventSearch', 'Event name or venue')}
                    {select('category', 'Category', options.categories || [])}
                    {select('language', 'Event language', options.languages || [])}
                    {select('mode', 'Attendance mode', [{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }])}
                    {select('state', 'Event state / region', options.states || [])}
                    {select('district', 'Event district', [...new Set((options.districts || []).filter(d => !draft.state || d.state === draft.state).map(d => d.name))].sort())}
                    {input('eventFrom', 'Event date from', 'date')}{input('eventTo', 'Event date to', 'date')}
                </div>
            </fieldset>
            <fieldset><legend className="mb-3 text-ui-caption font-semibold text-slate-900">Registration details</legend>
                <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {input('search', 'Name, email, phone or booking reference')}
                    {select('city', 'City / town (registration)', options.cities || [])}
                    {select('attendeeState', 'State (registration)', options.attendeeStates || [])}
                    {select('registrationType', 'Registration type', [{ value: 'guest', label: 'Guest' }, { value: 'member', label: 'Member' }])}
                    {select('paymentStatus', 'Payment status', [{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'not_required', label: 'Free' }, { value: 'failed', label: 'Failed' }])}
                    {select('status', 'Booking status', ['active', 'waitlist', 'expired', 'cancelled'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })))}
                    {input('bookedFrom', 'Booked from (IST)', 'date')}{input('bookedTo', 'Booked to (IST)', 'date')}
                    {select('responseKey', 'Other registration question', (options.questions || []).map(q => ({ value: q.key, label: q.label })))}
                    {draft.responseKey && input('responseValue', 'Answer contains')}
                </div>
                <p className="mt-3 text-ui-caption leading-relaxed text-slate-500">City, state and other answers use information saved on the registration form. Missing details are never guessed.</p>
            </fieldset>
            <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={() => { setDraft({}); onChange({}); }} className={ADMIN_SECONDARY_BTN}>Clear filters</button>
                <button type="submit" className={ADMIN_PRIMARY_BTN}>Apply filters</button>
            </div>
        </form>
    </details>;
}
