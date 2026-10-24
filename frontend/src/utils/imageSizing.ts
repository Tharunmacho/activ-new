import { PixelRatio } from 'react-native';
import { API_ORIGIN, resolveMediaUrl } from '../config/api.config';

// Match the API's cache buckets so nearby display sizes reuse the same file.
const WIDTHS = [320, 480, 640, 800, 1024, 1280, 1600, 1920];

export function responsiveImageWidth(logicalWidth: number, density = PixelRatio.get()): number {
  const width = Number.isFinite(logicalWidth) && logicalWidth > 0 ? logicalWidth : 400;
  const scale = Number.isFinite(density) && density > 0 ? Math.min(2, density) : 2;
  return Math.min(1280, Math.ceil(width * scale));
}

/** Resize only API-origin uploads after the existing legacy-upload URL repair. */
export function sizedMediaUrl(value?: string | null, width = 800): string {
  const uri = resolveMediaUrl(typeof value === 'string' ? value : '');
  if (!uri.startsWith(`${API_ORIGIN}/uploads/`)) return uri;
  const [url, hash] = uri.split('#', 2);
  const [path, query = ''] = url.split('?', 2);
  if (!/\.(jpe?g|png|webp)$/i.test(path)) return uri;
  const target = Number.isFinite(width) && width > 0 ? width : 800;
  const snapped = WIDTHS.find(step => step >= target) || 1920;
  const params = query.split('&').filter(part => part && !/^w=/i.test(part));
  params.push(`w=${snapped}`);
  return `${path}?${params.join('&')}${hash !== undefined ? `#${hash}` : ''}`;
}

export function imageSource(value?: string | null, width = 800) {
  const uri = sizedMediaUrl(value, width);
  // Android and iOS both decode WebP. Ask the existing API variant cache for it.
  return uri.startsWith(`${API_ORIGIN}/uploads/`) && /[?&]w=\d+/.test(uri)
    ? { uri, headers: { Accept: 'image/webp,image/*;q=0.8' } }
    : { uri };
}
