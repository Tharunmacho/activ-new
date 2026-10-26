import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, SPACE, PremiumInput } from '../../../ui';
import { useRegionTreeAll } from './superKit';

export type UpdateRegion = { state: string; district: string; block: string };
export const updateRegionLabel = (region: UpdateRegion) => [region.state, region.district, region.block].filter(Boolean).join(' / ');
const keyOf = (region: UpdateRegion) => [region.state, region.district, region.block].map(part => part.trim().toLowerCase()).join('|');
const covers = (outer: UpdateRegion, inner: UpdateRegion) => outer.state === inner.state && (!outer.district || outer.district === inner.district && (!outer.block || outer.block === inner.block));

/** Whole states, whole districts or individual blocks; each chosen path is complete. */
export default function UpdateRegionPicker({ value, onChange, disabled }: { value: UpdateRegion[]; onChange: (value: UpdateRegion[]) => void; disabled: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const tree = useRegionTreeAll();
  const [open, setOpen] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const toggleOpen = (key: string) => setOpen(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const toggle = (region: UpdateRegion) => {
    if (value.some(item => keyOf(item) === keyOf(region))) onChange(value.filter(item => keyOf(item) !== keyOf(region)));
    else if (!value.some(item => covers(item, region))) onChange([...value.filter(item => !covers(region, item)), region]);
  };
  const row = (region: UpdateRegion, title: string, expandable = false) => {
    const key = keyOf(region);
    const selected = value.some(item => covers(item, region));
    const inherited = selected && !value.some(item => keyOf(item) === key);
    return <View key={key} style={s.row}>
      <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={updateRegionLabel(region)} accessibilityState={{ checked: selected, disabled: disabled || inherited }} disabled={disabled || inherited} onPress={() => toggle(region)} style={s.pick}>
        <Icon name={selected ? 'check-box' : 'check-box-outline-blank'} size={23} color={inherited ? PALETTE.textMuted : PALETTE.indigo} />
        <Text style={s.name}>{title}</Text>
      </TouchableOpacity>
      {expandable && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${open.includes(key) ? 'Hide' : 'Show'} areas in ${title}`} accessibilityState={{ expanded: open.includes(key) }} onPress={() => toggleOpen(key)} style={s.expand}><Icon name={open.includes(key) ? 'expand-less' : 'expand-more'} size={24} color={PALETTE.indigo} /></TouchableOpacity>}
    </View>;
  };
  const needle = query.trim().toLowerCase();
  return <View style={s.wrap}>
    <Text style={s.hint}>Tick multiple states, districts or blocks. Selecting a whole state includes all of its districts and blocks.</Text>
    <PremiumInput tone="admin" label="Find a region" value={query} onChangeText={setQuery} placeholder="Search state, district or block" />
    {!tree.length && <Text style={s.hint}>Region options are not available yet. Your selected regions below are kept. Reopen this editor to retry loading.</Text>}
    {tree.map((state: any) => {
      const st = { state: state.name, district: '', block: '' };
      const districts = (state.districts || []).filter((district: any) => !needle || `${state.name} ${district.name}`.toLowerCase().includes(needle) || (district.blocks || []).some((block: any) => block.name.toLowerCase().includes(needle)));
      if (needle && !state.name.toLowerCase().includes(needle) && !districts.length) return null;
      return <View key={state.name} style={s.branch}>{row(st, state.name, !!districts.length)}
        {(needle || open.includes(keyOf(st))) && districts.map((district: any) => {
          const dt = { state: state.name, district: district.name, block: '' };
          return <View key={district.name} style={s.children}>{row(dt, district.name, !!district.blocks?.length)}
            {(needle || open.includes(keyOf(dt))) && (district.blocks || []).filter((block: any) => !needle || `${state.name} ${district.name} ${block.name}`.toLowerCase().includes(needle)).map((block: any) => <View key={block.name} style={s.children}>{row({ ...dt, block: block.name }, block.name)}</View>)}
          </View>;
        })}
      </View>;
    })}
    <Text style={s.hint}>{value.length} chosen {value.length === 1 ? 'region' : 'regions'}</Text>
    {value.map(region => <View key={keyOf(region)} style={s.selection}><Text style={s.name}>{updateRegionLabel(region)}</Text><TouchableOpacity disabled={disabled} onPress={() => onChange(value.filter(item => keyOf(item) !== keyOf(region)))} accessibilityLabel={`Remove ${updateRegionLabel(region)}`} style={s.expand}><Icon name="close" size={20} color={PALETTE.indigo} /></TouchableOpacity></View>)}
  </View>;
}
const s = StyleSheet.create({
  wrap: { gap: SPACE.sm }, hint: { fontSize: 16, lineHeight: 24, color: PALETTE.textMuted },
  branch: { borderWidth: 1, borderColor: PALETTE.border, borderRadius: 12, padding: SPACE.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 }, pick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, minHeight: 44 },
  name: { flex: 1, fontSize: 16, lineHeight: 24, color: PALETTE.text }, expand: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  children: { marginLeft: SPACE.md }, selection: { flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.blueSoft, borderRadius: 12, paddingLeft: SPACE.md },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
