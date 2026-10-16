import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { HeaderSection } from '@/components/layout/HeaderSection';
import { FooterSection } from '@/components/layout/FooterSection';
import BrowserPushSettings from '@/components/BrowserPushSettings';
import { getPublicNotices, getPublicNotice, recordVisitorOpen, type PublicNotice } from '@/services/visitorBrowserPush';
import { resolveMediaUrl } from '@/config/api.config';

export default function PublicNotificationsPage() {
  const [search] = useSearchParams();
  const id = search.get('notice');
  const [items, setItems] = useState<PublicNotice[]>([]);
  const [selected, setSelected] = useState<PublicNotice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSelected(null);
    (id ? getPublicNotice(id).then(value => { if (active) setSelected(value); }) : getPublicNotices().then(value => { if (active) setItems(value); }))
      .catch(() => { if (active) setError('This update may no longer be available. Please try again later.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  return <div className="min-h-screen bg-slate-50"><HeaderSection /><main className="mx-auto max-w-4xl space-y-6 px-4 py-12">
    <div><h1 className="text-[1.75rem] sm:text-[2.5rem] font-bold text-slate-900">Notifications</h1><p className="mt-2 text-ui-body text-slate-600">Public events and updates from ACTIV. Sign in for updates selected for your membership.</p></div>
    <BrowserPushSettings />
    {loading && <p role="status">Loading updates…</p>}{error && <p role="alert" className="rounded-xl border bg-white p-5">{error}</p>}
    {!loading && !error && (selected ? <article className="space-y-5 rounded-2xl border bg-white p-6">
      <Link to="/notifications" className="text-blue-700">← All notifications</Link><h2 className="text-2xl sm:text-3xl font-bold">{selected.title}</h2>
      {selected.imageUrl && <img src={resolveMediaUrl(selected.imageUrl)} alt="" className="max-h-[32rem] w-full rounded-xl object-contain" />}
      <p className="whitespace-pre-line text-ui-body leading-relaxed text-slate-700">{selected.body || selected.summary}</p>
      {selected.kind === 'event' && <Link to={'/events/' + encodeURIComponent(selected.sourceId)} className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-semibold text-white">View event</Link>}
    </article> : items.length ? items.map(item => <Link key={item.id} to={'/notifications?notice=' + item.id} onClick={() => void recordVisitorOpen(item.id, 'in_app').catch(() => undefined)} className="block space-y-2 rounded-2xl border border-slate-200 bg-white p-6 hover:border-blue-300">
      <p className="text-ui-caption font-semibold text-blue-700">{item.kind === 'event' ? 'PUBLIC EVENT' : 'COMMUNITY UPDATE'}</p><h2 className="text-ui-body font-bold text-slate-900">{item.title}</h2>
      <p className="text-ui-caption text-slate-600">{item.summary}</p><p className="text-ui-caption text-slate-500">{new Date(item.createdAt).toLocaleDateString('en-IN')}</p>
    </Link>) : <p className="rounded-2xl border bg-white p-6 text-slate-600">New public updates will appear here when ACTIV publishes them.</p>)}
    <div className="rounded-2xl bg-blue-900 p-6 text-white"><h2 className="text-ui-body font-bold">Connect with the ACTIV community</h2><p className="mt-2 text-ui-caption">Join as a member to discover opportunities and updates for your region.</p><Link to="/register" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-5 font-semibold text-blue-800">Become a member</Link></div>
  </main><FooterSection /></div>;
}
