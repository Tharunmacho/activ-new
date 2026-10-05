import { mediaDisplayName } from '@/lib/prepareImage';
import { resolveMediaUrl } from '@/config/api.config';

export function MediaFileName({ url, label = 'Image' }: { url: string; label?: string }) {
    if (!url) return null;
    return <a href={resolveMediaUrl(url)} target="_blank" rel="noopener noreferrer"
        className="block max-w-full break-words text-sm text-blue-600 hover:underline"
        aria-label={`Open ${label.toLowerCase()}`}>
        {mediaDisplayName(url, label)}
    </a>;
}
