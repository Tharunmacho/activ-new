import { ArrowRight, User, Phone, Mail, MapPin } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import { Tilt3D } from '@/components/shared/Tilt3D';
import { SECTION_HEADING } from '@/components/layout/typography';
import { sizedMediaUrl } from '@/config/api.config';
import type { RegionLeader, RegionOffice, RegionContactPerson } from '@/services/cmsRegionsApi';
import { PersonPhoto } from './PersonPhoto';
import type { LeaderContext } from '@/services/cmsLeaderMessagesApi';

/**
 * THE LEADERSHIP SCREEN — state, region and district, as one system.
 *
 * =========================================================================
 * A DIRECTORY, NOT A ROW OF THUMBNAILS
 * =========================================================================
 *
 * The benches were drawn as dashboard cards: a 4/3 letterbox of a portrait, a
 * name, two clamped lines, and a heading with "View All" beside it. That is the
 * right shape for a card that shares a row with five other kinds of card. It is
 * the wrong shape for the part of the site a member opens to find out who runs
 * their council — the photographs were the smallest thing on the page, the
 * designations were cut mid-word, and every tier looked like a summary of
 * something else.
 *
 * This is the same information given the room it needs:
 *
 *     a section heading that says which tier you are looking at
 *     a PORTRAIT-shaped photograph, 4:5, big enough to recognise a face
 *     the name, the designation and the firm CENTRED under it
 *     the full designation, never clamped
 *     one way in — "Read More" — in the same place on every entry
 *
 * ------------------------------------------------------------- NO CARD BOX
 *
 * The photograph is the card. There is no white panel behind these, no border
 * and no second rounded rectangle around each person, and the region and
 * district groups are not boxes either — they are a heading and a rule with
 * faces under them.
 *
 * A bordered card around a photograph that already has a hard edge, a radius
 * and a shadow draws the SAME rectangle twice, three pixels apart. Fifteen of
 * them on one screen is thirty rectangles competing with the faces they were
 * meant to present, and every panel around a group adds a third. Taking the
 * boxes away leaves the portraits as the only objects on the page, which is
 * what a leadership directory is for.
 *
 * What the box was doing is done by other means: the photograph carries the
 * radius and the shadow, the centred text under it groups itself, and the space
 * between entries separates them.
 *
 * ----------------------------------------------------------------- motion
 *
 * BOTH primitives the rest of the public site uses, doing the two different
 * jobs they were written for:
 *
 *   `Reveal` is the ENTRANCE — a section rises and fades in the first time it
 *   is scrolled to, exactly as the home page's blocks do. Cards inside a bench
 *   are staggered so a row populates left to right instead of appearing as one
 *   slab. A panel reveals as a whole AND its cards stagger inside it, which is
 *   what makes the container arrive first and fill.
 *
 *   `Tilt3D` is the DEPTH once it is there — a card tilts toward the pointer,
 *   lifts, and takes a deeper shadow. The TEXT rides 34px in front of the card
 *   face on its own plane, so it swings further than the surface it sits on and
 *   the card reads as an object with depth rather than as a picture of one.
 *
 * Using the page's own primitives rather than new ones is the point: the
 * leadership screen moves the way the events grid and the About block move, at
 * the same timings and the same easing, instead of inventing a second idea of
 * what a card does.
 *
 * THE PHOTOGRAPH DOES NOT MOVE. Every other hover effect on the site scales its
 * image; a face that grows and drifts under the pointer reads as a stock photo
 * in a carousel, which is the opposite of what a portrait of an office-bearer
 * is for. The card tilts, lifts and takes a deeper shadow; the picture inside it
 * sits still. `glare` is off for the same reason — a specular sweep across
 * somebody's face is a gimmick.
 *
 * Both primitives already withhold their effect from anyone who has asked
 * their system for less motion — `Reveal` by painting the content outright and
 * `Tilt3D` by not binding at all — and `Tilt3D` withholds the tilt from touch
 * devices as well. So there is no third check here.
 *
 * ----------------------------------------------------------------- the grid
 *
 * Five across at the widest, and the ramp below that is the MAIN COLUMN's, not
 * the screen's — these sections run the full width of the page, so the
 * breakpoints are simply wider than the dashboard cards' were. A bench never
 * leaves one portrait alone on the last row; see `trackClass`.
 */

/* ------------------------------------------------------------------ heading */

