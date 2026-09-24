import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Landmark, MapPin, Pencil, Trash2 } from 'lucide-react';
import {
    CmsPage, CmsCard, CmsField, CmsInput, CmsTextarea, CmsButton, CmsLoading, CmsError,
    CmsCheck, CmsChoice, CmsSteps, CmsStep, SaveNowProvider, SectionToolsProvider,
    cmsSaved, cmsFailed, cmsDeleted,
} from './components/CmsUI';
import { UploadField } from './components/UploadField';
import { LineList, ExtraFieldsEditor } from './components/CmsEditors';
import { errorMessage } from '@/services/api';
import { CmsScopeBrowser, useRegionOptions } from './components/CmsScopeBrowser';
import {
    listSchemesAdmin, saveSchemeRecord, deleteSchemeRecord, saveSchemeSettings,
    type SchemeRecord, type SchemeSettings, type SchemeTier,
} from '@/services/cmsSchemesApi';

/**
 * ============================================================================
 * THE SCHEMES EDITOR — `/cms/schemes`
 * ============================================================================
 *
 * Its own screen now. The schemes used to be a tab on the newsroom's, which
 * put a government instrument under "News" and made the page they appear on
 * impossible to find from the CMS menu.
 *
 * Laid out like Regions & States (`CmsScopeBrowser`): a Central tab, and a
 * States tab listing every state; opening a state gives it its own screen with
 * its state schemes and its district schemes, grouped by district. Adding from
 * there pre-fills the state. An editor OPENS one row into a sectioned form —
 * no modal, because a modal over a long form is a scroll inside a scroll.
 *
 * ---------------------------------------------------- where a scheme lives
 *
 * The TIER is a pick-one (`CmsChoice`) and it decides where the scheme is
 * printed: Central on `/schemes/central`, State and District on that state's
 * page. The state box suggests every state the Regions screen knows, and the
 * district box every district the admin database knows for that state —
 * suggestions, not a lock, because a real district the reference does not
 * list must still be postable. The spelling matters: the public page matches
 * a scheme to its state by name.
 */

/* Central and States, the way Regions & States has Regions and States. */
type Tab = 'central' | 'states' | 'settings';

const blank = (): Partial<SchemeRecord> => ({
    title: '', summary: '', body: '', tier: 'national', state: '', district: '',
    authority: '', eligibility: '', deadline: '', applyUrl: '', documentUrl: '', icon: 'file-text',
    category: '', benefits: '', howToApply: '', documentsRequired: [], helpline: '',
    image: { url: '', type: 'image', alt: '', fit: 'cover', position: 'center' },
    featured: false, sortOrder: 0, extraFields: [], status: 'draft',
});

const TIER_LABEL: Record<SchemeTier, string> = {
    national: 'Central', state: 'State', district: 'District',
};

