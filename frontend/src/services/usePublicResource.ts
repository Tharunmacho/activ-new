import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/** CMS edits become visible on focus, pull-to-refresh, foreground and every
 * minute while this screen is visible. Requests are cancelled on navigation. */
export function usePublicResource<T>(navigation: any, key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loader = useRef(load); loader.current = load;
  const request = useRef<AbortController | null>(null);
  const read = useCallback(async (background = false) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    if (!background) setLoading(true);
    setRefreshing(background); setError('');
    try {
      const value = await loader.current(controller.signal);
      if (!controller.signal.aborted) setData(value);
    } catch (err: any) {
      if (!controller.signal.aborted) {
        if (err?.response?.status === 404) { setData(null); setError('This content is no longer available.'); }
        else setError('Could not load the latest content. Check your connection and try again.');
      }
    } finally {
      if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [key]);
  useEffect(() => {
    setData(null); void read();
    const visible = () => (!navigation.isFocused || navigation.isFocused()) && AppState.currentState !== 'background';
    const focus = navigation.addListener?.('focus', () => { if (!request.current || request.current.signal.aborted) void read(true); });
    const blur = navigation.addListener?.('blur', () => request.current?.abort());
    const app = AppState.addEventListener('change', state => { if (state === 'active' && visible()) void read(true); });
    const timer = setInterval(() => { if (visible()) void read(true); }, 60000);
    return () => { request.current?.abort(); focus?.(); blur?.(); app.remove(); clearInterval(timer); };
  }, [navigation, read]);
  return { data, loading, refreshing, error, reload: () => read(true) };
}