/**
 * The heading over a tier: a label, a title and a rule. CENTRED.
 *
 * One component because every section shares it and because "which tier am I
 * looking at" has to be answered the same way, in the same place, every time.
 * The rule is 3.5rem of brand navy — short on purpose, so it reads as a mark
 * under the title rather than as a divider across the page.
 *
 * ------------------------------------------------------------------ centred
 *
 * The faces under it are centred, five to a row, filling the width. A heading
 * ranged left over a centred grid puts the one piece of type on the page that
 * does not line up with anything, and the eye lands on the mismatch before it
 * lands on the title. Centred, the heading sits on the same axis as the row it
 * introduces.
 *
 * -------------------------------------------------------- NO SUBTITLE LINE
 *
 * There was one — "Office bearers of the Tamil Nadu State Council" under
 * "Tamil Nadu Leaders". It said, in a second sentence, exactly what the title
 * and the eyebrow above it had already said in three words, and it pushed the
 * rule and the portraits further down every section for nothing. A heading
 * that needs a gloss is a heading that is not doing its job; these are.
 */
export function SectionHead({ eyebrow, title }: {
    eyebrow: string;
    title: string;
}) {
    /*
     * ================================================================
     * THE HEADING ARRIVES AS ONE THING, BECAUSE IT IS ONE THING
     * ================================================================
     *
     * It was three reveals — the label, then the title, then the rule, 90ms
     * apart — on the theory that a heading which does not move on a page that
     * does reads as a caption somebody forgot to animate.
     *
     * That was wrong, and wrong in a way a screenshot makes obvious: for the
     * first tenth of a second the section is the word "STATE" alone in the
     * middle of an empty band, with nothing under it. A label is not a
     * sentence. It exists only to qualify the title beside it, and shown
     * without that title it reads as a stray word — or as a page that has
     * failed to finish loading, which is exactly what it was reported as.
     *
     * So the three parts move together, as one block, and the STAGGER LIVES
     * WHERE IT MAKES SENSE: between the heading and the faces under it. The
     * heading lands, then the row sweeps in behind it. That is a sequence a
     * reader can follow; three words arriving one at a time is a stutter.
     */
    /*
     * ------------------------------------------------------------------
     * TIGHTER, BECAUSE WHAT IS UNDER IT IS THE POINT
     *
     * The eyebrow, a 60px title, a rule and 32px of air came to about 150
     * pixels before a single face. On the page a reader opens on, that is a
     * third of what is left after the band — spent saying "REGION" over a
     * heading that already says South Region Leaders.
     *
     * The parts all stay; the spacing between them does not. The heading
     * still reads as a heading and the bench now starts on the first screen.
     */
    return (
        <Reveal as="header" className="mb-5 sm:mb-6 text-center">
            <p className="text-[1.0625rem] font-bold uppercase
                          tracking-[0.18em] text-brand-500">
                {eyebrow}
            </p>
            {/*
              * `SECTION_HEADING`, and not a size of its own.
              *
              * These bands were written with a private scale that stopped at
              * 36px, while every other section heading on the site — the home
              * page's, the About page's — runs to 60px at desktop width. Two
              * pages of one site disagreeing about how big a section heading is
              * reads as one of them being a different, smaller product, and it
              * was reported exactly that way. The same token now decides it
              * everywhere, so there is nothing left to drift.
              */}
            <h2 className={`mt-1.5 ${SECTION_HEADING} text-brand-900`}>
                {title}
            </h2>
            <span
                aria-hidden="true"
                className="mt-3 mx-auto block h-[3px] w-14 rounded-full bg-brand-700"
            />
        </Reveal>
    );
}

/* --------------------------------------------------------------------- card */

/**
 * The card's resting shadow and its hover shadow, as one pair.
 *
 * Both are needed together: a card that only gains a tilt on hover and keeps
 * the same shadow looks like a rendering artefact, because nothing about the
 * light changed while the object moved.
 */
/*
 * NO `overflow-hidden` ON THE ENTRY.
 *
 * The photograph clips itself. Putting the clip on the wrapper is the obvious
 * way to round a picture, and it is what killed the text's depth:
 * `overflow: hidden` forces `transform-style: flat`, which collapses every 3D
 * transform inside it — the text's `translateZ` simply did nothing and the whole
 * thing tilted as one flat plate.
 *
 * So the wrapper keeps `preserve-3d` and carries no background, no border and
 * no shadow of its own. See the note at the head of this file.
 */
const CARD_SHELL = 'group flex h-full w-full flex-col items-center text-center';

/** The photograph's own shadow — the only one in the entry, and it deepens. */
const PHOTO_SHELL =
    'relative block w-full aspect-[4/5] overflow-hidden rounded-2xl '
    + 'bg-gradient-to-b from-gray-100 to-gray-200 transition-shadow duration-300 '
    + 'shadow-[0_2px_6px_rgba(16,24,40,0.08),0_16px_36px_-24px_rgba(28,46,104,0.55)] '
    + 'group-hover:shadow-[0_4px_10px_rgba(16,24,40,0.10),0_34px_64px_-30px_rgba(28,46,104,0.7)]';

