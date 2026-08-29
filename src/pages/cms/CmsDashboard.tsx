import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
    PanelTop, Home, FileText, PartyPopper, Images, Phone, Inbox,
    Check, AlertTriangle, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { getCmsOverview, errorMessage } from '@/services/cmsApi';
import { CmsLoading, CmsError } from './components/CmsUI';

/**
 * CMS overview.
 *
 * Reports what has and has not been authored, because an unconfigured section
 * renders as a blank strip on the live site and nothing else tells you.
 *
 * This screen used to fetch `/cms/overview` and then render none of it — a
 * loading state, an error state, and a welcome card reading "use the sidebar to
 * navigate". Every figure below comes from that payload; none is estimated
 * here, and a section with nothing authored says so rather than showing a zero
 * that could equally mean "empty" or "not set up".
 */

type Overview = {
    site?: { configured?: boolean; navLinks?: number; footerColumns?: number; socials?: number };
    home?: { configured?: boolean; slides?: number; aboutBullets?: number; aboutStats?: number };
    about?: { configured?: boolean; bullets?: number; stats?: number };
    contact?: { configured?: boolean; addressLines?: number; workingHours?: number };
    gallery?: { total?: number; hidden?: number };
    events?: { total?: number };
    messages?: { total?: number; unread?: number };
};

/**
 * A headline figure, laid out as the reference console draws it: the icon and a
 * small tracked label on one line, the number beneath at display size.
 *
 * Colours are passed in rather than written as `dark:` variants. On this screen
 * a `dark:hover:` variant lost to the plain `hover:` beside it and the row under
 * the cursor turned white with white text on it — invisible. The shell already
 * knows which theme is on and hands it down through the outlet, so every surface
 * here is chosen explicitly and there is nothing left to resolve at render time.
 */
function Stat({ label, value, caption, icon: Icon, to, dark, tone = 'plain' }: {
    label: string;
    value: number | string;
    caption: string;
    icon: LucideIcon;
    to: string;
    dark: boolean;
    tone?: 'plain' | 'alert';
}) {
    const card = dark
        ? 'bg-[#0A0A0A] border-[#1F1F1F] hover:border-[#2563EB]/60'
        : 'bg-white border-slate-200 hover:border-[#2563EB]/60';
    const chip = tone === 'alert'
        ? 'border-[#F59E0B]/40 text-[#FBBF24] bg-[#F59E0B]/10'
        : dark
            ? 'border-[#2563EB]/40 text-[#93B4FB] bg-[#2563EB]/10'
            : 'border-[#2563EB]/30 text-[#1D4ED8] bg-[#2563EB]/10';

    return (
        <Link
            to={to}
            className={`group rounded-2xl border p-5 transition-colors ${card}
                        ${tone === 'alert' ? 'border-l-[3px] border-l-[#F59E0B]' : ''}`}
        >
            <div className="flex items-center gap-3">
                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${chip}`}>
                    <Icon className="w-[1.125rem] h-[1.125rem]" />
                </span>
                <p className={`text-[0.75rem] font-bold uppercase tracking-[0.1em]
                               ${dark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}>
                    {label}
                </p>
            </div>

            <p className={`font-display text-[2.75rem] leading-none font-bold tabular-nums mt-4
                           ${dark ? 'text-white' : 'text-slate-900'}`}>
                {value}
            </p>
            <p className={`text-[0.875rem] mt-2.5 ${dark ? 'text-[#71717A]' : 'text-slate-400'}`}>
                {caption}
            </p>
        </Link>
    );
}

