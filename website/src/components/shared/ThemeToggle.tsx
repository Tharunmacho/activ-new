import { Moon, Sun } from 'lucide-react';
import { useAppTheme, useThemeLocked } from '@/lib/appTheme';

/**
 * The light / dark control for the signed-in areas.
 *
 * TWO SHAPES, ONE STATE (see `lib/appTheme.ts`):
 *
 *   `icon`       a single round tile that flips — for a header, where room is
 *                short and the page behind it is always the page being themed.
 *   `segmented`  Light | Dark side by side — for a sidebar, where there is room
 *                to say which theme is active without pressing anything.
 *
 * `tone="rail"` is for the admin rail, which is a blue gradient in BOTH themes:
 * it is drawn in translucent white so it reads on that gradient, and so the
 * dark-mode remap of `bg-white` / `text-slate-*` never touches it.
 *
 * ACCESSIBLE AS A TOGGLE. The icon button keeps one stable name ("Dark mode")
 * and reports its state through `aria-pressed`; a name that flipped between
 * "Switch to light" and "Switch to dark" AND carried a pressed state would be
 * announced as two contradicting things. The segmented pair is two
 * `aria-pressed` buttons in a labelled group.
 *
 * TAP TARGET. 44px square below `sm` (the minimum a thumb reliably hits),
 * 40px from `sm` up where the pointer is a mouse.
 */
export default function ThemeToggle({
    variant = 'icon',
    tone = 'surface',
    compact = false,
    className = '',
}: {
    variant?: 'icon' | 'segmented';
    tone?: 'surface' | 'rail';
    /** Segmented only: icons without the words, for a collapsed rail. */
    compact?: boolean;
    className?: string;
}) {
    const { dark, setMode, toggle } = useAppTheme();
    /* A page that is a document (certificate, receipt) stays light, so a switch
       there would do nothing. Better absent than inert. */
    const locked = useThemeLocked();

    if (locked) return null;

    if (variant === 'segmented' && !compact) {
        const rail = tone === 'rail';

        return (
            <div
                role="group"
                aria-label="Colour theme"
                className={`grid grid-cols-2 gap-1 rounded-xl p-1 ${
                    rail ? 'bg-black/20 ring-1 ring-white/15' : 'bg-slate-100 border border-slate-200'
                } ${className}`}
            >
                {([['Light', false, Sun], ['Dark', true, Moon]] as const).map(([label, wants, Icon]) => {
                    const active = dark === wants;

                    return (
                        <button
                            key={label}
                            type="button"
                            onClick={() => setMode(wants ? 'dark' : 'light')}
                            aria-pressed={active}
                            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-ui-caption
                                        font-semibold transition-colors ${
                                rail
                                    ? (active ? 'bg-white/25 text-white shadow-sm' : 'text-blue-100 hover:bg-white/10')
                                    : (active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900')
                            }`}
                        >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {label}
                        </button>
                    );
                })}
            </div>
        );
    }

    const rail = tone === 'rail';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={dark}
            aria-label="Dark mode"
            title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors active:scale-90
                        sm:h-10 sm:w-10 ${
                rail
                    ? 'border-white/25 text-white hover:bg-white/15'
                    : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900'
            } ${className}`}
        >
            {dark
                ? <Sun className="h-5 w-5" aria-hidden="true" />
                : <Moon className="h-5 w-5" aria-hidden="true" />}
        </button>
    );
}