export function LeaderCard({ person, onOpen, context }: {
    person: RegionLeader;
    onOpen: (leader: RegionLeader, context?: LeaderContext) => void;
    /** Forwarded untouched — see the note on `LeaderGrid`. */
    context?: LeaderContext;
}) {
    return (
        <Tilt3D className="h-full" intensity={7} lift={1.02} glare={false} perspective={1100}>
            <button
                type="button"
                onClick={() => onOpen(person, context)}
                className={CARD_SHELL}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/*
                  * 4:5 — the shape the grid is built on — with the whole
                  * photograph inside it, whatever shape the upload was.
                  * `PersonPhoto` holds that rule for every picture of a
                  * person on the site; the note on it says why.
                  *
                  * Still NO `group-hover:scale`: see the note at the head of
                  * this file.
                  */}
                <span className={PHOTO_SHELL}>
                    <PersonPhoto
                        url={person.photoUrl}
                        name={person.name}
                        width={520}
                        fallbackSize={34}
                    />
                </span>

                {/*
                  * `translateZ(34px)` — the text stands in front of the card.
                  *
                  * Far enough that it visibly parallaxes against the photograph
                  * as the card tilts; near enough that it does not detach. The
                  * same trick, at the same order of magnitude, as the icon
                  * plates in `MissionCarousel` and the About block.
                  *
                  * `items-center` and the shell's `text-center`: a name, a
                  * designation and a firm are three lines of different lengths,
                  * and ranged left under a full-width photograph they leave a
                  * ragged right edge on every card in the row. Centred, the five
                  * cards read as five portraits with captions.
                  */}
                <span
                    className="flex flex-1 flex-col items-center px-1 pt-5 pb-2"
                    style={{ transform: 'translateZ(34px)' }}
                >
                    {/*
                      * THE THREE BLOCKS BELOW EACH RESERVE THEIR LINES.
                      *
                      * A name, a designation and a firm are one, two or three
                      * lines depending on the person, and the five cards sit in
                      * a row. Left to size themselves, "Ms A Girija / Secretary,
                      * ACTIV Karnataka State Council" and "Mr C Prakash Gowda /
                      * Treasurer, ACTIV Karnataka State Council" start their
                      * firm lines a line apart, and every row of the card below
                      * that is out of step with the card beside it.
                      *
                      * `min-h` in `em`, so the reservation follows the type size
                      * (and the root size, which grows on a display wider than
                      * 1920). `line-clamp` on the name and the firm caps the
                      * worst case; the DESIGNATION is never clamped — see below.
                      */}
                    <span className="text-balance text-[1.3125rem] sm:text-[1.1875rem] font-extrabold
                                     leading-snug text-brand-900 line-clamp-2 min-h-[1.4em]
                                     transition-colors group-hover:text-brand-700">
                        {person.name || 'Name to be confirmed'}
                    </span>

                    {/*
                      * THE DESIGNATION IS NOT CLAMPED.
                      *
                      * It is the line a reader came for — "Convenor, State
                      * Skills & Export Working Group" cut to one line is the
                      * half that says nothing. The cards are a grid row, so
                      * they all take the height of the longest one and a
                      * three-line designation costs the row three lines once.
                      */}
                    {person.role && (
                        <span className="mt-1.5 min-h-[2.6em] text-balance text-[1.1875rem] font-semibold
                                         leading-snug text-brand-600">
                            {person.designation || person.role}
                        </span>
                    )}
                    {!person.role && person.designation && (
                        <span className="mt-1.5 min-h-[2.6em] text-balance text-[1.1875rem] font-semibold
                                         leading-snug text-brand-600">
                            {person.designation}
                        </span>
                    )}

                    {person.organisation && (
                        <span className="mt-2 min-h-[2.8em] text-balance text-[1.0625rem] font-medium
                                         leading-snug text-gray-500 line-clamp-2">
                            {person.organisation}
                        </span>
                    )}

                    {/* `mt-auto` pins this to the bottom of whatever height the
                        row settled on, so the five read as one line across. No
                        rule above it: with the box gone there is nothing for a
                        divider to divide, and a hairline across open background
                        is a line drawn for its own sake. */}
                    <span className="mt-auto pt-4 inline-flex items-center justify-center gap-1.5
                                     text-[1.0625rem] font-bold text-brand-600
                                     transition-colors group-hover:text-brand-800">
                        Read More
                        <ArrowRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                        />
                    </span>
                </span>
            </button>
        </Tilt3D>
    );
}

/* --------------------------------------------------------------------- grid */

