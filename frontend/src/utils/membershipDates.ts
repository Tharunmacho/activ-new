/** Expiry is exclusive; the last valid calendar day is shown in India time. */
export function membershipValidityLabel(expiresAt?: string | Date | null): string {
  if (!expiresAt) return '';
  const at = new Date(expiresAt);
  if (!Number.isFinite(at.getTime())) return '';
  const offset = 330 * 60 * 1000;
  const india = new Date(at.getTime() + offset);
  const end = Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()) - offset;
  return new Date(end - 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
