import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, FileText, Calendar, GalleryHorizontal, Phone, Inbox, PanelTop } from 'lucide-react';
import { getCmsOverview, errorMessage } from '@/services/cmsApi';
import { CmsCard, CmsLoading, CmsError } from './components/CmsUI';

/**
 * CMS overview.
 *
 * Reports what has and has not been authored, because an unconfigured section
 * renders as a blank strip on the live site and nothing else tells you. Every
 * figure comes from `/cms/overview`; none is estimated here.
 */
export default function CmsDashboard() {
    const [data, setData] = useState<any>(null);
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

    const sections = [
        {
            to: '/cms/home', icon: ImageIcon, label: 'Home Page',
            value: data?.home?.slides ?? 0, unit: 'carousel slide(s)',
            ok: !!data?.home?.configured,
        },
        {
            to: '/cms/site', icon: PanelTop, label: 'Header & Footer',
            value: data?.site?.navLinks ?? 0, unit: 'nav links',
            ok: !!data?.site?.configured,
        },
        {
            to: '/cms/home', icon: FileText, label: 'Home — About block',
            value: `${data?.home?.aboutBullets ?? 0} / ${data?.home?.aboutStats ?? 0}`, unit: 'points / figures',
            ok: (data?.home?.aboutBullets ?? 0) > 0 || (data?.home?.aboutStats ?? 0) > 0,
        },
        {
            to: '/cms/about', icon: FileText, label: 'About Us page',
            value: data?.about?.configured ? 'Written' : 'Empty', unit: '',
            ok: !!data?.about?.configured,
        },
        {
            to: '/cms/events', icon: Calendar, label: 'Events',
            value: data?.events?.total ?? 0, unit: 'event(s)',
            ok: (data?.events?.total ?? 0) > 0,
        },
        {
            to: '/cms/gallery', icon: GalleryHorizontal, label: 'Gallery',
            value: data?.gallery?.total ?? 0, unit: 'image(s)',
            ok: (data?.gallery?.total ?? 0) > 0,
        },
        {
            to: '/cms/contact', icon: Phone, label: 'Contact Details',
            value: data?.contact?.configured ? 'Set' : 'Empty', unit: '',
            ok: !!data?.contact?.configured,
        },
        {
            to: '/cms/messages', icon: Inbox, label: 'Inbox',
            value: data?.messages?.unread ?? 0, unit: `unread of ${data?.messages?.total ?? 0}`,
            ok: true,
        },
    ];

    return (
        <div className="space-y-6 w-full">
            <CmsError message={error} onRetry={load} />

            <div className="bg-white dark:bg-[#172033] border border-slate-200 dark:border-[#1e293b] rounded-xl p-8 mb-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Welcome to the admin dashboard. Use the sidebar to navigate to different sections.
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map(({ to, icon: Icon, label, value, unit, ok }) => (
                    <Link
                        key={to}
                        to={to}
                        className="bg-white dark:bg-[#172033] border border-slate-200 dark:border-[#1e293b] rounded-xl p-6 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm"
                    >
                        <div className="flex items-start justify-between">
                            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            {/* Amber, not red: an unauthored section is a task, not a fault. */}
                            <span
                                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                    ok ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                }`}
                            >
                                {ok ? 'Configured' : 'Not set up'}
                            </span>
                        </div>
                        <p className="text-3xl font-bold text-slate-900 dark:text-white mt-4">{value}</p>
                        <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{unit}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-3">{label}</p>
                    </Link>
                ))}
            </div>

            <CmsCard
                title="How this content is used"
                description="Each section below feeds one part of the public onboarding site."
            >
                <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-2">
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Header &amp; Footer</strong> — the branding, navigation and footer shown on every public page.</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Home Page</strong> — the banner (slides, headline, buttons, highlight card) and the About block (points, image, figures bar).</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">About Us</strong> — the dedicated About page and its media.</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Events</strong> — shown on the public site <em>and</em> to signed-in members. Events are one shared list, so publishing here is enough.</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Gallery</strong> — the image grid. Hidden images stay stored but are not served publicly.</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Contact</strong> — the address, phone and email shown on the Contact page.</li>
                    <li>· <strong className="text-slate-700 dark:text-slate-300">Inbox</strong> — messages submitted through the public contact form.</li>
                </ul>
            </CmsCard>
        </div>
    );
}
