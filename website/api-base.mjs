// Browser requests, OAuth navigation and server-rendered previews must use the
// same backend. The old API under the website domain is a separate deployment.
export const PRODUCTION_API = 'https://api.activ.org.in/api/v1';

export function resolveApiBase(value, { development = false } = {}) {
    let base = String(value || '').trim().replace(/\/+$/, '');
    if (!base) return development ? 'http://localhost:5000/api/v1' : PRODUCTION_API;
    if (!development && /^\/?api(?:\/v\d+)?$/i.test(base)) return PRODUCTION_API;
    try {
        const url = new URL(base);
        if (/^(www\.)?activ\.org\.in$/i.test(url.hostname)) return PRODUCTION_API;
    } catch { /* Keep an explicitly configured development proxy path. */ }
    return /\/api\/v\d+$/.test(base) ? base : `${base}/api/v1`;
}
