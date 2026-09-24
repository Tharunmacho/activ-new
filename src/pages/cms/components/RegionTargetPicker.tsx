import { useEffect, useMemo, useState } from 'react';
import {
    Globe, MapPin, AlertTriangle, Loader2, X, Plus,
} from 'lucide-react';
import { getRegionTree } from '@/services/activApi';
import { CmsSection, CmsChoice } from './CmsUI';

/**
 * Who a piece of content is for — any number of states, districts and blocks.
 *
 * THREE THINGS THIS REPLACES, all of them reported as "I cannot select the
 * regions":
 *
 *   1. THREE DROPDOWNS THAT EXPRESSED ONE REGION. A conclave held for ten
 *      blocks across two districts had to be posted ten times: ten records, ten
 *      registration lists, ten things to correct when the venue moved.
 *
 *   2. AN ADD-ONE-AT-A-TIME BUILDER. Its replacement was a list, which was
 *      right, but choosing ten blocks still meant thirty dropdown interactions
 *      and ten presses of Add. Ticking ten boxes is the operation the editor is
 *      actually performing.
 *
 *   3. AN EMPTY DROPDOWN THAT EXPLAINED NOTHING. When the region tree failed to
 *      load — or had not loaded yet — the state select rendered with only its
 *      placeholder in it, identical to a platform with no staffed regions at
 *      all. There is a loading state and a retry now, and "no regions" says why.
 *
 * EMPTY MEANS EVERYONE. That is the contract the model states and the one
 * `regionMatch.js` enforces on the way out, so it is offered as a mode rather
 * than as a row: "everywhere, and also Ariyalur" is either a contradiction or a
 * no-op depending which end of the system you ask.
 *
 * SELECTING A WIDER SCOPE DROPS THE NARROWER ONES INSIDE IT. Ticking Tamil Nadu
 * removes any districts and blocks of Tamil Nadu already chosen, because
 * `{ state: 'Tamil Nadu' }` already reaches every one of them. Keeping both
 * would show an editor two rows that mean one thing and make the reach count
 * look like it was double-counting.
 *
 * The options come from the live region tree — the admin collections, not a
 * bundled list — so a region opens for targeting the moment a block admin is
 * created for it. See the admin-first region architecture note in CLAUDE.md.
 */

export interface RegionTarget {
    state: string;
    district: string;
    block: string;
}

interface Props {
    /** Every region ticked in the tree, kept whether or not it is narrowing. */
    targets: RegionTarget[];
    onChange: (targets: RegionTarget[]) => void;
    /**
     * "Everyone in the association" — the first card, and a field of its own on
     * the event rather than a shorthand for an empty `targets`.
     *
     * Separate because the two cards are independent: an event may carry ticked
     * regions AND go to everybody, and reopening it has to show back both. With
     * an empty list standing in for everyone, ticking the first card could only
     * be saved by discarding the second card's regions.
     */
    reachEveryone?: boolean;
    onReachEveryoneChange?: (reachEveryone: boolean) => void;
    /** Feeds the reach count: the members-only switch narrows it further. */
    audience?: 'all' | 'paid';
    hint?: string;
    title?: string;
}

interface BlockNode { name?: string }
interface DistrictNode { name?: string; blocks?: BlockNode[] }
interface StateNode { name?: string; districts?: DistrictNode[] }

const label = (t: RegionTarget) => [t.state, t.district, t.block].filter(Boolean).join(' › ');

const same = (a: RegionTarget, b: RegionTarget) =>
    a.state === b.state && a.district === b.district && a.block === b.block;

/** Is `inner` inside `outer`? A scope is read left to right — see the model. */
const covers = (outer: RegionTarget, inner: RegionTarget) => {
    if (outer.state !== inner.state) return false;
    if (!outer.district) return true;
    if (outer.district !== inner.district) return false;
    if (!outer.block) return true;
    return outer.block === inner.block;
};

