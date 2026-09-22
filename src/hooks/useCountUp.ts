import { useEffect, useRef, useState } from 'react';

/**
 * Count a figure up from zero, once, when it first scrolls into view.
 *
 * The stat rows on the public pages are the one place the site makes a claim
 * about its own size — "5,000+ Members Registered", "405+ Blocks". A number
 * that is simply printed reads as a label; a number that arrives reads as a
 * result, which is the whole reason those rows are on the page.
 *
 * The values come from the CMS as free text, so this cannot assume a number. It
 * parses the digits out and preserves everything around them: `"5,000+"` keeps
 * its comma grouping and its `+`, `"₹2.5Cr"` keeps prefix and suffix, and a
 * value with no digits at all ("Nationwide") is handed back untouched rather
 * than rendered as `NaN` — which is exactly what an editor would eventually
 * type and exactly what a naive `parseInt` would break on.
 *
 * `requestAnimationFrame` rather than an interval: an interval keeps firing in
 * a background tab and drifts against the display, and this is decoration that
 * should stop when nobody is looking at it.
 */

/** Ease-out cubic — fast first, settling at the end, so the figure "lands". */
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion = (): boolean => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

interface Parsed {
    prefix: string;
    digits: number;
    suffix: string;
    /** True when the source used `1,234` grouping, so the count keeps it. */
    grouped: boolean;
    /** Decimal places in the source, so `2.5` does not count up to `3`. */
    decimals: number;
}

const parse = (raw: string): Parsed | null => {
    const match = String(raw ?? '').match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/s);
    if (!match) return null;

    const [, prefix, numeric, suffix] = match;
    const plain = numeric.replace(/,/g, '');
    const value = Number(plain);
    if (!Number.isFinite(value)) return null;

    return {
        prefix,
        digits: value,
        suffix,
        grouped: numeric.includes(','),
        decimals: (plain.split('.')[1] || '').length,
    };
};

const format = (value: number, p: Parsed): string => {
    const fixed = value.toFixed(p.decimals);
    const body = p.grouped
        ? Number(fixed).toLocaleString('en-IN', {
              minimumFractionDigits: p.decimals,
              maximumFractionDigits: p.decimals,
          })
        : fixed;
    return `${p.prefix}${body}${p.suffix}`;
};

/**
 * Returns a ref to attach to the element, and the text to render inside it.
 * Before the element is seen, and whenever the value cannot be counted, the
 * text is the original string.
 */
export function useCountUp(value: string, durationMs = 1600) {
    const ref = useRef<HTMLElement | null>(null);
    const [display, setDisplay] = useState<string>(value);

    useEffect(() => {
        const parsed = parse(value);

        // Not a number, or the visitor asked for less motion: print it as authored.
        if (!parsed || prefersReducedMotion()) {
            setDisplay(value);
            return;
        }

        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') {
            setDisplay(value);
            return;
        }

        let frame = 0;
        let startedAt = 0;

        const step = (now: number) => {
            if (!startedAt) startedAt = now;
            const progress = Math.min((now - startedAt) / durationMs, 1);
            setDisplay(format(parsed.digits * easeOut(progress), parsed));
            if (progress < 1) frame = requestAnimationFrame(step);
        };

        const io = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                io.disconnect();
                frame = requestAnimationFrame(step);
            },
            /*
             * Deliberately low. The hero's figures sit in a card that straddles
             * the fold, so at a lot of window heights they are on screen but
             * less than half visible — and a figure that is readable while
             * still showing `0+` does not look like an animation waiting to
             * start, it looks like a number that failed to load.
             */
            { threshold: 0.15 },
        );

        io.observe(el);
        setDisplay(format(0, parsed));

        return () => {
            io.disconnect();
            if (frame) cancelAnimationFrame(frame);
        };
    }, [value, durationMs]);

    return { ref, display };
}

export default useCountUp;
