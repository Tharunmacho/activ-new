/**
 * The public site's surface primitives — the sheet, the card, the card's
 * heading, its badge and its field label.
 *
 * =========================================================================
 * LIFTED FROM THE BUSINESS AREA, ON PURPOSE
 * =========================================================================
 *
 * These are `pages/business/BusinessUI.tsx`'s card and type, to the class. That
 * is the screen a member creates their business account on, and it is the
 * longest, densest form the product has — so it is the one place the house
 * style has already been argued all the way through. The association asked for
 * the public flows to read the same way, and the cheapest way to be sure they
 * do is to use the same strings rather than a careful imitation of them.
 *
 * THREE THINGS MAKE A CARD A CARD, and the first is the one that gets left out:
 *
 *   1. a page underneath it that is NOT the same white. That is `SHEET`. White
 *      cards on a white document have only a hairline between them and it, and
 *      a hairline is not a layer — this is exactly what the booking flow's
 *      choice step looked like before it was fixed, and what the event page
 *      looked like beside it.
 *   2. the `slate-200` hairline.
 *   3. a two-stop shadow: a 1px contact shadow that sets the card down, and a
 *      wide soft one that lifts it. One alone reads as a border or as a haze.
 *
 * `BusinessUI` is not imported directly because it exports React components
 * carrying the business area's own light-only assumptions; what the public
 * pages need is the class strings.
 */

/**
 * The tinted layer cards stand on.
 *
 * Three layers, as the reference has them: a white page, one faintly tinted
 * sheet, and white cards on the sheet. With only two — and both white — the
 * cards have nothing to stand on; tinting the whole page instead leaves them
 * floating on a wash with no edge to the document.
 */
export const SHEET =
    'rounded-[1.75rem] bg-[#f3f6fb] border border-gray-200/80 p-4 sm:p-6 lg:p-8';

/** `BusinessUI.Card`. */
export const BIZ_CARD =
    'bg-white border border-slate-200 rounded-2xl ' +
    'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]';

/** `BusinessUI.SectionHeading`'s `<h2>`. */
export const BIZ_CARD_TITLE = 'text-[1.375rem] font-extrabold tracking-tight text-slate-900';

/** A step down from it, for a heading inside a card that already has one. */
export const BIZ_SUB_TITLE = 'text-[1.375rem] font-extrabold tracking-tight text-slate-900';

/**
 * `BusinessUI.Chip`, with a fixed height.
 *
 * The height is an alignment fix. Two badges of the same nominal size sat two
 * pixels apart because one carried a border and the other did not, and every
 * row beneath them inherited the offset — close enough to look like a mistake
 * and not close enough to look deliberate. A fixed `h-7` makes the rule
 * independent of what each badge is wearing.
 */
export const BIZ_BADGE =
    'inline-flex h-7 w-fit items-center gap-1.5 rounded-full px-3 ' +
    'text-[0.9375rem] font-bold uppercase tracking-[0.08em]';

/**
 * `BusinessUI.Field`'s label: 16px bold in slate-800, sentence case.
 *
 * Uppercase 12px is a caption — it annotates the box rather than naming it, and
 * at that size a form of eight of them reads as fine print around the inputs
 * instead of as a form.
 */
export const BIZ_FIELD_LABEL = 'block text-[1.25rem] font-bold text-slate-800 mb-2';

/**
 * The caption above a VALUE rather than above a control.
 *
 * This one stays small and uppercase, and the distinction is real: a form label
 * names something you are about to fill in and has to carry the weight of a
 * question, while "Date" over "Thu, 15 Oct 2026" is a key beside its value and
 * should not compete with it.
 */
export const BIZ_DETAIL_LABEL =
    'text-[0.9375rem] font-extrabold uppercase tracking-widest text-slate-400';

/** The value under it. */
export const BIZ_DETAIL_VALUE = 'text-[1.25rem] font-bold text-slate-900';

/**
 * A tinted well INSIDE a white card — a price panel, a meter, a note.
 *
 * `slate-50` on white is the same relationship `SHEET` has with a card, one
 * step quieter, so a panel nested in a card still reads as nested rather than
 * as a second card that failed to get its shadow.
 */
export const BIZ_WELL = 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5';
