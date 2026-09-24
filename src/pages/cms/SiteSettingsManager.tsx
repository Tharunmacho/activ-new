import { useEffect, useState } from 'react';
import { Lock, ExternalLink, AlertCircle } from 'lucide-react';
import {
    getSiteSettings, updateSiteSettings, getLegalLinks, errorMessage,
    type SiteSettings, type CmsLink, type CmsSectionOverride,
} from '@/services/cmsApi';
import {
    CmsSteps,
    CmsStep,
    CmsBlock,
    SaveNowProvider,
    SectionToolsProvider,
    CmsField,
    CmsInput,
    CmsColorInput,
    CmsLoading,
    CmsError,
    CmsPage,
    cmsSaved,
    cmsFailed,
} from './components/CmsUI';
import { RepeatableList, LinkList, LineList, IconPicker , ExtraFieldsEditor } from './components/CmsEditors';
import MediaPicker from './components/MediaPicker';

/**
 * The header and the footer — two blocks, matching the two bars they control.
 *
 * There used to be three. A separate "Branding" card held the logo, the names
 * and the tagline, because those values are stored together under `brand`. That
 * is a fact about the database, not about the page an editor is looking at: to
 * change the header, you edited two cards, and neither of them showed you the
 * whole header.
 *
 * Each block now holds everything its bar renders, and nothing else:
 *
 *   Header — logo, full name, colours, nav links, the login button
 *   Footer — logo and tagline, address, link columns, contact, socials, legal
 *
 * The logo and the full name appear in both bars, so they are edited in the
 * Header cards and shown read-only in the Footer one, which says where to
 * change them. Duplicating an editable field in two places invites two
 * different answers to one question.
 *
 * Also gone: **Short name**. It was rendered by nothing — not the header, not
 * the footer, not a page — so the CMS was asking an editor to fill in a field
 * with no effect anywhere on the site.
 *
 * Anything repeatable is still repeatable: nav links, footer columns and the
 * links inside them, phone numbers, address lines, social buttons and legal
 * links can each be added, reordered and removed, and every one is stored and
 * read back from the database. Every card also carries its own Remove and its
 * own "Add field" — see `SectionToolsProvider`.
 */

type BlockKey = 'header' | 'footer';