/** One authored section, and whether it is actually ready to be seen. */
function SectionRow({ label, to, ready, detail, icon: Icon, dark }: {
    label: string; to: string; ready: boolean; detail: string; icon: LucideIcon; dark: boolean;
}) {
    return (
        <Link
            to={to}
            className={`flex items-center gap-4 px-5 py-4 border-t first:border-t-0 transition-colors
                        ${dark
                    ? 'border-[#1F1F1F] hover:bg-[#121212]'
                    : 'border-slate-200 hover:bg-slate-50'}`}
        >
            <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0
                              ${dark ? 'border-[#262626] text-[#A1A1AA]' : 'border-slate-200 text-slate-500'}`}>
                <Icon className="w-[1.125rem] h-[1.125rem]" />
            </span>

            <span className="min-w-0 flex-1">
                <span className={`block text-base font-semibold truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
                    {label}
                </span>
                <span className={`block text-[0.875rem] truncate ${dark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}>
                    {detail}
                </span>
            </span>

            <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[0.75rem]
                              font-bold shrink-0 ${ready
                    ? 'bg-[#16A34A]/12 text-[#4ADE80]'
                    : 'bg-[#F59E0B]/12 text-[#FBBF24]'}`}>
                {ready ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {ready ? 'Ready' : 'Not set up'}
            </span>

            <ArrowRight className={`w-4 h-4 shrink-0 ${dark ? 'text-[#3F3F46]' : 'text-slate-300'}`} />
        </Link>
    );
}

export default function CmsDashboard() {
    // The shell owns the theme and hands it down; see the note on `Stat`.
    const { dark = true } = useOutletContext<{ dark?: boolean }>() || {};
    const [data, setData] = useState<Overview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await getCmsOverview());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the overview'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) return <CmsLoading label="Loading overview…" />;

    const d = data || {};
    const gallery = d.gallery || {};
    const events = d.events || {};
    const messages = d.messages || {};

    const sections = [
        {
            label: 'Header & Footer', to: '/cms/site', icon: PanelTop,
            ready: !!d.site?.configured,
            detail: `${d.site?.navLinks || 0} nav links · ${d.site?.footerColumns || 0} footer columns · ${d.site?.socials || 0} socials`,
        },
        {
            label: 'Home Page', to: '/cms/home', icon: Home,
            ready: !!d.home?.configured,
            detail: `${d.home?.slides || 0} slides · ${d.home?.aboutBullets || 0} about bullets · ${d.home?.aboutStats || 0} figures`,
        },
        {
            label: 'About Us', to: '/cms/about', icon: FileText,
            ready: !!d.about?.configured,
            detail: `${d.about?.bullets || 0} bullets · ${d.about?.stats || 0} figures`,
        },
        {
            label: 'Contact Details', to: '/cms/contact', icon: Phone,
            ready: !!d.contact?.configured,
            detail: `${d.contact?.addressLines || 0} address lines · ${d.contact?.workingHours || 0} working hours`,
        },
    ];

    const notReady = sections.filter(s => !s.ready).length;

    return (
        <div className="w-full max-w-[100rem] mx-auto space-y-8">
            <CmsError message={error} onRetry={load} />

            {/* An eyebrow above the title, as the reference lays it out — it says
                which part of the console you are in before the title says what. */}
            <header>
                <p className={`text-[0.75rem] font-bold uppercase tracking-[0.14em] mb-2
                               ${dark ? 'text-[#52525B]' : 'text-slate-400'}`}>
                    Workspace
                </p>
                <h1 className={`font-display text-[2.5rem] leading-[1.1] font-bold tracking-tight
                                ${dark ? 'text-white' : 'text-slate-900'}`}>
                    Overview
                </h1>
                <p className={`text-base mt-2.5 max-w-[64ch] ${dark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}>
                    {notReady === 0
                        ? 'Every section is authored. This is what the public site is serving.'
                        : `${notReady} of ${sections.length} sections still need content before they render.`}
                </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                    label="Events" value={events.total || 0} icon={PartyPopper} to="/cms/events" dark={dark}
                    caption={events.total ? 'Published and draft, all tiers' : 'Nothing scheduled yet'}
                />
                <Stat
                    label="Gallery" value={gallery.total || 0} icon={Images} to="/cms/gallery" dark={dark}
                    caption={gallery.hidden ? `${gallery.hidden} hidden from the public site` : 'All images visible'}
                />
                <Stat
                    label="Messages" value={messages.total || 0} icon={Inbox} to="/cms/messages" dark={dark}
                    caption={messages.unread ? `${messages.unread} waiting for a reply` : 'Nothing unread'}
                    tone={messages.unread ? 'alert' : 'plain'}
                />
                <Stat
                    label="Sections to finish" value={notReady} icon={AlertTriangle} to="/cms/site" dark={dark}
                    caption={notReady ? 'Blank on the live site until authored' : 'Everything is authored'}
                    tone={notReady ? 'alert' : 'plain'}
                />
            </div>

            <section className={`rounded-2xl border overflow-hidden
                                 ${dark ? 'bg-[#0A0A0A] border-[#1F1F1F]' : 'bg-white border-slate-200'}`}>
                <header className={`px-5 py-5 border-b ${dark ? 'border-[#1F1F1F]' : 'border-slate-200'}`}>
                    <h2 className={`font-display text-xl font-bold tracking-tight
                                    ${dark ? 'text-white' : 'text-slate-900'}`}>
                        Site content
                    </h2>
                    <p className={`text-[0.9375rem] mt-1.5 ${dark ? 'text-[#A1A1AA]' : 'text-slate-500'}`}>
                        What each public page is reading, and whether it has anything to read.
                    </p>
                </header>

                <div>
                    {sections.map((row) => <SectionRow key={row.to} {...row} dark={dark} />)}
                </div>
            </section>
        </div>
    );
}
