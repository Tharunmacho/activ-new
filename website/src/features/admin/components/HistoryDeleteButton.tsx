import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/services/api';
import { deleteHistory, historyBatches, previewHistoryDelete, validateHistoryResult, type HistoryBatch, type HistoryPreview, type HistorySelection } from '@/services/notificationHistoryApi';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/shared/components/ui/alert-dialog';

type ClearJob = {
  batches: HistoryBatch[];
  context: string;
  next: number;
  removed: number;
  retained: number;
  reasons: { reason: string; count: number }[];
  started: boolean;
};

/** One confirmation applies only to the reviewed snapshot, including every batch. */
export default function HistoryDeleteButton({ selection, onRemoved, disabled = false, label = 'Delete', context = 'this message' }: {
  selection: HistorySelection;
  onRemoved: () => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  context?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ checked: number; removed: number } | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const job = useRef<ClearJob | null>(null);
  const selectionKey = JSON.stringify(selection);
  useEffect(() => {
    // Keep the same snapshot after confirmation, even if filters are refreshed.
    if (job.current?.started) return;
    generation.current++;
    job.current = null;
    setOpen(false); setPreview(null); setError(''); setProgress(null); setBusy(false); lock.current = false;
  }, [selectionKey]);
  useEffect(() => () => { generation.current++; }, []);

  const review = async () => {
    if (lock.current) return;
    if (job.current?.started) { setOpen(true); return; }
    if (disabled) return;
    lock.current = true; setBusy(true); setOpen(true); setPreview(null); setError(''); setProgress(null);
    const current = generation.current;
    try {
      const result = await previewHistoryDelete(selection);
      if (current !== generation.current) return;
      if (selection.all && result.remaining) throw new Error('These logs could not all be reviewed. Narrow the filters and try again.');
      // Copy once: later arrivals and refreshed filters never expand this deletion.
      const batches = historyBatches(result);
      job.current = { batches, context, next: 0, removed: 0, retained: result.retained, reasons: (result.reasons || []).map(reason => ({ ...reason })), started: false };
      setPreview(result);
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err, 'Could not check these logs. Please try again.'));
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  };
  const confirm = async () => {
    const snapshot = job.current;
    if (lock.current || !snapshot?.batches.length || !preview?.eligible) return;
    snapshot.started = true;
    lock.current = true; setBusy(true); setError('');
    setProgress({ checked: snapshot.next, removed: snapshot.removed });
    const current = generation.current;
    try {
      while (snapshot.next < snapshot.batches.length) {
        const batch = snapshot.batches[snapshot.next];
        const result = await deleteHistory({ ids: batch.ids, token: batch.token });
        if (current !== generation.current) return;
        if (result?.processing) {
          setError('These logs are still being cleared. Wait a moment, then continue to check the result.');
          return;
        }
        validateHistoryResult(result, batch);
        // Only advance after a final result. An uncertain request reuses this token.
        snapshot.removed += result.removed;
        snapshot.retained += result.retained;
        for (const item of result.reasons || []) {
          const previous = snapshot.reasons.find(reason => reason.reason === item.reason);
          if (previous) previous.count += item.count; else snapshot.reasons.push({ ...item });
        }
        snapshot.next++;
        setProgress({ checked: snapshot.next, removed: snapshot.removed });
      }
      const message = `${snapshot.removed} ${snapshot.removed === 1 ? 'log' : 'logs'} deleted${snapshot.retained ? ` · ${snapshot.retained} kept` : ''}.`;
      const options = snapshot.reasons.length ? { description: snapshot.reasons.map(item => `${item.count}: ${item.reason}`).join(' ') } : undefined;
      if (snapshot.removed) toast.success(message, options); else toast.info(message, options);
      job.current = null;
      setOpen(false); setPreview(null); setProgress(null);
      // Refresh totals and page one only when the complete snapshot has finished.
      try { await onRemoved(); } catch { toast.error('Logs were cleared. Refresh the page to update the list.'); }
    } catch (err) {
      if (current === generation.current) setError(`${errorMessage(err, 'Could not confirm the result.')} Continue to check this same request and finish clearing the reviewed logs.`);
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  };
  const resumable = !!job.current?.started;

  return <>
    <button type="button" disabled={busy || (disabled && !resumable)} onClick={() => void review()}
      aria-label={`${label}: ${context}`}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-ui-small font-semibold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
      <Trash2 aria-hidden="true" className="h-4 w-4" />{resumable ? 'Continue clearing' : label}
    </button>
    <AlertDialog open={open} onOpenChange={value => { if (!lock.current) setOpen(value); }}>
      <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl text-ui-body">
        <AlertDialogHeader>
          <AlertDialogTitle>{label === 'Delete' ? 'Delete this log?' : 'Clear these logs?'}</AlertDialogTitle>
          <AlertDialogDescription className="text-ui-small text-slate-600">
            {job.current?.context || context}. This removes entries from admin history. Members keep their messages. Messages waiting to send stay in the list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {busy && !preview && <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking logs…</p>}
        {preview && <div className="space-y-2 text-ui-small">
          <p className="font-semibold">{preview.eligible} {preview.eligible === 1 ? 'log' : 'logs'} ready to delete.</p>
          {!!preview.retained && <p>{preview.retained} will stay in the list.</p>}
          {(preview.reasons || []).map((item, index) => <p key={index}>{item.count}: {item.reason}</p>)}
          <p>New messages arriving after this check stay in your history.</p>
        </div>}
        {progress && <p role="status" className="text-ui-small">{progress.removed} logs deleted. Checked {progress.checked} of {job.current?.batches.length || progress.checked} steps.</p>}
        {error && <p role="alert" className="text-ui-small text-rose-700">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="min-h-11">{resumable ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {preview && <button type="button" disabled={busy || !preview.eligible || !job.current?.batches.length}
            onClick={() => void confirm()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-700 px-4 font-semibold text-white hover:bg-rose-800 disabled:opacity-50">
            {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}{busy ? 'Clearing…' : resumable ? 'Continue clearing' : `Delete ${preview.eligible} ${preview.eligible === 1 ? 'log' : 'logs'}`}
          </button>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
