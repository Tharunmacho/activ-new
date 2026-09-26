import { useCallback, useRef } from 'react';

/**
 * A TABLE THAT BECOMES CARDS ON A PHONE.
 *
 * Put the returned ref on the element that wraps a `<table>` and give it the
 * `card-table` class (index.css). Below 640px every row is drawn as a card and
 * every cell as "Header: value"; from 640px up the table is untouched.
 *
 * The header text is copied onto each cell as `data-label`, which is what the
 * CSS prints before the value, and a MutationObserver keeps it in step as rows
 * page, sort and filter. A CALLBACK ref, not an effect on mount: these tables
 * usually appear only after their data loads, and an effect that ran on the
 * empty first render would never see them.
 */
export function useCardTable<T extends HTMLElement = HTMLDivElement>() {
    const observer = useRef<MutationObserver | null>(null);

    return useCallback((root: T | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!root) return;

        const label = () => {
            root.querySelectorAll('table').forEach((table) => {
                const heads = [...table.querySelectorAll('thead th')].map((th) => (th.textContent || '').trim());
                table.querySelectorAll('tbody tr').forEach((tr) => {
                    [...tr.children].forEach((td, i) => {
                        const text = heads[i] || '';
                        if (td.getAttribute('data-label') !== text) td.setAttribute('data-label', text);
                    });
                });
            });
        };

        label();
        observer.current = new MutationObserver(label);
        observer.current.observe(root, { childList: true, subtree: true });
    }, []);
}