/**
 * How many across, written out one complete string per count.
 *
 * `xl:grid-cols-${n}` is a string Tailwind's scanner never sees, so the rule is
 * never generated and the grid silently falls back to one column at the width
 * it matters most. Hence a lookup, not a template.
 */
const GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
};

/**
 * How wide the ROW may run, per track count.
 *
 * =========================================================================
 * THE ROW FITS THE BENCH, AND THE CARD STAYS THE SAME SIZE
 * =========================================================================
 *
 * Two things were tried and both were wrong on their own.
 *
 * A FIXED FIVE TRACKS keeps every portrait identical, and a bench of four then
 * ends in a column of white — the row does not reach the right-hand edge, which
 * reads as a photograph that failed to load rather than as a council of four.
 *
 * TRACKS THAT NARROW TO THE BENCH fills every row, and the card size then
 * follows the count: five office-bearers at 290px under one heading, two at
 * 700px under the next. Every face a different size is the opposite of an
 * aligned page.
 *
 * Doing BOTH is what works. The track count narrows so the row is always full,
 * AND the row itself is capped and centred so the cards stay in one narrow band
 * of sizes whatever the count. Measured against the page's own gutters, that
 * band is 290–330px from one to five:
 *
 *     1 → 320px      3 → 318px      5 → 290px (uncapped, full width)
 *     2 → 316px      4 → 326px
 *
 * A short bench is now a short row, centred under its heading, with its
 * portraits in one narrow band of sizes.
 *
 * ------------------------------------------------- and ONE is different
 *
 * A bench of one was 320px, in that band with the rest — and a district
 * with a single office-bearer then took a WHOLE SCREEN to say so: a
 * two-line heading, a 320×400 portrait, a name, an organisation and a Read
 * More, with the next district nowhere in sight. A reader scrolling the
 * state page met one face per screenful.
 *
 * So one and two are pulled in. It costs the exact thing the band was for
 * — a lone chairman is drawn smaller than a colleague on a bench of four —
 * and that is the trade the association asked for. A section a reader can
 * take in at a glance beats a portrait that is the same size as a portrait
 * they have to scroll to compare it with.
 */
const ROW_WIDTH: Record<number, string> = {
    1: 'max-w-[14rem] mx-auto',
    2: 'max-w-[32rem] mx-auto',
    3: 'max-w-[64rem] mx-auto',
    4: 'max-w-[86rem] mx-auto',
    5: '',
};

/**
 * The track count for a bench of this size.
 *
 * Fills the row — and never leaves ONE portrait alone on the last one. A bench
 * of six across five tracks is a full row and then a single card against four
 * columns of white; one column narrower puts three and three.
 */
const tracksFor = (count: number, max = 5) => {
    const fits = Math.min(max, Math.max(1, count));
    return (fits > 2 && count % fits === 1) ? fits - 1 : fits;
};

/*
 * ON A PHONE every bench of two or more is two columns, so an odd bench left
 * its last portrait alone against a blank column. It is centred instead, at
 * the same width as the others.
 */
const PHONE_ORPHAN =
    'max-sm:[&>*:last-child:nth-child(odd)]:col-span-2 '
    + 'max-sm:[&>*:last-child:nth-child(odd)]:w-[calc(50%-0.625rem)] '
    + 'max-sm:[&>*:last-child:nth-child(odd)]:justify-self-center';

const rowClass = (count: number, max = 5) => {
    const tracks = tracksFor(count, max);
    return `${GRID[tracks] || GRID[5]} ${ROW_WIDTH[tracks] || ''} ${tracks >= 2 ? PHONE_ORPHAN : ''}`;
};

/**
 * Just the width half, for a caller that has a HEADING to line up too.
 *
 * A district's name and the hairline under it ran the full width of the page
 * while the four portraits beneath sat inside an 86rem centred row — so the
 * rule overhung the photographs by about a hundred pixels at each end, which is
 * the one misalignment on the page you cannot help seeing. `TierPanel` puts
 * this on the header and the grid together, so the rule ends exactly where the
 * first and last portrait do.
 */
const rowWidth = (count: number, max = 5) => ROW_WIDTH[tracksFor(count, max)] || '';

/**
 * The same no-orphan rule, for the rows of contact cards.
 *
 * Its own lookup rather than the portraits': a contact card carries a postal
 * address, and two of them across a phone is an address broken over five lines.
 * These start at one column and never go past four.
 */
const OFFICE_GRID: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
};

/** The same widths, at the office row's shallower maximum of four. */
const OFFICE_WIDTH: Record<number, string> = {
    1: 'max-w-[34rem]',
    2: 'max-w-[68rem]',
    3: '',
    4: '',
};

