/**
 * Keeping "No. of Sister Concerns" and the company-name boxes in step.
 *
 * ==========================================================================
 * THE COUNT AND THE BOXES ARE ONE ANSWER
 * ==========================================================================
 *
 * "No. of Sister Concerns: 3" beside a single name box is a form contradicting
 * itself, and the applicant has no way to know which half the association will
 * read. Typing a number builds that many boxes; adding or removing a box moves
 * the number. Neither can be left behind by the other.
 *
 * Its own module rather than a closure inside `Profile.tsx` because three
 * screens ask this same question — the wizard, `DeclarationForm` and
 * `Settings` — and because the shrinking rule below is the one part of it with
 * a decision in it, which makes it the part worth testing on its own.
 */

/**
 * The rows resized to `count`.
 *
 * GROWING appends empty boxes.
 *
 * SHRINKING DROPS BLANKS BEFORE IT DROPS TYPED NAMES. Going 3 -> 2 with
 * `["Acme", "", "Baker"]` keeps both companies rather than deleting Baker for
 * the crime of being last — the blank row is the one carrying nothing. Only
 * once there are no blanks left does a typed name go, which at that point is
 * the honest consequence of answering "2".
 *
 * `count <= 0` is an empty list, not one empty box: the member has said there
 * are none, and a name field under that answer is a question already answered.
 */
export const resizeCompanyNames = (rows: string[], count: number): string[] => {
    const safe = Array.isArray(rows) ? rows : [];
    if (!Number.isFinite(count) || count <= 0) return [];
    if (safe.length === count) return safe;
    if (safe.length < count) {
        return [...safe, ...Array(count - safe.length).fill('')];
    }

    const next = [...safe];
    while (next.length > count) {
        const blank = next.map((row) => String(row ?? '').trim()).lastIndexOf('');
        if (blank >= 0) next.splice(blank, 1);
        else next.pop();
    }
    return next;
};

/**
 * Digits only, from whatever was typed.
 *
 * A count cannot be negative or fractional, and `<input type="number">` will
 * happily hand over "-3", "1e5" and "2.5". Returns `''` for an empty box, which
 * is NOT zero — it is "no answer yet", and the caller must not resize on it or
 * every member who selects the field and retypes loses their names on the way
 * past empty.
 */
export const toCount = (raw: string): string => String(raw ?? '').replace(/[^0-9]/g, '');
