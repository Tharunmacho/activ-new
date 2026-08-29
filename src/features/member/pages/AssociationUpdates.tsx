import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Search } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import UpdateCard, { CATEGORY_STYLE } from '@/features/member/components/UpdateCard';
import { listAnnouncements, type Announcement, type AnnouncementCategory } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';

/**
 * Association Updates (MEM-001).
 *
 * The feed is already scoped to this member's state, district and block by the
 * server — there is no "show me another region" control and there should not
 * be, because the targeting is the feature. An update aimed at Ariyalur block
 * is aimed at the people standing in it.
 *
 * Filtering here is therefore only ever narrowing what has already arrived: the
 * category pills and the search box run over the loaded feed rather than asking
 * the server again. The feed is capped at fifty items server-side, which is
 * small enough that a round trip per keystroke would cost more than it saved.
 */

const CATEGORIES: (AnnouncementCategory | 'all')[] = [
    'all', 'urgent', 'notice', 'policy', 'scheme', 'achievement', 'general',
];

export default function AssociationUpdates() {
    const [updates, setUpdates] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [category, setCategory] = useState<AnnouncementCategory | 'all'>('all');
    const [query, setQuery] = useState('');

    useEffect(() => {
        let cancelled = false;

        listAnnouncements()
            .then((feed) => {
                if (!cancelled) setUpdates(feed?.announcements || []);
            })
            .catch((err) => {
                if (!cancelled) setError(errorMessage(err, 'Could not load updates'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const visible = useMemo(() => {
        const term = (query || '').trim().toLowerCase();

        return (updates || []).filter((update) => {
            if (category !== 'all' && update.category !== category) return false;
            if (!term) return true;

            // Title, standfirst and region — the three things a member would be
            // looking at when they decide to search for something.
            return [update.title, update.summary, update.targetLabel]
                .some((field) => (field || '').toLowerCase().includes(term));
        });
    }, [updates, category, query]);

    /** Only the categories actually present, so no pill leads to an empty list. */
    const availableCategories = useMemo(() => {
        const present = new Set((updates || []).map((update) => update.category));
        return CATEGORIES.filter((key) => key === 'all' || present.has(key as AnnouncementCategory));
    }, [updates]);

    const pinned = visible.filter((update) => update.pinned);
    const rest = visible.filter((update) => !update.pinned);

    return (
        <MemberPageShell
            title="Association Updates"
            subtitle="News and notices for your state, district and block"
            width="standard"
        >
            <div className="space-y-5">
                {/* ---------- filters ---------- */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search updates"
                            className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-500/30
                                       focus:border-blue-400"
                        />
                    </div>

                    {availableCategories.length > 1 ? (
                        <div className="flex flex-wrap gap-2">
                            {availableCategories.map((key) => {
                                const active = category === key;
                                const label = key === 'all'
                                    ? 'All'
                                    : CATEGORY_STYLE[key as AnnouncementCategory].label;

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setCategory(key)}
                                        className={`px-3 py-1.5 rounded-full text-[0.78125rem] font-semibold
                                                    transition-colors ${
                                            active
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>

                {/* ---------- the feed ---------- */}
                {loading ? (
                    <RowsSkeleton rows={4} />
                ) : error ? (
                    <EmptyState
                        icon={<Megaphone className="w-6 h-6" />}
                        title="Updates could not be loaded"
                        detail={error}
                    />
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={<Megaphone className="w-6 h-6" />}
                        title={updates.length === 0 ? 'No updates yet' : 'Nothing matches that'}
                        detail={
                            updates.length === 0
                                ? 'Notices published for your region will appear here.'
                                : 'Try a different category, or clear the search box.'
                        }
                    />
                ) : (
                    <div className="space-y-5">
                        {pinned.length > 0 ? (
                            <div className="space-y-3">
                                {pinned.map((update) => <UpdateCard key={update.id} update={update} />)}
                            </div>
                        ) : null}

                        {rest.length > 0 ? (
                            <div className="space-y-3">
                                {rest.map((update) => <UpdateCard key={update.id} update={update} />)}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </MemberPageShell>
    );
}
