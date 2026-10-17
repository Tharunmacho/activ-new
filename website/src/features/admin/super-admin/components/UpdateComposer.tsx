import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { FileText, ImagePlus, Loader2, Paperclip, Send, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { resolveMediaUrl } from '@/config/api.config';
import { errorMessage, listMembershipPlans, type MembershipPlanRow } from '@/services/activApi';
import { uploadMedia, uploadEventAttachment } from '@/services/cmsApi';
import { createAnnouncement, updateAnnouncement, previewUpdate, type UpdatePreview, type UpdateVariable, type Announcement, type AnnouncementCategory } from '@/services/memberHubApi';
import { UPDATE_AUDIENCES, type UpdateAudience } from '@/lib/memberAudience';
import { UPDATE_DELIVERY_CHANNELS, resolveUpdateDeliveryChannels, updateDeliverySummary, type UpdateDeliveryChannels } from '@/lib/updateDeliveryChannels';
import RegionTargetPicker, { type RegionTarget } from '@/pages/cms/components/RegionTargetPicker';
import UpdatePersonalizationEditor from './UpdatePersonalizationEditor';

const INPUT = 'w-full min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-[18px] leading-7 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400';
const SECONDARY = 'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-[18px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const CATEGORIES: { value: AnnouncementCategory; label: string }[] = [
    { value: 'general', label: 'General update' }, { value: 'notice', label: 'Notice' },
    { value: 'policy', label: 'Policy' }, { value: 'scheme', label: 'Scheme' },
    { value: 'achievement', label: 'Achievement' }, { value: 'urgent', label: 'Urgent' },
];
type Form = {
    title: string; summary: string; body: string; category: AnnouncementCategory;
    targets: RegionTarget[]; audience: UpdateAudience; planKeys: string[]; includeVisitors: boolean;
    recipientMode: 'audience' | 'selected'; memberIds: string[]; variables: UpdateVariable[];
    bannerUrl: string; bannerAlt: string; attachmentUrl: string; attachmentLabel: string;
    pinned: boolean; expiresAt: string;
    deliveryChannels: UpdateDeliveryChannels;
};
const dateInput = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const mediaLink = (value: string) => {
    const url = resolveMediaUrl(value);
    return /^(https?:\/\/|\/uploads\/)/i.test(url || '') ? url : '';
};
const plainText = (value: string) => {
    // Decode escaped variable text after removing markup. React renders the result as text.
    const decoder = document.createElement('textarea');
    decoder.innerHTML = value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|h[1-6]|li|blockquote)>/gi, '\n\n').replace(/<[^>]*>/g, '');
    return decoder.value.trim();
};

