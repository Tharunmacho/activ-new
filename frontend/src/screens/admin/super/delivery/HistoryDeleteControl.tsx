import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { ConsoleButton, PALETTE, SPACE } from '../../../../ui';
import { errorText } from '../../../../services/superApi';
import { notificationReason } from '../../../../services/deliveryReportApi';
import {
  confirmHistoryDelete, historySelection, previewHistoryDelete,
  type HistoryDeleteBatch, type HistoryDeletePreview, type HistoryDeleteResult, type HistorySelection,
} from '../../../../services/notificationHistoryApi';

type DeleteRun = {
  preview: HistoryDeletePreview; batches: HistoryDeleteBatch[]; index: number;
  result: HistoryDeleteResult; started: boolean;
};
const reviewedRun = (preview: HistoryDeletePreview): DeleteRun => {
  if (!Number.isInteger(preview?.eligible) || preview.eligible < 0 || !Number.isInteger(preview?.retained)
    || preview.retained < 0 || !Array.isArray(preview?.ids)) throw Error('Could not review these log entries. Please try again.');
  const batches = (preview.batches || (preview.eligible ? [{ ids: preview.ids, token: preview.token, eligible: preview.eligible }] : []))
    .map(batch => ({ ...batch, ids: Array.isArray(batch?.ids) ? [...batch.ids] : [] }));
  const ids = batches.flatMap(batch => batch.ids);
  if (batches.some(batch => !batch.token || !batch.ids.length || batch.ids.length > 500 || batch.eligible !== batch.ids.length)
    || ids.length !== preview.eligible || new Set(ids).size !== ids.length || ids.length !== preview.ids.length
    || ids.some((id, index) => typeof id !== 'string' || !id || id !== preview.ids[index])) {
    throw Error('Could not review these log entries. Please try again.');
  }
  return { preview, batches, index: 0, started: false,
    result: { removed: 0, retained: preview.retained, reasons: [...(preview.reasons || [])] } };
};
const addReasons = (previous: HistoryDeleteResult['reasons'], next: HistoryDeleteResult['reasons']) => {
  const counts = new Map<string, number>();
  [...previous, ...(Array.isArray(next) ? next : [])].forEach(reason => counts.set(reason.reason, (counts.get(reason.reason) || 0) + reason.count));
  return [...counts].map(([reason, count]) => ({ reason, count }));
};

