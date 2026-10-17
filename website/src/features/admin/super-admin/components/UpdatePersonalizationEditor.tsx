import { useEffect, useState } from 'react';
import { Plus, UserRound, X } from 'lucide-react';
import { findUpdateRecipients, type UpdateRecipient, type UpdateVariable, type UpdateVariableOption } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';

const INPUT = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[18px] leading-7 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30';
const BUTTON = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-[18px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50';
type Props = {
    variables: UpdateVariable[]; onVariables: (value: UpdateVariable[]) => void;
    mode: 'audience' | 'selected'; onMode: (value: 'audience' | 'selected') => void;
    memberIds: string[]; onMembers: (value: string[]) => void;
    previewMemberId: string; onPreviewMember: (value: string) => void;
    onInsert: (key: string) => void; disabled: boolean;
};
export default function UpdatePersonalizationEditor(props: Props) {
    const { variables, onVariables, mode, onMode, memberIds, onMembers, previewMemberId, onPreviewMember, onInsert, disabled } = props;
    const [catalogue, setCatalogue] = useState<UpdateVariableOption[]>([]);
    const [known, setKnown] = useState<Record<string, UpdateRecipient>>({});
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<UpdateRecipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [newKey, setNewKey] = useState('');
    const [variableError, setVariableError] = useState('');
    const cacheMembers = (rows: UpdateRecipient[]) => setKnown(previous => ({ ...previous, ...Object.fromEntries(rows.map(row => [row.id, row])) }));
    const savedIds = [...new Set([...memberIds, ...variables.flatMap(row => row.overrides.map(entry => entry.memberId))])].join(',');
    useEffect(() => {
        let active = true;
        findUpdateRecipients(savedIds ? { ids: savedIds } : {}).then(data => {
            if (!active) return; setCatalogue(data.variables); cacheMembers(data.members);
        }).catch(err => { if (active) setError(errorMessage(err, 'Could not load variable and member details.')); });
        return () => { active = false; };
    }, [savedIds, attempt]);
    useEffect(() => {
        let active = true;
        setResults([]); setLoading(search.trim().length >= 2); setError('');
        if (search.trim().length < 2) return () => { active = false; };
        const timer = window.setTimeout(() => {
            findUpdateRecipients({ search: search.trim() }).then(data => {
                if (!active) return; setResults(data.members); cacheMembers(data.members); setCatalogue(data.variables);
            }).catch(err => { if (active) setError(errorMessage(err, 'Could not search members.')); })
                .finally(() => { if (active) setLoading(false); });
        }, 300);
        return () => { active = false; window.clearTimeout(timer); };
    }, [search, attempt]);
    const addVariable = (key: string) => {
        setVariableError('');
        key = key.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) { setVariableError('Start with a letter and use only letters, numbers or underscores, up to 40 characters.'); return; }
        if (!variables.some(row => row.key === key)) {
            if (variables.length >= 40) { setVariableError('Use at most 40 configured variables per update.'); return; }
            onVariables([...variables, { key, defaultValue: '', overrides: [] }]);
        }
        onInsert(key); setNewKey('');
    };
    const setVariable = (key: string, value: string, memberId?: string) => onVariables(variables.map(row => row.key !== key ? row : memberId
        ? { ...row, overrides: [...row.overrides.filter(entry => entry.memberId !== memberId), ...(value ? [{ memberId, value }] : [])] }
        : { ...row, defaultValue: value }));
    const previewName = known[previewMemberId]?.fullName || 'Selected member';
    return <div className="space-y-6">
        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4" disabled={disabled}>
            <legend className="px-1 text-[20px] font-semibold text-slate-900">Member selection</legend>
            <label className="block"><span className="mb-2 block font-semibold">Send to</span><select aria-label="Send to" className={INPUT} value={mode} onChange={event => onMode(event.target.value as Props['mode'])}><option value="audience">All members who match the audience and regions</option><option value="selected">Specific members who also match those rules</option></select></label>
            <p className="text-[18px] leading-7 text-slate-600">Selected members must also match the audience, plans and regions above. Choosing someone here does not change who is allowed to see the update.</p>
            <label className="block"><span className="mb-2 block font-semibold">Find a member to {mode === 'selected' ? 'select or preview' : 'preview or personalize'}</span><input aria-label="Search update members" className={INPUT} value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, phone or membership number (2+ characters)" /></label>
            {loading && <p role="status">Searching members…</p>}
            {error && <p role="alert" className="text-red-700">{error} <button type="button" className="min-h-[48px] underline" onClick={() => setAttempt(value => value + 1)}>Retry</button></p>}
            {!loading && !error && search.trim().length >= 2 && !results.length && <p>No matching active members.</p>}
            {!!results.length && <ul aria-label="Member search results" className="max-h-72 space-y-2 overflow-y-auto">{results.map(member => <li key={member.id} className="rounded-xl border border-slate-200 p-3"><p className="break-words font-semibold">{member.fullName}</p><p className="break-words text-[18px] text-slate-600">{member.email}{member.membershipNumber ? ` · ${member.membershipNumber}` : ''}</p><p className="break-words text-[18px] text-slate-500">{member.region}</p><div className="mt-2 flex flex-wrap gap-2">{mode === 'selected' && <button type="button" className={BUTTON} disabled={memberIds.includes(member.id) || memberIds.length >= 500} onClick={() => { onMembers([...memberIds, member.id]); onPreviewMember(member.id); }}>{memberIds.includes(member.id) ? 'Selected' : 'Select member'}</button>}<button type="button" className={BUTTON} onClick={() => onPreviewMember(member.id)}>Preview & set values</button></div></li>)}</ul>}
            {mode === 'selected' && <div><p className="font-semibold">{memberIds.length} selected (up to 500)</p><ul className="mt-2 space-y-2">{memberIds.map(id => <li key={id} className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2"><button type="button" onClick={() => onPreviewMember(id)} className="min-h-[48px] min-w-0 flex-1 break-words text-left font-medium text-blue-800">{known[id]?.fullName || 'Member unavailable — remove and search again'}{known[id]?.email && <span className="block text-[18px] font-normal">{known[id].email}</span>}</button><button type="button" aria-label={`Remove ${known[id]?.fullName || 'member'}`} className="grid h-11 w-11 shrink-0 place-items-center" onClick={() => { onMembers(memberIds.filter(value => value !== id)); if (previewMemberId === id) onPreviewMember(''); }}><X size={18}/></button></li>)}</ul></div>}
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4" disabled={disabled}>
            <legend className="px-1 text-[20px] font-semibold text-slate-900">Variables and general values</legend>
            <p className="text-[18px] leading-7 text-slate-600">Insert a variable in the title, message or summary. A member-specific value comes first, then available profile information, then your general value. Missing names use ACTIVian; other missing values are blank and flagged in preview.</p>
            <label className="block"><span className="mb-2 block font-semibold">Insert a member variable</span><select aria-label="Insert variable" className={INPUT} value="" onChange={event => { if (event.target.value) addVariable(event.target.value); }}><option value="">Choose a variable…</option>{catalogue.map(row => <option key={row.key} value={row.key}>{row.label} — {'{' + row.key + '}'}</option>)}</select></label>
            <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1"><span className="mb-2 block font-semibold">Create any custom variable</span><input aria-label="Custom variable name" value={newKey} onChange={event => setNewKey(event.target.value)} className={INPUT} maxLength={40} placeholder="For example: meeting_place" /></label><button type="button" className={BUTTON} onClick={() => addVariable(newKey)}><Plus size={18}/>Add & insert</button></div>
            {variableError && <p role="alert" className="text-red-700">{variableError}</p>}
            <div className="rounded-xl bg-blue-50 p-3"><p className="font-semibold"><UserRound className="mr-2 inline" size={18}/>Editing values for: {previewMemberId ? previewName : 'General / visitor'}</p><p className="mt-1 text-[18px] leading-7 text-slate-600">Search or click a member above to set their individual values and preview the result. General values also apply to public visitors.</p>{previewMemberId && <button type="button" className="mt-2 min-h-[48px] font-semibold text-blue-700 underline" onClick={() => onPreviewMember('')}>Preview general values</button>}</div>
            {variables.some(row => row.overrides.length) && <div><p className="mb-2 font-medium">Members with saved individual values</p><div className="flex flex-wrap gap-2">{[...new Set(variables.flatMap(row => row.overrides.map(entry => entry.memberId)))].map(id => <button type="button" key={id} className={BUTTON} onClick={() => onPreviewMember(id)}>{known[id]?.fullName || 'Saved member'}</button>)}</div></div>}
            {variables.map(variable => <div key={variable.key} className="space-y-3 rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><button type="button" className="min-h-[48px] break-words text-left text-[18px] font-semibold text-blue-700" onClick={() => onInsert(variable.key)}>{'{' + variable.key + '}'}</button><p className="text-[18px] leading-7 text-slate-600">{catalogue.find(row => row.key === variable.key)?.detail || 'Your own custom text, with a shared general value and optional member values.'}</p></div><button type="button" className="grid h-11 w-11 shrink-0 place-items-center" aria-label={`Remove variable ${variable.key}`} onClick={() => onVariables(variables.filter(row => row.key !== variable.key))}><X size={18}/></button></div><label className="block"><span className="mb-1 block font-medium">General value for {'{' + variable.key + '}'}</span><input aria-label={`General value for ${variable.key}`} className={INPUT} value={variable.defaultValue} maxLength={1000} onChange={event => setVariable(variable.key, event.target.value)} placeholder={variable.key === 'name' ? 'ACTIVian' : 'For example: your company, our upcoming event, contact us for details'} /></label>{previewMemberId && <label className="block"><span className="mb-1 block font-medium">Value for {previewName}</span><input aria-label={`Member value for ${variable.key}`} className={INPUT} value={variable.overrides.find(row => row.memberId === previewMemberId)?.value || ''} maxLength={1000} onChange={event => setVariable(variable.key, event.target.value, previewMemberId)} placeholder="Leave blank to use profile information or the general value" /></label>}{!!variable.overrides.length && <p className="text-[18px] text-slate-500">{variable.overrides.length} member-specific {variable.overrides.length === 1 ? 'value' : 'values'} saved in this update.</p>}</div>)}
        </fieldset>
    </div>;
}
