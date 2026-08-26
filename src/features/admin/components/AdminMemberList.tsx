import { ChevronRight, Users } from "lucide-react";

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
 * word, and a chevron into the detail view. That is what a directory wants, and
 * it is what this renders. The rows sit in a single white surface rather than
 * separate cards, so a long list reads as one list.
 *
 * Kept in `features/admin/components` because the block, district and state
 * Members screens were three near-identical copies of the same markup; the row
 * now has one definition.
 */

export interface AdminMemberRow {
    id: string;
    applicationId?: string;
    name: string;
    email?: string;
    /** "Active" | "Inactive" — see the note on the caller's status rule. */
    status?: string;
}

export default function AdminMemberList({
    members,
    loading,
    emptyHint,
    onOpen,
}: {
    members: AdminMemberRow[];
    loading?: boolean;
    emptyHint?: string;
    onOpen: (member: AdminMemberRow) => void;
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

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {members.map((member, i) => {
                const inactive = (member.status || '').toLowerCase() === 'inactive';
                return (
                    <button
                        key={member.id || member.applicationId || i}
                        type="button"
                        onClick={() => onOpen(member)}
                        className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${i === members.length - 1 ? '' : 'border-b border-gray-100'
                            }`}
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
                        </span>

                        <span
                            className={`text-sm font-semibold shrink-0 ${inactive ? 'text-red-500' : 'text-green-600'}`}
                        >
                            {inactive ? 'Inactive' : 'Active'}
                        </span>

                        <ChevronRight className="w-5 h-5 text-indigo-500 shrink-0" />
                    </button>
                );
            })}
        </div>
    );
}