export function officeGridClass(count: number) {
    const tracks = tracksFor(count, 4);
    return `grid gap-5 items-stretch ${OFFICE_GRID[tracks] || OFFICE_GRID[3]} `
        + `${OFFICE_WIDTH[tracks] || ''}`;
}

export function LeaderGrid({ leaders, onOpen, max = 5, context }: {
    leaders: RegionLeader[];
    onOpen: (leader: RegionLeader, context?: LeaderContext) => void;
    max?: number;
    /**
     * Where these particular leaders sit, handed to the profile panel.
     *
     * The state page draws THREE of these grids off one route — the state
     * council, its regions and its districts — so the panel cannot work out
     * which one a face came from. The grid that drew it can, and a district
     * office-bearer's enquiry filed under the state is exactly the mistake
     * the leader messaging exists to avoid.
     *
     * Optional. Without it the panel offers no Message button at all: an
     * enquiry with no geography is one the super admin cannot route.
     */
    context?: LeaderContext;
}) {
    const people = (leaders || []).filter((p) => p?.name || p?.designation);
    if (!people.length) return null;

    return (
        <ul className={`grid gap-5 sm:gap-6 items-stretch ${rowClass(people.length, max)}`}>
            {people.map((person, i) => (
                /*
                 * `Math.min(i, 4) * 80` — the stagger the events grid uses.
                 *
                 * CAPPED at the fifth card, deliberately. Uncapped, a bench of
                 * twelve would put the last card 880ms behind the first, and a
                 * reader who has already scrolled past is watching a row finish
                 * arriving after they have gone. Five steps is enough to read as
                 * a sweep; past that they land together.
                 */
                <Reveal
                    as="li"
                    key={person.id || i}
                    delay={220 + Math.min(i, 4) * 80}
                    className="h-full"
                >
                    <LeaderCard person={person} onOpen={onOpen} context={context} />
                </Reveal>
            ))}
        </ul>
    );
}

/* -------------------------------------------------------------------- tiers */

/**
 * ONE REGION, OR ONE DISTRICT — a name, centred, with a bench under it.
 *
 * =========================================================================
 * NOTHING SITS AT THE SIDE
 * =========================================================================
 *
 * This had a rule down its left edge and a paragraph of description beside it
 * for a region, and a name with its description on the same line and a hairline
 * under both for a district. Two treatments, both ranged left, over a grid of
 * centred portraits — so the only two blocks of type on the page that did not
 * sit on the page's axis were these, and the eye found the mismatch before it
 * found the name.
 *
 * It is one centred name now, for both tiers. The description went with the
 * left bar: it repeated what the section heading above had already said, and a
 * paragraph is not a label. The FIELD still exists — `districts[].description`
 * is still stored and still served — it is simply not drawn here.
 *
 * `variant` is kept because the two tiers still differ in ONE thing: a region
 * is the band the whole page reports into and carries a touch more weight than
 * a district chapter. Nothing about it is positional any more.
 */
export function TierPanel({
    name, leaders, onOpen, variant = 'rule', max = 5, id, showName = true, context,
}: {
    name: string;
    leaders: RegionLeader[];
    onOpen: (leader: RegionLeader, context?: LeaderContext) => void;
    /**
     * Where these particular leaders sit, handed to the profile panel.
     *
     * The state page draws THREE of these grids off one route — the state
     * council, its regions and its districts — so the panel cannot work out
     * which one a face came from. The grid that drew it can, and a district
     * office-bearer's enquiry filed under the state is exactly the mistake
     * the leader messaging exists to avoid.
     *
     * Optional. Without it the panel offers no Message button at all: an
     * enquiry with no geography is one the super admin cannot route.
     */
    context?: LeaderContext;
    variant?: 'bar' | 'rule';
    max?: number;
    /** An anchor, so the map above can bring a reader straight to this bench. */
    id?: string;
    /**
     * PRINT THE PANEL'S OWN NAME, OR LET THE SECTION HEADING SPEAK FOR IT.
     *
     * A band with several panels needs each one labelled — four zones under
     * "Region-wise Leadership" are four different benches and the reader has to
     * be told which is which.
     *
     * A band with exactly ONE panel does not. The national region drew
     * "NATIONAL REGION / South Region Leadership" as its section heading and
     * then "SOUTH REGION" again directly under it, which is the same name twice
     * in three lines with a rule between them — it reads as a heading that lost
     * its content rather than as two levels of anything.
     *
     * So the caller, which is the only thing that knows how many panels the band
     * has, says. See `StatePage`.
     */
    showName?: boolean;
}) {
    const people = (leaders || []).filter((p) => p?.name || p?.designation);
    if (!people.length) return null;

    return (
        /* No panel. A heading and a rule, with faces under them — see the note
           at the head of this file. The width is the ROW's, so the heading and
           its rule line up with the portraits rather than overhanging them. */
        <Reveal as="section" id={id} className={`scroll-mt-24 ${rowWidth(people.length, max)}`}>
            {/* The zone's or district's own name gets the same entrance, so
                the sequence reads the same at every level of the page: the
                heading, then the faces under it. */}
            {showName && (
            <Reveal as="header" className="mb-6 text-center">
                <h3 className={variant === 'bar'
                    ? 'text-[1.75rem] sm:text-[2.0625rem] font-extrabold uppercase tracking-[0.08em] text-brand-900'
                    : 'text-[1.25rem] sm:text-[1.75rem] font-extrabold uppercase tracking-[0.08em] text-brand-800'}
                >
                    {name}
                </h3>
            </Reveal>
            )}

            <LeaderGrid leaders={people} onOpen={onOpen} max={max} context={context} />
        </Reveal>
    );
}

