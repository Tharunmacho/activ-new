import { useEffect, useRef, useState } from 'react';
import { uploadMedia } from '@/services/cmsApi';
import { sizedMediaUrl, resolveMediaUrl } from '@/config/api.config';

export function useMediaUpload(value: string, onUploaded: (media: { url: string; type: 'image' | 'video' }) => void, onBusy?: (busy: boolean) => void) {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [local, setLocal] = useState<{ src: string; saved: string; type: string } | null>(null);
    const inFlight = useRef(false);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const localSrc = local?.src;
    useEffect(() => () => { if (localSrc) URL.revokeObjectURL(localSrc); }, [localSrc]);

    const upload = async (file?: File | null, imagesOnly = true) => {
        if (!file || inFlight.current) return;
        if (imagesOnly && !file.type.startsWith('image/')) throw new Error('Choose an image.');
        inFlight.current = true;
        setBusy(true); onBusy?.(true);
        const chosen = { src: URL.createObjectURL(file), saved: '', type: file.type.startsWith('video/') ? 'video' : 'image' };
        setLocal(chosen);
        try {
            const media = await uploadMedia(file, message => { if (alive.current) setStatus(message); });
            if (!alive.current) return;
            setLocal({ ...chosen, saved: media.url });
            onUploaded(media);
        } catch (error) {
            if (alive.current) setLocal(null);
            throw error;
        } finally {
            inFlight.current = false;
            if (alive.current) { setBusy(false); setStatus(''); }
            onBusy?.(false);
        }
    };
    const active = local && (busy || local.saved === value) ? local : null;
    const preview = active?.src || (/\.(mp4|webm|mov)(?:[?#]|$)/i.test(value) ? resolveMediaUrl(value) : sizedMediaUrl(value, 640));
    return { busy, status, preview, localType: active?.type, upload };
}
