import { useForceLightTheme } from '@/lib/appTheme';

/**
 * Render this on a screen that must stay light whatever the saved theme is — a
 * certificate or a tax receipt, which are documents rather than interface and
 * have to look on screen the way they print.
 */
export default function ForceLightTheme() {
    useForceLightTheme();
    return null;
}
