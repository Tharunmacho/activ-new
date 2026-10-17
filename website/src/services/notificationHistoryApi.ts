import api, { unwrap } from './api';

export interface HistorySelection {
  view: 'reports' | 'logs';
  ids?: string[];
  filters?: Record<string, string | undefined>;
  all?: boolean;
}
export interface HistoryBatch {
  ids: string[];
  token: string;
  eligible: number;
}
export interface HistoryPreview {
  matched: number;
  reviewed: number;
  eligible: number;
  retained: number;
  remaining: number;
  truncated: boolean;
  ids: string[];
  token: string;
  batches?: HistoryBatch[];
  reasons: { reason: string; count: number }[];
}
export interface HistoryResult {
  removed: number;
  retained: number;
  alreadySubmitted?: boolean;
  processing?: boolean;
  reasons: { reason: string; count: number }[];
}

const isCount = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0;

/** Reject incomplete plans before any irreversible history mutation. */
export function historyBatches(preview: HistoryPreview): HistoryBatch[] {
  const invalid = () => { throw new Error('The server could not review every selected log. Please close this window and try again.'); };
  if (!preview || !isCount(preview.eligible) || !isCount(preview.retained) || !Array.isArray(preview.ids) || preview.ids.length !== preview.eligible) invalid();
  const batches = preview.batches || (preview.token ? [{ ids: preview.ids, token: preview.token, eligible: preview.eligible }] : []);
  if (!Array.isArray(batches) || preview.eligible > 10000) invalid();
  const ids: string[] = [], tokens = new Set<string>();
  for (const batch of batches) {
    if (!batch || !Array.isArray(batch.ids) || !batch.ids.length || batch.ids.length > 500 || batch.eligible !== batch.ids.length ||
      typeof batch.token !== 'string' || !batch.token || tokens.has(batch.token) || batch.ids.some(id => typeof id !== 'string' || !id)) invalid();
    ids.push(...batch.ids); tokens.add(batch.token);
  }
  if (ids.length !== preview.eligible || new Set(ids).size !== ids.length || ids.some((id, index) => id !== preview.ids[index])) invalid();
  return batches.map(batch => ({ ...batch, ids: [...batch.ids] }));
}

export function validateHistoryResult(result: HistoryResult, batch: HistoryBatch) {
  if (!result || !isCount(result.removed) || !isCount(result.retained) || result.removed + result.retained !== batch.ids.length) {
    throw new Error('The server returned an incomplete deletion result.');
  }
}

export const previewHistoryDelete = async (selection: HistorySelection) =>
  unwrap<HistoryPreview>(await api.post('/notifications/history/delete-preview', selection, { timeout: 120000 }), null);
export const deleteHistory = async (preview: Pick<HistoryPreview, 'ids' | 'token'>) =>
  unwrap<HistoryResult>(await api.post('/notifications/history/delete', preview, { timeout: 120000 }), null);
