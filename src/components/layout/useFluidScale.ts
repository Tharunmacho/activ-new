import { useEffect } from 'react';

/**
 * Turn on the public site's fluid page scaling, for as long as this page lives.
 *
 * The scaling itself is one rule in `index.css`: the root font size tracks the
 * viewport width, and because Tailwind's spacing, type and max-width scales are
 * rem-based, the whole layout grows and shrinks together. That is what makes
 * the onboarding pages look the same at 90% browser zoom as at 100%.
 *
 * It has to live on `<html>` — `rem` is root-relative by definition, so there
 * is no way to scope it to a subtree with CSS alone. A class on the root, added
 * while a public page is mounted and removed when it unmounts, is what keeps it
 * off the member and admin screens: those were built against a fixed 16px root
 * and re-scaling them was never part of the brief.
 *
 * Called from `HeaderSection`, which is rendered by exactly the five onboarding
 * pages and nothing else — so the scaling is on precisely where the header is.
 */
export function useFluidScale(): void {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('fluid-scale');
        return () => root.classList.remove('fluid-scale');
    }, []);
}
