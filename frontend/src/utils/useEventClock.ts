import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
/** Re-evaluate cached cards as events finish and when the phone resumes. */
export function useEventClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  return now;
}
