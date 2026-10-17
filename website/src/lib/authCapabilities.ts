export type PasswordStatus = 'set' | 'not_set' | 'legacy_unknown';
const names: Record<string, string> = { google: 'Google', linkedin: 'LinkedIn', facebook: 'Facebook' };
export const linkedProviderNames = (account: any): string[] => [...new Set<string>((Array.isArray(account?.linkedProviders) ? account.linkedProviders : [])
  .filter((provider: unknown) => typeof provider === 'string' && Object.prototype.hasOwnProperty.call(names, provider))
  .map((provider: string) => names[provider]))];

/** Missing capabilities preserve the existing current-password requirement. */
export function accountPasswordStatus(account: any): PasswordStatus {
  if (['set', 'not_set', 'legacy_unknown'].includes(account?.passwordStatus)) return account.passwordStatus;
  return account?.hasPassword === false ? 'not_set' : 'set';
}
