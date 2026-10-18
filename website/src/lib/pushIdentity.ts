// Shared by the page and service worker. No authentication credentials are stored here.
export type PushIdentity = { userId?: string; visitorId?: string; token: string; expiresAt: number; configured?: boolean };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('activ-web-push', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('session');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readPushIdentity(): Promise<PushIdentity | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('session').objectStore('session').get('current');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function writePushIdentity(value: PushIdentity | null): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('session', 'readwrite');
      transaction.objectStore('session').put(value, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export function ownsPush(identity: PushIdentity | null, data: Record<string, string> = {}) {
  if (!identity || identity.expiresAt <= Date.now()) return false;
  if (data.audience === 'visitor') return Boolean(!identity.userId && identity.visitorId && identity.visitorId === data.visitorId && /^[a-f\d]{24}$/i.test(data.publicNotificationId || ''));
  return Boolean(identity.userId && identity.userId === data.userId);
}
