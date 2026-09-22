import { useEffect, useMemo, useState } from 'react';
import { Mail, MapPin, Phone, X } from 'lucide-react';
import { Reveal } from '@/components/shared/Reveal';
import type { RegionContactGroup, RegionDistrict } from '@/services/cmsRegionsApi';
import { stateMaps } from '@/data/maps';
import { normaliseDistrict } from '@/data/maps/match';
import { ZONE_STYLES, type StateMap } from '@/data/maps/types';

/**
 * THE STATE, DRAWN, COLOURED BY ZONE.
 *
 * =========================================================================
 * ONE COMPONENT, EVERY STATE
 * =========================================================================
 *
 * It was Tamil Nadu's map with Tamil Nadu's boundaries imported at the top. It
 * is now whichever state it is handed, because the association has eight in the
 * South alone and a second copy of this file per state is eight places to fix
 * the next thing.
 *
 * The boundaries are LAZY-LOADED — `stateMaps` is a table of dynamic imports,
 * so a reader opening Kerala fetches Kerala's 22KB and none of the other seven.
 * Until it arrives the block draws nothing at all rather than a spinner: it sits
 * beside a list of contacts that is already useful, and a placeholder box that
 * turns into a map is more distracting than a map that simply appears.
 *
 * A state with NO map — one the generator has not been run for — renders
 * nothing and the page is its contacts, full width. Nothing breaks and nothing
 * apologises.
 *
 * -------------------------------------------------- the map alone until asked
 *
 * The block opens as a map, a legend, and nothing else. CLICKING IS WHAT
 * PRODUCES INFORMATION, and what it produces closes with the × in its corner.
 * A map is a question; a card that is already open has answered one nobody
 * asked.
 *
 * ---------------------------------------------------------------- the zones
 *
 * Every district is coloured by the zone it sits in — not the staffed ones in
 * navy and the rest in grey, which drew the eye to the handful of places the
 * association happens to be and made the rest of the state look like a hole.
 * The colour says WHERE in the state you are; the pin says whether there is a
 * chapter there. Two facts, two marks, neither standing in for the other.
 *
 * A state of five districts or fewer is not zoned — four zones over four shapes
 * is a legend with one entry per district, which explains nothing — and those
 * draw in a single neutral fill.
 *
 * ---------------------------------------------------------------- the data
 *
 * Chapters come from the CMS and are matched to shapes by name through
 * `normalise`. Add, rename or remove a district there and the pins, the counts
 * and the popover follow on the next load with nothing to change here.
 */

/* ------------------------------------------------------------------ naming */

/*
 * THE MATCHING RULE IS NOT IN THIS FILE ANY MORE.
 *
 * `normaliseDistrict`, the post-2011 split table and the spelling aliases
 * moved to `@/data/maps/match`, because the CMS needs the SAME rule to warn
 * an editor that a district they have typed will draw nothing. A second copy
 * of it there would be a warning that drifts from the behaviour it warns
 * about — which is how a district entered as "TIRUVANNAMALI" was published
 * with a member count, a region and an office-bearer, and no marker.
 */
const normalise = normaliseDistrict;

/* ------------------------------------------------------------- the paint */

/**
 * ==========================================================================
 * A COLOUR PER REGION THE CMS NAMES, not per compass point
 * ==========================================================================
 *
 * The shapes were coloured by the geographic zone the generator stamped on
 * each district. That is a fact about the geometry, and a state that has
 * defined its OWN regions therefore saw a map coloured by something it does
 * not use: creating a fifth region changed nothing on the map, because the
 * map had never heard of the first four.
 *
 * A district assigned a region takes that region's colour, keyed by the
 * region's POSITION in the CMS list, so an editor reordering their regions
 * sees the colours follow. Unassigned districts keep the zone they always
 * had, which is what a state half-way through being set up looks like.
 *
 * EIGHT hues, not four. Four would repeat the moment a state has five
 * regions, and two regions sharing a colour is a legend that lies. These are
 * the four zone families first — so a state with four regions looks much as
 * it did — then four more, ordered so no two of a family are adjacent.
 */
