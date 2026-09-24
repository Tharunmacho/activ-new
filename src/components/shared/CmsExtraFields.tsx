import { type CmsExtraField } from '@/services/cmsApi';
import { MICRO_LABEL } from '@/components/layout/typography';
import { CmsIcon } from '@/components/shared/CmsIcon';

/**
 * The fields an editor named themselves, wherever they were added.
 *
 * Every page in the CMS ends with a "Your own fields" list, because no schema
 * can enumerate what an association will want to say next. This renders them,
 * and it renders NOTHING when the list is empty — no heading, no rule, no gap.
 * A page that grows an empty band the moment the feature ships would be worse
 * than not having it.
 *
 * ==========================================================================
 * A FIELD SAYS WHERE IT GOES, AND THIS DRAWS BOTH ANSWERS
 * ==========================================================================
 *
 * `placement: 'card'`    a labelled line, as it has always been, with the
 *                        icon the editor picked beside it.
 * `placement: 'content'` a section of its own: the label as a heading and the
 *                        value as the prose under it, blank lines starting a
 *                        new paragraph.
 *
 * Handled HERE rather than at the twenty call sites, and that is the whole
 * reason the rollout was one change: every surface on the site already draws
 * its named fields through this component, so giving it the second shape gave
 * it to the footer, the about block, the banner, the contact page, the events
 * explorer and the rest at once. A caller that wants only one half asks for
 * it with `only`.
 *
 * `placement` is absent on every row written before the choice existed. Those
 * read as `card`, which is where they already appeared — a default that moved
 * them would have rearranged live pages nobody had edited.
 *
 * Two shapes for the card half, because the same content sits in two kinds of
 * place:
 *
 *   `list`  a labelled column — for a details card or a footer, where each row
 *           reads as a fact.
 *   `grid`  the same pairs across the page, for the wide bands under a body of
 *           copy, where a single column would run to one long thin strip.
 *
 * Values keep their line breaks (`whitespace-pre-line`): an editor who typed
 * three sponsors on three lines meant three lines. They are printed by React,
 * so the text is escaped — no markup is interpreted, and none needs stripping.
 */
interface Props {
    fields?: CmsExtraField[] | null;
    variant?: 'list' | 'grid';
    className?: string;
    /** Colour set for the footer, where the ground is dark. */
    tone?: 'light' | 'dark';
    /**
     * Draw only one half.
     *
     * For a surface whose two halves belong in different places on the page —
     * the facts in a side card, the sections down the middle. Left unset, both
     * are drawn here, sections first.
     */
    only?: 'card' | 'content';
    /** Hide the icon on the card half, where a surface draws no marks. */
    showIcons?: boolean;
    /**
     * TREAT EVERY ROW AS THIS SHAPE, whatever it was saved as.
     *
     * For a surface that can only draw one — the banner is white words over
     * a photograph and has no details card, so a labelled fact with an icon
     * has nowhere to go. The CMS stops OFFERING the other shape on those
     * cards (`fieldMode` on `CmsStep`), and this is what covers the rows
     * saved before it did: without it a field stored as `card` would keep
     * rendering as a caption and a glyph over the picture, on a card whose
     * editor no longer has a control to fix it with.
     */
    force?: 'card' | 'content';
    /**
     * WHICH WAY THE SECTION AROUND IT IS SET.
     *
     * Rows inherit their section's size, weight and colour (see the note
     * below) but not its alignment, because alignment is set on an ANCESTOR
     * and these rows sit in their own block. So a field added to the gallery's
     * filter-chip card — a centred rail — came out hard against the left
     * margin under eight centred pills, which is the "it is not aligned"
     * report.
     *
     * Passed by the caller for the same reason `proseClass` is: only the
     * caller knows which band it is dropping this into.
     */
    align?: 'start' | 'center';
}

