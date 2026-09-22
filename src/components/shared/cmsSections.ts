import type { CmsExtraField, CmsSectionOverride } from '@/services/cmsApi';

/**
 * ==========================================================================
 * READING WHAT THE EDITOR DID TO A SECTION
 * ==========================================================================
 *
 * The CMS writes one row per card it was asked about — see `CmsStep` and
 * `sectionOverrides` in the models. The public page asks two questions of it,
 * and these are the two functions.
 *
 * Both are total. A page whose content predates this feature has no `sections`
 * at all, a page saved by a build that did not know a card carries no row for
 * it, and a row can name a card this code no longer draws. Every one of those
 * answers "shown, with no extra rows", which is the behaviour the site had
 * before any of this existed — so a section can only ever be hidden because
 * somebody said to hide it.
 *
 * ONE SPELLING OF EACH KEY. The CMS card and the public section are two files
 * that never import from each other, and the only thing tying them together is
 * this string. They are listed in `SECTION_KEYS` below so a grep for a key
 * finds both ends of it, and a card renamed in the CMS without its page is a
 * card that stops hiding rather than a card that hides the wrong thing.
 */

/** The row the editor's answers for one card are stored in, if there is one. */
const rowOf = (sections: CmsSectionOverride[] | undefined, key: string) =>
    (sections || []).find(s => s && s.key === key);

/** Is this section off the page? Absent answers `false` — see above. */
export const sectionHidden = (sections: CmsSectionOverride[] | undefined, key: string): boolean =>
    rowOf(sections, key)?.hidden === true;

/** The editor's own rows for this section, in the order they set. */
export const sectionFields = (
    sections: CmsSectionOverride[] | undefined,
    key: string,
): CmsExtraField[] => rowOf(sections, key)?.fields || [];

/**
 * Every key this site uses, by screen.
 *
 * Not consumed at runtime — both ends pass the literal — but a single list of
 * them is what makes the pairing auditable, and is what a reviewer reads to
 * see that a card added to a CMS screen was also given a page to hide.
 */
export const SECTION_KEYS = {
    home: [
        'carousel.headline', 'carousel.buttons', 'carousel.slides',
        'carousel.galleryPosters', 'carousel.highlightCard',
        'about.badge', 'about.heading', 'about.points', 'about.image', 'about.statsBar',
        /* Two bands the home page draws off ANOTHER document — the events
           settings and the site settings. Keyed under `home.` and read in
           `Hero`, so removing one takes it off this page and leaves it on
           the other pages that draw the same band. */
        'home.eventsBand', 'home.acrossIndia',
    ],
    site: [
        'header.brand', 'header.colours', 'header.navLinks', 'header.cta',
        'footer.brand', 'footer.address', 'footer.linkColumns', 'footer.contact',
        'footer.socials', 'footer.bottomBar',
    ],
    /* The About PAGE shares five keys with the home page's About block on
       purpose: they render through the same `AboutBlock`, off two separate
       documents, so the same key means the same part of the same layout. */
    about: [
        'about.quote', 'about.badge', 'about.heading', 'about.points',
        'about.image', 'about.statsBar',
    ],
    contact: [
        'contact.header', 'contact.form', 'contact.info',
        'contact.banner', 'contact.social',
    ],
    events: [
        'events.header', 'events.hero', 'events.filters',
        'events.banner', 'events.grid', 'events.pastLink',
    ],
    gallery: [
        'gallery.categories', 'gallery.paging', 'gallery.detail',
        'gallery.pastEvents',
    ],
    news: ['news.header', 'news.schemes'],
    membership: [
        'membership.opening', 'membership.why', 'membership.advantages',
        'membership.journey', 'membership.who', 'membership.matters',
        'membership.closing',
    ],
} as const;
