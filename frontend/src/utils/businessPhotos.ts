import { resolveMediaUrl } from '../config/api.config';

/** Existing company images and published product photos, in display order. */
export function businessPhotoItems(company: any): any[] {
  const candidates = [
    { _id: `company-cover:${company?._id || ''}`, name: 'Company cover', kind: 'Company photo', imageUrl: company?.banner, showPrice: false },
    { _id: `company-logo:${company?._id || ''}`, name: 'Company logo', kind: 'Company photo', imageUrl: company?.logo, showPrice: false },
    ...(Array.isArray(company?.products) ? company.products.filter(Boolean) : []),
  ];
  const seen = new Set<string>();
  const items: any[] = [];
  for (const candidate of candidates) {
    const images: string[] = [];
    const add = (value: any) => {
      const raw = typeof value === 'string' ? value : typeof value?.url === 'string' ? value.url : value?.imageUrl;
      if (typeof raw !== 'string' || !raw.trim()) return;
      const uri = resolveMediaUrl(raw.trim());
      if (!uri || seen.has(uri)) return;
      seen.add(uri);
      images.push(uri);
    };
    add(candidate.imageUrl);
    for (const field of ['images', 'imageUrls', 'gallery']) {
      if (Array.isArray(candidate[field])) candidate[field].forEach(add);
    }
    if (images.length) {
      // Keep catalogue details, with one canonical image array after de-duplication.
      items.push({ ...candidate, imageUrl: images[0], images, imageUrls: [], gallery: [] });
    }
  }
  return items;
}