export default function RegionTargetPicker({
    targets,
    onChange,
    reachEveryone = false,
    onReachEveryoneChange,
    audience = 'all',
    hint,
    title,
}: Props) {
    const [states, setStates] = useState<StateNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [term, setTerm] = useState('');
    /*
     * SETS, NOT ONE OPEN BRANCH EACH.
     *
     * These were single strings, so opening a second district closed the first
     * and opening a second state closed everything under it. Picking four blocks
     * across two districts therefore meant re-expanding the tree between every
     * pick, and after each one the row that had just been ticked scrolled away
     * with its branch. Several branches can stand open now, which is what makes
     * choosing more than one region bearable.
     */
    const [openStates, setOpenStates] = useState<Set<string>>(new Set());
    const [openDistricts, setOpenDistricts] = useState<Set<string>>(new Set());

    /**
     * The three cascading steps, as a draft that is not a target until Added.
     *
     * A DRAFT, not a direct write. Choosing a state would otherwise immediately
     * aim the event at the whole state, and the editor on their way to one
     * block would broadcast it to 38 districts for as long as it took them to
     * pick the next field. Nothing is added to `targets` until the button says
     * so, which is also what lets the same three fields express three different
     * levels.
     */
    const [draftState, setDraftState] = useState('');
    const [draftDistrict, setDraftDistrict] = useState('');
    const [draftBlock, setDraftBlock] = useState('');

    /** The districts of the chosen state, and the blocks of the chosen district. */
    const draftDistricts = useMemo(
        () => states.find((st) => st.name === draftState)?.districts || [],
        [states, draftState],
    );
    const draftBlocks = useMemo(
        () => draftDistricts.find((d) => d.name === draftDistrict)?.blocks || [],
        [draftDistricts, draftDistrict],
    );

    /*
     * A narrower choice cannot outlive the wider one it belonged to.
     *
     * Changing the state with a district still selected would leave a district
     * that does not exist inside the new state — and the Add button would
     * cheerfully write it, producing a target nothing can ever match.
     */
    const chooseState = (name: string) => {
        setDraftState(name);
        setDraftDistrict('');
        setDraftBlock('');
    };
    const chooseDistrict = (name: string) => {
        setDraftDistrict(name);
        setDraftBlock('');
    };

    /** Add or remove one key, without mutating the set React is rendering. */
    const toggleIn = (
        setter: React.Dispatch<React.SetStateAction<Set<string>>>,
        key: string,
    ) => setter((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });

    /** Open one branch — used when a card asks for the tree, not by the rows. */
    const setOpenState = (name: string) =>
        setOpenStates((current) => (name ? new Set(current).add(name) : current));

    /*
     * TWO INDEPENDENT ANSWERS, STORED INDEPENDENTLY.
     *
     * `targets` is what was ticked in the tree. `reachEveryone` is the first
     * card. Either, both or neither may be on, and the event carries both, so
     * reopening it restores exactly what the editor last saw.
     *
     * That separation lives on the Event schema, and it had to: with an empty
     * list standing in for "everyone", ticking the first card could only be
     * saved by throwing the second card's regions away — so every edit of such
     * an event started from a blank tree. See `reachEveryone` on the model.
     */
    const list = useMemo(() => (Array.isArray(targets) ? targets : []), [targets]);
    const everyone = reachEveryone === true;

    /**
     * Who this actually goes to, once both answers are read together.
     *
     * "Everyone" wins — everyone ∪ Tamil Nadu is everyone — and the ticked
     * regions are kept, simply not narrowing anything while it is on. This is
     * the same rule the server applies in `event.service.listEvents`, and it has
     * to be, or the reach count would describe a different audience from the one
     * that receives the event.
     */
    const effective = everyone ? [] : list;
    const everywhere = effective.length === 0;


    const loadTree = (force = false) => {
        setLoading(true);
        setLoadError('');

        /*
         * `include: 'all'` — EVERY REGION THE ADMIN DATABASE KNOWS.
         *
         * The default listing is the APPLICANT's: pruned bottom-up so a
         * registration dropdown cannot offer a state with no block beneath it to
         * finish choosing through. Reading that listing here deleted real
         * regions from this picker. A platform with two staffed states — one
         * with 38 districts of block admins, one carrying only its state admin
         * — offered exactly one, with nothing on screen to say the other had
         * been withheld or why. The editor's reasonable conclusion was that the
         * state admin they had just created had not saved.
         *
         * Targeting asks the opposite question. A state whose only staffed
         * account is its state admin is a real audience: that admin, and every
         * member standing in that state, receive the event. Nothing about
         * reaching them requires a block admin to exist first — that rule is
         * about opening a region for REGISTRATION, and it does not belong here.
         */
        getRegionTree(force, 'all')
            .then((tree) => {
                const rows = Array.isArray(tree?.states) ? tree.states : [];
                setStates(rows);
                /*
                 * An empty tree is a real answer, and a different one from a
                 * failure. This listing holds every region any admin account
                 * names, so empty means no admin has been created anywhere —
                 * which the editor can act on, unlike a blank dropdown.
                 */
                if (!rows.length) {
                    setLoadError('No regions exist yet. Create an admin for a state, district or block to open one for targeting.');
                }
            })
            .catch(() => setLoadError('The region list could not be loaded.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadTree(); }, []);

    // ---------------------------------------------------------------- selection

    /**
     * Add a scope, dropping anything it already covers.
     *
     * A region can be ticked while "Everyone" is still on: the tick is stored
     * either way, and `reachEveryone` decides whether it is narrowing anything.
     */
    const select = (target: RegionTarget) => {
        if (list.some((t) => covers(t, target))) return;   // already reached
        onChange([...list.filter((t) => !covers(target, t)), target]);
    };

    const deselect = (target: RegionTarget) =>
        onChange(list.filter((t) => !same(t, target)));

    /**
     * Ticked = chosen exactly, or reached by something wider.
     *
     * Read from the stored list, which holds the ticks whether or not
     * "Everyone" is overruling them. Deriving "everyone" from an EMPTY list is
     * what used to blank the tree the moment that card was ticked.
     */
    const statusOf = (target: RegionTarget): 'on' | 'partial' | 'off' => {
        if (list.some((t) => same(t, target))) return 'on';
        if (list.some((t) => covers(t, target))) return 'on';
        if (list.some((t) => covers(target, t))) return 'partial';
        return 'off';
    };

    const toggle = (target: RegionTarget) => {
        const status = statusOf(target);

        if (status === 'on') {
            // Remove the entry itself, and any wider one that was reaching it —
            // untick means "not this", and leaving the parent on would ignore it.
            onChange(list.filter((t) => !same(t, target) && !covers(t, target)));
            return;
        }
        select(target);
    };

    // ---------------------------------------------------------------- search

    const filtered = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (!q) return states;

        /*
         * A state stays when it matches, or when anything inside it does — and
         * in the second case only the matching descendants are kept, so a
         * search for "hosur" does not open a district of ninety irrelevant
         * blocks around the one that matched.
         */
        return states
            .map((s) => {
                const stateHit = (s.name || '').toLowerCase().includes(q);

                const districts = (s.districts || [])
                    .map((d) => {
                        const districtHit = (d.name || '').toLowerCase().includes(q);
                        const blocks = (d.blocks || [])
                            .filter((b) => (b.name || '').toLowerCase().includes(q));

                        if (stateHit || districtHit) return d;
                        return blocks.length ? { ...d, blocks } : null;
                    })
                    .filter(Boolean) as DistrictNode[];

                if (stateHit) return s;
                return districts.length ? { ...s, districts } : null;
            })
            .filter(Boolean) as StateNode[];
    }, [states, term]);

    // ---------------------------------------------------------------- reach

    // ---------------------------------------------------------------- render

    return (
        <CmsSection
            title={title || 'Who sees this'}
            hint={hint || 'Either the whole association, or the regions you choose. '
                + 'Pick a state, then narrow it to a district or a block if you want to.'}
        >
            {/* ------------------------------------------- the choice -------
              EXACTLY ONE OF TWO, as a radio group.

              This was two checkbox cards that could both be ticked, on the
              argument that "everyone, and these are the regions I care about"
              is a real thing to want. It is — but on screen two ticked cards
              read as a contradiction, and no editor could tell from looking
              which audience the event actually had.

              `CmsChoice` is the house component for a pick-one: role=radiogroup,
              a drawn radio mark, roving tabindex and arrow keys. Never two
              `aria-pressed` buttons — see its own note.

              THE REGIONS ARE STILL SAVED while "Everyone" is selected. Only the
              UI is exclusive; `reachEveryone` and `targets` remain two fields,
              so switching back restores what was picked rather than starting
              from a blank list. That was the entire reason they were split.
            */}
            <CmsChoice
                label="Who sees this event"
                size="lg"
                value={everyone ? 'everyone' : 'regions'}
                onChange={(next) => onReachEveryoneChange?.(next === 'everyone')}
                options={[
                    {
                        value: 'everyone',
                        icon: <Globe className="w-4 h-4" />,
                        title: 'Everyone in the association',
                        detail: list.length
                            ? `Every member, wherever they are. Your ${list.length} `
                              + `${list.length === 1 ? 'region is' : 'regions are'} kept, `
                              + 'and come back if you switch.'
                            : 'Every member, wherever they are.',
                    },
                    {
                        value: 'regions',
                        icon: <MapPin className="w-4 h-4" />,
                        title: 'Only chosen regions',
                        detail: list.length
                            ? `${list.length} ${list.length === 1 ? 'region' : 'regions'} chosen.`
                            : 'Choose a state, then narrow it if you want to.',
                    },
                ]}
            />

            {/* ------------------------------------------- the three steps ---
              HIDDEN ENTIRELY WHILE "EVERYONE" IS SELECTED.

              The controls used to stay on screen with the first card ticked,
              which invited exactly the question the association asked: why am I
              being shown a region picker for an event that goes everywhere.
            */}
            {!everyone ? (
                <div className="mt-4">
                    {loading ? (
                        <p className="flex items-center gap-2 text-[1.25rem] text-slate-500 dark:text-[#A1A1AA]">
                            <Loader2 size={14} className="animate-spin" /> Loading regions…
                        </p>
                    ) : loadError ? (
                        <p className="flex items-start gap-2 text-[1.25rem] text-amber-700 dark:text-amber-400">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{loadError}</span>
                        </p>
                    ) : (
                        <>
                            {/*
                              STATE, THEN DISTRICT, THEN BLOCK — each locked
                              until the one before it is answered, and each
                              saying so rather than sitting greyed and silent.

                              Stopping after the state aims the event at the
                              whole state; stopping after the district takes the
                              district. That is what makes three fields express
                              three levels without a tree.
                            */}
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Step
                                    n={1}
                                    label="State"
                                    value={draftState}
                                    onChange={chooseState}
                                    options={states.map((st) => st.name || '').filter(Boolean)}
                                    placeholder="Choose a state"
                                    locked={false}
                                />
                                <Step
                                    n={2}
                                    label="District"
                                    value={draftDistrict}
                                    onChange={chooseDistrict}
                                    options={draftDistricts.map((d) => d.name || '').filter(Boolean)}
                                    placeholder={draftDistricts.length
                                        ? 'All districts'
                                        : 'No districts in this state'}
                                    locked={!draftState}
                                    lockedNote="Choose a state first"
                                    optionalNote="Leave as All districts to take the whole state"
                                />
                                <Step
                                    n={3}
                                    label="Block"
                                    value={draftBlock}
                                    onChange={setDraftBlock}
                                    options={draftBlocks.map((b) => b.name || '').filter(Boolean)}
                                    placeholder={draftBlocks.length
                                        ? 'All blocks'
                                        : 'No blocks in this district'}
                                    locked={!draftDistrict}
                                    lockedNote="Choose a district first"
                                    optionalNote="Leave as All blocks to take the whole district"
                                />
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    disabled={!draftState}
                                    onClick={() => {
                                        select({
                                            state: draftState,
                                            district: draftDistrict,
                                            block: draftBlock,
                                        });
                                        // Cleared back to the state, not to
                                        // nothing: the commonest next pick is
                                        // another district of the same state.
                                        setDraftDistrict('');
                                        setDraftBlock('');
                                    }}
                                    /*
                                     * A SECONDARY control, and a constant label.
                                     *
                                     * In solid blue it was the loudest thing on
                                     * the form and read as the button that posts
                                     * the event — which is the one mistake this
                                     * button must not invite. An outline says
                                     * "this adds a row", and the only solid blue
                                     * on the form stays Create event.
                                     *
                                     * The label was "Add all of Tamil Nadu",
                                     * rewriting itself on every keystroke of the
                                     * three fields; a control whose words move
                                     * while you are reading them is harder to
                                     * trust, not clearer. The three fields above
                                     * already say what will be added.
                                     */
                                    className="inline-flex items-center gap-2 h-12 px-5 rounded-xl border
                                               border-slate-300 bg-white text-[1.25rem] font-semibold
                                               text-slate-700 transition-colors hover:bg-slate-50
                                               hover:border-slate-400 disabled:opacity-40
                                               dark:bg-transparent dark:text-neutral-200 dark:border-[#2a2a2a]"
                                >
                                    <Plus size={16} /> Add
                                </button>

                                {!draftState ? (
                                    <span className="text-[1.25rem] text-slate-500 dark:text-[#A1A1AA]">
                                        Start by choosing a state.
                                    </span>
                                ) : null}
                            </div>

                            {/* ------------------------------------- chosen -- */}
                            {list.length > 0 ? (
                                <div className="mt-5">
                                    <p className="text-[1.0625rem] font-semibold uppercase
                                                  tracking-wider text-slate-400 mb-2">
                                        Chosen regions
                                    </p>
                                    <ul className="flex flex-wrap gap-2">
                                        {list.map((target) => (
                                            <li
                                                key={`${target.state}|${target.district}|${target.block}`}
                                                className="inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-full
                                                           bg-blue-50 dark:bg-blue-500/10 text-blue-700
                                                           dark:text-blue-300 text-[1.25rem] font-semibold"
                                            >
                                                {/* Read left to right, widest first, so a
                                                    state-wide target cannot be mistaken for
                                                    a block of the same name. */}
                                                {[target.state, target.district, target.block]
                                                    .filter(Boolean).join(' › ')}
                                                <button
                                                    type="button"
                                                    onClick={() => deselect(target)}
                                                    aria-label={`Remove ${target.block || target.district || target.state}`}
                                                    className="w-6 h-6 rounded-full inline-flex items-center
                                                               justify-center hover:bg-blue-100
                                                               dark:hover:bg-blue-500/20"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                /* No "nothing chosen yet" line. The three
                                   fields and the empty chip row already say it,
                                   and a sentence restating them under the button
                                   was the third thing on screen making the same
                                   point. */
                                null
                            )}
                        </>
                    )}
                </div>
            ) : null}

        </CmsSection>
    );
}

// ---------------------------------------------------------------- pieces

/**
 * One of the three cascading steps.
 *
 * A LOCKED STEP SAYS WHY IT IS LOCKED. A `disabled` select that sits grey and
 * silent is the commonest way a cascading form stalls somebody: they click it,
 * nothing happens, and there is nothing on screen connecting it to the field
 * above. The note under the control is the whole difference between a form that
 * teaches its own order and one that has to be explained.
 *
 * The optional note matters as much. Leaving District on "All districts" is how
 * an editor takes a whole state, and there is nothing about an untouched
 * dropdown that says so — so it is written under the field rather than left to
 * be discovered.
 *
 * An empty options list is its OWN case, not a lock: a state genuinely without
 * districts is a complete answer, and "No districts in this state" tells the
 * editor their state-wide pick is the only one available rather than implying
 * they have missed a step.
 */
function Step({
    n,
    label,
    value,
    onChange,
    options,
    placeholder,
    locked,
    lockedNote,
    optionalNote,
}: {
    n: number;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder: string;
    locked: boolean;
    lockedNote?: string;
    optionalNote?: string;
}) {
    const empty = !locked && options.length === 0;

    return (
        <div className="min-w-0">
            <label className="flex items-center gap-2 mb-2">
                {/* The number is the instruction. Three fields in a row do not
                    read as a sequence without it. */}
                <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center
                                  text-[1.0625rem] font-bold shrink-0 ${locked
                        ? 'bg-slate-100 text-slate-400 dark:bg-[#1a1a1a]'
                        : 'bg-blue-600 text-white'}`}>
                    {n}
                </span>
                <span className={`text-[1.25rem] font-semibold ${locked
                    ? 'text-slate-400 dark:text-[#6b6b6b]'
                    : 'text-slate-800 dark:text-neutral-200'}`}>
                    {label}
                </span>
            </label>

            <select
                value={value}
                disabled={locked || empty}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-12 rounded-xl border border-slate-200 dark:border-[#2a2a2a]
                           bg-white dark:bg-black px-3.5 text-[1.25rem] text-slate-900 dark:text-neutral-100
                           outline-none transition-colors focus:border-blue-500
                           focus:ring-4 focus:ring-blue-500/10
                           disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                           dark:disabled:bg-[#0d0d0d]"
            >
                <option value="">{placeholder}</option>
                {options.map((name) => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>

            {/* Slate, not amber. Amber reads as a WARNING — something has
                gone wrong — and nothing has: the step is simply next in the
                order. It is the same weight as the other notes now, just the
                one that happens to say what to do first. */}
            <p className={`mt-2 text-[1.1875rem] ${locked
                ? 'text-slate-700 dark:text-neutral-300 font-semibold'
                : 'text-slate-500 dark:text-[#A1A1AA]'}`}>
                {locked ? lockedNote : empty ? placeholder : optionalNote || '\u00a0'}
            </p>
        </div>
    );
}