/* ----------------------------------------------------------------- contacts */

/**
 * One line of a contact card: a glyph, and the thing you can act on.
 *
 * `justify-center` on the row, `text-center` on the text. The glyph therefore
 * sits against the start of the text rather than in a column of its own — which
 * is the trade for a centred page, and at four lines of four different lengths
 * a column of icons down the left was the thing pulling the card off the axis.
 */
function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <li className="flex items-start justify-center gap-2.5 text-[1.1875rem] font-medium
                       leading-relaxed text-gray-600">
            <span className="mt-[3px] shrink-0 text-brand-500">{icon}</span>
            <span className="min-w-0 text-center">{children}</span>
        </li>
    );
}

/* ---------------------------------------------------- the contact directory */

/** One entry in the directory — a person, and the ways to reach them. */
export interface ContactEntry {
    id?: string;
    name: string;
    role: string;
    email: string;
    phone: string;
    organisation: string;
    address: string;
}

/**
 * A PERSON's contact, not an office's.
 *
 * =========================================================================
 * ONE ENTRY PER OFFICE-BEARER
 * =========================================================================
 *
 * The page carried one contact per tier — a state office, a regional office, a
 * district office. That answers "who do I write to about this council" and not
 * "how do I reach the Convenor of the skills panel", which is the question a
 * member standing on a leadership page actually has. Every face on the page now
 * has its own entry here, drawn from that person's own record.
 *
 * Nobody is invented. An office-bearer with no email, no telephone and no
 * address is not listed — see `contactEntries` — so a council that publishes one
 * shared address looks exactly as it did, and one that fills the fields in gets
 * a directory.
 */
export function ContactPerson({ entry, delay = 0 }: { entry: ContactEntry; delay?: number }) {
    return (
        /*
          * A BOX, AND EVERY BOX THE SAME HEIGHT.
          *
          * These were loose blocks of type on the page background, and three of
          * them across meant three ragged columns whose rows did not line up:
          * one person's designation runs to two lines and their neighbour's to
          * one, so the email under the first sat a line below the email under
          * the second, all the way down. Nothing said where one person ended and
          * the next began except the gap, and the gaps were all different.
          *
          * The box is what makes the row a row. `h-full` fills the grid track,
          * so every card in a row is the height of the tallest, and the
          * telephone numbers line up across the page.
          */
        <Reveal
            as="li"
            delay={delay}
            className="h-full rounded-[1.25rem] border border-gray-200/70 bg-white/70 p-5
                       text-center transition-shadow duration-300
                       hover:shadow-[0_2px_6px_rgba(16,24,40,0.05),0_18px_40px_-28px_rgba(28,46,104,0.5)]"
        >
            <p className="text-balance text-[1.1875rem] font-extrabold leading-snug text-brand-900">
                {entry.name}
            </p>
            {/*
              * TWO LINES RESERVED for the role.
              *
              * The box already makes every card in a row the same HEIGHT; it
              * does nothing for the rows INSIDE it. "Director" on one card and
              * "Chairman, ACTIV Lakshadweep State Council" on the next start
              * their email lines a line apart, and from there the telephone
              * number and the firm are out of step all the way down the row —
              * which is the fault the note above says the box was added to fix,
              * still visible one level in.
              */}
            {entry.role && (
                <p className="mt-1 min-h-[2.6em] text-balance text-[1.1875rem] font-semibold leading-snug text-brand-600">
                    {entry.role}
                </p>
            )}

            <ul className="mt-3 space-y-1.5">
                {entry.email && (
                    <Line icon={<Mail size={16} />}>
                        <a
                            href={`mailto:${entry.email}`}
                            className="break-all transition-colors hover:text-brand-700"
                        >
                            {entry.email}
                        </a>
                    </Line>
                )}
                {entry.phone && (
                    <Line icon={<Phone size={16} />}>
                        <a
                            href={`tel:${entry.phone}`}
                            className="transition-colors hover:text-brand-700"
                        >
                            {entry.phone}
                        </a>
                    </Line>
                )}
            </ul>

            {(entry.organisation || entry.address) && (
                <p className="mt-3 border-t border-gray-100 pt-3 text-[1.0625rem] font-medium
                              leading-relaxed text-gray-500 whitespace-pre-line">
                    {[entry.organisation, entry.address].filter(Boolean).join('\n')}
                </p>
            )}
        </Reveal>
    );
}

