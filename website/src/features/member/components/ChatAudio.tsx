import { useEffect, useRef, useState } from 'react';
import { Loader2, Play } from 'lucide-react';
import { loadMessageAudio, type MessageAttachment } from '@/services/messagesApi';

export default function ChatAudio({ attachment }: { attachment: MessageAttachment }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const request = useRef<AbortController | null>(null);
    const player = useRef<HTMLAudioElement | null>(null);
    useEffect(() => () => { request.current?.abort(); }, []);
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    useEffect(() => {
        const pause = () => { if (document.hidden) player.current?.pause(); };
        document.addEventListener('visibilitychange', pause);
        return () => document.removeEventListener('visibilitychange', pause);
    }, []);
    const load = async () => {
        if (loading) return;
        const controller = new AbortController(); request.current = controller;
        setLoading(true); setError('');
        try {
            const blob = await loadMessageAudio(attachment, controller.signal);
            if (!controller.signal.aborted) setUrl(URL.createObjectURL(blob));
        } catch { if (!controller.signal.aborted) setError('Audio could not be opened. Please try again.'); }
        finally { if (!controller.signal.aborted) setLoading(false); }
    };
    return <div className="mb-2 min-w-0 space-y-1">
        <p className="break-all text-ui-small font-semibold">{attachment.name}</p>
        {url ? <audio ref={player} controls autoPlay preload="metadata" src={url} aria-label={`Play ${attachment.name}`} className="h-10 w-full max-w-64" onError={() => { setUrl(''); setError('This browser cannot play this audio. Try an MP3 or M4A file.'); }} />
            : <button type="button" disabled={loading} onClick={() => void load()} aria-label={`Play ${attachment.name}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-current/20 px-3 text-ui-small font-semibold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {loading ? 'Loading audio…' : 'Play audio'}</button>}
        {error && <p role="alert" className="text-ui-caption">{error}</p>}
    </div>;
}
