import api, { unwrap } from './api';

/**
 * ============================================================================
 * ASKING TO BE PUT IN TOUCH WITH AN OFFICE-BEARER
 * ============================================================================
 *
 * A visitor opens a leader's panel on their region or state page and asks to be
 * contacted. The message is recorded for the super admin, who decides what is
 * passed on — nothing here reaches the leader's own mailbox. Their email and
 * telephone are printed on the panel for anyone who wants to write directly.
 *
 * THE VISITOR DOES NOT WRITE THE MESSAGE. They pick a purpose from the list
 * below and give a telephone number; the SERVER composes the sentence from
 * that. There is no field on this client that reaches the stored message, so
 * "hi" cannot be posted to a state chairman — which is the whole reason the
 * association asked for the feature to work this way.
 *
 * `note` is the one free field. It is short, optional, and stored apart from
 * the composed message so an administrator reading it knows whose words it is.
 */

/** One of the things a visitor can ask for. The server owns the list. */
export interface LeaderMessagePurpose {
    key: string;
    label: string;
    hint: string;
    /**
     * This option IS the free box — “something else, I will write it”.
     *
     * The server sends it so the form can mark the box required and refuse
     * before a round trip. The server checks it again: a client's
     * validation is a convenience, never the rule.
     */
    requiresNote?: boolean;
}

/** Where the leader sits. This is what the super admin sorts the inbox by. */
export interface LeaderContext {
    tier: 'national' | 'region' | 'state' | 'district';
    /** The region page's own name, where there is one. */
    region?: string;
    state?: string;
    district?: string;
}

export interface LeaderMessageDraft {
    leader: {
        id?: string;
        name: string;
        role?: string;
        designation?: string;
        organisation?: string;
    };
    context: LeaderContext;
    pagePath: string;
    sender: {
        name: string;
        phone: string;
        email?: string;
        organisation?: string;
        district?: string;
    };
    purpose: string;
    note?: string;
}

/* ------------------------------------------------------------------ public */

/**
 * The purposes, fetched once per page load.
 *
 * Not put through `cached()` from `cmsApi`: that cache is invalidated wholesale
 * on every CMS save, and this list is not editable content — it is a fixed
 * table in the service. A module-level promise is the right lifetime.
 */
let purposesOnce: Promise<LeaderMessagePurpose[]> | null = null;

export const getLeaderMessagePurposes = (): Promise<LeaderMessagePurpose[]> => {
    if (!purposesOnce) {
        purposesOnce = api.get('/cms/leader-messages/purposes')
            .then((res) => unwrap<LeaderMessagePurpose[]>(res, []))
            .catch(() => {
                // Let the next open try again: a failed fetch here leaves the
                // form with nothing to choose, and a cached failure would make
                // that permanent for the rest of the session.
                purposesOnce = null;
                return [];
            });
    }
    return purposesOnce;
};

export const sendLeaderMessage = async (draft: LeaderMessageDraft) => {
    const res = await api.post('/cms/leader-messages', {
        leader: draft.leader,
        tier: draft.context.tier,
        region: draft.context.region || '',
        state: draft.context.state || '',
        district: draft.context.district || '',
        pagePath: draft.pagePath,
        sender: draft.sender,
        purpose: draft.purpose,
        note: draft.note || '',
    });
    return unwrap<{ sent: boolean; purposeLabel: string }>(res, { sent: false, purposeLabel: '' });
};

/* ------------------------------------------------------------- super admin */

export interface LeaderMessage {
    _id: string;
    leader: { id: string; name: string; role: string; designation: string; organisation: string };
    tier: LeaderContext['tier'];
    region: string;
    state: string;
    district: string;
    pagePath: string;
    sender: { name: string; phone: string; email: string; organisation: string; district: string };
    purpose: string;
    purposeLabel: string;
    /** Composed by the server. Never editable, here or anywhere. */
    body: string;
    /** The sender's own words, if they added any. */
    note: string;
    status: 'new' | 'read' | 'contacted' | 'closed';
    adminNote: string;
    handledBy: { email: string; at: string | null };
    createdAt: string | null;
}

export const listLeaderMessages = async (params: {
    status?: string; tier?: string; state?: string; district?: string; limit?: number;
} = {}) => {
    const res = await api.get('/cms/leader-messages', { params });
    return unwrap<{ messages: LeaderMessage[]; unread: number }>(res, { messages: [], unread: 0 });
};

/**
 * The status and the super admin's own note.
 *
 * Deliberately not the message, the sender or the addressee: those are a record
 * of what a member of the public actually sent, and a record an administrator
 * can edit is not a record. The server enforces this too.
 */
export const updateLeaderMessage = async (
    id: string,
    patch: { status?: LeaderMessage['status']; adminNote?: string },
) => unwrap<LeaderMessage>(await api.patch(`/cms/leader-messages/${id}`, patch), {} as LeaderMessage);

export const deleteLeaderMessage = async (id: string) =>
    unwrap<{ deleted: boolean }>(await api.delete(`/cms/leader-messages/${id}`), { deleted: false });
