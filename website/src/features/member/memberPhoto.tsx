import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, X, ImageUp } from 'lucide-react';
import { toast } from 'sonner';
import { resolveMediaUrl } from '@/config/api.config';
import { SESSION_EVENT } from '@/services/api';
import { getMyProfile, uploadProfilePhoto, errorMessage } from '@/services/activApi';

/**
 * THE MEMBER'S PHOTO — one source, every surface.
 *
 * The sidebar drew `src={profilePhoto}` with the raw stored value
 * (`/uploads/<file>`). That path is on the API host, not the website's, so the
 * browser asked the WEBSITE for it, got a 404, and drew its broken-image icon —
 * while Settings, which resolved the URL, showed the photo fine. Each screen
 * kept its own copy and its own rule.
 *
 * Now there is one store: seeded from the last known value (a warm cache,
 * member sessions only), confirmed from `/members/my-profile`, updated the
 * moment an upload lands, and read by every avatar through `useMemberPhoto`.
 * URLs always go through `resolveMediaUrl`; a photo that fails to load falls
 * back to initials, never a broken icon.
 *
 * Photos are stored per member (`/uploads/members/<name>-<id>/…`) and never
 * deleted, so a stored value keeps working. Tapping any avatar opens the
 * photo full size, with "Change photo".
 */

const KEY = 'userProfilePhoto';
const EVENT = 'profilePhotoUpdated';

const isMemberSession = () => {
    try { return !!localStorage.getItem('token') && localStorage.getItem('role') === 'member'; } catch { return false; }
};

let raw = (() => {
    try { return isMemberSession() ? (localStorage.getItem(KEY) || '') : ''; } catch { return ''; }
})();
let inflight: Promise<void> | null = null;
let fetchedAt = 0;
const listeners = new Set<(v: string) => void>();

const publish = (value: string) => {
    raw = value || '';
    try {
        if (raw) localStorage.setItem(KEY, raw);
        else localStorage.removeItem(KEY);
    } catch { /* storage unavailable */ }
    listeners.forEach((fn) => fn(raw));
};

/** Ask the server; one request at a time, at most every 20 seconds unless forced. */
export const refreshMemberPhoto = (force = false): Promise<void> => {
    if (!isMemberSession()) { publish(''); return Promise.resolve(); }
    if (inflight) return inflight;
    if (!force && Date.now() - fetchedAt < 20000) return Promise.resolve();
    inflight = getMyProfile()
        .then((p: any) => {
            fetchedAt = Date.now();
            // The server is the answer — including "no photo".
            publish(String(p?.profilePhoto || ''));
        })
        .catch(() => { /* keep what we have */ })
        .finally(() => { inflight = null; });
    return inflight;
};

/** Upload a new photo; every avatar on the page updates when it lands. */
export const uploadMemberPhoto = async (file: File): Promise<string> => {
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (JPG, PNG or WebP).');
    if (file.size > 5 * 1024 * 1024) throw new Error('The photo must be under 5 MB.');
    const res: any = await uploadProfilePhoto(file);
    const value = String(res?.profilePhoto || res?.url || '');
    if (!value) throw new Error('The photo could not be saved. Please try again.');
    publish(value);
    fetchedAt = Date.now();
    window.dispatchEvent(new Event(EVENT));
    window.dispatchEvent(new Event('profileDataUpdated'));
    return value;
};

export function useMemberPhoto() {
    const [value, setValue] = useState(raw);

    useEffect(() => {
        listeners.add(setValue);
        refreshMemberPhoto();
        const reread = () => refreshMemberPhoto(true);
        const reseed = () => { raw = ''; fetchedAt = 0; setValue(''); refreshMemberPhoto(true); };
        window.addEventListener('profileDataUpdated', reread);
        window.addEventListener(EVENT, reread);
        window.addEventListener(SESSION_EVENT, reseed);
        return () => {
            listeners.delete(setValue);
            window.removeEventListener('profileDataUpdated', reread);
            window.removeEventListener(EVENT, reread);
            window.removeEventListener(SESSION_EVENT, reseed);
        };
    }, []);

    return { raw: value, src: resolveMediaUrl(value) };
}

export const initialsOf = (name: string) =>
    (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'M';

/**
 * The member's avatar. A button: tapping it opens the photo full size.
 * `className` sizes and shapes it; the image fills it; a failed image shows
 * the initials instead.
 */
export function MemberAvatar({
    name,
    className = 'h-11 w-11 rounded-xl',
    initialsClassName = 'bg-blue-600 text-white text-ui-small font-bold',
    imgClassName = '',
    label = 'View your profile photo',
}: {
    name: string;
    className?: string;
    initialsClassName?: string;
    imgClassName?: string;
    label?: string;
}) {
    const { src } = useMemberPhoto();
    const [broken, setBroken] = useState(false);
    const [open, setOpen] = useState(false);
    useEffect(() => { setBroken(false); }, [src]);
    const show = src && !broken;

    return (
        <>
            <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
                aria-label={label}
                className={`relative shrink-0 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
            >
                {show ? (
                    <img src={src} alt="" onError={() => setBroken(true)} className={`h-full w-full object-cover ${imgClassName}`} />
                ) : (
                    <span className={`flex h-full w-full items-center justify-center ${initialsClassName}`}>{initialsOf(name)}</span>
                )}
            </button>
            {open ? <MemberPhotoViewer name={name} onClose={() => setOpen(false)} /> : null}
        </>
    );
}

/** The photo full size, with "Change photo". Rendered at the top of the page. */
export function MemberPhotoViewer({ name, onClose }: { name: string; onClose: () => void }) {
    const { src } = useMemberPhoto();
    const [broken, setBroken] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => { setBroken(false); }, [src]);

    const close = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            previous?.focus?.();
        };
    }, [close]);

    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setBusy(true);
        try {
            await uploadMemberPhoto(file);
            toast.success('Profile photo updated');
        } catch (err) {
            toast.error(errorMessage(err, 'Could not upload the photo. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const has = !!src && !broken;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Your profile photo"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
            onClick={close}
        >
            <div
                className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <p className="min-w-0 truncate font-display text-[1.125rem] font-semibold text-slate-900">{name || 'Your photo'}</p>
                    <button ref={closeRef} type="button" onClick={close} aria-label="Close"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
                    {has ? (
                        <img src={src} alt={`${name || 'Member'} — profile photo`} onError={() => setBroken(true)}
                            className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain" />
                    ) : (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                            <span className="grid h-28 w-28 place-items-center rounded-3xl bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] font-display text-[2.5rem] font-bold text-white">
                                {initialsOf(name)}
                            </span>
                            <p className="text-[1rem] text-slate-500">No photo yet — add one so members recognise you.</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={close} disabled={busy}
                        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-5 font-semibold text-slate-700 hover:bg-slate-50">
                        Close
                    </button>
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white disabled:opacity-70">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : has ? <Camera className="h-4 w-4" /> : <ImageUp className="h-4 w-4" />}
                        {has ? 'Change photo' : 'Upload a photo'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} />
                </div>
            </div>
        </div>,
        document.body,
    );
}
