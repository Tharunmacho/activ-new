import { API_BASE_URL } from '@/config/api.config';
const KEY = 'activ:visitor-push';
const REVOKE = 'activ:visitor-push-revoke';
type Identity = { id: string; key: string };
export type PublicNotice = { id: string; kind: 'event' | 'announcement'; sourceId: string; title: string; summary: string; body: string; imageUrl: string; createdAt: string };
export function visitorIdentity(): Identity | null {
  try { const row = JSON.parse(localStorage.getItem(KEY) || 'null'); return row?.id && row?.key ? row : null; } catch { return null; }
}
async function request(path: string, method = 'GET', body?: object, key?: string) {
  const response = await fetch(`${API_BASE_URL}/public-notifications${path}`, { method, credentials: 'omit',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'x-activ-visitor-key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  if (!response.ok) { const error = new Error('Could not update public notifications. Please try again.') as Error & { status: number }; error.status = response.status; throw error; }
  return (await response.json()).data;
}
export async function visitorRegistration(token: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let row = visitorIdentity();
    if (!row) { row = await request('/installations', 'POST', {}); localStorage.setItem(KEY, JSON.stringify(row)); }
    try { await request('/devices', 'PUT', { token, platform: 'web' }, row!.key); return row!; }
    catch (error: any) { if (error.status === 401) { localStorage.removeItem(KEY); if (!attempt) continue; } throw error; }
  }
  throw new Error('Could not renew notification registration.');
}

export function queueVisitorRevocation() { const row = visitorIdentity(); if (row) localStorage.setItem(REVOKE, JSON.stringify(row)); }
export async function drainVisitorRevocation() {
  const saved = localStorage.getItem(REVOKE);
  if (!saved) return;
  const row = JSON.parse(saved) as Identity;
  try { await request('/devices', 'DELETE', undefined, row.key); }
  catch (error: any) { if (error.status !== 401) throw error; }
  if (localStorage.getItem(REVOKE) === saved) localStorage.removeItem(REVOKE);
}
export async function recordVisitorOpen(id: string, channel: 'push' | 'in_app') {
  const row = visitorIdentity();
  if (row && /^[a-f\d]{24}$/i.test(id)) await request(`/${id}/open`, 'PATCH', { channel }, row.key);
}
export const getPublicNotices = (): Promise<PublicNotice[]> => request('');
export const getPublicNotice = (id: string): Promise<PublicNotice> => request('/' + encodeURIComponent(id));