export default function SchemesManager() {
    const [tab, setTab] = useState<Tab>('central');
    const [schemes, setSchemes] = useState<SchemeRecord[]>([]);
    /* A Save in every card's footer — see the note on `EventsManager`. */
    const [settings, setSettingsClean] = useState<Partial<SchemeSettings>>({});
    const [settingsDirty, setSettingsDirty] = useState(false);
    const setSettings = (next: Partial<SchemeSettings>) => {
        setSettingsClean(next);
        setSettingsDirty(true);
    };
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [scheme, setScheme] = useState<Partial<SchemeRecord> | null>(null);
    /* The state open on the States tab — kept here so it survives opening a scheme. */
    const [openState, setOpenState] = useState('');

    /* Suggestions for the region boxes, and the states for the States tab. */
    const { regionMap, stateOptions, districtsOf } = useRegionOptions();

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!quiet) setLoading(true);
        setError('');
        try {
            const data = await listSchemesAdmin();
            setSchemes(data.schemes || []);
            setSettingsClean(data.settings || {});
            setSettingsDirty(false);
        } catch (err) {
            setError(errorMessage(err, 'The schemes could not be loaded'));
        } finally {
            if (!quiet) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const districtOptions = districtsOf(scheme?.state);

    const setS = (patch: Partial<SchemeRecord>) => setScheme((s) => ({ ...(s || {}), ...patch }));

    const submit = async () => {
        if (!scheme) return;
        setSaving(true);
        try {
            await saveSchemeRecord(scheme.id || null, scheme);
            cmsSaved('Scheme');
            setScheme(null);
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Scheme', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (row: SchemeRecord) => {
        if (!window.confirm(`Delete “${row.title || 'Untitled'}”? This cannot be undone.`)) return;
        try {
            await deleteSchemeRecord(row.id);
            cmsDeleted('Scheme');
            await load({ quiet: true });
        } catch (err) {
            cmsFailed('Scheme', errorMessage(err, ''));
        }
    };

    const submitSettings = async () => {
        setSaving(true);
        try {
            await saveSchemeSettings(settings);
            cmsSaved('Schemes page wording');
            await load({ quiet: true });
            setSettingsDirty(false);
        } catch (err) {
            cmsFailed('Schemes page wording', errorMessage(err, ''));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <CmsPage><CmsLoading /></CmsPage>;
    if (error) return <CmsPage><CmsError message={error} onRetry={load} /></CmsPage>;

    /* ---------------------------------------------------------- the form */
    if (scheme) {
        const tier = (scheme.tier || 'national') as SchemeTier;
        return (
            <CmsPage>
                <CmsCard
                    title={scheme.id ? 'Edit scheme' : 'New scheme'}
                    description="The card shows the name, the short description and who it is for. “View more” opens a page with everything below, and “Click to apply” takes the reader to the official website you paste in Section 4."
                >
                    <button
                        type="button"
                        onClick={() => setScheme(null)}
                        className="mb-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2
                                   text-[1.0625rem] font-semibold text-slate-600 transition-colors hover:border-[#2563EB]
                                   hover:text-[#2563EB] dark:border-[#2a2a2a] dark:text-neutral-300"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to {tab === 'states' && openState ? 'the state' : 'the list'}
                    </button>

                    <datalist id="scheme-states">
                        {stateOptions.map((name) => <option key={name} value={name} />)}
                    </datalist>
                    <datalist id="scheme-districts">
                        {districtOptions.map((name) => <option key={name} value={name} />)}
                    </datalist>

                    <SaveNowProvider value={{ save: submit, saving, dirty: true, label: 'Save scheme' }}>
                    <CmsSteps>
                        <CmsStep
                            step="Section 1"
                            title="Where it applies"
                            hint="Central schemes appear under Central. State and district schemes appear on that state's page — district ones grouped under their district."
                        >
                            <CmsChoice<SchemeTier>
                                label="Scheme level"
                                value={tier}
                                onChange={(next) => setS({ tier: next })}
                                options={[
                                    { value: 'national', icon: <Landmark className="h-5 w-5" />, title: 'Central', detail: 'Government of India — every state' },
                                    { value: 'state', icon: <MapPin className="h-5 w-5" />, title: 'State', detail: 'One state government' },
                                    { value: 'district', icon: <MapPin className="h-5 w-5" />, title: 'District', detail: 'One district inside a state' },
                                ]}
                            />

                            {tier !== 'national' && (
                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <CmsField label="State" hint="Pick from the list so the spelling matches the state page.">
                                        <CmsInput
                                            list="scheme-states"
                                            value={scheme.state || ''}
                                            placeholder="Tamil Nadu"
                                            onChange={(e) => setS({ state: e.target.value })}
                                        />
                                    </CmsField>
                                    {tier === 'district' && (
                                        <CmsField label="District">
                                            <CmsInput
                                                list="scheme-districts"
                                                value={scheme.district || ''}
                                                placeholder="Coimbatore"
                                                onChange={(e) => setS({ district: e.target.value })}
                                            />
                                        </CmsField>
                                    )}
                                </div>
                            )}
                        </CmsStep>

                        <CmsStep step="Section 2" title="The scheme" hint="What the card prints, and the opening of the scheme's page.">
                            <CmsField label="Scheme name">
                                <CmsInput
                                    value={scheme.title || ''}
                                    placeholder="Credit Guarantee Fund for Micro and Small Enterprises"
                                    onChange={(e) => setS({ title: e.target.value })}
                                />
                            </CmsField>
                            <CmsField label="Short description" hint="Two or three lines. Printed on the card and at the top of the scheme's page.">
                                <CmsTextarea rows={3} value={scheme.summary || ''}
                                             onChange={(e) => setS({ summary: e.target.value })} />
                            </CmsField>
                            <CmsField label="About the scheme" hint="The full description on the “View more” page. Leave a blank line between paragraphs.">
                                <CmsTextarea rows={8} value={scheme.body || ''}
                                             onChange={(e) => setS({ body: e.target.value })} />
                            </CmsField>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <CmsField label="Category" hint="A chip on the card, and a filter on the Central page.">
                                    <CmsInput value={scheme.category || ''} placeholder="Credit"
                                              onChange={(e) => setS({ category: e.target.value })} />
                                </CmsField>
                                <CmsField label="Run by" hint="The ministry or department.">
                                    <CmsInput value={scheme.authority || ''} placeholder="Ministry of MSME"
                                              onChange={(e) => setS({ authority: e.target.value })} />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep step="Section 3" title="The details" hint="Each becomes its own section on the scheme's page. Leave one blank and that section is not shown.">
                            <CmsField label="Benefits" hint="What the member receives — amounts, subsidy rates, cover.">
                                <CmsTextarea rows={4} value={scheme.benefits || ''}
                                             onChange={(e) => setS({ benefits: e.target.value })} />
                            </CmsField>
                            <CmsField label="Who can apply" hint="Also printed on the card.">
                                <CmsTextarea rows={3} value={scheme.eligibility || ''}
                                             placeholder="Registered micro and small enterprises in manufacturing or services"
                                             onChange={(e) => setS({ eligibility: e.target.value })} />
                            </CmsField>
                            <CmsField label="How to apply" hint="One step per line — printed as a numbered list.">
                                <CmsTextarea rows={5} value={scheme.howToApply || ''}
                                             placeholder={'Register on the Udyam portal\nFill in the online application\nUpload the documents and submit'}
                                             onChange={(e) => setS({ howToApply: e.target.value })} />
                            </CmsField>
                            <LineList
                                label="Documents required"
                                hint="One per line — printed as a checklist."
                                value={scheme.documentsRequired || []}
                                onChange={(documentsRequired) => setS({ documentsRequired })}
                                placeholder={'Aadhaar card\nUdyam registration certificate\nBank statement (6 months)'}
                                clearable
                            />
                            <CmsField label="Helpline" hint="A phone number, an email or an office to ask.">
                                <CmsInput value={scheme.helpline || ''} placeholder="1800-180-6763"
                                          onChange={(e) => setS({ helpline: e.target.value })} />
                            </CmsField>
                        </CmsStep>

                        <CmsStep step="Section 4" title="Apply link and dates" hint="“Click to apply” opens this link, on the official website, in a new tab.">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <CmsField label="Click to apply — official link">
                                    <CmsInput value={scheme.applyUrl || ''} placeholder="https://www.cgtmse.in"
                                              onChange={(e) => setS({ applyUrl: e.target.value })} />
                                </CmsField>
                                <CmsField label="Notification or form (optional)">
                                    <CmsInput value={scheme.documentUrl || ''} placeholder="https://…/guidelines.pdf"
                                              onChange={(e) => setS({ documentUrl: e.target.value })} />
                                </CmsField>
                                <CmsField label="Status / deadline" hint="Free text: “Open”, “Closes 31 Mar 2026”.">
                                    <CmsInput value={scheme.deadline || ''} placeholder="Open"
                                              onChange={(e) => setS({ deadline: e.target.value })} />
                                </CmsField>
                                <CmsField label="Icon" hint="A name from the CMS icon set, e.g. file-text, landmark, factory.">
                                    <CmsInput value={scheme.icon || ''} placeholder="file-text"
                                              onChange={(e) => setS({ icon: e.target.value })} />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep step="Section 5" title="Picture" hint="Optional. Shown at the top of the scheme's page.">
                            <UploadField
                                label="Scheme picture"
                                url={scheme.image?.url || ''}
                                onChange={(url) => setS({ image: { ...(scheme.image || blank().image!), url } })}
                            />
                        </CmsStep>

                        <CmsStep step="Section 6" title="Publishing">
                            <CmsCheck
                                checked={scheme.status === 'published'}
                                onChange={(on) => setS({ status: on ? 'published' : 'draft' })}
                                title="Published"
                                detail="Off means only you can see it, on the site as well as here."
                            />
                            <div className="mt-3">
                                <CmsCheck
                                    checked={scheme.featured === true}
                                    onChange={(featured) => setS({ featured })}
                                    title="Feature this scheme"
                                    detail="Puts it first in its list."
                                />
                            </div>
                            <div className="mt-4 max-w-xs">
                                <CmsField label="Order" hint="Lower numbers come first.">
                                    <CmsInput type="number" value={String(scheme.sortOrder ?? 0)}
                                              onChange={(e) => setS({ sortOrder: Number(e.target.value || 0) })} />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep
                            step="Section 7"
                            title="Your own fields"
                            hint="Circular no., Subsidy rate, Sanctioned by — anything this scheme should record that the fields above do not cover. Each one becomes its OWN section on the page, under the title you give it here, set like “About the scheme” above."
                        >
                            <ExtraFieldsEditor bare items={scheme.extraFields || []}
                                               onChange={(extraFields) => setS({ extraFields })} />
                        </CmsStep>
                    </CmsSteps>
                    </SaveNowProvider>

                    {/* CANCEL ONLY. The Save that stood beside it is in every
                        card's footer now, labelled "Save scheme" — see
                        `label` on `SaveNowValue`. Leaving this one here put two
                        identical saves on the screen. */}
                    <div className="mt-8 flex gap-3">
                        <CmsButton variant="ghost" onClick={() => setScheme(null)}>Cancel</CmsButton>
                    </div>
                </CmsCard>
            </CmsPage>
        );
    }

    /* ---------------------------------------------------------- the list */
    return (
        <CmsPage>
            <CmsCard
                title="Schemes"
                description="Government schemes, reached from the Schemes dropdown in the header: Central, or a region and then a state, whose page lists its state schemes and then its district schemes. Each card has “View more” and “Click to apply”."
            >
                <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-[#1f1f1f]">
                    {([
                        ['central', 'Central', schemes.filter((x) => x.tier === 'national').length],
                        ['states', 'States', schemes.filter((x) => x.tier !== 'national').length],
                        ['settings', 'Page wording', null],
                    ] as [Tab, string, number | null][])
                        .map(([key, label, count]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={`-mb-px border-b-2 px-5 py-3 text-[1.25rem] font-semibold transition-colors ${tab === key
                                    ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200'}`}
                            >
                                {label}
                                {count !== null && <span className="ml-2 text-[1.1875rem] text-slate-400">{count}</span>}
                            </button>
                        ))}
                </div>

                {(tab === 'central' || tab === 'states') && (
                    <CmsScopeBrowser<SchemeRecord>
                        view={tab === 'central' ? 'national' : 'states'}
                        items={schemes}
                        scopeOf={(x) => ({ tier: x.tier, state: x.state, district: x.district })}
                        regionMap={regionMap}
                        nationalLabel="Central"
                        noun="scheme"
                        openState={openState}
                        onOpenState={setOpenState}
                        publicHref={(st) => `/schemes/state/${st.slug}`}
                        onAdd={(prefill) => setScheme({ ...blank(), ...prefill })}
                        renderRow={(row) => (
                            <SchemeRow key={row.id} row={row} onEdit={() => setScheme(row)} onRemove={() => remove(row)} />
                        )}
                    />
                )}

                {tab === 'settings' && (
                    <SaveNowProvider value={{ save: submitSettings, saving, dirty: settingsDirty }}>
                    <SectionToolsProvider value={{
                        sections: settings.sections || [],
                        onChange: (sections) => setSettings({ ...settings, sections }),
                    }}>
                        <CmsSteps>
                            <CmsStep step="Section 1" title="The band at the top" hint="The badge and picture over every schemes page.">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <CmsField label="Small label">
                                        <CmsInput value={settings.badgeText || ''} placeholder="Schemes"
                                                  onChange={(e) => setSettings({ ...settings, badgeText: e.target.value })} />
                                    </CmsField>
                                    <CmsField label="Icon" hint="A name from the CMS icon set.">
                                        <CmsInput value={settings.badgeIcon || ''} placeholder="landmark"
                                                  onChange={(e) => setSettings({ ...settings, badgeIcon: e.target.value })} />
                                    </CmsField>
                                </div>
                                <UploadField
                                    label="Background picture"
                                    url={settings.heroImage?.url || ''}
                                    onChange={(url) => setSettings({
                                        ...settings,
                                        heroImage: { url, type: 'image', alt: '', fit: 'cover', position: 'center' },
                                    })}
                                />
                            </CmsStep>

                            <CmsStep step="Section 2" title="The central page" hint="Reached from Schemes → Central in the header. State pages are titled with the state's name.">
                                <CmsField label="Title">
                                    <CmsInput value={settings.centralLabel || ''} placeholder="Central schemes"
                                              onChange={(e) => setSettings({ ...settings, centralLabel: e.target.value })} />
                                </CmsField>
                                <CmsField label="Description">
                                    <CmsTextarea rows={2} value={settings.centralDescription || ''}
                                                 onChange={(e) => setSettings({ ...settings, centralDescription: e.target.value })} />
                                </CmsField>
                                <CmsField label="When a list is empty" hint="Leave blank for “Nothing has been published here yet.”">
                                    <CmsInput value={settings.emptyMessage || ''}
                                              onChange={(e) => setSettings({ ...settings, emptyMessage: e.target.value })} />
                                </CmsField>
                            </CmsStep>
                        </CmsSteps>

                        {/* The LINK stays, the duplicate save does not — see the
                            note on `GalleryManager`. Every card above carries a
                            Save in its footer now, and this called the same
                            function they do. */}
                        <div className="mt-8 flex items-center gap-3">
                            <a href="/schemes" target="_blank" rel="noopener noreferrer"
                               className="inline-flex items-center gap-1.5 text-[1.0625rem] font-semibold text-blue-700 dark:text-blue-400">
                                View the schemes page <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </SectionToolsProvider>
                    </SaveNowProvider>
                )}
            </CmsCard>
        </CmsPage>
    );
}

/** One scheme in a list: what it is, where, whether it is live, and its two actions. */
function SchemeRow({ row, onEdit, onRemove }: { row: SchemeRecord; onEdit: () => void; onRemove: () => void }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5
                        transition-colors hover:border-slate-300 dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50
                             text-[#2563EB] dark:bg-blue-950/40">
                {row.tier === 'national' ? <Landmark className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[1.25rem] font-bold text-slate-900 dark:text-white">{row.title || 'Untitled'}</p>
                <p className="truncate text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                    {[TIER_LABEL[row.tier], row.district, row.authority, row.deadline].filter(Boolean).join(' · ')}
                </p>
            </div>
            {!row.applyUrl && (
                <span className="hidden shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[1rem] font-semibold
                                 text-amber-700 sm:inline dark:bg-amber-950/30 dark:text-amber-300">
                    No apply link
                </span>
            )}
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[1.0625rem] font-bold ${row.status === 'published'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-500 dark:bg-[#161616] dark:text-neutral-400'}`}>
                {row.status === 'published' ? 'Published' : 'Draft'}
            </span>
            <button type="button" onClick={onEdit}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[1.0625rem]
                               font-semibold text-blue-700 transition-colors hover:bg-blue-50
                               dark:text-blue-400 dark:hover:bg-blue-950/40">
                <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button type="button" onClick={onRemove} aria-label="Delete"
                    className="shrink-0 rounded p-2 text-red-500 transition-colors hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
