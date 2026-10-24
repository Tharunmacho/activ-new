import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Returning from a UPI/bank app and returning from a browser use one rule. */
export function usePaymentResumeCheck(enabled: boolean, check: () => Promise<boolean>, onConfirmed: () => void) {
  const latest = useRef({ check, onConfirmed });
  latest.current = { check, onConfirmed };
  useEffect(() => {
    if (!enabled) return undefined;
    let previous = AppState.currentState;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async (run: number, attempt = 0): Promise<void> => {
      const confirmed = await latest.current.check().catch(() => false);
      if (run !== generation) return;
      if (confirmed) { latest.current.onConfirmed(); return; }
      // The bank's webhook can arrive after Android has resumed our activity.
      if (attempt < 10) timer = setTimeout(() => { poll(run, attempt + 1); }, 3000);
    };
    const sub = AppState.addEventListener('change', next => {
      if (next === previous) return;
      const returned = next === 'active' && previous !== 'active';
      previous = next;
      generation += 1;
      if (timer) clearTimeout(timer);
      if (returned) poll(generation);
    });
    return () => { generation += 1; if (timer) clearTimeout(timer); sub.remove(); };
  }, [enabled]);
}
