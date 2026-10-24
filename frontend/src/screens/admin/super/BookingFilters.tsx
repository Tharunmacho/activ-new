import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ConsoleCard, GradientButton, PALETTE, PremiumInput, PremiumSelect, PressableScale, SPACE } from '../../../ui';
import { BookingFilterOptions, BookingFiltersValue } from '../../../services/bookingFilters';

export default function BookingFilters({ value, options = {}, onChange }: {
  value: BookingFiltersValue; options?: BookingFilterOptions; onChange: (value: BookingFiltersValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const count = Object.entries(value).filter(([key, v]) => key !== 'history' && v).length;
  const update = (key: keyof BookingFiltersValue, text: string) => setDraft(old => ({ ...old, [key]: text,
    ...(key === 'state' ? { district: '' } : {}), ...(key === 'responseKey' ? { responseValue: '' } : {}) }));
  const select = (key: keyof BookingFiltersValue, label: string, items: (string | { value: string; label: string })[]) => {
    const choices = items.map(item => typeof item === 'string' ? { value: item, label: item } : item);
    return <PremiumSelect key={key} label={label} value={choices.find(item => item.value === draft[key])?.label || 'All'}
      options={['All', ...choices.map(item => item.label)]} onChange={v => update(key, choices.find(item => item.label === v)?.value || '')} />;
  };
  const input = (key: keyof BookingFiltersValue, label: string, date = false) => <PremiumInput key={key} label={label}
    value={draft[key] || ''} onChangeText={v => update(key, v)} placeholder={date ? 'YYYY-MM-DD' : ''} maxLength={date ? 10 : 200}
    autoCapitalize="none" accessibilityLabel={label} />;
  return <ConsoleCard style={s.card}>
    <PressableScale onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel="Booking filters"
      accessibilityState={{ expanded: open }} contentStyle={s.toggle}>
      <Text style={s.heading}>Filters{count ? ` · ${count} active` : ''}</Text><Text style={s.action}>{open ? 'Close' : 'Show'}</Text>
    </PressableScale>
    {open && <View style={s.fields}>
      <Text style={s.group}>Event details · dates in IST</Text>
      {input('eventSearch', 'Event name or venue')}
      {select('category', 'Category', options.categories || [])}{select('language', 'Event language', options.languages || [])}
      {select('mode', 'Attendance mode', [{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }])}
      {select('state', 'Event state / region', options.states || [])}
      {select('district', 'Event district', [...new Set((options.districts || []).filter(d => !draft.state || d.state === draft.state).map(d => d.name))])}
      {input('eventFrom', 'Event date from', true)}{input('eventTo', 'Event date to', true)}
      <Text style={s.group}>Registration details</Text>
      {input('search', 'Name, email, phone or reference')}
      {select('city', 'City / town (registration)', options.cities || [])}
      {select('attendeeState', 'State (registration)', options.attendeeStates || [])}
      {select('registrationType', 'Registration type', [{ value: 'guest', label: 'Guest' }, { value: 'member', label: 'Member' }])}
      {select('paymentStatus', 'Payment status', [{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'not_required', label: 'Free' }, { value: 'failed', label: 'Failed' }])}
      {select('status', 'Booking status', ['active', 'waitlist', 'expired', 'cancelled'].map(v => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })))}
      {input('bookedFrom', 'Booked from (IST)', true)}{input('bookedTo', 'Booked to (IST)', true)}
      {select('responseKey', 'Other registration question', (options.questions || []).map(q => ({ value: q.key, label: q.label })))}
      {!!draft.responseKey && input('responseValue', 'Answer contains')}
      <Text style={s.help}>Only saved registration answers are used. Missing details are never guessed.</Text>
      <GradientButton label="Apply filters" icon="filter-list" onPress={() => { onChange(draft); setOpen(false); }} />
      <GradientButton label="Clear filters" variant="outline" onPress={() => { setDraft({}); onChange({}); }} />
    </View>}
  </ConsoleCard>;
}
const s = StyleSheet.create({
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md }, toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 16, fontWeight: '700', color: PALETTE.text }, action: { fontSize: 13, fontWeight: '700', color: PALETTE.blue },
  fields: { gap: SPACE.sm, paddingTop: SPACE.sm }, group: { color: PALETTE.text, fontSize: 15, fontWeight: '700', marginVertical: SPACE.sm },
  help: { fontSize: 12, lineHeight: 18, color: PALETTE.textMuted, marginBottom: SPACE.sm },
});
