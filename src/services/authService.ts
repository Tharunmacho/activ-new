/**
 * Re-export of the shared auth service.
 *
 * A past restructure left two copies of this module (`src/services` and
 * `src/shared/services`) and different pages import from each. Keeping two
 * implementations in step is exactly how they drift, so this one now forwards
 * to the shared module rather than duplicating it.
 */
export * from '@/shared/services/authService';
export { default } from '@/shared/services/authService';