const REGION_PALETTE = [
    { fill: 'fill-violet-300', hover: 'hover:fill-violet-400', active: 'fill-violet-500', swatch: 'bg-violet-400' },
    { fill: 'fill-sky-300', hover: 'hover:fill-sky-400', active: 'fill-sky-500', swatch: 'bg-sky-400' },
    { fill: 'fill-emerald-300', hover: 'hover:fill-emerald-400', active: 'fill-emerald-500', swatch: 'bg-emerald-400' },
    { fill: 'fill-amber-300', hover: 'hover:fill-amber-400', active: 'fill-amber-500', swatch: 'bg-amber-400' },
    { fill: 'fill-rose-300', hover: 'hover:fill-rose-400', active: 'fill-rose-500', swatch: 'bg-rose-400' },
    { fill: 'fill-teal-300', hover: 'hover:fill-teal-400', active: 'fill-teal-500', swatch: 'bg-teal-400' },
    { fill: 'fill-indigo-300', hover: 'hover:fill-indigo-400', active: 'fill-indigo-500', swatch: 'bg-indigo-400' },
    { fill: 'fill-orange-300', hover: 'hover:fill-orange-400', active: 'fill-orange-500', swatch: 'bg-orange-400' },
];

/* ----------------------------------------------------------- the markers */

/**
 * The marker, sized to what it has to hold.
 *
 * A bare ring stays 9px, exactly as it was. A ring with a figure in it grows
 * with the number of DIGITS, not with the count — which would make a district
 * of four hundred members a disc swallowing its neighbours, and one of nine a
 * dot nobody can hit.
 *
 * It grows to fit rather than shrinking the digits, because a three-figure
 * count in a 9px ring is unreadable at map scale, and a marker the reader
 * cannot read may as well be the plain ring.
 */
const radiusFor = (members: number, selected: boolean) => {
    const base = members > 0
        ? 9 + Math.min(3, String(compactCount(members)).length - 1) * 3
        : 9;
    return selected ? base + 1.5 : base;
};

/** The figure inside the ring, sized so it always fits the ring above. */
const labelSizeFor = (members: number) =>
    (String(compactCount(members)).length >= 4 ? 8 : 9);

/**
 * 1,400 members in a 15px circle is a circle with "1,4" in it.
 *
 * Thousands are abbreviated with one decimal only where it says something:
 * 1.4k reads as more than 1k, 2k reads better than 2.0k. Below a thousand
 * the exact figure fits and is more useful than any rounding of it.
 */
const compactCount = (members: number) => {
    const n = Math.max(0, Math.round(Number(members) || 0));
    if (n < 1000) return String(n);
    const k = n / 1000;
    return `${k < 10 && k % 1 >= 0.05 ? k.toFixed(1) : Math.round(k)}k`;
};

/* ------------------------------------------------------------- the loading */

/**
 * The state's boundaries, fetched once the component knows which state it is.
 *
 * `cancelled` rather than an AbortController: a dynamic import cannot be
 * aborted, so the guard is against SETTING STATE after the reader has navigated
 * away — which is the actual failure, and the one React warns about.
 */
const useStateMap = (slug: string) => {
    const [map, setMap] = useState<StateMap | null>(null);

    useEffect(() => {
        const key = String(slug || '').toLowerCase();
        const load = stateMaps[key];
        setMap(null);
        if (!load) return undefined;

        let cancelled = false;
        load()
            .then((mod) => { if (!cancelled) setMap(mod.default); })
            .catch(() => { if (!cancelled) setMap(null); });

        return () => { cancelled = true; };
    }, [slug]);

    return map;
};

/* -------------------------------------------------------------------- map */

