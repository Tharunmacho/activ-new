import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/services/api';
import { deleteHistory, previewHistoryDelete, type HistoryPreview, type HistorySelection } from '@/services/notificationHistoryApi';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/shared/components/ui/alert-dialog';

/** Only an explicitly confirmed server snapshot can clear admin history. */
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
  const lock = useRef(false);
  const generation = useRef(0);
  const selectionKey = JSON.stringify(selection);
  useEffect(() => {
    generation.current++;
    setOpen(false); setPreview(null); setError(''); setBusy(false); lock.current = false;
    return () => { generation.current++; };
  }, [selectionKey]);

  const review = async () => {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true); setOpen(true); setPreview(null); setError('');
    const current = generation.current;
    try {
      const result = await previewHistoryDelete(selection);
      if (current === generation.current) setPreview(result);
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err, 'Could not check these logs. Please try again.'));
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  };
  const confirm = async () => {
    if (lock.current || !preview?.token || !preview.ids.length) return;
    lock.current = true; setBusy(true); setError('');
    const current = generation.current;
    try {
      const result = await deleteHistory({ ids: preview.ids, token: preview.token });
      if (current !== generation.current) return;
      if (result.processing) {
        setError('These logs are still being cleared. Wait a moment, then press the same button to check the result.');
        return;
      }
      const message = `${result.removed} ${result.removed === 1 ? 'log' : 'logs'} deleted${result.retained ? ` · ${result.retained} kept` : ''}.`;
      const options = result.reasons?.length ? { description: result.reasons.map(item => `${item.count}: ${item.reason}`).join(' ') } : undefined;
      if (result.removed) toast.success(message, options); else toast.info(message, options);
      setOpen(false); setPreview(null);
      await onRemoved();
    } catch (err) {
      if (current === generation.current) setError(errorMessage(err, 'Could not confirm deletion. Refresh the history before trying again.'));
    } finally {
      if (current === generation.current) { lock.current = false; setBusy(false); }
    }
  };

  return <>
    <button type="button" disabled={disabled || busy} onClick={() => void review()}
      aria-label={`${label}: ${context}`}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-ui-small font-semibold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">
      <Trash2 aria-hidden="true" className="h-4 w-4" />{label}
    </button>
    <AlertDialog open={open} onOpenChange={value => { if (!lock.current) setOpen(value); }}>
      <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl text-ui-body">
        <AlertDialogHeader>
          <AlertDialogTitle>{label === 'Delete' ? 'Delete this log?' : 'Clear these logs?'}</AlertDialogTitle>
          <AlertDialogDescription className="text-ui-small text-slate-600">
            {context}. This removes entries from admin history. Members keep their messages. Messages waiting to send stay in the list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {busy && !preview && <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking logs…</p>}
        {preview && <div className="space-y-2 text-ui-small">
          <p className="font-semibold">{preview.eligible} {preview.eligible === 1 ? 'log' : 'logs'} ready to delete.</p>
          {!!preview.retained && <p>{preview.retained} will stay in the list.</p>}
          {(preview.reasons || []).map((item, index) => <p key={index}>{item.count}: {item.reason}</p>)}
          {!!preview.remaining && <p>{preview.remaining} more logs are outside this batch. You can clear the next batch afterwards.</p>}
          <p>New messages arriving after this check stay in your history.</p>
        </div>}
        {error && <p role="alert" className="text-ui-small text-rose-700">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} className="min-h-11">Cancel</AlertDialogCancel>
          {preview && <button type="button" disabled={busy || !preview.eligible || !preview.token}
            onClick={() => void confirm()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rose-700 px-4 font-semibold text-white hover:bg-rose-800 disabled:opacity-50">
            {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}Delete {preview.eligible} {preview.eligible === 1 ? 'log' : 'logs'}
          </button>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
