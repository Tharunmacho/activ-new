/** Public gallery routes and photo positions match the website album pages. */
const published = (item: any) => item && typeof item === 'object' && !Array.isArray(item)
  && item.visible !== false && !item.isHidden && (!item.status || item.status === 'published');

export function galleryPath(item: any): string | null {
  const key = item?.slug || item?._id || item?.id;
  if (typeof key !== 'string' || !key.trim() || /[\\/?#\u0000-\u001f]/.test(key)) return null;
  return '/gallery/' + encodeURIComponent(key.trim());
}

/** CMS media must be a web/upload URL, never a device-local file or executable URI. */
export function galleryMediaUrl(value: any): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!url || /[\\\u0000-\u001f]/.test(url) || url.startsWith('//')) return '';
  return /^[a-z][a-z\d+.-]*:/i.test(url) && !/^https?:\/\//i.test(url) ? '' : url;
}

export type GalleryPhoto = { photo: any; index: number; cover: boolean };
export function galleryPhotos(item: any): GalleryPhoto[] {
  // Assign website indices before hiding malformed/private media so a link never opens a different photo.
  const extras = (Array.isArray(item?.photos) ? item.photos : []).filter((photo: any) => photo && photo.url);
  const hasCover = !!item?.media?.url;
  const entries: GalleryPhoto[] = [
    ...(hasCover ? [{ photo: { ...item.media, title: item.title, caption: item.caption, description: item.description, customFields: [] }, index: 0, cover: true }] : []),
    ...extras.map((photo: any, index: number) => ({ photo, index: index + (hasCover ? 1 : 0), cover: false })),
  ];
  return entries.filter(entry => published(entry.photo) && galleryMediaUrl(entry.photo.url));
}

export function relatedGalleryAlbums(item: any, value: any): any[] {
  const ids = (row: any) => [row?._id, row?.id, row?.slug].filter(Boolean).map(String);
  const current = new Set(ids(item));
  const seen = new Set<string>();
  const others = (Array.isArray(value) ? value : []).filter(row => {
    const path = galleryPath(row);
    if (!published(row) || !path || ids(row).some(id => current.has(id)) || seen.has(path)) return false;
    seen.add(path); return true;
  });
  const same = item?.category ? others.filter(row => row.category === item.category) : [];
  return [...same, ...others.filter(row => !same.includes(row))].slice(0, 4);
}
