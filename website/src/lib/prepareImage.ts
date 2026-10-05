// Reduce large photographs before transfer. Keep small images and formats that
// may be animated unchanged. Canvas preserves aspect ratio and transparency.
export async function prepareImage(file: File): Promise<File> {
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size <= 512 * 1024) return file;
    let bitmap: ImageBitmap | undefined;
    try {
        bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return file;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.9));
        if (!blob || blob.size >= file.size) return file;
        const extension = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : '.png';
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + extension, { type: blob.type, lastModified: file.lastModified });
    } catch {
        // Unsupported browser/format: uploading the original still works.
        return file;
    } finally { bitmap?.close(); }
}

export function mediaDisplayName(url: string, fallback = 'Image'): string {
    const name = url.split(/[?#]/)[0].split('/').pop() || '';
    // Old generated names carry no useful description; leave their URLs intact.
    if (/^(?:cms|image|file|profile|company-logo|product-img)-\d[\d-]*\./i.test(name)) return fallback;
    try { return decodeURIComponent(name) || fallback; } catch { return fallback; }
}
