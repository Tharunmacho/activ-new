import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ConsoleButton, PremiumInput, PremiumSelect, PALETTE, SPACE } from '../../../ui';
import { errorText } from '../../../services/superApi';
import { findUpdateMembers, previewAssociationUpdate, type UpdateMember, type UpdatePreview, type UpdateVariable, type UpdateVariableOption } from '../../../services/updatePersonalizationApi';
import { htmlToText } from '../../member/updates/updateFormat';

type Props = {
  mode: 'audience' | 'selected'; onMode: (mode: 'audience' | 'selected') => void;
  memberIds: string[]; onMembers: (ids: string[]) => void;
  variables: UpdateVariable[]; onVariables: (variables: UpdateVariable[]) => void;
  onInsert: (token: string) => void; insertTarget?: string; onKnownMembers: (members: UpdateMember[]) => void; disabled?: boolean;
};
const label = (member: UpdateMember) => `${member.fullName || 'ACTIVian'} · ${member.membershipNumber || member.email || member.id}`;
const message = (error: any) => error?.response ? errorText(error) : error?.message || 'Please try again.';
const variableKey = (value: string) => value.trim().toLowerCase();

export default function UpdatePersonalizationEditor({ mode, onMode, memberIds, onMembers, variables, onVariables, onInsert, insertTarget = 'Message', onKnownMembers, disabled }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UpdateMember[]>([]);
  const [known, setKnown] = useState<Record<string, UpdateMember>>({});
  const [catalog, setCatalog] = useState<UpdateVariableOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [key, setKey] = useState('name');
  const [newKey, setNewKey] = useState('');
  const [overrideId, setOverrideId] = useState('');
  const savedIds = useRef([...new Set([...memberIds, ...variables.flatMap(row => row.overrides.map(entry => entry.memberId))])]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const metadata = await findUpdateMembers();
        if (active) setCatalog(metadata.variables);
        const all: UpdateMember[] = [];
        for (let offset = 0; offset < savedIds.current.length; offset += 100) {
          const batch = await findUpdateMembers({ ids: savedIds.current.slice(offset, offset + 100).join(',') });
          all.push(...batch.members);
        }
        if (active) setKnown(current => ({ ...current, ...Object.fromEntries(all.map(member => [member.id, member])) }));
      } catch (cause) { if (active) setError(message(cause)); }
    };
    void load(); return () => { active = false; };
  }, [revision]);
  useEffect(() => { onKnownMembers(Object.values(known)); }, [known, onKnownMembers]);
  useEffect(() => {
    let active = true;
    setResults([]);
    if (search.trim().length < 2) { setLoading(false); return; }
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      void findUpdateMembers({ search: search.trim() }).then(data => {
        if (!active) return;
        setResults(data.members);
        setKnown(current => ({ ...current, ...Object.fromEntries(data.members.map(member => [member.id, member])) }));
      }).catch(cause => { if (active) setError(message(cause)); }).finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search, revision]);
  const options = [...catalog, ...variables.filter(row => !catalog.some(option => option.key === row.key)).map(row => ({ key: row.key, label: row.key, detail: 'Your custom variable.' }))];
  const selected = variables.find(row => row.key === key);
  const definition = catalog.find(row => row.key === key);
  const updateVariable = (patch: Partial<UpdateVariable>) => {
    const next = { key, defaultValue: '', overrides: [], ...selected, ...patch };
    if (!selected && variables.length >= 40) { setError('Use at most 40 variables or general fallback settings in an update.'); return; }
    onVariables(selected ? variables.map(row => row.key === key ? next : row) : [...variables, next]);
  };
  const addVariable = () => {
    const nextKey = variableKey(newKey);
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(nextKey) || ['constructor', 'prototype', '__proto__'].includes(nextKey)) {
      setError('Start the variable name with a letter. Use up to 40 letters, numbers or underscores.'); return;
    }
    if (options.some(row => row.key === nextKey)) { setKey(nextKey); setNewKey(''); setError('That variable already exists. You can edit it below.'); return; }
    if (variables.length >= 40) { setError('Use at most 40 variables or general fallback settings in an update.'); return; }
    onVariables([...variables, { key: nextKey, defaultValue: '', overrides: [] }]);
    setKey(nextKey); setNewKey(''); setError('');
  };
  const overrideChoices = Object.values(known).filter(member => !selected?.overrides.some(row => row.memberId === member.id));
  return <View style={s.stack}>
    <PremiumSelect tone="admin" label="Choose members" value={mode === 'selected' ? 'Specific members' : 'Members who match your choices'}
      options={['Members who match your choices', 'Specific members']} disabled={disabled}
      onChange={value => onMode(value === 'Specific members' ? 'selected' : 'audience')} />
    <Text style={s.hint}>Membership and region filters also apply to specific members. A member-specific value does not add that member to the audience.</Text>
    <PremiumInput tone="admin" label="Find members" value={search} onChangeText={setSearch} editable={!disabled}
      placeholder="Name, email, phone or membership number" hint="Type at least 2 characters. Up to 30 matches appear; refine your search if needed." inputStyle={s.input} />
    {loading ? <Text accessibilityLiveRegion="polite" style={s.hint}>Finding members…</Text> : null}
    {!loading && search.trim().length >= 2 && !results.length && !error ? <Text style={s.hint}>No matching members.</Text> : null}
    {results.map(member => <TouchableOpacity key={member.id} disabled={disabled} accessibilityRole={mode === 'selected' ? 'checkbox' : 'button'}
      accessibilityLabel={mode === 'selected' ? `Select ${label(member)}` : `Use values for ${label(member)}`}
      accessibilityState={{ checked: mode === 'selected' ? memberIds.includes(member.id) : undefined, disabled }} style={s.member}
      onPress={() => {
        if (mode !== 'selected') { setOverrideId(member.id); return; }
        if (!memberIds.includes(member.id) && memberIds.length >= 500) { setError('Select at most 500 specific members.'); return; }
        onMembers(memberIds.includes(member.id) ? memberIds.filter(id => id !== member.id) : [...memberIds, member.id]);
      }}>
      <Icon name={mode === 'selected' ? memberIds.includes(member.id) ? 'check-box' : 'check-box-outline-blank' : 'person-outline'} size={23} color={PALETTE.indigo} />
      <View style={s.flex}><Text style={s.memberName}>{member.fullName || 'ACTIVian'}</Text><Text style={s.hint}>{member.membershipNumber || member.email || member.id}</Text>{member.region ? <Text style={s.hint}>{member.region}</Text> : null}</View>
    </TouchableOpacity>)}
    {mode === 'selected' ? <View style={s.stack}>
      <Text style={s.heading}>{memberIds.length} selected members</Text>
      {memberIds.map(id => <View key={id} style={s.selectedRow}><Text style={[s.hint, s.flex]}>{known[id] ? label(known[id]) : `Member ${id}`}</Text>
        <ConsoleButton kind="ghost" icon="close" label="Remove" disabled={disabled} onPress={() => onMembers(memberIds.filter(value => value !== id))} />
      </View>)}
      {!memberIds.length ? <Text style={s.hint}>Search above and select at least one member.</Text> : null}
    </View> : null}
    <View style={s.divider} />
    <Text style={s.heading}>Variables and general values</Text>
    <Text style={s.hint}>{'{name}'} uses the member’s name, or ACTIVian. Other fields use the member’s recorded value, then your general value. An individual override takes priority. Title and fee are values you enter.</Text>
    <PremiumInput tone="admin" label="New custom variable" value={newKey} onChangeText={setNewKey} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} placeholder="e.g. meeting_date or amount" maxLength={40} inputStyle={s.input} />
    <ConsoleButton kind="soft" icon="add" label="Create variable" disabled={disabled || !newKey.trim()} onPress={addVariable} />
    <PremiumSelect tone="admin" label="Variable" value={options.find(row => row.key === key)?.label || key}
      options={options.map(row => row.label)} disabled={disabled || !options.length}
      onChange={value => { setKey(options.find(row => row.label === value)?.key || 'name'); setOverrideId(''); }} />
    <Text style={s.hint}>{`{${key}}`}{definition?.detail ? ` · ${definition.detail}` : ''}</Text>
    <Text style={s.hint}>{'{title}'} means a salutation such as Mr, Ms or Dr. Enter a general or individual value; it is not inferred from a member’s name. Fee also needs a value you enter.</Text>
    <ConsoleButton kind="soft" icon="add-comment" label={`Insert {${key}} into ${insertTarget.toLowerCase()}`} disabled={disabled} onPress={() => onInsert(`{${key}}`)} />
    <PremiumInput tone="admin" label={`General value for {${key}}`} value={selected?.defaultValue || ''} onChangeText={defaultValue => updateVariable({ defaultValue })}
      editable={!disabled} maxLength={1000} placeholder={key === 'name' ? 'ACTIVian' : 'Value when member information is unavailable'} inputStyle={s.input} />
    <Text style={s.hint}>Use a meaningful general value, such as “your organisation”. Missing values remain blank; dates, titles and fees are never guessed.</Text>
    <PremiumSelect tone="admin" label="Member for individual value" value={known[overrideId] ? label(known[overrideId]) : 'Choose a member'}
      options={['Choose a member', ...overrideChoices.map(label)]} disabled={disabled}
      onChange={value => setOverrideId(overrideChoices.find(member => label(member) === value)?.id || '')} />
    <ConsoleButton kind="soft" icon="person-add" label="Add individual value" disabled={disabled || !overrideId || !!selected?.overrides.some(row => row.memberId === overrideId)} onPress={() => {
      const overrides = selected?.overrides || [];
      if (overrides.length >= 500 || variables.reduce((sum, row) => sum + row.overrides.length, 0) >= 2000) { setError('The member-value limit for this update has been reached.'); return; }
      updateVariable({ overrides: [...overrides, { memberId: overrideId, value: '' }] }); setOverrideId('');
    }} />
    {(selected?.overrides || []).map(row => <View key={row.memberId} style={s.override}>
      <Text style={s.memberName}>{known[row.memberId] ? label(known[row.memberId]) : `Member ${row.memberId}`}</Text>
      <PremiumInput tone="admin" label={`Individual {${key}} value for ${known[row.memberId]?.fullName || row.memberId}`} value={row.value} maxLength={1000} editable={!disabled}
        onChangeText={value => updateVariable({ overrides: (selected?.overrides || []).map(entry => entry.memberId === row.memberId ? { ...entry, value } : entry) })}
        placeholder="Leave blank to use the normal fallback" inputStyle={s.input} />
      <ConsoleButton kind="ghost" label="Remove individual value" disabled={disabled} onPress={() => {
        if (selected) updateVariable({ overrides: selected.overrides.filter(entry => entry.memberId !== row.memberId) });
      }} />
    </View>)}
    {selected ? <ConsoleButton kind="ghost" icon="delete-outline" label={definition ? 'Clear variable settings' : 'Remove custom variable'} disabled={disabled} onPress={() => {
      onVariables(variables.filter(row => row.key !== key)); if (!definition) setKey('name');
    }} /> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><ConsoleButton kind="ghost" label="Retry member lookup" disabled={disabled} onPress={() => { setError(''); setRevision(value => value + 1); }} /></> : null}
  </View>;
}

