import { useEffect, useState } from 'react';
import { ImageOff, ZoomIn } from 'lucide-react';
import { PhotoLightbox, type LightboxPhoto } from '@/components/shared/PhotoLightbox';
import { sizedMediaUrl } from '@/config/api.config';

export interface BusinessPhoto extends LightboxPhoto { id: string; productId?: string }

export function businessPhotos(company: {
    businessName?: string; logo?: string; banner?: string;
    products?: { _id?: string; imageUrl?: string; name?: string; description?: string }[];
}): BusinessPhoto[] {
    const name = company.businessName || 'Company';
    return [
        ...(company.banner?.trim() ? [{ id: 'banner', url: company.banner, alt: `${name} cover` }] : []),
        ...(company.logo?.trim() ? [{ id: 'logo', url: company.logo, alt: `${name} logo` }] : []),
        ...(company.products || []).flatMap((product, index) => product.imageUrl?.trim() ? [{
            id: `product:${product._id || index}`, productId: product._id,
            url: product.imageUrl, alt: product.name || 'Product',
            caption: [product.name, product.description].filter(Boolean).join('\n'),
        }] : []),
    ];
}

export function useBusinessPhotoGallery(photos: BusinessPhoto[], title: string, onView?: (photo: BusinessPhoto) => void) {
    const [selected, setSelected] = useState<string | null>(null);
    const index = photos.findIndex(photo => photo.id === selected);
    useEffect(() => { if (selected !== null && index === -1) setSelected(null); }, [index, selected]);
    const openPhoto = (id: string) => {
        const photo = photos.find(item => item.id === id);
        if (!photo) return;
        setSelected(id);
        onView?.(photo);
    };
    return {
        openPhoto,
        viewer: <PhotoLightbox photos={photos} index={index} title={title} onClose={() => setSelected(null)} onIndex={next => openPhoto(photos[next].id)} />,
    };
}

export function BusinessPhotoGrid({ photos, onOpen }: { photos: BusinessPhoto[]; onOpen: (id: string) => void }) {
    if (!photos.length) return <p className="text-ui-body text-slate-500">No photos have been added yet.</p>;
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {photos.map(photo => <PhotoThumbnail key={photo.id} photo={photo} onOpen={onOpen} />)}
    </div>;
}

function PhotoThumbnail({ photo, onOpen }: { photo: BusinessPhoto; onOpen: (id: string) => void }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => { setFailed(false); }, [photo.url]);
    return <button type="button" onClick={() => onOpen(photo.id)} aria-label={`Open photo: ${photo.alt}`}
        className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
        <span className="flex aspect-square items-center justify-center overflow-hidden">
            {failed ? <ImageOff className="h-8 w-8 text-slate-400" aria-label="Photo unavailable" />
                : <img src={sizedMediaUrl(photo.url, 480)} alt={photo.alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-contain transition-transform group-hover:scale-105" />}
        </span>
        <span className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="min-w-0 flex-1 truncate">{photo.alt}</span><ZoomIn size={17} aria-hidden="true" /></span>
    </button>;
}