export function CmsExtraFields({
    fields, variant = 'grid', className = '', tone = 'light', only, showIcons = true, force,
    align = 'start',
}: Props) {
    const rows = (fields || []).filter(f => f && (f.label || f.value));
    if (!rows.length) return null;

    const isContent = (f: CmsExtraField) => (force || f.placement) === 'content';

    const sections = only === 'card' ? [] : rows.filter(f => isContent(f) && String(f.value || '').trim());
    const facts = only === 'content' ? [] : rows.filter(f => !isContent(f));

    if (!sections.length && !facts.length) return null;

    /*
     * ======================================================================
     * THE SECTION'S TYPE, NOT THIS COMPONENT'S
     * ======================================================================
     *
     * The value and the body used to carry their own size, weight and colour
     * — `text-[1.125rem] font-semibold text-brand-800`. So a field added to a
     * band whose prose is large and bold came out small and medium-weight in
     * a different blue, sitting directly under that prose, and read as
     * somebody else's text pasted in. It was reported exactly that way: "can
     * you see the difference between the fonts".
     *
     * They inherit now. A field written into a section is part of that
     * section, so it takes the size, the weight, the leading and the colour of
     * the copy around it, whatever that copy happens to be — which is what
     * makes it look designed rather than injected, and what stops every new
     * band needing a new rule here.
     *
     * The LABEL keeps a size of its own, and deliberately: it is a caption
     * naming the thing rather than part of the prose, and every details card
     * on the site sets its labels this way. Its colour still comes from the
     * section, at reduced opacity, so it sits in the same palette.
     */
    const labelClass = tone === 'dark' ? 'text-white/60' : 'text-current opacity-55';
    const valueClass = tone === 'dark' ? 'text-white/90' : 'text-current';
    const bodyClass = tone === 'dark' ? 'text-white/80' : 'text-current';
    const headingClass = tone === 'dark' ? 'text-white' : 'text-current';

    const centred = align === 'center';

    return (
        <div className={`${className}${centred ? ' text-center' : ''}`}>
            {/* The editor's own sections, each under the heading they gave it. */}
            {sections.map((field, i) => (
                <section key={`s-${field.label}-${i}`} className={i === 0 ? '' : 'mt-10'}>
                    {field.label && (
                        /* `1.25em`, not a fixed rem: a heading inside a band of
                           large copy should be larger than that copy, and inside
                           a small card it should be smaller. One rule, every
                           band. */
                        <h2
                            className={`mb-3 font-black tracking-tight ${headingClass}`}
                            style={{ fontSize: '1.25em' }}
                        >
                            {field.label}
                        </h2>
                    )}
                    <div className="space-y-5">
                        {String(field.value).split(/\n{2,}/).map((para, j) => (
                            /* No size and no leading: the paragraph reads at
                               whatever the section reads at. */
                            <p key={j} className={`${bodyClass} whitespace-pre-line`}>
                                {para.trim()}
                            </p>
                        ))}
                    </div>
                </section>
            ))}

            {facts.length > 0 && (
                <dl
                    className={`${sections.length ? 'mt-10 ' : ''}${variant === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5'
                        : 'space-y-4'}`}
                >
                    {facts.map((field, i) => (
                        <div key={`f-${field.label}-${i}`} className="min-w-0">
                            {field.label && (
                                <dt className={`${MICRO_LABEL} ${labelClass} mb-1 flex items-center gap-1.5
                                                ${centred ? 'justify-center' : ''}`}>
                                    {/* The mark the editor picked. `info` is the
                                        fallback, so a row written before the
                                        picker existed still gets one rather than
                                        the empty space that reads as a fault. */}
                                    {showIcons && (
                                        <CmsIcon name={field.icon} size={14} fallback="info" />
                                    )}
                                    {field.label}
                                </dt>
                            )}
                            {field.value && (
                                <dd className={`${valueClass} break-words whitespace-pre-line`}>
                                    {field.value}
                                </dd>
                            )}
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}
