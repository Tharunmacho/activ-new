import api, { unwrap } from './api';
import type { CmsMedia } from './cmsApi';

export interface CmsSharePreview {
    path: string;
    label: string;
    group: string;
    title: string;
    description: string;
    image: CmsMedia;
    imageSource?: CmsMedia;
    imageMeta?: { width: number; height: number; type: string };
    shareText?: string;
    canonicalPath?: string;
    type?: string;
    overrides: { title: string; description: string; image: CmsMedia | null };
    updatedAt?: string | null;
}

export type CmsSharePreviewRoute = Pick<CmsSharePreview, 'path' | 'label' | 'group'>;

export const getSharePreviewEditor = async(): Promise<{ routes: CmsSharePreviewRoute[] }> =>
    unwrap(await api.get('/cms/share-previews'), { routes: [] });

export const getPublicSharePreview = async(path: string): Promise<CmsSharePreview> =>
    unwrap<CmsSharePreview>(await api.get('/cms/share-previews/resolve', { params: { path } }), null);

export const saveSharePreview = async(value: Pick<CmsSharePreview, 'path' | 'title' | 'description'> & { image?: CmsMedia }): Promise<CmsSharePreview> =>
    unwrap<CmsSharePreview>(await api.put('/cms/share-previews', value), null);

export const resetSharePreview = async(path: string): Promise<CmsSharePreview> =>
    unwrap<CmsSharePreview>(await api.delete('/cms/share-previews', { params: { path } }), null);