export function StateDistrictMap({
    stateName, stateSlug, districts, regions = [], contactGroups = [],
}: {
    stateName: string;
    /** Which boundaries to draw. The CMS slug and the URL's are the same. */
    stateSlug: string;
    districts: RegionDistrict[];
    /**
     * The state's own regions, in the order the CMS lists them.
     *
     * Optional: a region page has no sub-regions and passes nothing, and the
     * map then behaves exactly as it always did.
     */
    regions?: RegionDistrict[];
    /**
     * ==================================================================
     * WHAT A CLICKED DISTRICT SAYS IS WHAT SOMEBODY TYPED INTO SECTION 5
     * ==================================================================
     *
     * The panel used to open with "N office-bearers" and then print the
     * district office — `districts[i].contact`. Neither survives contact
     * with the CMS as it now stands. The office has no editor at all, so it
     * was a telephone number on a live page that nobody could correct; and
     * the count read a bench most districts do not have, so the panel
     * greeted a reader with "0 office-bearers" and an editor with a number
     * they could see no way to raise.
     *
     * It reads the DISTRICT-WISE CONTACT GROUPS instead — the list in
     * Section 5, matched to the shape by name on the same normalisation the
     * map matches everything else with. Type a contact for Chennai and it is
     * on the Chennai shape; that is the whole of the rule.
     *
     * The bench is NOT hidden, and it is not counted here either. It has its
     * own boards further down the page, which is where leadership lives. A
     * marker is about reaching somebody.
     */
    contactGroups?: RegionContactGroup[];
    /** Take the reader to that district's bench, further up the page. */
    /*
     * `onOpenDistrict` is gone with the button it drove.
     *
     * "See the Chennai bench" was the only thing on this panel that led to
     * the leadership, and it led there from a card that no longer mentions
     * leadership at all. The boards are on the same page, under their own
     * headings, which is a shorter journey than a map click followed by a
     * scroll somebody else chose for them.
     */
}) {
    const map = useStateMap(stateSlug);

    /**
     * The colour of each region, by the order the CMS lists them.
     *
     * Built from the region NAMES rather than their ids — see the note on
     * `regionName`. `normalise` is the same reconciler the shapes use, so a
     * region typed "north" and a district assigned "North" still meet.
     */
    const regionStyles = useMemo(() => {
        const out = new Map<string, typeof REGION_PALETTE[number]>();
        (regions || []).filter((r) => r?.name).forEach((r, i) => {
            out.set(normalise(r.name), REGION_PALETTE[i % REGION_PALETTE.length]);
        });
        return out;
    }, [regions]);

    /**
     * The regions worth putting in the legend — the ones at least one district
     * has been assigned to.
     *
     * A region an editor created and has not assigned anything to colours
     * nothing on the map, and a legend entry for a colour that appears nowhere
     * is a key to a lock with no door.
     */
    const namedRegions = useMemo(() => {
        const assigned = new Set((districts || []).map((d) => normalise(d?.regionName || '')).filter(Boolean));
        return (regions || []).map((r) => r?.name || '').filter((n) => n && assigned.has(normalise(n)));
    }, [regions, districts]);

    /** Which CMS chapter, if any, belongs to each drawn district. */

    const byShape = useMemo(() => {
        const found = new Map<string, RegionDistrict>();
        if (!map) return found;
        (districts || []).filter((d) => d?.name).forEach((district) => {
            const shape = map.districts.find(
                (s) => normalise(s.name) === normalise(district.name),
            );
            if (shape) found.set(shape.slug, district);
        });
        return found;
    }, [districts, map]);

    /**
     * The district-wise contact groups, keyed the way the shapes are.
     *
     * A GROUP IS MATCHED BY ITS HEADING, and the heading is free text an
     * editor typed — "Chennai", "Chennai District", "chennai  district".
     * `normalise` already folds case and whitespace for the shape names, so
     * the trailing word is all that is left to take off. Without that,
     * "Chennai District" missed the Chennai shape and the panel said nothing
     * on the one district somebody had gone to the trouble of filling in.
     */
    const groupFor = useMemo(() => {
        const found = new Map<string, RegionContactGroup>();
        const key = (n: string) => normalise(String(n || '').replace(/s*districts*$/i, ''));
        (contactGroups || []).filter((g) => g?.name).forEach((group) => {
            found.set(key(group.name), group);
        });
        return found;
    }, [contactGroups]);

    /**
     * ======================================================================
     * THE KEY TO EVERY COLOUR ON THE MAP — BOTH KINDS AT ONCE
     * ======================================================================
     *
     * The shapes are coloured per district, so a state part-way through
     * being set up carries BOTH kinds of colour: the regions an editor has
     * assigned, and the geographic zones the rest still have. Listing only
     * one of the two is what left Tamil Nadu drawing four colours under a
     * legend that named one.
     *
     * Regions first, because they are the association's own answer; then
     * every zone still colouring at least one shape. A zone nothing is left
     * in drops off — the original rule, and the right one.
     *
     * The swatch is looked up BY NAME from `regionStyles`, never by this
     * list's own index. The palette is keyed by a region's position in the
     * CMS's list and `namedRegions` is a filtered subset of it, so indexing
     * by row showed a colour belonging to a different region the moment one
     * was filtered out.
     */
    const legend = useMemo(() => {
        const rows: { key: string; swatch: string; label: string }[] = [];
        const seen = new Set<string>();

        namedRegions.forEach((name) => {
            const style = regionStyles.get(normalise(name));
            if (!style) return;
            rows.push({ key: `r:${name}`, swatch: style.swatch, label: name });
            seen.add(normalise(name));
        });

        /* A zone still colouring something is a zone whose districts have
           NOT been assigned to a region — the same test `styleFor` makes,
           asked of every shape rather than one. */
        const live = new Set<string>();
        (map?.districts || []).forEach((shape) => {
            const chapter = byShape.get(shape.slug);
            const assigned = chapter?.regionName
                ? regionStyles.get(normalise(chapter.regionName))
                : undefined;
            if (!assigned && shape.zone) live.add(shape.zone);
        });

        (map?.zones || []).forEach((key) => {
            if (!live.has(key)) return;
            const style = ZONE_STYLES[key];
            /* A region an editor named “North” and the built-in North zone
               would otherwise be two rows with the same word on them. The
               region wins: it is the one somebody chose. */
            if (!style || seen.has(normalise(style.label))) return;
            rows.push({ key: `z:${key}`, swatch: style.swatch, label: style.label });
        });

        return rows;
    }, [namedRegions, regionStyles, byShape, map]);

    /**
     * A shape's colour: its CMS region first, then the geographic zone.
     *
     * Per district, not per state. Assign three of thirty-eight and those
     * three take their region's colour while the rest keep the zone they
     * always had — a half-assigned state is the normal state of one being set
     * up, and it should not go grey while the work is in progress.
     */
    const styleFor = (shape: { zone?: string; slug: string }) => {
        const chapter = byShape.get(shape.slug);
        const assigned = chapter?.regionName ? regionStyles.get(normalise(chapter.regionName)) : undefined;
        if (assigned) return assigned;
        return shape.zone ? ZONE_STYLES[shape.zone as keyof typeof ZONE_STYLES] : undefined;
    };


    /*
     * NOTHING IS SELECTED UNTIL SOMEBODY SELECTS IT — and a change of state
     * clears it, so Kerala never opens showing a district of Tamil Nadu.
     */
    const [selected, setSelected] = useState<string | null>(null);
    useEffect(() => { setSelected(null); }, [stateSlug]);

    if (!map) return null;

    const shape = selected ? map.districts.find((d) => d.slug === selected) || null : null;
    const chapter = selected ? byShape.get(selected) || null : null;

    /*
     * The people on the clicked shape. The group is looked up by the SHAPE’s
     * name as well as the chapter’s, because a district can have a contact
     * with no chapter card at all — that is the ordinary case now, and it is
     * the case the old panel had no way to show.
     */
    const groupName = normalise(String(shape?.name || '').replace(/s*districts*$/i, ''));
    const contacts = ((groupFor.get(groupName)?.contacts) || [])
        .filter((c) => c && [c.name, c.designation, c.organisation, c.email, c.phone, c.address]
            .some((v) => String(v || '').trim()));
    const zone = shape?.zone ? ZONE_STYLES[shape.zone] : undefined;

    return (
        /*
          * THE MAP IS A PANEL, LIKE THE BOXES BESIDE IT.
          *
          * It was a bare drawing on the page background next to a grid of
          * bordered white cards, so the two columns did not read as one block —
          * one had edges and the other did not, and there was no line anywhere
          * that both of them started on. Same surface, same radius, same border,
          * and a label in the same small caps at the same height as the group
          * heading opposite.
          */
        <Reveal as="div" className="min-w-0">
            <p className="mb-3 text-[1.25rem] font-bold uppercase tracking-[0.16em] text-brand-500">
                Chapters across {stateName}
            </p>

            <div className="rounded-[1.25rem] border border-gray-200/70 bg-white/70 p-5">
                {/*
                  * One place decides a shape's colour, and the order is the whole
                  * rule: the region an editor assigned, then the zone the build
                  * script computed, then neutral grey for a state too small to be
                  * cut into zones at all.
                  */}
                <svg
                    viewBox={map.viewBox}
                    role="img"
                    aria-label={`Districts of ${stateName}`}
                    className="mx-auto block h-auto w-full max-h-[26rem]"
                >
                    {map.districts.map((row) => {
                        const style = styleFor(row);
                        const isSelected = selected === row.slug;
                        const has = byShape.get(row.slug);

                        const paint = style
                            ? (isSelected ? style.active : `${style.fill} ${style.hover}`)
                            : (isSelected ? 'fill-slate-400' : 'fill-slate-200 hover:fill-slate-300');

                        return (
                            <path
                                key={row.slug}
                                d={row.d}
                                role="button"
                                tabIndex={0}
                                aria-label={has
                                    ? `${has.name} district, chapter`
                                    : `${row.name} district`}
                                aria-pressed={isSelected}
                                onClick={() => setSelected(isSelected ? null : row.slug)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelected(isSelected ? null : row.slug);
                                    }
                                }}
                                className={`cursor-pointer stroke-white outline-none transition-colors
                                            duration-200 focus-visible:stroke-brand-900 ${paint}`}
                                strokeWidth={isSelected ? 2.5 : 1}
                            >
                                <title>{row.name}</title>
                            </path>
                        );
                    })}

                    {/*
                      * A PIN WHERE THERE IS A CHAPTER.
                      *
                      * The colour says which zone a district is in; the pin says
                      * the association is actually there. Chennai is a few pixels
                      * across at this size, so the pin is also the only target on
                      * it a person can hit — which is why it takes the click.
                      */}
                    {map.districts.map((row) => {
                        const has = byShape.get(row.slug);
                        if (!has) return null;
                        const isSelected = selected === row.slug;

                        return (
                            <g
                                key={`pin-${row.slug}`}
                                role="button"
                                tabIndex={0}
                                aria-label={`${has.name} district chapter`}
                                aria-pressed={isSelected}
                                onClick={() => setSelected(isSelected ? null : row.slug)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setSelected(isSelected ? null : row.slug);
                                    }
                                }}
                                className="cursor-pointer outline-none
                                           [&:focus-visible>circle]:stroke-brand-900"
                            >
                                {/*
                                  * THE MARKER CARRIES THE MEMBER COUNT.
                                  *
                                  * Every ring used to say one thing — "there is a chapter
                                  * here" — so six identical rings across a state could not
                                  * tell a district of four hundred members from one of nine.
                                  * The figure is `activeMembers` on that district in the CMS:
                                  * type a number there and this marker carries it.
                                  *
                                  * It GROWS to fit rather than shrinking the digits. A
                                  * three-figure count in a 9px ring is unreadable at map
                                  * scale, and a marker the reader cannot read is a marker
                                  * that may as well be the plain ring.
                                  *
                                  * No count leaves the ring exactly as it was, which is what
                                  * every district shows until somebody publishes a figure.
                                  */}
                                <circle
                                    cx={row.cx}
                                    cy={row.cy}
                                    r={radiusFor(has.activeMembers, isSelected)}
                                    className={`transition-all duration-200 ${isSelected
                                        ? 'fill-brand-900 stroke-white'
                                        : 'fill-white stroke-brand-800'}`}
                                    strokeWidth={3}
                                />

                                {has.activeMembers > 0 && (
                                    <text
                                        x={row.cx}
                                        y={row.cy}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        /* `pointer-events-none`: the ring is the button, and a
                                           label that swallows the click makes the marker feel
                                           broken in its own middle. */
                                        className={`pointer-events-none select-none font-bold
                                                    ${isSelected ? 'fill-white' : 'fill-brand-900'}`}
                                        style={{ fontSize: labelSizeFor(has.activeMembers) }}
                                    >
                                        {compactCount(has.activeMembers)}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/*
                  * THE LEGEND IS A GRID, NOT A WRAPPED ROW.
                  *
                  * Five items on one line wrapped to four and one, and the orphan
                  * centred itself under the other four — which reads as a fifth
                  * thing that did not fit rather than as a key. The zones take
                  * two even columns, and the chapter mark sits below a hairline
                  * because it is a different KIND of mark: the others say which
                  * zone, this one says whether anybody is there.
                  */}
                {/*
                  * THE LEGEND FOLLOWS WHATEVER IS COLOURING THE MAP.
                  *
                  * Once an editor has assigned districts to their own regions,
                  * the shapes are coloured by those regions — and a legend still
                  * reading North/East/South/West would be naming four things the
                  * reader can no longer see. It lists the CMS regions instead, in
                  * the order the page lists them, which is the order the palette
                  * is keyed by.
                  *
                  * With nothing assigned it is the four zones, exactly as before.
                  */}
                {legend.length > 0 && (
                    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[1.0625rem]
                                   font-semibold text-gray-600">
                        {legend.map((row) => (
                            <li key={row.key} className="flex items-center gap-2">
                                <span className={`h-3 w-3 shrink-0 rounded-full ${row.swatch}`} />
                                {row.label}
                            </li>
                        ))}
                    </ul>
                )}

                {/* The rule separates the chapter mark from the KEY above it,
                    so it follows whether a key was drawn — not whether the
                    state happens to be zoned, which stopped being the same
                    question once regions could colour the map too. */}
                <p className={`flex items-center gap-2 text-[1.0625rem] font-semibold text-gray-500
                               ${legend.length > 0
                        ? 'mt-3 border-t border-gray-200/80 pt-3'
                        : 'mt-4'}`}
                >
                    <span className="h-3 w-3 shrink-0 rounded-full border-2 border-brand-800 bg-white" />
                    District with a chapter — the figure is its active members
                </p>

                {/* -------------------------------------- what a click says */}
                {shape && (
                    <div
                        role="status"
                        className="relative mt-4 rounded-xl border border-gray-200 bg-white p-4
                                   pt-5 text-center"
                    >
                        {/* The × of the reference: a card a reader opened is a
                            card they must be able to shut, and shutting it puts
                            the block back the way it was. */}
                        <button
                            type="button"
                            onClick={() => setSelected(null)}
                            aria-label="Close"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
                                       rounded-full text-gray-400 transition-colors
                                       hover:bg-gray-100 hover:text-gray-600"
                        >
                            <X size={14} />
                        </button>

                        <p className="text-[1.25rem] font-bold uppercase tracking-[0.16em]
                                      text-brand-500">
                            {zone ? `${zone.label} · ${stateName}` : stateName}
                        </p>
                        <h3 className="mt-1 text-[1.5625rem] font-black tracking-tight text-brand-900">
                            {chapter ? chapter.name : shape.name}
                        </h3>

                        {/*
                          * WHAT IS KNOWN ABOUT THE CHAPTER, BEFORE WHO TO WRITE TO.
                          *
                          * An editor filled a district in completely — an
                          * office-bearer, five members, the right region — clicked
                          * it on the map and read "No contact published for this
                          * district yet", which is TRUE and reads as though none of
                          * the work had landed. A contact is one of the things a
                          * district has, and it was being treated as the only one.
                          *
                          * So the panel opens with the facts it holds: the members
                          * it publishes and the size of its bench. Both are already
                          * on the record and both are what the marker was drawn
                          * from, so a district that is filled in cannot look empty.
                          */}
                        {chapter && (chapter.activeMembers > 0
                            || (chapter.leaders || []).length > 0) && (
                            <p className="mt-2 text-[1.0625rem] font-semibold text-gray-500">
                                {[
                                    chapter.activeMembers > 0
                                        && `${chapter.activeMembers} active member${
                                            chapter.activeMembers === 1 ? '' : 's'}`,
                                    (chapter.leaders || []).length > 0
                                        && `${chapter.leaders.length} on the bench`,
                                ].filter(Boolean).join(' · ')}
                            </p>
                        )}

                        {/*
                          * ------------------------------------------------------
                          * THE OFFICE, ALONE. NO BENCH, NO COUNT.
                          * ------------------------------------------------------
                          *
                          * This opened with "N office-bearers" over a district
                          * office. The count was wrong to print for two reasons at
                          * once: most districts have no bench, so the first thing a
                          * reader saw on a marker somebody had carefully filled in
                          * was a ZERO; and the bench it counted has its own boards
                          * further down the page, where a reader sees the faces
                          * rather than a number standing in for them.
                          *
                          * What a marker is for is reaching somebody. So it prints
                          * the contacts — the district-wise group in Section 5 of
                          * the CMS, which is the one place a district contact can
                          * now be typed, and therefore the one place it can be
                          * corrected. The district office it printed before has no
                          * editor at all any more.
                          */}
                        {contacts.length > 0 ? (
                            <ul className="mt-3 space-y-3 text-[1.0625rem] font-medium text-gray-600">
                                {contacts.map((c, k) => (
                                    <li key={c.id || k} className="space-y-1">
                                        {/* A contact with only a telephone number is a
                                            real contact and gets no empty heading. */}
                                        {(c.name || c.designation || c.organisation) && (
                                            <p className="font-bold text-brand-900">
                                                {c.name || c.designation || c.organisation}
                                                {c.name && c.designation ? (
                                                    <span className="block text-[1rem] font-medium text-gray-500">
                                                        {c.designation}
                                                    </span>
                                                ) : null}
                                            </p>
                                        )}
                                        {c.phone && (
                                            <p className="flex items-center justify-center gap-2.5">
                                                <Phone size={14} className="shrink-0 text-brand-500" />
                                                <a
                                                    href={`tel:${c.phone}`}
                                                    className="transition-colors hover:text-brand-700"
                                                >
                                                    {c.phone}
                                                </a>
                                            </p>
                                        )}
                                        {c.email && (
                                            <p className="flex items-center justify-center gap-2.5">
                                                <Mail size={14} className="shrink-0 text-brand-500" />
                                                <a
                                                    href={`mailto:${c.email}`}
                                                    className="break-all transition-colors hover:text-brand-700"
                                                >
                                                    {c.email}
                                                </a>
                                            </p>
                                        )}
                                        {c.address && (
                                            <p className="flex items-start justify-center gap-2.5">
                                                <MapPin size={14} className="mt-[3px] shrink-0 text-brand-500" />
                                                <span>{c.address}</span>
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            /*
                             * Two silences, and they are not the same sentence. A
                             * district the association HAS a chapter in but has
                             * published no contact for is an omission somebody can
                             * fix; a district it is not in yet is an invitation.
                             * Printing one for the other tells an editor their
                             * region does not exist when it plainly does.
                             *
                             * And on a chapter that HAS a bench, the line above has
                             * already said so, so this one only has to name the one
                             * thing missing — quietly, because a telephone number
                             * nobody has published yet is not a fault on the page.
                             */
                            <p className="mt-2 text-[1.0625rem] font-semibold text-gray-400">
                                {chapter
                                    ? "No contact published yet — see the bench below."
                                    : "No ACTIV chapter here yet."}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Reveal>
    );
}