/**
 * One tier's worth of people, in a fixed three-column grid.
 *
 * =========================================================================
 * FIXED, BECAUSE THE GROUPS STACK
 * =========================================================================
 *
 * These lay out one above another down a column — a state council, then a
 * region, then a district each. Sizing the grid to each group's own count, the
 * way the PORTRAIT rows do, is exactly wrong here: a group of six sat at full
 * width and the group of two directly under it shrank and centred itself, so
 * the left edge of the page moved twice between one label and the next. A
 * reader's eye tracks that edge; nothing else on the page moves it.
 *
 * So the track count never changes. Every box in the section is the same
 * width, every group starts and ends on the same two lines, and a group of two
 * simply fills two of the three — which, in bordered boxes under a heading,
 * reads as a table with a short last row rather than as a mistake.
 *
 * (The portraits are the opposite case and keep the opposite rule: they are
 * full-width bands with nothing above or below to line up with, so filling the
 * row is what matters there. See `rowClass`.)
 */
const CONTACT_GRID = 'sm:grid-cols-2 xl:grid-cols-3';

/** One tier's worth of people. */
export function ContactGroup({ label, entries }: { label: string; entries: ContactEntry[] }) {
    /*
     * A SECOND TEST HERE WOULD UNDO THE FIRST.
     *
     * This filtered again on `name && (email || phone || address)` — the same
     * rule `contactEntries` applies to office-bearers, applied a second time
     * to everything it had already decided. A contact admitted by the new
     * any-one-field rule was then dropped here, two functions later, and the
     * editor saw nothing appear.
     *
     * `contactEntries` is where the decision belongs; this only needs to skip
     * a row with nothing to print at all.
     */
    const rows = (entries || []).filter((e) => e && (e.name || e.role || e.email || e.phone || e.address));
    if (!rows.length) return null;

    return (
        <div>
            <ContactLabel>{label}</ContactLabel>
            {/* `items-stretch` is what lets `h-full` on the card mean
                anything — without it each card is only as tall as its own
                text and the boxes in a row end at different points. */}
            <ul className={`grid gap-5 items-stretch ${CONTACT_GRID}`}>
                {rows.map((entry, i) => (
                    <ContactPerson
                        key={entry.id || `${entry.name}-${i}`}
                        entry={entry}
                        delay={Math.min(i, 4) * 70}
                    />
                ))}
            </ul>
        </div>
    );
}

/**
 * The office and its bench, as one list of entries.
 *
 * The office goes FIRST and keeps its designation, because "Director, state
 * office" is the general enquiry address and a reader scanning for one should
 * not have to know a name to find it. After it, every office-bearer who has a
 * contact of their own.
 */
/**
 * ==========================================================================
 * GET IN TOUCH IS THE OFFICE AND THE CONTACTS. NOT THE BENCH.
 * ==========================================================================
 *
 * This used to emit three things: the office, the tier's named contacts, and
 * EVERY OFFICE-BEARER who happened to have published an email or a telephone.
 * That third source was most of the list — 44 of the 50 entries on the Tamil
 * Nadu page — and it is gone.
 *
 * The association asked for it, and the reason is a real one: a leader and a
 * contact are different things, and deriving one from the other meant an
 * editor could not control either. Filling in a chairman's telephone number so
 * it showed on their leader panel also published them in the contact
 * directory, and the only way to take them out of the directory was to delete
 * the number from the panel. Two decisions, one control.
 *
 * A leader's email, telephone and address are still stored and still drawn —
 * on their own profile panel, which is what opens when a reader clicks their
 * portrait. Nothing was deleted. What changed is that the contact DIRECTORY is
 * now exactly what somebody typed into a contacts list.
 *
 * ------------------------------------------------- what the caller passes
 *
 * A CONTACTS LIST. That is all, now — the `office` parameter has gone too.
 *
 * It was the one address a visitor could write to without knowing a name,
 * and on a state page it kept its editor after the region and district ones
 * were removed. That editor is gone as well, so the office had become a
 * block of text the page printed and nobody could change: an address that
 * can only get older. Whatever it held is typed into the contacts list
 * instead, beside the region-wise and district-wise entries, in the one card
 * the association asked for.
 *
 * The field is still on the record and still comes down in the payload. This
 * function simply does not read it, so removing the editor cannot strand
 * anything on the live page.
 *
 * The `onBench` de-duplication went with the bench. It existed because the
 * office contact is usually the district chairman, so listing the office AND
 * the bench printed one person twice. With no bench here, there is nothing to
 * collide with.
 */
