/**
 * Re-export of the shared admin API.
 *
 * A past restructure left two identical copies of this module. Forwarding to
 * one implementation stops them drifting apart.
 */
export * from '@/shared/services/adminApi';
export { default } from '@/shared/services/adminApi';
