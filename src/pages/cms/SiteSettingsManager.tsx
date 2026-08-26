import { useEffect, useState } from 'react';
import { Save, Check, Loader2 } from 'lucide-react';
import {
    getSiteSettings, updateSiteSettings, errorMessage,
    type SiteSettings, type CmsLink,
} from '@/services/cmsApi';
import {
    CmsCard,
    CmsField,
    CmsInput,
    CmsColorInput,
    CmsLoading,
    CmsError,
    CmsPage,
    CmsSection,
    cmsSaved,
    cmsFailed,
} from './components/CmsUI';
import { RepeatableList, LinkList, LineList, IconPicker } from './components/CmsEditors';
import MediaPicker from './components/MediaPicker';

/**
 * The header and the footer — two cards, matching the two bars they control.
 *
 * There used to be three. A separate "Branding" card held the logo, the names
 * and the tagline, because those values are stored together under `brand`. That
 * is a fact about the database, not about the page an editor is looking at: to
 * change the header, you edited two cards, and neither of them showed you the
 * whole header.
 *
 * Each card now holds everything its bar renders, and nothing else:
 *
 *   Header — logo, full name, colours, nav links, the login button
 *   Footer — logo and tagline, address, link columns, contact, socials, legal
 *
 * The logo and the full name appear in both bars, so they are edited in the
 * Header card and shown read-only in the Footer card, which says where to change
 * them. Duplicating an editable field in two places invites two different
 * answers to one question.
 *
 * Also gone: **Short name**. It was rendered by nothing — not the header, not
 * the footer, not a page — so the CMS was asking an editor to fill in a field
 * with no effect anywhere on the site.
 *
 * Anything repeatable is still repeatable: nav links, footer columns and the
 * links inside them, phone numbers, address lines, social buttons and legal
 * links can each be added, reordered and removed, and every one is stored and
 * read back from the database.
 */

type BlockKey = 'header' | 'footer';

export default function SiteSettingsManager() {
    const [site, setSite] = useState<SiteSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<BlockKey | null>(null);
    const [saved, setSaved] = useState<BlockKey | null>(null);

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

    /**
     * Save one bar.
     *
     * `brand` rides along with both, because the logo, the full name and the
     * tagline are shown inside these two cards rather than in a card of their
     * own. Both send the same local copy, so whichever is saved second cannot
     * undo an edit made in the other.
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
                [key]: site[key],
            } as Partial<SiteSettings>));
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

    const patch = (key: 'brand' | BlockKey, value: any) =>
        setSite({ ...site, [key]: { ...site[key], ...value } });

    const SaveRow = ({ block, label }: { block: BlockKey; label: string }) => (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-[#1f1f1f]">
            <button
                type="button"
                disabled={saving === block}
                onClick={() => save(block)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500
                           text-white rounded-lg text-sm font-medium transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving === block
                    ? <Loader2 size={16} className="animate-spin" />
                    : saved === block ? <Check size={16} /> : <Save size={16} />}
                {saving === block ? 'Saving…' : saved === block ? 'Saved' : label}
            </button>
        </div>
    );

    return (
        <CmsPage>
            <CmsError message={error} />

            {/* ======================================================= header */}
            <CmsCard
                title="Header"
                description="Everything in the bar at the top of every public page."
            >
                <div className="space-y-0">
                    <CmsSection
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
                    </CmsSection>

                    <CmsSection
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
                                className="text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                                style={{ color: site.header.textColor || '#1c2e68' }}
                            >
                                {site.brand.fullName || 'Your organisation'}
                            </span>
                            <span className="flex items-center gap-4 whitespace-nowrap">
                                {(site.header.navLinks || []).slice(0, 4).map((item, i) => (
                                    <span
                                        key={i}
                                        className="text-xs font-medium"
                                        style={{ color: site.header.textColor || '#1c2e68' }}
                                    >
                                        {item.label || 'Link'}
                                    </span>
                                ))}
                                {site.header.ctaLabel && (
                                    <span
                                        className="text-xs font-medium text-white px-4 py-1.5 rounded-full"
                                        style={{ backgroundColor: site.header.textColor || '#1c2e68' }}
                                    >
                                        {site.header.ctaLabel}
                                    </span>
                                )}
                            </span>
                        </div>
                    </CmsSection>

                    <CmsSection
                        title="Navigation links"
                        hint="Shown left to right in this order. Add, reorder or remove as many as you need."
                    >
                        <LinkList
                            items={site.header.navLinks}
                            onChange={navLinks => patch('header', { navLinks })}
                            noun="nav link"
                        />
                    </CmsSection>

                    <CmsSection title="Button">
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
                    </CmsSection>
                </div>

                <SaveRow block="header" label="Save header" />
            </CmsCard>

            {/* ======================================================= footer */}
            <CmsCard
                title="Footer"
                description="Everything in the band at the bottom of every public page."
            >
                <div className="space-y-0">
                    <CmsSection
                        title="Logo and name"
                        hint="The same mark and name the header uses. Change them in the Header card above."
                    >
                        <div className="flex items-center gap-4 rounded-lg border border-slate-200
                                        dark:border-[#1f1f1f] bg-slate-50 dark:bg-black/40 px-4 py-3">
                            {site.brand.logo?.url ? (
                                <img
                                    src={site.brand.logo.url}
                                    alt={site.brand.logo.alt || ''}
                                    className="h-10 w-auto max-w-[140px] object-contain shrink-0"
                                />
                            ) : (
                                <span className="text-xs text-neutral-400 shrink-0">No logo set</span>
                            )}
                            <span className="text-xs text-slate-600 dark:text-neutral-300 min-w-0">
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
                    </CmsSection>

                    <CmsSection title="Address" hint="One line per line.">
                        <LineList
                            value={site.footer.addressLines}
                            onChange={addressLines => patch('footer', { addressLines })}
                            placeholder={'6&7, Hayagreeva Apartments,\n121, Velachery Road, Guindy,\nChennai, TamilNadu-600032, India'}
                        />
                    </CmsSection>

                    <CmsSection
                        title="Link columns"
                        hint="Each column renders side by side. Leave a heading blank for an unlabelled column."
                    >
                        <RepeatableList<{ heading: string; links: CmsLink[] }>
                            items={site.footer.linkColumns}
                            onChange={linkColumns => patch('footer', { linkColumns })}
                            noun="column"
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
                    </CmsSection>

                    <CmsSection title="Contact">
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
                    </CmsSection>

                    <CmsSection
                        title="Social buttons"
                        hint="A button with no link at all is removed when you save. Leave # as a placeholder while an account is being set up."
                    >
                        <RepeatableList<{ icon: string; href: string }>
                            items={site.footer.socials}
                            onChange={socials => patch('footer', { socials })}
                            noun="social link"
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
                    </CmsSection>

                    <CmsSection title="Bottom bar">
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

                        <div className="mt-5">
                            <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 mb-3">
                                Legal links
                            </p>
                            <LinkList
                                items={site.footer.legalLinks}
                                onChange={legalLinks => patch('footer', { legalLinks })}
                                noun="legal link"
                            />
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
                    </CmsSection>
                </div>

                <SaveRow block="footer" label="Save footer" />
            </CmsCard>
        </CmsPage>
    );
}