export default function SiteSettingsManager() {
    const [site, setSite] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<BlockKey | null>(null);
    const [, setSaved] = useState<BlockKey | null>(null);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setSite(await getSiteSettings());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the site settings'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    /*
     * Which block has unsaved work.
     *
     * Per block, not per page: the header and the footer save separately, so
     * a footer card's save must stay grey when the only edit on screen was to
     * the header.
     */
    const [dirty, setDirty] = useState({ header: false, footer: false });

    /*
     * The PUBLISHED policies, which the footer draws alongside the authored
     * links below and this card knew nothing about — see the note on the
     * Bottom bar card.
     */
    const [policies, setPolicies] = useState<{ label: string; href: string }[]>([]);

    useEffect(() => {
        let cancelled = false;
        getLegalLinks()
            .then((rows) => { if (!cancelled) setPolicies(rows || []); })
            /* Silent: this is context beside a control, not the control. */
            .catch(() => { /* the card renders without it */ });
        return () => { cancelled = true; };
    }, []);

    /**
     * Save one bar.
     *
     * `brand`, `extraFields` and `sections` ride along with both, because each
     * is edited inside one of these two cards rather than in a card of its own.
     * Both send the same local copy, so whichever is saved second cannot undo
     * an edit made in the other.
     */
    const save = async (key: BlockKey) => {
        if (!site) return;
        setSaving(key);
        setSaved(null);
        setError('');
        try {
            // Take the server's copy back: it drops links with no destination,
            // rejects a colour that is not a hex value and discards unknown
            // icons, and the editor should show what was actually stored.
            setSite(await updateSiteSettings({
                brand: site.brand,
                // Leaving these out sent a 200 back on a save that stored
                // nothing an editor had just typed into them.
                extraFields: site.extraFields,
                sections: site.sections,
                [key]: site[key],
            } as Partial<SiteSettings>));
            setDirty((d) => ({ ...d, [key]: false }));
            setSaved(key);
            cmsSaved(key === 'header' ? 'Header' : 'Footer');
            setTimeout(() => setSaved(null), 2500);
        } catch (err) {
            const message = errorMessage(err, 'Could not save');
            setError(message);
            cmsFailed(key === 'header' ? 'Header' : 'Footer', message);
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <CmsLoading label="Loading site settings…" />;
    if (!site) return <CmsError message={error || 'No content'} onRetry={load} />;

    /*
     * The setter marks its block dirty.
     *
     * `brand` belongs to BOTH — the logo and the colours are sent with
     * whichever block is saved — so editing it lights up both saves, which
     * is true: either one will store it.
     */
    const patch = (key: 'brand' | BlockKey, value: any) => {
        setSite({ ...site, [key]: { ...site[key], ...value } });
        if (key === 'brand') setDirty({ header: true, footer: true });
        else setDirty((d) => ({ ...d, [key]: true }));
    };

    /*
     * Removing a card, or adding a field to one.
     *
     * ONE list for the whole screen, sent with either block, so both saves
     * light up — see the note on `patch`.
     */
    const setSections = (sections: CmsSectionOverride[]) => {
        setSite({ ...site, sections });
        setDirty({ header: true, footer: true });
    };

    const sectionTools = { sections: site.sections || [], onChange: setSections };

    return (
        <CmsPage>
            <CmsError message={error} />

            {/*
              * ==============================================================
              * THE HEADER — numbered cards, each saving the header
              * ==============================================================
              *
              * This screen saves by BLOCK: the header and the footer are two
              * writes as far as the server is concerned, and one must not
              * touch the other. So the provider is per block, and every card
              * inside this one saves the header — which is what the single
              * "Save header" button did, spread across the cards it covered.
              */}
            <SaveNowProvider
                value={{
                    save: () => save('header'),
                    saving: saving === 'header',
                    dirty: dirty.header,
                }}
            >
                <SectionToolsProvider value={sectionTools}>
                    <CmsBlock
                        title="The header bar"
                        hint="The bar at the top of every page. These four cards save together."
                    />
                    <CmsSteps>
                        <CmsStep
                            sectionKey="header.brand"
                            ownFields={false}
                            /* The one card here that cannot be removed: a header
                               with no mark and no name is not a header. */
                            fixed
                            step="Header 1"
                            title="Logo and name"
                            hint="Also used in the footer — editing here changes both."
                        >
                            <div className="space-y-5">
                                <MediaPicker
                                    label="Logo"
                                    value={site.brand.logo}
                                    onChange={logo => patch('brand', { logo })}
                                    aspect="16 / 6"
                                    hint="Use 'Fit whole' so the entire mark is visible rather than cropped."
                                />
                                <CmsField
                                    label="Full name"
                                    hint="The lockup beside the mark in the header, and the heading in the footer."
                                >
                                    <CmsInput
                                        value={site.brand.fullName}
                                        onChange={e => patch('brand', { fullName: e.target.value })}
                                        placeholder="Adidravidar Confederation of Trade and Industrial Vision"
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="header.colours"
                            ownFields={false}
                            step="Header 2"
                            title="Colours"
                            hint="Applied to the bar itself and to the text, links and button on it."
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <CmsField label="Background">
                                    <CmsColorInput
                                        value={site.header.background}
                                        onChange={background => patch('header', { background })}
                                        fallback="#ffffff"
                                    />
                                </CmsField>
                                <CmsField label="Text and button">
                                    <CmsColorInput
                                        value={site.header.textColor}
                                        onChange={textColor => patch('header', { textColor })}
                                        fallback="#1c2e68"
                                    />
                                </CmsField>
                            </div>

                            {/* What the two colours actually produce, at a glance. */}
                            <div
                                className="mt-5 rounded-lg border border-slate-200 dark:border-[#1f1f1f] px-4 py-3
                                           flex items-center justify-between gap-4 overflow-x-auto"
                                style={{ backgroundColor: site.header.background || '#ffffff' }}
                            >
                                <span
                                    className="text-[1.0625rem] font-bold uppercase tracking-wider whitespace-nowrap"
                                    style={{ color: site.header.textColor || '#1c2e68' }}
                                >
                                    {site.brand.fullName || 'Your organisation'}
                                </span>
                                <span className="flex items-center gap-4 whitespace-nowrap">
                                    {(site.header.navLinks || []).slice(0, 4).map((item, i) => (
                                        <span
                                            key={i}
                                            className="text-[1.0625rem] font-medium"
                                            style={{ color: site.header.textColor || '#1c2e68' }}
                                        >
                                            {item.label || 'Link'}
                                        </span>
                                    ))}
                                    {site.header.ctaLabel && (
                                        <span
                                            className="text-[1.0625rem] font-medium text-white px-4 py-1.5 rounded-full"
                                            style={{ backgroundColor: site.header.textColor || '#1c2e68' }}
                                        >
                                            {site.header.ctaLabel}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="header.navLinks"
                            ownFields={false}
                            step="Header 3"
                            title="Navigation links"
                            hint="Shown left to right in this order. Add, reorder or remove as many as you need."
                        >
                            <LinkList
                                items={site.header.navLinks}
                                onChange={navLinks => patch('header', { navLinks })}
                                noun="nav link"
                            />

                            {/*
                              * ==========================================================
                              * REGIONS IS IN THE HEADER, AND WAS NOT ON THIS SCREEN
                              * ==========================================================
                              *
                              * The menu is built from the region and state pages, so it
                              * is not one of the links above and never could be: an
                              * editor cannot type a two-level menu into a label and a
                              * path, and a link typed here would go stale the moment a
                              * region page was published or unpublished.
                              *
                              * That was a reason to keep it out of the LIST. It was
                              * never a reason to leave it off the SCREEN — an editor
                              * counting seven links against eight things in the header
                              * has found a bug that is not there, and said so.
                              *
                              * So it is shown, in the place it actually occupies (after
                              * the links), with what it holds and where to edit it.
                              * Locked rather than hidden: an editor should be able to
                              * see everything the header contains on the screen called
                              * Header & Footer.
                              */}
                            <div className="mt-3 flex items-center gap-3 rounded-xl border
                                            border-slate-200 bg-slate-50/70 p-3.5 dark:border-[#2a2a2a]
                                            dark:bg-[#0f0f0f]">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center
                                                 rounded-lg bg-slate-200/70 text-slate-500
                                                 dark:bg-[#161616] dark:text-neutral-400">
                                    <Lock className="h-4 w-4" />
                                </span>

                                <div className="min-w-0 flex-1">
                                    <p className="text-[1.25rem] font-bold text-slate-900 dark:text-white">
                                        Zones
                                        <span className="ml-2 text-[1.0625rem] font-semibold text-slate-400">
                                            always last
                                        </span>
                                    </p>
                                    <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                                        A menu of the national page, the five zones and their states —
                                        built from the pages themselves, so publishing one adds it here.
                                    </p>
                                </div>

                                <a
                                    href="/cms/regions"
                                    className="shrink-0 rounded-lg px-3 py-1.5 text-[1.0625rem] font-semibold
                                               text-blue-700 transition-colors hover:bg-blue-50
                                               dark:text-blue-400 dark:hover:bg-blue-950/40"
                                >
                                    Edit in Zones &amp; States
                                </a>
                            </div>
                        </CmsStep>

                        <CmsStep sectionKey="header.cta" ownFields={false} step="Header 4" title="Button">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <CmsField label="Label" hint="Leave blank to hide the button.">
                                    <CmsInput
                                        value={site.header.ctaLabel}
                                        onChange={e => patch('header', { ctaLabel: e.target.value })}
                                        placeholder="Login"
                                    />
                                </CmsField>
                                <CmsField label="Link">
                                    <CmsInput
                                        value={site.header.ctaHref}
                                        onChange={e => patch('header', { ctaHref: e.target.value })}
                                        placeholder="/login"
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>
                    </CmsSteps>
                </SectionToolsProvider>
            </SaveNowProvider>

            {/* ======================================================= footer */}
            <SaveNowProvider
                value={{
                    save: () => save('footer'),
                    saving: saving === 'footer',
                    dirty: dirty.footer,
                }}
            >
                <SectionToolsProvider value={sectionTools}>
                    <CmsBlock
                        title="The footer bar"
                        hint="The bar at the foot of every page. These seven cards save together, separately from the header."
                    />
                    <CmsSteps>
                        <CmsStep
                            /*
                             * `card` only, on all six footer columns.
                             *
                             * A footer column is a narrow strip of labelled
                             * lines — a telephone number, an address — on a
                             * dark ground. A section of prose with its own
                             * heading in a 300px column is a heading over a
                             * word-per-line paragraph, and there are three of
                             * those columns side by side.
                             */
                            sectionKey="footer.brand"
                            fieldMode="card"
                            step="Footer 1"
                            title="Logo and name"
                            hint="The same mark and name the header uses. Change them in the Header card above."
                        >
                            <div className="flex items-center gap-4 rounded-lg border border-slate-200
                                            dark:border-[#1f1f1f] bg-slate-50 dark:bg-black/40 px-4 py-3">
                                {site.brand.logo?.url ? (
                                    <img
                                        src={site.brand.logo.url}
                                        alt={site.brand.logo.alt || ''}
                                        className="h-10 w-auto max-w-[8.75rem] object-contain shrink-0"
                                    />
                                ) : (
                                    <span className="text-[1.0625rem] text-neutral-400 shrink-0">No logo set</span>
                                )}
                                <span className="text-[1.0625rem] text-slate-600 dark:text-neutral-300 min-w-0">
                                    {site.brand.fullName || 'No name set'}
                                </span>
                            </div>

                            <div className="mt-5">
                                <CmsField label="Tagline" hint="Footer only — sits under the logo.">
                                    <CmsInput
                                        value={site.brand.tagline}
                                        onChange={e => patch('brand', { tagline: e.target.value })}
                                        placeholder="Building Future"
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        <CmsStep sectionKey="footer.address"
                            fieldMode="card" step="Footer 2" title="Address" hint="One line per line.">
                            <LineList
                                value={site.footer.addressLines}
                                onChange={addressLines => patch('footer', { addressLines })}
                                placeholder={'6&7, Hayagreeva Apartments,\n121, Velachery Road, Guindy,\nChennai, TamilNadu-600032, India'}
                            />
                        </CmsStep>

                        <CmsStep
                            sectionKey="footer.linkColumns"
                            fieldMode="card"
                            step="Footer 3"
                            title="Link columns"
                            hint="Each column renders side by side. Leave a heading blank for an unlabelled column."
                        >
                            <RepeatableList<{ heading: string; links: CmsLink[] }>
                                items={site.footer.linkColumns}
                                onChange={linkColumns => patch('footer', { linkColumns })}
                                noun="column"
                                summary={(col) => ({
                                    title: col.heading,
                                    subtitle: `${(col.links || []).length} links`,
                                })}
                                max={3}
                                blank={() => ({ heading: '', links: [] })}
                                row={(column, update) => (
                                    <div className="space-y-4">
                                        <CmsField label="Heading" hint="Optional.">
                                            <CmsInput
                                                value={column.heading}
                                                onChange={e => update({ heading: e.target.value })}
                                                placeholder="Quick links"
                                            />
                                        </CmsField>
                                        <LinkList
                                            items={column.links || []}
                                            onChange={links => update({ links })}
                                        />
                                    </div>
                                )}
                            />
                        </CmsStep>

                        <CmsStep sectionKey="footer.contact"
                            fieldMode="card" step="Footer 4" title="Contact">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <CmsField label="Heading">
                                    <CmsInput
                                        value={site.footer.contactHeading}
                                        onChange={e => patch('footer', { contactHeading: e.target.value })}
                                        placeholder="Contact"
                                    />
                                </CmsField>
                                <CmsField label="Email">
                                    <CmsInput
                                        value={site.footer.email}
                                        onChange={e => patch('footer', { email: e.target.value })}
                                        placeholder="enquiry@activ.org.in"
                                    />
                                </CmsField>
                            </div>

                            <div className="mt-5">
                                <LineList
                                    label="Phone numbers"
                                    hint="One per line."
                                    value={site.footer.phones}
                                    onChange={phones => patch('footer', { phones })}
                                    rows={3}
                                    placeholder={'+91 44 2345 6789\n+91 98765 43210'}
                                />
                            </div>
                        </CmsStep>

                        <CmsStep
                            sectionKey="footer.socials"
                            fieldMode="card"
                            step="Footer 5"
                            title="Social buttons"
                            hint="A button with no link at all is removed when you save. Leave # as a placeholder while an account is being set up."
                        >
                            <RepeatableList<{ icon: string; href: string }>
                                items={site.footer.socials}
                                onChange={socials => patch('footer', { socials })}
                                noun="social link"
                                /* An icon and a URL. See the note on `compact`. */
                                compact
                                summary={(item) => ({ title: item.icon, subtitle: item.href })}
                                blank={() => ({ icon: 'facebook', href: '' })}
                                row={(social, update) => (
                                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
                                        <IconPicker value={social.icon} onChange={icon => update({ icon })} />
                                        <CmsField label="Link">
                                            <CmsInput
                                                value={social.href}
                                                onChange={e => update({ href: e.target.value })}
                                                placeholder="https://facebook.com/…"
                                            />
                                        </CmsField>
                                    </div>
                                )}
                            />
                        </CmsStep>

                        <CmsStep sectionKey="footer.bottomBar"
                            fieldMode="card" step="Footer 6" title="Bottom bar">
                            <CmsField
                                label="Copyright line"
                                hint="Write {year} where the current year should appear — it then never needs updating."
                            >
                                <CmsInput
                                    value={site.footer.copyright}
                                    onChange={e => patch('footer', { copyright: e.target.value })}
                                    placeholder="© {year} ACTIV — Designed and developed by the ACTIV Tech Team"
                                />
                            </CmsField>

                            {/*
                              * ==================================================
                              * THE LEGAL ROW HAS TWO SOURCES
                              * ==================================================
                              *
                              * This card listed the authored links and nothing
                              * else, so it said “two” while the live footer showed
                              * four. The other two — in fact all four — come from
                              * the published policies, because a link pointing at
                              * `#` is dropped from the footer and both authored
                              * rows pointed at `#`.
                              *
                              * Shown, locked, with where they come from. An editor
                              * should be able to account for every link on the bar
                              * from the screen named after it.
                              */}
                            <div className="mt-5">
                                <p className="text-[1.1875rem] font-medium text-slate-700 dark:text-neutral-300 mb-3">
                                    Legal links
                                </p>

                                {policies.length > 0 && (
                                    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5
                                                    dark:border-[#2a2a2a] dark:bg-[#0f0f0f]">
                                        <div className="mb-2.5 flex items-start gap-3">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center
                                                             rounded-lg bg-slate-200/70 text-slate-500
                                                             dark:bg-[#161616] dark:text-neutral-400">
                                                <Lock className="h-4 w-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[1.25rem] font-bold text-slate-900 dark:text-white">
                                                    Your published policies
                                                    <span className="ml-2 text-[1.0625rem] font-semibold text-slate-400">
                                                        always shown
                                                    </span>
                                                </p>
                                                <p className="text-[1.0625rem] text-slate-500 dark:text-neutral-400">
                                                    One row per published policy. Publishing another adds it
                                                    to the footer on its own.
                                                </p>
                                            </div>
                                            <a
                                                href="/cms/legal"
                                                className="shrink-0 rounded-lg px-3 py-1.5 text-[1.0625rem] font-semibold
                                                           text-blue-700 transition-colors hover:bg-blue-50
                                                           dark:text-blue-400 dark:hover:bg-blue-950/40"
                                            >
                                                Edit in Legal Notices
                                            </a>
                                        </div>

                                        <ul className="flex flex-wrap gap-2">
                                            {policies.map((p) => (
                                                <li key={p.href}>
                                                    <a
                                                        href={p.href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 rounded-lg border
                                                                   border-slate-200 bg-white px-3 py-1.5 text-[1.0625rem]
                                                                   font-semibold text-slate-700 transition-colors
                                                                   hover:bg-slate-100 dark:border-[#2a2a2a]
                                                                   dark:bg-[#111] dark:text-neutral-300"
                                                    >
                                                        {p.label}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <p className="mb-2 text-[1.0625rem] font-medium text-slate-500 dark:text-neutral-400">
                                    Anything else for that row — a regulator, a parent body. These are
                                    yours to type; the policies above look after themselves.
                                </p>

                                <LinkList
                                    items={site.footer.legalLinks}
                                    onChange={legalLinks => patch('footer', { legalLinks })}
                                    noun="legal link"
                                />

                                {/*
                                  A row pointing at `#` is dropped by the footer, so it
                                  is on this screen and not on the site. That was true of
                                  both rows here and nothing said so.
                                */}
                                {(site.footer.legalLinks || []).some(
                                    (l) => !l.href || l.href.trim() === '#' || l.href.trim().startsWith('#'),
                                ) && (
                                    <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200
                                                  bg-amber-50 px-3 py-2 text-[1.0625rem] font-medium text-amber-900
                                                  dark:border-amber-900/60 dark:bg-amber-950/30
                                                  dark:text-amber-300">
                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            A link with no destination — or one pointing at
                                            <span className="font-bold"> #</span> — is not drawn on the
                                            site. Give it a path, or delete the row.
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="mt-5">
                                <CmsField label="Closing note">
                                    <CmsInput
                                        value={site.footer.note}
                                        onChange={e => patch('footer', { note: e.target.value })}
                                        placeholder="All rights reserved."
                                    />
                                </CmsField>
                            </div>
                        </CmsStep>

                        {/*
                          * The FOOTER's own list, separate from the per-card ones
                          * above. A row here is a line in the footer wherever the
                          * footer ends; a row on a card is a line inside that
                          * card's part of it.
                          */}
                        <CmsStep
                            sectionKey="footer.ownFields"
                            ownFields={false}
                            step="Footer 7"
                            title="Your own fields"
                            hint="Extra lines in the footer — a registration number, an office that is not the head office, anything else."
                        >
                            <ExtraFieldsEditor
                                bare
                                items={site.extraFields || []}
                                onChange={extraFields => {
                                    setSite({ ...site, extraFields });
                                    setDirty({ header: true, footer: true });
                                }}
                            />
                        </CmsStep>
                    </CmsSteps>
                </SectionToolsProvider>
            </SaveNowProvider>
        </CmsPage>
    );
}
