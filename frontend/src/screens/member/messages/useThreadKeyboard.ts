import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';

export const keyboardOverlap = (bottom: number, keyboardTop: number | null) =>
  keyboardTop === null ? 0 : Math.max(0, Math.round(bottom - keyboardTop));

/** Measure the outer frame, never the padded child. A resized Android window
 * contributes zero overlap, preventing a second keyboard-height gap. */
export function useThreadKeyboard() {
  const ref = useRef<View>(null);
  const [bottom, setBottom] = useState(0);
  const [top, setTop] = useState<number | null>(null);
  const measure = useCallback(() => {
    ref.current?.measureInWindow?.((_x, y, _width, height) => {
      if (Number.isFinite(y + height) && height > 0) setBottom(y + height);
    });
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      const screenY = event?.endCoordinates?.screenY;
      setTop(Number.isFinite(screenY) ? screenY : null);
      measure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setTop(null));
    return () => { show.remove(); hide.remove(); };
  }, [measure]);
  return { ref, onLayout: measure, visible: top !== null, overlap: Platform.OS === 'android' ? keyboardOverlap(bottom, top) : 0 };
}
