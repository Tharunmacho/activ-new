import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getPublicSharePreview, type CmsSharePreview } from '@/services/cmsSharePreviewsApi';
import { resolveMediaUrl } from '@/config/api.config';
import { setShareMeta } from '@/lib/shareMeta';
import { isPublicPreviewPath } from '../../../share-preview.mjs';

// One owner for public metadata, including client-side navigation. Initial
// crawler metadata is rendered separately by Vite / the production server.
const PreviewContext = createContext<CmsSharePreview | null>(null);
export const usePublicSharePreview = () => useContext(PreviewContext);

export default function PublicSharePreview({ children }: { children: ReactNode }) {
    const { pathname } = useLocation();
    const [resolved, setResolved] = useState<{ pathname: string; card: CmsSharePreview } | null>(null);
    useEffect(() => {
        if (!isPublicPreviewPath(pathname)) return;
        let active = true;
        let undo: (() => void) | undefined;
        getPublicSharePreview(pathname).then(card => {
            if (!active) return;
            setResolved({ pathname, card });
            undo = setShareMeta({ title: card.title, description: card.description,
                image: resolveMediaUrl(card.image.url), imageMeta: card.imageMeta, alt: card.image.alt,
                url: `${window.location.origin}${card.canonicalPath || card.path}`, type: card.type });
        }).catch(() => { /* Keep the initial HTML preview when the API is unavailable. */ });
        return () => { active = false; undo?.(); };
    }, [pathname]);
    return <PreviewContext.Provider value={resolved?.pathname === pathname && isPublicPreviewPath(pathname) ? resolved.card : null}>{children}</PreviewContext.Provider>;
}