/** Admin history only. The server reviews a fixed snapshot before confirmation. */
export function HistoryDeleteControl({ selection, onDone, disabled, label = 'Clear logs' }: {
  selection: HistorySelection; onDone: () => void; disabled?: boolean; label?: string;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const selectionKey = JSON.stringify(historySelection(selection));
  const currentKey = useRef(selectionKey);
  currentKey.current = selectionKey;
  const reviewedKey = useRef('');
  const completed = useRef(onDone);
  completed.current = onDone;
  const [preview, setPreview] = useState<HistoryDeletePreview | null>(null);
  const [result, setResult] = useState<HistoryDeleteResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const run = useRef<DeleteRun | null>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { run.current = null; setPreview(null); setResult(null); setError(''); setProgress({ completed: 0, total: 0 }); }, [selectionKey]);
  const review = async (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    if (lock.current || disabled) return;
    if (run.current?.started && reviewedKey.current === selectionKey) {
      setPreview(run.current.preview); return;
    }
    lock.current = true; setBusy(true); setError(''); setResult(null); setPreview(null);
    const key = selectionKey;
    try {
      const next = await previewHistoryDelete(selection);
      const nextRun = reviewedRun(next);
      if (selection.all && (next.truncated || next.remaining)) {
        throw new Error('The full history could not be reviewed. Narrow the filters and try again.');
      }
      if (alive.current && key === currentKey.current) {
        reviewedKey.current = key; run.current = nextRun; setPreview(next);
        setProgress({ completed: 0, total: nextRun.batches.length });
      }
    } catch (err) { if (alive.current && key === currentKey.current) setError(errorText(err)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const confirm = async (event?: { stopPropagation?: () => void }) => {
    event?.stopPropagation?.();
    const current = run.current;
    if (lock.current || disabled || currentKey.current !== selectionKey || reviewedKey.current !== selectionKey || !preview?.eligible || !current?.batches.length) return;
    lock.current = true; setBusy(true); setError('');
    current.started = true;
    const key = selectionKey;
    try {
      while (current.index < current.batches.length && alive.current && key === currentKey.current) {
        const batch = current.batches[current.index];
        const next = await confirmHistoryDelete({ ids: batch.ids, token: batch.token });
        if (!next?.processing && (!Number.isInteger(next?.removed) || !Number.isInteger(next?.retained)
          || next.removed < 0 || next.retained < 0 || next.removed + next.retained !== batch.ids.length)) {
          throw new Error('The server did not confirm deletion. Try the same confirmation again.');
        }
        if (next?.processing) {
          if (alive.current && key === currentKey.current) setResult({ ...current.result, processing: true });
          return;
        }
        current.result = { removed: current.result.removed + next.removed, retained: current.result.retained + next.retained,
          reasons: addReasons(current.result.reasons, next.reasons) };
        current.index++;
        if (alive.current && key === currentKey.current) {
          setResult({ ...current.result }); setProgress({ completed: current.index, total: current.batches.length });
        }
      }
      if (alive.current && key === currentKey.current && current.index === current.batches.length) {
        setPreview(null); run.current = null;
        try {
          Alert.alert('History updated', `${current.result.removed} log entries deleted · ${current.result.retained} kept. Notifications in people's accounts and messages waiting to send are kept.`);
        } catch { /* Inline counts remain available if a native alert is unavailable. */ }
        completed.current();
      }
    } catch (err) {
      // Keep the same snapshot for an explicit retry; the server makes it idempotent.
      if (alive.current && key === currentKey.current) setError(errorText(err));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <View style={s.wrap}>
    {!preview && <ConsoleButton kind="soft" size="sm" icon="delete-outline" label={label}
      disabled={disabled || busy} loading={busy} onPress={review} />}
    {preview && <View style={s.review}>
      <Text style={s.text}>Delete {Number(preview.eligible || 0)} log entries from admin history?</Text>
      <Text style={s.help}>Notifications in people's accounts and messages waiting to send are kept.</Text>
      <Text style={s.help}>{Number(preview.reviewed || 0)} reviewed · {Number(preview.retained || 0)} kept.</Text>
      {(Array.isArray(preview.reasons) ? preview.reasons : []).map((reason, index) => <Text key={index} style={s.help}>{Number(reason?.count || 0)} kept: {notificationReason(reason?.reason)}</Text>)}
      {progress.total > 1 && <Text accessibilityLiveRegion="polite" style={s.help}>{progress.completed} of {progress.total} groups cleared. New entries after this review are kept.</Text>}
      <View style={s.actions}>
        <ConsoleButton size="sm" icon="delete-outline" label={`Confirm delete (${Number(preview.eligible || 0)})`}
          disabled={disabled || busy || !preview.eligible || !run.current?.batches.length} loading={busy} onPress={confirm} />
        <ConsoleButton size="sm" kind="soft" label={run.current?.started ? 'Close' : 'Cancel deletion'} disabled={busy} onPress={() => {
          if (!run.current?.started) run.current = null;
          setPreview(null);
        }} />
      </View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    {result && <Text accessibilityLiveRegion="polite" style={s.help}>{result.processing
      ? 'Deletion is still being processed. Check again using the same confirmation.'
      : `${Number(result.removed || 0)} log entries deleted · ${Number(result.retained || 0)} kept.`}</Text>}
    {(Array.isArray(result?.reasons) ? result.reasons : []).map((reason, index) => <Text key={index} style={s.help}>{Number(reason?.count || 0)} kept: {notificationReason(reason?.reason)}</Text>)}
  </View>;
}
const s = StyleSheet.create({
  wrap: { marginTop: SPACE.sm, gap: SPACE.sm },
  review: { padding: SPACE.md, backgroundColor: PALETTE.canvasAdmin, borderRadius: 12, gap: SPACE.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  text: { fontSize: 16, lineHeight: 23, fontWeight: '700', color: PALETTE.textSoft },
  help: { fontSize: 14, lineHeight: 21, color: PALETTE.textMuted },
  error: { fontSize: 14, lineHeight: 21, color: PALETTE.redDark },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