export default function UpdateComposer({ initial, onClose, onSaved }: {
    initial: Announcement | null; onClose: () => void; onSaved: () => void;
}) {
    const [form, setForm] = useState<Form>(() => ({
        title: initial?.title || '', summary: initial?.summary || '', body: initial?.body || '', category: initial?.category || 'general',
        targets: initial?.targets?.length ? initial.targets : initial?.state ? [{ state: initial.state, district: initial.district || '', block: initial.block || '' }] : [],
        includeVisitors: !!initial?.includeVisitors,
        recipientMode: initial?.recipientMode || 'audience', memberIds: initial?.memberIds || [], variables: initial?.variables || [],
        audience: initial?.audience || 'all', planKeys: initial?.planKeys || [],
        bannerUrl: initial?.bannerUrl || '', bannerAlt: initial?.bannerAlt || '',
        attachmentUrl: initial?.attachmentUrl || '', attachmentLabel: initial?.attachmentLabel || '',
        pinned: !!initial?.pinned, expiresAt: dateInput(initial?.expiresAt),
        deliveryChannels: resolveUpdateDeliveryChannels(initial),
    }));
    const [regional, setRegional] = useState(!!(initial?.targets?.length || initial?.state));
    const [previewMemberId, setPreviewMemberId] = useState('');
    const [preview, setPreview] = useState<UpdatePreview | null>(null);
    const [previewError, setPreviewError] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewAttempt, setPreviewAttempt] = useState(0);
    const messageInput = useRef<HTMLTextAreaElement>(null);
    const [plans, setPlans] = useState<MembershipPlanRow[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState('');
    const [catalogueAttempt, setCatalogueAttempt] = useState(0);
    const [uploading, setUploading] = useState({ poster: '', document: '' });
    const [fileError, setFileError] = useState({ poster: '', document: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const mounted = useRef(true);
    const uploadingRef = useRef(false);
    const savingRef = useRef(false);
    const busy = saving || !!uploading.poster || !!uploading.document;
    const selectedAudience = UPDATE_AUDIENCES.find(option => option.value === form.audience);
    const planNames = form.planKeys.map(key => plans.find(plan => plan.key === key)?.name || key);
    const recipients = form.audience === 'plans' ? (planNames.join(', ') || 'Choose at least one plan') : selectedAudience?.title;
    const region = regional ? form.targets.map(target => [target.state, target.district, target.block].filter(Boolean).join(' / ')).join(', ') || 'Choose at least one region' : 'All regions';
    const channelSummary = updateDeliverySummary(form.deliveryChannels);
    const sendsNotifications = Object.values(form.deliveryChannels).some(Boolean);
    const previewText = (field: 'title' | 'summary' | 'body') => field === 'body' ? plainText(preview?.announcement.body || '') : preview?.announcement[field] || '';
    const insertVariable = (key: string) => {
        const token = `{${key}}`;
        const input = messageInput.current;
        const start = input?.selectionStart ?? form.body.length;
        const end = input?.selectionEnd ?? start;
        change('body', form.body.slice(0, start) + token + form.body.slice(end));
        requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + token.length, start + token.length); });
    };
    const change = <K extends keyof Form>(key: K, value: Form[K]) => { setDirty(true); setForm(current => ({ ...current, [key]: value })); };

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => {
        let active = true; setPreviewLoading(true); setPreviewError('');
        setPreview(previous => (previous?.recipient?.id || '') === previewMemberId ? previous : null);
        const timer = window.setTimeout(() => {
            previewUpdate({ ...form, targets: regional ? form.targets : [], state: '', district: '', block: '',
                includeVisitors: form.includeVisitors && form.audience === 'all' && !regional && form.recipientMode !== 'selected',
                previewMemberId, announcementId: initial?.id }).then(value => { if (active) setPreview(value); })
                .catch(err => { if (active) { setPreview(null); setPreviewError(errorMessage(err, 'Could not load this preview.')); } })
                .finally(() => { if (active) setPreviewLoading(false); });
        }, 350);
        return () => { active = false; window.clearTimeout(timer); };
    }, [form, regional, previewMemberId, initial?.id, previewAttempt]);
    useEffect(() => {
        let active = true; setPlansLoading(true); setPlansError('');
        listMembershipPlans().then(data => { if (active) setPlans(data?.plans || []); })
            .catch(() => { if (active) setPlansError('Membership plans could not be loaded. Please retry.'); })
            .finally(() => { if (active) setPlansLoading(false); });
        return () => { active = false; };
    }, [catalogueAttempt]);

    const close = () => { if (!busy && (!dirty || window.confirm('Discard your unsaved update?'))) onClose(); };
    const upload = async (kind: 'poster' | 'document', file?: File) => {
        if (!file || busy || uploadingRef.current) return;
        setFileError(current => ({ ...current, [kind]: '' }));
        const poster = kind === 'poster';
        const allowed = poster ? /\.(jpe?g|png|webp|gif)$/i : /\.(pdf|docx?|xlsx?|pptx?)$/i;
        if (!allowed.test(file.name) || (poster && !/^image\/(jpeg|png|webp|gif)$/.test(file.type))) {
            setFileError(current => ({ ...current, [kind]: poster ? 'Choose a JPG, PNG, WebP or GIF image.' : 'Choose a PDF, Word, Excel or PowerPoint document.' })); return;
        }
        if (file.size > (poster ? 10 : 20) * 1024 * 1024) {
            setFileError(current => ({ ...current, [kind]: `Choose a file smaller than ${poster ? 10 : 20} MB.` })); return;
        }
        uploadingRef.current = true;
        setUploading(current => ({ ...current, [kind]: 'Uploading…' }));
        try {
            const media = poster ? await uploadMedia(file, progress => { if (mounted.current) setUploading(current => ({ ...current, poster: progress })); }) : await uploadEventAttachment(file);
            if (!mounted.current) return;
            if (!mediaLink(media.url)) throw new Error('The upload did not return a usable file. Please retry.');
            setDirty(true);
            setForm(current => poster ? { ...current, bannerUrl: media.url } : { ...current, attachmentUrl: media.url, attachmentLabel: file.name });
        } catch (err) { if (mounted.current) setFileError(current => ({ ...current, [kind]: errorMessage(err, 'Upload failed. Please try again.') })); }
        finally { uploadingRef.current = false; if (mounted.current) setUploading(current => ({ ...current, [kind]: '' })); }
    };
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault(); if (busy || uploadingRef.current || savingRef.current) return;
        const status = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'published' ? 'published' : 'draft';
        setError('');
        if (!form.title.trim()) { setError('Add a title so members know what the update is about.'); return; }
        if (regional && !form.targets.length) { setError('Choose at least one region, or select all regions.'); return; }
        if (form.recipientMode === 'selected' && !form.memberIds.length) { setError('Choose at least one specific member, or use all eligible members.'); return; }
        if (status === 'published' && ![form.body, form.summary, form.bannerUrl, form.attachmentUrl].some(value => plainText(value))) {
            setError('Write a message or add a poster or document before publishing.'); return;
        }
        if (form.audience === 'plans' && (plansLoading || plansError || !form.planKeys.length || form.planKeys.some(key => !plans.some(plan => plan.key === key)))) {
            setError('Choose at least one available membership plan before saving.'); return;
        }
        const expiry = form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`) : null;
        if (expiry && (!Number.isFinite(expiry.getTime()) || dateInput(expiry.toISOString()) !== form.expiresAt)) { setError('Choose a valid end date.'); return; }
        savingRef.current = true; setSaving(true);
        try {
            const payload = { ...form, targets: regional ? form.targets : [], includeVisitors: form.includeVisitors && form.audience === 'all' && !regional && form.recipientMode !== 'selected', title: form.title.trim(), status, planKeys: form.audience === 'plans' ? form.planKeys : [], expiresAt: expiry?.toISOString() || '' };
            if (initial) await updateAnnouncement(initial.id, payload); else await createAnnouncement(payload);
            toast.success(status === 'draft' ? 'Draft saved' : initial?.status === 'published' ? 'Update saved' : 'Update published');
            onSaved();
        } catch (err) { setError(errorMessage(err, 'Could not save your update. Please try again.')); }
        finally { savingRef.current = false; if (mounted.current) setSaving(false); }
    };

    return <form aria-label="Update composer" onSubmit={submit} className="space-y-6 text-[18px] leading-7">
        <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-[26px] font-semibold text-slate-900">{initial ? 'Edit update' : 'Create an update'}</h2><p className="mt-1 text-[18px] leading-7 text-slate-500">Write your message, choose its audience and check the preview.</p></div>
            <button type="button" aria-label="Close update editor" disabled={busy} onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 disabled:opacity-50"><X size={20} /></button>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            <div className="min-w-0 space-y-6">
                <Section title="Write your update" detail="A clear title and a short message are enough. Media is optional.">
                    <Field label="Title" required><input name="title" required maxLength={200} value={form.title} onChange={e => change('title', e.target.value)} placeholder="For example: New membership benefits" className={INPUT} /></Field>
                    <Field label="Message"><textarea ref={messageInput} name="body" value={form.body} onChange={e => change('body', e.target.value)} rows={7} placeholder={'Dear {Name},\n\nShare the details of your update here.\n\nThank you for being part of ACTIV.'} className={`${INPUT} resize-y`} /></Field>
                    <div className="rounded-xl bg-blue-50 p-3"><button type="button" onClick={() => insertVariable('name')} disabled={busy} className="inline-flex min-h-10 items-center gap-2 text-[18px] font-semibold text-blue-700"><UserRound size={17} />Insert member name</button><p className="text-[18px] leading-7 text-slate-600">Use variables in the title, message or summary. Add company, dates, fees and your own variables under “Variables and general values” below. You can set a general fallback and different values for individual members.</p></div>
                    <details className="rounded-xl border border-slate-200 px-4 py-3" open={!!form.summary || undefined}>
                        <summary className="cursor-pointer text-[18px] font-medium text-slate-600">Short summary (optional)</summary>
                        <div className="mt-3"><Field label="Summary" hint="Shown on the update card. If blank, we use the start of your message."><input name="summary" value={form.summary} maxLength={300} onChange={e => change('summary', e.target.value)} className={INPUT} /></Field></div>
                    </details>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Category"><select name="category" value={form.category} onChange={e => change('category', e.target.value as AnnouncementCategory)} className={INPUT}>{CATEGORIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                        <Field label="Show until (optional)" hint="Visible through the end of this date."><input name="expiresAt" type="date" value={form.expiresAt} onChange={e => change('expiresAt', e.target.value)} className={INPUT} /></Field>
                    </div>
                    <div className="border-t border-slate-100 pt-5">
                        <h4 className="text-[18px] font-semibold text-slate-900">Poster or image <span className="font-normal text-slate-500">(optional)</span></h4>
                        {form.bannerUrl && <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={mediaLink(form.bannerUrl)} alt={form.bannerAlt || 'Update poster preview'} className="mx-auto max-h-80 w-full object-contain" /></div>}
                        <div className="mt-3 flex flex-wrap items-center gap-3"><label className={`${SECONDARY} relative cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><ImagePlus size={18} />{uploading.poster || (form.bannerUrl ? 'Replace image' : 'Upload image')}<input aria-label="Upload update image" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void upload('poster', file); }} /></label>{form.bannerUrl && <button type="button" className="min-h-[48px] px-2 text-[18px] font-medium text-red-700" disabled={busy} onClick={() => { change('bannerUrl', ''); change('bannerAlt', ''); }}>Remove image</button>}</div>
                        <p className="mt-2 text-[18px] text-slate-500">JPG, PNG, WebP or GIF, up to 10 MB. Your full poster stays visible.</p>
                        {fileError.poster && <p role="alert" className="mt-2 text-[18px] text-red-700">{fileError.poster}</p>}
                        {form.bannerUrl && <div className="mt-3"><Field label="Image description (optional)" hint="Helps members who use a screen reader."><input name="bannerAlt" value={form.bannerAlt} onChange={e => change('bannerAlt', e.target.value)} className={INPUT} placeholder="Describe the important information in this image" /></Field></div>}
                    </div>
                    <div className="border-t border-slate-100 pt-5">
                        <h4 className="text-[18px] font-semibold text-slate-900">Document <span className="font-normal text-slate-500">(optional)</span></h4>
                        {form.attachmentUrl && <div className="mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3"><FileText className="shrink-0 text-blue-700" size={22} /><a href={mediaLink(form.attachmentUrl)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-words text-[18px] font-medium text-blue-800">{form.attachmentLabel || 'View document'}</a><button type="button" disabled={busy} aria-label="Remove document" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-red-700 hover:bg-red-50" onClick={() => { change('attachmentUrl', ''); change('attachmentLabel', ''); }}><Trash2 size={17} /></button></div>}
                        <label className={`${SECONDARY} relative mt-3 cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}><Paperclip size={18} />{uploading.document || (form.attachmentUrl ? 'Replace document' : 'Upload document')}<input aria-label="Upload update document" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" disabled={busy} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void upload('document', file); }} /></label>
                        <p className="mt-2 text-[18px] text-slate-500">PDF, Word, Excel or PowerPoint, up to 20 MB.</p>
                        {fileError.document && <p role="alert" className="mt-2 text-[18px] text-red-700">{fileError.document}</p>}
                        {form.attachmentUrl && <div className="mt-3"><Field label="Document name"><input name="attachmentLabel" value={form.attachmentLabel} onChange={e => change('attachmentLabel', e.target.value)} className={INPUT} /></Field></div>}
                    </div>
                </Section>
                <Section title="Choose recipients" detail="Only members who match both the audience and region can see this update.">
                    <Field label="Audience" hint={selectedAudience?.detail}><select name="audience" value={form.audience} onChange={e => change('audience', e.target.value as UpdateAudience)} className={INPUT}>{UPDATE_AUDIENCES.map(option => <option key={option.value} value={option.value}>{option.title}</option>)}</select></Field>
                    {form.audience === 'plans' && <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-[18px] font-semibold text-slate-700">Membership plans</legend>
                        {plansLoading ? <p role="status" className="text-[18px] text-slate-500">Loading plans…</p> : plansError ? <div role="alert" className="text-[18px] text-red-700">{plansError}<button type="button" className="ml-2 min-h-[48px] underline" onClick={() => setCatalogueAttempt(v => v + 1)}>Retry</button></div> : <>
                            <div className="mb-3 flex flex-wrap gap-3"><button type="button" className="min-h-10 text-[18px] font-semibold text-blue-700" onClick={() => change('planKeys', plans.filter(plan => plan.audience !== 'student').map(plan => plan.key))}>Select all except student plans</button><button type="button" className="min-h-10 text-[18px] text-slate-500" onClick={() => change('planKeys', [])}>Clear selection</button></div>
                            <div className="grid gap-2 sm:grid-cols-2">{plans.map(plan => <label key={plan.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${form.planKeys.includes(plan.key) ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}><input type="checkbox" name="planKeys" value={plan.key} checked={form.planKeys.includes(plan.key)} onChange={e => change('planKeys', e.target.checked ? [...form.planKeys, plan.key] : form.planKeys.filter(key => key !== plan.key))} className="mt-1 h-5 w-5 shrink-0 accent-blue-700" /><span className="min-w-0"><span className="block break-words text-[18px] font-semibold text-slate-800">{plan.name}</span><span className="block text-[18px] capitalize text-slate-500">{plan.audience === 'platinum' ? 'Lifetime' : plan.audience}{plan.active === false ? ' · Retired plan' : ''}</span></span></label>)}</div>
                            {!plans.length && <p className="text-[18px] text-slate-500">No membership plans are available. Add them under Membership plans first.</p>}
                        </>}
                    </fieldset>}
                    <RegionTargetPicker multipleSelection targets={form.targets} onChange={value => change('targets', value)} reachEveryone={!regional} onReachEveryoneChange={value => { setDirty(true); setRegional(!value); }} title="Regions" contentLabel="update" audienceLabel="Selected audience in all regions" hint="Select multiple states, districts or blocks. Members must match the audience above and at least one chosen region." />
                    <UpdatePersonalizationEditor variables={form.variables} onVariables={value => change('variables', value)} mode={form.recipientMode} onMode={value => change('recipientMode', value)} memberIds={form.memberIds} onMembers={value => change('memberIds', value)} previewMemberId={previewMemberId} onPreviewMember={setPreviewMemberId} onInsert={insertVariable} disabled={busy} />
                    <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="checkbox" checked={form.includeVisitors && form.audience === 'all' && !regional && form.recipientMode !== 'selected'} disabled={busy || form.audience !== 'all' || regional || form.recipientMode === 'selected'} onChange={event => change('includeVisitors', event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-blue-700" /><span><span className="block text-[18px] font-semibold text-slate-800">Also show to visitors</span><span className="mt-1 block text-[18px] leading-7 text-slate-500">Makes this update public. Visitors who allow notifications are notified only when Push notifications is selected below. Available for all eligible members in all regions, without a specific member selection. Visitors see general values.</span></span></label>
                </Section>
                <Section title="Send notifications" detail="Choose how to notify recipients about this update. Leave all channels off to publish in the feed without notifications.">
                    <fieldset aria-label="Notification channels" disabled={busy} className="space-y-3">
                        {UPDATE_DELIVERY_CHANNELS.map(channel => <label key={channel.key} className={`flex min-h-[48px] items-start gap-3 rounded-xl border p-4 ${form.deliveryChannels[channel.key] ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'} ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
                            <input type="checkbox" name={`deliveryChannels.${channel.key}`} aria-label={`Notify by ${channel.label}`} checked={form.deliveryChannels[channel.key]} disabled={busy}
                                onChange={event => change('deliveryChannels', { ...form.deliveryChannels, [channel.key]: event.target.checked })} className="mt-1 h-5 w-5 shrink-0 accent-blue-700" />
                            <span className="min-w-0"><span className="block text-[18px] font-semibold text-slate-800">{channel.label}</span><span className="mt-1 block text-[18px] leading-7 text-slate-500">{channel.detail}</span></span>
                        </label>)}
                    </fieldset>
                    <p className="text-[18px] leading-7 text-slate-600">Audience rules, member preferences and consent still apply. Publishing always makes the update available in eligible recipients’ feeds and in-app updates.</p>
                </Section>
            </div>
            <aside className="min-w-0 space-y-5 xl:sticky xl:top-5">
                <section aria-label="Member preview" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="space-y-3 border-b border-slate-100 px-5 py-4"><h3 className="text-[20px] font-semibold text-slate-800">{previewMemberId ? `Preview: ${preview?.recipient?.fullName || 'selected member'}` : 'General / visitor preview'}</h3><p className="text-[18px] leading-7 text-slate-600">Choose a member in the selection area to check their exact values. Publication date previews today until published. Preview never sends a message.</p>{previewLoading && <p role="status" className="text-[18px] text-blue-700">Updating preview…</p>}{previewError && <p role="alert" className="text-[18px] text-red-700">{previewError} <button type="button" className="min-h-[48px] underline" onClick={() => setPreviewAttempt(value => value + 1)}>Retry preview</button></p>}{preview && !preview.eligible && <p className="rounded-lg bg-amber-50 p-3 text-[18px] text-amber-800">{previewMemberId ? 'This member does not match the current recipient rules and will not receive this update.' : 'General values preview only. Visitors will not receive this update with the current recipient settings.'}</p>}{!!preview?.missing.length && <p role="status" className="rounded-lg bg-amber-50 p-3 text-[18px] text-amber-800">Missing values: {preview.missing.map(key => `{${key}}`).join(', ')}. Add a general value or a value for this member; otherwise these are blank.</p>}</div>
                    {form.bannerUrl && <img src={mediaLink(form.bannerUrl)} alt={form.bannerAlt || 'Update poster'} className="max-h-72 w-full bg-slate-50 object-contain" />}
                    <div className="space-y-3 p-5"><span className="inline-block rounded-full bg-blue-50 px-2.5 py-1 text-[18px] font-semibold text-blue-700">{CATEGORIES.find(c => c.value === form.category)?.label}</span><h4 className="break-words text-[22px] font-semibold leading-7 text-slate-900">{previewText('title').trim() || 'Your update title'}</h4>{form.summary && <p className="break-words text-[18px] leading-7 text-slate-500">{previewText('summary')}</p>}<p className="whitespace-pre-wrap break-words text-[18px] leading-7 text-slate-700">{previewText('body') || (!form.bannerUrl && !form.attachmentUrl ? 'Your message will appear here.' : '')}</p>{form.attachmentUrl && <span className="flex items-center gap-2 break-words text-[18px] font-medium text-blue-700"><Paperclip size={16} className="shrink-0" />{preview?.announcement.attachmentLabel || 'View document'}</span>}</div>
                </section>
                <section className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                    <h3 className="text-[18px] font-semibold text-slate-900">Review & publish</h3>
                    <dl className="space-y-3 text-[18px]"><div><dt className="text-slate-500">Audience</dt><dd data-testid="recipient-summary" className="mt-1 break-words font-medium text-slate-800">{recipients}</dd></div><div><dt className="text-slate-500">Region</dt><dd className="mt-1 break-words font-medium text-slate-800">{region}</dd></div><div><dt className="text-slate-500">Notification channels</dt><dd data-testid="delivery-channel-summary" className="mt-1 break-words font-medium text-slate-800">{channelSummary}</dd></div>{form.expiresAt && <div><dt className="text-slate-500">Visible through</dt><dd className="mt-1 font-medium text-slate-800">{form.expiresAt}</dd></div>}</dl>
                    <label className="flex cursor-pointer items-start gap-3 border-t border-blue-100 pt-4"><input type="checkbox" name="pinned" checked={form.pinned} onChange={e => change('pinned', e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-blue-700" /><span className="text-[18px] leading-7 text-slate-700">Pin this update at the top of eligible members’ feeds</span></label>
                    <p className="text-[18px] leading-7 text-slate-500">{form.recipientMode === 'selected' ? `${form.memberIds.length} specific members selected; each must also match the audience and region.` : 'All members matching the audience and region.'} Drafts stay private. {sendsNotifications ? 'Only the selected channels are used, subject to recipient preferences and consent.' : 'No email, WhatsApp or push notifications will be sent. The published update remains available in the feed and in-app updates.'} {form.deliveryChannels.push && 'Push notifications use a general notice to keep personal details off lock screens.'}</p>
                    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[18px] leading-7 text-red-700">{error}</p>}
                    <button type="submit" name="intent" value="published" disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-[18px] font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <Send size={18} className="shrink-0" />}{initial?.status === 'published' ? 'Save published update' : sendsNotifications ? 'Publish update' : 'Publish without notifications'}</button>
                    <button type="submit" name="intent" value="draft" disabled={busy} className={`${SECONDARY} w-full`}>Save as draft</button>
                    {initial?.status === 'published' && <p className="text-[18px] text-slate-500">Saving as a draft removes it from members’ feeds.</p>}
                </section>
            </aside>
        </div>
    </form>;
}

function Section({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
    return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div><h3 className="text-[22px] font-semibold text-slate-900">{title}</h3><p className="mt-1 text-[18px] leading-7 text-slate-500">{detail}</p></div>{children}</section>;
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
    return <label className="block min-w-0"><span className="mb-1.5 block text-[18px] font-semibold text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</span>{children}{hint && <span className="mt-1.5 block text-[18px] leading-7 text-slate-500">{hint}</span>}</label>;
}
