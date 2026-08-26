import { Eye, Trash2, UserCheck, UserX, Users } from "lucide-react";

/**
 * The admin member list, matching the mobile app's `BlockMembersScreen` row.
 *
 * The website rendered each member as a large blue-gradient card in a
 * three-column grid: a 64px avatar, the name, the member type, a status badge,
 * then email / phone / location on their own lines, a join date and a "View
 * Profile" button. Twelve members filled three screens, and the white text on
 * saturated blue made the actual content — a name and an email — the least
 * legible part of the card.
 *
 * Mobile shows one quiet row per member: initials, name over email, the status
 * word, then the actions. That is what a directory wants, and it is what this
 * renders. The rows sit in a single white surface rather than separate cards,
 * so a long list reads as one list.
 *
 * The row used to be a single `<button>` wrapping everything. Putting the three
 * action buttons inside it would have nested interactive elements, which is
 * invalid HTML and makes the inner clicks ambiguous, so the row is a plain
 * `<div>` and only the identity block is the button that opens the profile.
 */

export interface AdminMemberRow {
    id: string;
    applicationId?: string;
    name: string;
    email?: string;
    /** "Active" | "Inactive", resolved by the server. */
    status?: string;
    /** Why they are inactive — suspended, or rejected and the reason given. */
    inactiveReason?: string;
}

export default function AdminMemberList({
    members,
    loading,
    emptyHint,
    onOpen,
    onToggleActive,
    onDelete,
    busyId,
}: {
    members: AdminMemberRow[];
    loading?: boolean;
    emptyHint?: string;
    onOpen: (member: AdminMemberRow) => void;
    /** Suspend an active member, or reactivate a suspended one. */
    onToggleActive?: (member: AdminMemberRow, nextActive: boolean) => void;
    /** Permanent, cascading delete. The caller confirms before calling. */
    onDelete?: (member: AdminMemberRow) => void;
    /** Row currently mid-request; its buttons are disabled. */
    busyId?: string | null;
}) {
    const initials = (name: string) =>
        (name || '')
            .split(' ')
            .filter(Boolean)
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || '?';

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 py-16">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3 animate-pulse">
                        <Users className="w-7 h-7 text-blue-600" />
                    </div>
                    <p className="text-gray-600">Loading members…</p>
                </div>
            </div>
        );
    }

    if (!members.length) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 py-16">
                <div className="flex flex-col items-center text-center px-4">
                    <Users className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-base font-semibold text-gray-700">No members found</p>
                    {emptyHint ? <p className="text-sm text-gray-500 mt-1">{emptyHint}</p> : null}
                </div>
            </div>
        );
    }

    const iconBtn =
        'w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {members.map((member, i) => {
                const inactive = (member.status || '').toLowerCase() === 'inactive';
                const rowId = member.id || member.applicationId || String(i);
                const busy = !!busyId && busyId === rowId;

                return (
                    <div
                        key={rowId}
                        className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${i === members.length - 1 ? '' : 'border-b border-gray-100'
                            }`}
                    >
                        <button
                            type="button"
                            onClick={() => onOpen(member)}
                            className="flex items-center gap-4 flex-1 min-w-0 text-left"
                        >
                            <span className="w-11 h-11 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm flex items-center justify-center shrink-0">
                                {initials(member.name)}
                            </span>

                            <span className="flex-1 min-w-0">
                                <span className="block font-semibold text-gray-900 truncate">
                                    {member.name || 'Name not provided'}
                                </span>
                                <span className="block text-sm text-gray-500 truncate">
                                    {member.email || 'No email'}
                                </span>
                                {/* Only shown when there is one — an active member
                                    has no reason to display, and an empty line
                                    under every active row is noise. */}
                                {inactive && member.inactiveReason ? (
                                    <span className="block text-xs text-red-500 truncate mt-0.5">
                                        {member.inactiveReason}
                                    </span>
                                ) : null}
                            </span>
                        </button>

                        <span
                            className={`text-sm font-semibold shrink-0 hidden sm:inline ${inactive ? 'text-red-500' : 'text-green-600'}`}
                        >
                            {inactive ? 'Inactive' : 'Active'}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                title="View full application"
                                aria-label={`View ${member.name || 'member'}`}
                                onClick={() => onOpen(member)}
                                className={`${iconBtn} text-indigo-600 hover:bg-indigo-50`}
                            >
                                <Eye className="w-4 h-4" />
                            </button>

                            <button
                                type="button"
                                disabled={busy || !onToggleActive}
                                title={inactive ? 'Reactivate this member' : 'Suspend this member'}
                                aria-label={inactive ? `Reactivate ${member.name || 'member'}` : `Suspend ${member.name || 'member'}`}
                                onClick={() => onToggleActive?.(member, inactive)}
                                className={`${iconBtn} ${inactive
                                    ? 'text-green-600 hover:bg-green-50'
                                    : 'text-amber-600 hover:bg-amber-50'
                                    }`}
                            >
                                {inactive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                            </button>

                            <button
                                type="button"
                                disabled={busy || !onDelete}
                                title="Delete permanently"
                                aria-label={`Delete ${member.name || 'member'}`}
                                onClick={() => onDelete?.(member)}
                                className={`${iconBtn} text-red-600 hover:bg-red-50`}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