export function UpdateRecipientPreview({ payload, members }: { payload: Record<string, unknown>; members: UpdateMember[] }) {
  const [memberId, setMemberId] = useState('');
  const [data, setData] = useState<UpdatePreview | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    let active = true; setData(null); setError('');
    const timer = setTimeout(() => {
      void previewAssociationUpdate({ ...JSON.parse(serialized), previewMemberId: memberId }).then(value => { if (active) setData(value); })
        .catch(cause => { if (active) setError(message(cause)); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [serialized, memberId, revision]);
  return <View style={s.stack}>
    <PremiumSelect tone="admin" label="Preview for a member" value={memberId ? label(members.find(member => member.id === memberId) || { id: memberId, fullName: 'Member' }) : 'General / ACTIVian'}
      options={['General / ACTIVian', ...members.map(label)]} onChange={value => setMemberId(members.find(member => label(member) === value)?.id || '')} />
    <Text style={s.hint}>Search or select a member above to preview their actual values. This preview sends no notification.</Text>
    <Text style={s.hint}>{'{date}'} previews today until publication. An existing published update keeps its original publication date.</Text>
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><ConsoleButton kind="soft" label="Retry preview" onPress={() => setRevision(value => value + 1)} /></>
      : !data ? <Text accessibilityLiveRegion="polite" style={s.hint}>Preparing preview…</Text>
      : <>
        <Text style={s.hint}>{memberId ? data.eligible ? 'This member matches your choices.' : 'This member will not receive this update with your current choices.' : 'General preview. Personal member details are private.'}</Text>
        {data.missing.length ? <Text style={s.error}>Missing values: {data.missing.map(value => `{${value}}`).join(', ')}. Add general or individual values above.</Text> : null}
        <Text style={s.previewTitle}>{data.announcement.title || 'Your update title'}</Text>
        {data.announcement.summary ? <Text style={s.body}>{data.announcement.summary}</Text> : null}
        {data.announcement.body ? <Text style={s.body}>{htmlToText(data.announcement.body)}</Text> : null}
        {data.announcement.attachmentLabel ? <Text style={s.hint}>Document: {data.announcement.attachmentLabel}</Text> : null}
      </>}
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: SPACE.md }, flex: { flex: 1, minWidth: 0 },
  heading: { fontSize: 20, lineHeight: 28, color: PALETTE.text, fontWeight: '600' },
  input: { fontSize: 18, lineHeight: 27 }, hint: { fontSize: 16, lineHeight: 24, color: PALETTE.textMuted },
  member: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, paddingVertical: SPACE.sm },
  memberName: { fontSize: 18, lineHeight: 27, color: PALETTE.text, fontWeight: '600' },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  divider: { height: 1, backgroundColor: PALETTE.divider, marginVertical: SPACE.sm },
  override: { gap: SPACE.sm, borderWidth: 1, borderColor: PALETTE.divider, borderRadius: 14, padding: SPACE.md },
  error: { color: PALETTE.red, fontSize: 16, lineHeight: 24 },
  previewTitle: { fontSize: 22, lineHeight: 30, fontWeight: '600', color: PALETTE.text },
  body: { fontSize: 18, lineHeight: 27, color: PALETTE.textSoft },
});
