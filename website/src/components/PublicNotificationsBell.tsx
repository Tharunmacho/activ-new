import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, BellRing, ChevronRight, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { resolveMediaUrl } from '@/config/api.config';
import { pushConfigured } from '@/lib/firebasePushConfig';
import { disableBrowserPush, enableBrowserPush, PUSH_EVENT, pushEnabled } from '@/services/browserPush';
import { getPublicNotice, getPublicNotices, recordVisitorOpen, type PublicNotice } from '@/services/visitorBrowserPush';

const ASKED = 'activ:browser-permission-requested';
const noticeDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function PublicNotificationsBell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [noticeId, setNoticeId] = useState<string | null>(null);
  const [items, setItems] = useState<PublicNotice[]>([]);
  const [selected, setSelected] = useState<PublicNotice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const openedFromList = useRef<string | null>(null);
  const asked = useRef(false);
  const supportsPush = pushConfigured() && window.isSecureContext && 'Notification' in window
    && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const fromLink = query.get('notifications') === 'open';
    setOpen(fromLink); setNoticeId(fromLink ? query.get('notice') : null);
    openedFromList.current = null;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const refresh = () => {
      const current = 'Notification' in window ? Notification.permission : 'default';
      setPermission(current);
      try { setEnabled(current === 'granted' && pushEnabled()); } catch { setEnabled(false); }
    };
    refresh(); window.addEventListener(PUSH_EVENT, refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(PUSH_EVENT, refresh); window.removeEventListener('focus', refresh); };
  }, []);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(''); setSelected(null);
    const load = async () => {
      try {
        if (noticeId) {
          if (!/^[a-f\d]{24}$/i.test(noticeId)) throw new Error('Invalid notice');
          const notice = await getPublicNotice(noticeId);
          if (!notice?.id) throw new Error('Unavailable notice');
          if (active) {
            setSelected(notice);
            if (openedFromList.current === noticeId) {
              openedFromList.current = null;
              void recordVisitorOpen(noticeId, 'in_app').catch(() => undefined);
            }
          }
        } else {
          const notices = await getPublicNotices();
          if (active) setItems(Array.isArray(notices) ? notices : []);
        }
      } catch {
        if (active) setError(noticeId ? 'This update is unavailable. Please try again.' : 'Could not load notifications. Please try again.');
      } finally { if (active) setLoading(false); }
    };
    void load(); return () => { active = false; };
  }, [open, noticeId, revision]);

  const changePush = async (enable: boolean) => {
    if (busy) return;
    setBusy(true); setPushError('');
    try {
      // Request native permission during this click, before any asynchronous SDK work.
      if (enable) await enableBrowserPush(); else await disableBrowserPush();
    } catch (cause) { setPushError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally {
      setPermission('Notification' in window ? Notification.permission : 'default');
      try { setEnabled(Notification.permission === 'granted' && pushEnabled()); } catch { setEnabled(false); }
      setBusy(false);
    }
  };
  const onBellClick = () => {
    if (open || !supportsPush || Notification.permission !== 'default' || asked.current) return;
    try { if (sessionStorage.getItem(ASKED)) return; sessionStorage.setItem(ASKED, 'true'); } catch { /* In-memory guard still applies. */ }
    asked.current = true; void changePush(true);
  };
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (value) return;
    setNoticeId(null); openedFromList.current = null;
    const query = new URLSearchParams(location.search);
    if (query.get('notifications') === 'open') {
      query.delete('notifications'); query.delete('notice'); query.delete('notificationSource');
      navigate({ pathname: location.pathname, search: query.toString() ? '?' + query.toString() : '', hash: location.hash }, { replace: true });
    }
  };
  const back = () => {
    openedFromList.current = null; setNoticeId(null);
    const query = new URLSearchParams(location.search);
    if (query.get('notifications') === 'open') {
      query.delete('notice'); query.delete('notificationSource');
      navigate({ pathname: location.pathname, search: '?' + query.toString(), hash: location.hash }, { replace: true });
    }
  };

  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label="Notifications" onClick={onBellClick} className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-full border border-blue-100 text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=open]:bg-blue-50"><Bell size={21} /></button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={12} collisionPadding={12} aria-label="Notifications"
      className="z-[75] flex w-[min(24rem,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border-slate-200 bg-white p-0 font-sans text-slate-900 shadow-xl"
      style={{ maxHeight: 'min(34rem, var(--radix-popover-content-available-height))' }}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
        {noticeId ? <button type="button" aria-label="Back to notifications" onClick={back} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-blue-700 hover:bg-blue-50"><ArrowLeft size={19} /></button> : <BellRing size={20} className="shrink-0 text-blue-700" />}
        <h2 className="flex-1 text-base font-bold">Notifications</h2>
        <button type="button" aria-label="Close notifications" onClick={() => changeOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? <p role="status" className="px-5 py-8 text-center text-sm text-slate-500">Loading notifications…</p>
          : error ? <div className="space-y-3 p-5 text-sm"><p role="alert" className="text-slate-600">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="min-h-11 font-semibold text-blue-700">Try again</button></div>
          : selected ? <article className="space-y-3 p-4">
            <p className="text-xs font-medium text-slate-500">{noticeDate(selected.createdAt)}</p><h3 className="break-words text-base font-semibold leading-6">{selected.title}</h3>
            {selected.imageUrl && <img src={resolveMediaUrl(selected.imageUrl)} alt="" decoding="async" className="max-h-48 w-full rounded-xl object-contain" />}
            <p className="whitespace-pre-line break-words text-sm leading-6 text-slate-600">{selected.body || selected.summary}</p>
            {selected.kind === 'event' && <Link to={'/events/' + encodeURIComponent(selected.sourceId)} onClick={() => changeOpen(false)} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-blue-700">View event <ChevronRight size={16} /></Link>}
          </article>
          : items.length ? <ul className="divide-y divide-slate-100">{items.map(item => <li key={item.id}><button type="button" onClick={() => { openedFromList.current = item.id; setNoticeId(item.id); }} className="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-blue-50/60 focus-visible:bg-blue-50 focus-visible:outline-none">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Bell size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold leading-5">{item.title}</span><span className="mt-1 block break-words text-xs leading-5 text-slate-500 line-clamp-2">{item.summary}</span><time className="mt-1.5 block text-xs text-slate-400">{noticeDate(item.createdAt)}</time></span><ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" />
          </button></li>)}</ul>
          : <div className="px-5 py-8 text-center"><Bell size={26} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-semibold">You're all caught up</p><p className="mt-1 text-xs leading-5 text-slate-500">New public events and updates will appear here.</p></div>}
      </div>
      {supportsPush && <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3">
        {permission === 'denied' ? <p className="text-xs leading-5 text-slate-500">Notifications are blocked. You can allow them in your browser's site settings.</p>
          : <button type="button" disabled={busy} aria-label={enabled ? 'Disable browser notifications' : 'Enable browser notifications'} onClick={() => void changePush(!enabled)} className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-blue-700 disabled:opacity-60">
            {enabled ? <BellOff size={16} /> : <BellRing size={16} />}{busy ? 'Updating…' : enabled ? 'Notifications on · Turn off' : 'Turn on browser notifications'}
          </button>}
        {pushError && permission !== 'denied' && <p role="status" className="mt-1 text-xs leading-5 text-amber-700">{pushError}</p>}
      </div>}
    </PopoverContent>
  </Popover>;
}
