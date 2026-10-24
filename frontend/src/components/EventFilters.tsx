import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PremiumInput, PremiumSelect, SurfaceCard, PALETTE, SPACE } from '../ui';
import { EMPTY_EVENT_FILTERS, eventDateError, eventFilterOptions, EventFilters as Filters } from '../utils/eventFilters';

export default function EventFilters({ events, value, onChange, search = true }: {
  events: any[]; value: Filters; onChange: (value: Filters) => void; search?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const set = (key: keyof Filters, v: string) => onChange({ ...value, [key]: v });
  const count = Object.entries(value).filter(([key, v]) => key !== 'q' && !!v).length;
  const error = eventDateError(value.from, value.to);
  return <SurfaceCard style={s.card}>
    {search && <PremiumInput label="Search events" value={value.q} onChangeText={v => set('q', v)} placeholder="Name, topic or place" />}
    <View style={s.row}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.button}>
        <Text style={s.title}>Filters{count ? ` (${count})` : ''} {open ? '−' : '+'}</Text>
      </Pressable>
      {(count > 0 || !!value.q) && <Pressable onPress={() => onChange({ ...EMPTY_EVENT_FILTERS })} accessibilityRole="button" style={s.button}><Text style={s.clear}>Clear all</Text></Pressable>}
    </View>
    {open && <View style={s.fields}>
      {(['category', 'language', 'area'] as const).map(key => <PremiumSelect key={key}
        label={key === 'area' ? 'Area / venue' : key[0].toUpperCase() + key.slice(1)} value={value[key]}
        options={eventFilterOptions(events, key)} placeholder={`All ${key === 'category' ? 'categories' : key === 'area' ? 'areas' : 'languages'}`}
        onChange={v => set(key, v)} />)}
      <PremiumSelect label="Attendance" value={value.mode === 'online' ? 'Online' : value.mode === 'offline' ? 'In person' : ''}
        options={['Online', 'In person']} placeholder="All formats" onChange={v => set('mode', v === 'Online' ? 'online' : v ? 'offline' : '')} />
      <View style={s.row}>{(['from', 'to'] as const).map(key => <View key={key} style={s.date}>
        <PremiumInput label={key === 'from' ? 'From date' : 'To date'} value={value[key]} onChangeText={v => set(key, v)} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} />
      </View>)}</View>
      <Text style={error ? s.error : s.hint}>{error || 'Choose either or both dates. Includes programmes running during this period (India time).'}</Text>
    </View>}
  </SurfaceCard>;
}
const s = StyleSheet.create({ card: { marginVertical: SPACE.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  button: { minHeight: 44, justifyContent: 'center' }, title: { color: PALETTE.text, fontSize: 16, fontWeight: '700' }, clear: { color: PALETTE.blue, fontWeight: '700' },
  fields: { gap: 10 }, date: { flex: 1, minWidth: 130 }, hint: { color: PALETTE.textMuted, fontSize: 12, lineHeight: 18 }, error: { color: '#B91C1C', fontSize: 13 } });
