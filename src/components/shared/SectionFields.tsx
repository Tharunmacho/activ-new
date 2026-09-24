import type { CmsSectionOverride } from '@/services/cmsApi';
import { sectionHidden, sectionFields } from '@/components/shared/cmsSections';
import { CmsExtraFields } from '@/components/shared/CmsExtraFields';

/**
 * ==========================================================================
 * A SECTION'S OWN FIELDS, DRAWN INSIDE THAT SECTION
 * ==========================================================================
 *
 * The CMS asks "what else does THIS CARD want to say" once per card, and
 * stores the answer against that card's key. The public pages then pooled
 * every card's answers into one array and printed it once, at the very foot
 * of the page:
 *
 *     const ownRows = [ ...rowsOf('membership.opening'), ...rowsOf('membership.why'), ... ];
 *     <CmsExtraFields fields={ownRows} />        // <- the bottom of the page
 *
 * So an editor who added a field to "Why join" found it at the end of the
 * page, under the last band, in the page's default type rather than that
 * card's. The field was saved correctly and shown in the wrong place, which
 * is the worst of both: nothing to debug and nothing that looks broken.
 *
 * This puts it back where it was written. Drop one at the end of a section's
 * markup and the rows land inside that section, inheriting its width, its
 * ground and its type, because they are simply part of it.
 *
 * It renders NOTHING when the card has no rows, so a page does not grow a gap
 * per section the moment this ships. And it renders nothing for a section the
 * editor removed — taking a card off the page has to take its rows with it,
 * or removing a card leaves its fields behind with no heading to explain them.
 */
export function SectionFields({
    sections, sectionKey, className = '', tone = 'light', proseClass = '', force,
    align = 'start',
}: {
    sections?: CmsSectionOverride[];
    /** The card's key, e.g. `membership.why`. See `SECTION_KEYS`. */
    sectionKey: string;
    className?: string;
    tone?: 'light' | 'dark';
    /**
     * THE SECTION'S OWN TYPE, handed down.
     *
     * `CmsExtraFields` sets no size and no weight — it inherits — but CSS
     * inheritance only reaches what an ANCESTOR sets, and on these pages the
     * type lives on the `<p>` elements themselves, which are siblings. So the
     * rows landed at the page's base 16px regular next to prose at 28px
     * extra-bold, and read as somebody else's text pasted in.
     *
     * The caller passes the classes its copy uses and they go on the wrapper,
     * which every row then inherits. It is the caller because only the caller
     * knows: the same component is dropped into a hero, a details column and a
     * footer, and there is no rule that could guess between them.
     */
    proseClass?: string;
    /** See `force` on `CmsExtraFields` — for a surface with only one shape. */
    force?: 'card' | 'content';
    /** See `align` on `CmsExtraFields` — for a band whose copy is centred. */
    align?: 'start' | 'center';
}) {
    if (sectionHidden(sections, sectionKey)) return null;

    const rows = sectionFields(sections, sectionKey);
    if (!rows.length) return null;

    /*
     * `mt-8` and not a margin on the caller: the rows belong to the section, so
     * the space above them is the section's business and every caller should
     * get the same one. A caller that needs different spacing passes it.
     */
    return (
        <div className={proseClass}>
            <CmsExtraFields
                fields={rows}
                variant="list"
                tone={tone}
                force={force}
                align={align}
                className={className || 'mt-8'}
            />
        </div>
    );
}
