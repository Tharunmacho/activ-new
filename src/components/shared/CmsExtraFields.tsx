import { type CmsExtraField } from '@/services/cmsApi';
import { MICRO_LABEL } from '@/components/layout/typography';

/**
 * The fields an editor named themselves, wherever they were added.
 *
 * Every page in the CMS ends with a "Your own fields" list, because no schema
 * can enumerate what an association will want to say next. This renders them,
 * and it renders NOTHING when the list is empty — no heading, no rule, no gap.
 * A page that grows an empty band the moment the feature ships would be worse
 * than not having it.
 *
 * Two shapes, because the same content sits in two kinds of place:
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
}

export function CmsExtraFields({ fields, variant = 'grid', className = '', tone = 'light' }: Props) {
    const rows = (fields || []).filter(f => f && (f.label || f.value));
    if (!rows.length) return null;

    const labelClass = tone === 'dark' ? 'text-white/60' : 'text-gray-400';
    const valueClass = tone === 'dark' ? 'text-white/90' : 'text-brand-800';

    return (
        <dl
            className={`${variant === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5'
                : 'space-y-4'} ${className}`}
        >
            {rows.map((field, i) => (
                <div key={`${field.label}-${i}`} className="min-w-0">
                    {field.label && (
                        <dt className={`${MICRO_LABEL} ${labelClass} mb-1`}>{field.label}</dt>
                    )}
                    {field.value && (
                        <dd className={`text-[1.125rem] font-semibold ${valueClass} break-words whitespace-pre-line`}>
                            {field.value}
                        </dd>
                    )}
                </div>
            ))}
        </dl>
    );
}
