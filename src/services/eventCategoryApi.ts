import api, { unwrap } from './api';
import { ENDPOINTS } from '@/config/api.config';

/**
 * Event categories — Medical, Awareness, Export, Coffee Meet.
 *
 * ONE LIST, shared with the filter chips on the public events page. The server
 * note (`backend/src/modules/events/eventcategory.service.js`) has the argument
 * for why these are not a collection of their own; the thing to carry to a call
 * site is that renaming one here renames it on the public site and re-files
 * every event wearing the old label.
 */

/**
 * Which kind of event a category may be filed under.
 *
 * `both` unless somebody narrows it. The two narrower values are what stop a
 * label being offered where it makes no sense — "ZOOM" on an event people are
 * driving to, "Tea party" on a video call.
 */
export type EventCategoryMode = 'both' | 'online' | 'offline';

export interface EventCategory {
    /** The chip's own id. EMPTY for an unmanaged row — see `managed`. */
    id: string;
    label: string;
    icon: string;
    mode: EventCategoryMode;
    order: number;
    /**
     * Whether this category is on the managed list.
     *
     * `false` means events carry the label but no chip lists it — one written
     * before this screen existed, or one whose chip was deleted. Those rows are
     * shown rather than hidden, because a list of SOME of the categories in use
     * is the least useful thing this screen could be.
     */
    managed: boolean;
    /** How many events carry this label. What is lost if the chip is removed. */
    eventCount: number;
}

export interface EventCategoryList {
    categories: EventCategory[];
    /** Which of the standard names are absent — what "Add standard list" would add. */
    missingStandard: string[];
    standard: string[];
    /** Set by a rename: how many events were re-filed onto the new label. */
    moved?: number;
    previous?: string;
    /** Set by the standard-list action. */
    added?: string[];
}

const EMPTY: EventCategoryList = { categories: [], missingStandard: [], standard: [] };

export const listEventCategories = async () =>
    unwrap<EventCategoryList>(await api.get(ENDPOINTS.EVENTS.CATEGORIES), EMPTY);

export const addEventCategory = async (
    label: string,
    mode: EventCategoryMode = 'both',
    icon = 'calendar-days',
) =>
    unwrap<EventCategoryList>(
        await api.post(ENDPOINTS.EVENTS.CATEGORIES, { label, icon, mode }), EMPTY);

/**
 * Rename a chip AND re-file every event on the old label.
 *
 * The server does both and returns `moved`. The screen reports that number:
 * "renamed, and moved 12 events onto it" is the half of this an editor cannot
 * see for themselves, and leaving it out invites them to check by hand.
 */
export const renameEventCategory = async (
    id: string,
    label: string,
    mode?: EventCategoryMode,
    icon?: string,
) =>
    unwrap<EventCategoryList>(
        await api.put(ENDPOINTS.EVENTS.CATEGORY(id), {
            label,
            ...(icon ? { icon } : {}),
            // Omitted when not being changed: the server reads an absent `mode`
            // as "leave it alone", so renaming cannot silently widen a category
            // back to `both`.
            ...(mode ? { mode } : {}),
        }), EMPTY);

export const deleteEventCategory = async (id: string) =>
    unwrap<EventCategoryList>(await api.delete(ENDPOINTS.EVENTS.CATEGORY(id)), EMPTY);

export const moveEventCategory = async (id: string, direction: 'up' | 'down') =>
    unwrap<EventCategoryList>(
        await api.post(ENDPOINTS.EVENTS.CATEGORY_MOVE(id), { direction }), EMPTY);

/** Add whichever standard names are missing. Additive — it removes nothing. */
export const addStandardEventCategories = async () =>
    unwrap<EventCategoryList>(await api.post(ENDPOINTS.EVENTS.CATEGORIES_STANDARD, {}), EMPTY);
