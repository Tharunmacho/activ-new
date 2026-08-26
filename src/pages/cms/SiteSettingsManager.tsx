import { useEffect, useState } from 'react';
import { Save, Check, Loader2 } from 'lucide-react';
import {
    getSiteSettings, updateSiteSettings, errorMessage,
    type SiteSettings, type CmsLink,
} from '@/services/cmsApi';
import { CmsCard, CmsField, CmsInput, CmsLoading, CmsError } from './components/CmsUI';
import { RepeatableList, LinkList, LineList, IconPicker } from './components/CmsEditors';
import MediaPicker from './components/MediaPicker';

/**
 * The header and footer, which appear on every public page.
 *
 * Three blocks, three save buttons, for the same reason the home page has four:
 * they are independent, and saving the footer must not push a stale copy of the
 * nav over an edit made to it a moment ago in another tab.
 */

type BlockKey = 'brand' | 'header' | 'footer';

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

    const save = async (key: BlockKey) => {
        if (!site) return;
        setSaving(key);
        setSaved(null);
        setError('');
        try {
            // Take the server's copy back: it drops links with no destination
            // and unknown icons, and the editor should show what was stored.
            setSite(await updateSiteSettings({ [key]: site[key] } as Partial<SiteSettings>));
            setSaved(key);
            setTimeout(() => setSaved(null), 2500);
        } catch (err) {
            setError(errorMessage(err, 'Could not save'));
        } finally {
            setSaving(null);
        }
    };

    if (loading) return <CmsLoading label="Loading site settings…" />;
    if (!site) return <CmsError message={error || 'No content'} onRetry={load} />;

    const patch = (key: BlockKey, value: any) => setSite({ ...site, [key]: { ...site[key], ...value } });

    const SaveRow = ({ block, label }: { block: BlockKey; label: string }) => (
        <div className="mt-6">
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
        <div className="space-y-6 max-w-5xl">
            <CmsError message={error} />

            {/* ---- branding ---- */}
            <CmsCard title="Branding" description="The mark and wording used in both the header and the footer.">
                <div className="space-y-5">
                    <MediaPicker
                        label="Logo"
                        value={site.brand.logo}
                        onChange={logo => patch('brand', { logo })}
                        aspect="16 / 6"
                        hint="Use 'Fit inside' so the whole mark is visible rather than cropped."
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CmsField label="Short name">
                            <CmsInput
                                value={site.brand.name}
                                onChange={e => patch('brand', { name: e.target.value })}
                                placeholder="ACTIV"
                            />
                        </CmsField>
                        <CmsField label="Tagline" hint="Shown under the logo in the footer.">
                            <CmsInput
                                value={site.brand.tagline}
                                onChange={e => patch('brand', { tagline: e.target.value })}
                                placeholder="Building Future"
                            />
                        </CmsField>
                    </div>

                    <CmsField label="Full name" hint="The lockup beside the mark in the header, and the heading in the footer.">
                        <CmsInput
                            value={site.brand.fullName}
                            onChange={e => patch('brand', { fullName: e.target.value })}
                            placeholder="Adidravidar Confederation of Trade and Industrial Vision"
                        />
                    </CmsField>
                </div>

                <SaveRow block="brand" label="Save branding" />
            </CmsCard>

            {/* ---- header ---- */}
            <CmsCard title="Header" description="The navigation bar. Links appear left to right in this order.">
                <div className="space-y-5">
                    <LinkList
                        items={site.header.navLinks}
                        onChange={navLinks => patch('header', { navLinks })}
                        noun="nav link"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <CmsField label="Button label" hint="Leave blank to hide the button.">
                            <CmsInput
                                value={site.header.ctaLabel}
                                onChange={e => patch('header', { ctaLabel: e.target.value })}
                                placeholder="Login"
                            />
                        </CmsField>
                        <CmsField label="Button link">
                            <CmsInput
                                value={site.header.ctaHref}
                                onChange={e => patch('header', { ctaHref: e.target.value })}
                                placeholder="/login"
                            />
                        </CmsField>
                    </div>
                </div>

                <SaveRow block="header" label="Save header" />
            </CmsCard>

            {/* ---- footer ---- */}
            <CmsCard title="Footer" description="Address, link columns, contact details and social buttons.">
                <div className="space-y-6">
                    <LineList
                        label="Address"
                        value={site.footer.addressLines}
                        onChange={addressLines => patch('footer', { addressLines })}
                        placeholder={'6&7, Hayagreeva Apartments,\n121, Velachery Road, Guindy,\nChennai, TamilNadu-600032, India'}
                    />

                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Link columns</p>
                        <p className="text-xs text-slate-500 mb-3">
                            Each column renders side by side. Leave a heading blank for an unlabelled column.
                        </p>

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
                                            placeholder="News"
                                        />
                                    </CmsField>
                                    <LinkList
                                        items={column.links || []}
                                        onChange={links => update({ links })}
                                    />
                                </div>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CmsField label="Contact heading">
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

                    <LineList
                        label="Phone numbers"
                        value={site.footer.phones}
                        onChange={phones => patch('footer', { phones })}
                        rows={3}
                        placeholder={'+91 44 2345 6789\n+91 98765 43210'}
                    />

                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Social buttons</p>
                        <RepeatableList<{ icon: string; href: string }>
                            items={site.footer.socials}
                            onChange={socials => patch('footer', { socials })}
                            noun="social link"
                            blank={() => ({ icon: 'facebook', href: '' })}
                            row={(social, update) => (
                                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
                                    <IconPicker value={social.icon} onChange={icon => update({ icon })} />
                                    <CmsField label="Link" hint="A link that goes nowhere is dropped on save.">
                                        <CmsInput
                                            value={social.href}
                                            onChange={e => update({ href: e.target.value })}
                                            placeholder="https://facebook.com/…"
                                        />
                                    </CmsField>
                                </div>
                            )}
                        />
                    </div>

                    <CmsField
                        label="Copyright line"
                        hint="Write {year} where the current year should appear — it then never needs updating."
                    >
                        <CmsInput
                            value={site.footer.copyright}
                            onChange={e => patch('footer', { copyright: e.target.value })}
                            placeholder="© {year} ACTIV - Designed and Developed by ACTIV Tech Team"
                        />
                    </CmsField>

                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Bottom-bar links</p>
                        <LinkList
                            items={site.footer.legalLinks}
                            onChange={legalLinks => patch('footer', { legalLinks })}
                            noun="legal link"
                        />
                    </div>

                    <CmsField label="Closing note">
                        <CmsInput
                            value={site.footer.note}
                            onChange={e => patch('footer', { note: e.target.value })}
                            placeholder="All rights reserved."
                        />
                    </CmsField>
                </div>

                <SaveRow block="footer" label="Save footer" />
            </CmsCard>
        </div>
    );
}
