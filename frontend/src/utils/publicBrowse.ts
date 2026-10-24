export type PublicAction = { kind: 'event' | 'member-event' | 'member-update'; id: string } | { kind: 'register' | 'login' | 'membership' | 'account' | 'donate' };

/** Strictly local website paths; never accept another origin as an app command. */
export function publicWebsitePath(value: string): string | null {
  let raw = String(value || '').trim();
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  if (/^https?:\/\//i.test(raw)) {
    const match = /^https:\/\/(?:www\.)?activ\.org\.in(\/[^#]*)?(?:#.*)?$/i.exec(raw)
      || (__DEV__ ? /^http:\/\/localhost:8080(\/[^#]*)?(?:#.*)?$/i.exec(raw) : null);
    if (!match) return null;
    raw = match[1] || '/';
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  try { raw = decodeURIComponent(raw.split(/[?#]/)[0]); } catch { return null; }
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  const parts: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}
export function publicActionFor(value: string): PublicAction | null {
  const path = publicWebsitePath(value);
  if (!path) return null;
  const booking = /^\/events\/([a-z0-9_-]+)\/book\/?$/i.exec(path);
  if (booking) return { kind: 'event', id: booking[1] };
  const sharedMemberContent = /^\/member\/(events|updates)\/([a-z0-9_-]+)$/i.exec(path);
  if (sharedMemberContent) return { kind: sharedMemberContent[1].toLowerCase() === 'events' ? 'member-event' : 'member-update', id: sharedMemberContent[2] };
  if (/^\/register(?:\/|$)/i.test(path)) return { kind: 'register' };
  if (/^\/login(?:\/|$)/i.test(path)) return { kind: 'login' };
  if (/^\/(?:donate|donations)(?:\/|$)/i.test(path)) return { kind: 'donate' };
  if (/^\/(?:payment|membership\/(?:apply|join|checkout)|complete-membership)(?:\/|$)/i.test(path)) return { kind: 'membership' };
  if (/^\/(?:admin|cms|super-admin|state-admin|district-admin|block-admin|events-admin|member|member-dashboard|business|checkout|auth)(?:\/|$)/i.test(path)) return { kind: 'account' };
  return null;
}