export function contactEntries(
    contacts?: RegionContactPerson[] | null,
): ContactEntry[] {
    const out: ContactEntry[] = [];

    /*
     * ANY ONE FIELD IS ENOUGH.
     *
     * A contact has no portrait anywhere, so if an editor has typed anything
     * into one — a name, a role, a firm — that is a person they meant to
     * publish. Withholding them because the telephone number has not arrived
     * yet is the screen deciding it knows better.
     *
     * `photoUrl` is not in the test: a face with no name beside it is not a
     * contact.
     */
    (contacts || []).forEach((c, i) => {
        if (!c) return;
        const said = [c.name, c.designation, c.organisation, c.email, c.phone, c.address]
            .some((v) => String(v || '').trim());
        if (!said) return;
        out.push({
            id: c.id || `contact-${i}`,
            /* Something has to head the card. With no name, the role leads and
               the role line is left empty rather than printing the same words
               twice, one above the other. */
            name: c.name || c.designation || c.organisation,
            role: c.name ? (c.designation || '') : '',
            email: c.email || '',
            phone: c.phone || '',
            organisation: c.organisation || '',
            address: c.address || '',
        });
    });

    return out;
}

/** The small caps label over each band of contact cards. *//** The small caps label over each band of contact cards. */
export function ContactLabel({ children }: { children: React.ReactNode }) {
    return (
        <Reveal
            as="p"
            className="mb-3 text-[1.25rem] font-bold uppercase tracking-[0.16em] text-brand-500"
        >
            {children}
        </Reveal>
    );
}

/**
 * ONE OFFICE — whichever tier it belongs to.
 *
 * `wide` lays the lines out two abreast, for the single card that has a band to
 * itself; the narrow form stacks them, for the rows of three and four. Same
 * component either way, because "a place you can ring" is one thing and three
 * near-identical cards is three places to forget the email address.
 *
 * A line with nothing in it is not drawn — and an office with nothing at all in
 * it returns null rather than a card with a name and four empty rows.
 */
export function OfficeCard({ title, office, wide = false, delay = 0 }: {
    title: string;
    office: RegionOffice;
    wide?: boolean;
    /** Stagger, for a row of them. */
    delay?: number;
}) {
    const o = office || ({} as RegionOffice);
    const address = [
        ...(o.addressLines || []),
        [o.city, o.state].filter(Boolean).join(', ') + (o.pincode ? ` ${o.pincode}` : ''),
    ].map((l) => String(l || '').trim()).filter(Boolean).join(', ');

    const has = !!(o.personName || o.phone || o.email || address);
    if (!has && !title) return null;

    return (
        <Reveal
            as="section"
            delay={delay}
            /*
             * The contacts ARE panels, and stay panels.
             *
             * They are the one thing on the page with no photograph — four lines
             * of small grey text with no shape of their own — and set loose on
             * the background they read as a paragraph that lost its heading. The
             * panel is what tells a reader where one office ends and the next
             * begins. It is lighter than it was: a hairline and a tint, no drop
             * shadow, so it sits behind the text rather than in front of it.
             */
            className="h-full rounded-[1.25rem] border border-gray-200/70 bg-white/70 p-5
                       text-center"
        >
            <h3 className="text-[1.1875rem] font-extrabold text-brand-900">{title}</h3>

            <ul className={`mt-3.5 gap-x-8 gap-y-2.5 ${wide ? 'grid sm:grid-cols-2' : 'space-y-2.5'}`}>
                {o.personName && (
                    <Line icon={<User size={16} />}>
                        {o.personName}
                        {o.designation ? `, ${o.designation}` : ''}
                    </Line>
                )}
                {o.phone && (
                    <Line icon={<Phone size={16} />}>
                        <a href={`tel:${o.phone}`} className="transition-colors hover:text-brand-700">
                            {o.phone}
                        </a>
                    </Line>
                )}
                {o.email && (
                    <Line icon={<Mail size={16} />}>
                        <a
                            href={`mailto:${o.email}`}
                            className="break-all transition-colors hover:text-brand-700"
                        >
                            {o.email}
                        </a>
                    </Line>
                )}
                {address && <Line icon={<MapPin size={16} />}>{address}</Line>}
            </ul>
        </Reveal>
    );
}
