import api from './api';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Authenticated report downloads never expose a public URL containing contact data. */
export async function downloadSpreadsheet(path: string, filename: string, params: Record<string, string> = {}) {
    const response = await api.get(path, { params: { ...params, format: 'xlsx' }, responseType: 'blob', timeout: 120000 });
    const contentType = String(response.headers?.['content-type'] || '');
    if (!contentType.includes(XLSX_MIME) || !response.data?.size) {
        throw new Error('The Excel report could not be downloaded. Please refresh and try again.');
    }
    const suggested = /filename="([^"]+)"/.exec(String(response.headers?.['content-disposition'] || ''))?.[1] || filename;
    const safeName = suggested.replace(/\.xlsx$/i, '').replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/^[. ]+/, '').slice(0, 120) || 'activ-report';
    const url = URL.createObjectURL(new Blob([response.data], { type: XLSX_MIME }));
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName + '.xlsx';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to accept the download before releasing its buffer.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
