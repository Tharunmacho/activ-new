import api, { unwrap } from './api';

export interface HistorySelection {
  view: 'reports' | 'logs';
  ids?: string[];
  filters?: Record<string, string | undefined>;
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
  reasons: { reason: string; count: number }[];
}
export interface HistoryResult {
  removed: number;
  retained: number;
  alreadySubmitted?: boolean;
  processing?: boolean;
  reasons: { reason: string; count: number }[];
}
export const previewHistoryDelete = async (selection: HistorySelection) =>
  unwrap<HistoryPreview>(await api.post('/notifications/history/delete-preview', selection, { timeout: 120000 }), null);
export const deleteHistory = async (preview: Pick<HistoryPreview, 'ids' | 'token'>) =>
  unwrap<HistoryResult>(await api.post('/notifications/history/delete', preview, { timeout: 120000 }), null);
