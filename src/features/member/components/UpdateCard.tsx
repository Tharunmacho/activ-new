import { Link } from 'react-router-dom';
import { Pin, MapPin, Paperclip } from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';
import type { Announcement, AnnouncementCategory } from '@/services/memberHubApi';
import { formatDate } from './eventFormat';

/**
 * How each category reads, and what colour it carries.
 *
 * A `Record` keyed on the union rather than a lookup with a fallback, so adding
 * a category to the server's enum without adding it here is a TYPE ERROR rather
 * than a grey pill labelled "general" appearing in production. The same
 * argument as `STAGE_ACCENTS` in `applicantStyles.ts`.
 */
export const CATEGORY_STYLE: Record<AnnouncementCategory, { label: string; cls: string }> = {
    general: { label: 'Update', cls: 'bg-slate-100 text-slate-600' },
    notice: { label: 'Notice', cls: 'bg-blue-50 text-blue-700' },
    policy: { label: 'Policy', cls: 'bg-indigo-50 text-indigo-700' },
    scheme: { label: 'Scheme', cls: 'bg-emerald-50 text-emerald-700' },
    achievement: { label: 'Achievement', cls: 'bg-amber-50 text-amber-700' },
    urgent: { label: 'Urgent', cls: 'bg-red-50 text-red-700' },
};

/**
 * One Association Update.
 *
 * The region trail is shown whenever the update was targeted at one. It is the
 * answer to the question a member asks about anything on this feed — "is this
 * for me, or is it for everybody?" — and a block-level notice carries very
 * different weight from a national one.
 */
export default function UpdateCard({
    update,
    compact = false,
}: {
    update: Announcement;
    compact?: boolean;
}) {
    const style = CATEGORY_STYLE[update.category] || CATEGORY_STYLE.general;
    const banner = resolveMediaUrl(update.bannerUrl);

    return (
        <Link
            to={`/member/updates/${update.id}`}
            className="group block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden
                       hover:border-blue-400 hover:shadow-md transition-all"
        >
            {!compact && banner ? (
                <div className="w-full aspect-[16/6] bg-slate-100 overflow-hidden">
                    <img
                        src={banner}
                        alt={update.bannerAlt || ''}
                        loading="lazy"
                        className="w-full h-full object-cover"
                    />
                </div>
            ) : null}

            <div className="p-4 lg:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-[0.65625rem] font-bold uppercase tracking-wide px-2 py-0.5
                                      rounded-full ${style.cls}`}>
                        {style.label}
                    </span>

                    {update.pinned ? (
                        <span className="inline-flex items-center gap-1 text-[0.65625rem] font-bold uppercase
                                         tracking-wide text-blue-700">
                            <Pin className="w-3 h-3" /> Pinned
                        </span>
                    ) : null}

                    {update.targetLabel ? (
                        <span className="inline-flex items-center gap-1 text-[0.6875rem] text-slate-500 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{update.targetLabel}</span>
                        </span>
                    ) : null}

                    <span className="text-[0.6875rem] text-slate-400 ml-auto shrink-0">
                        {formatDate(update.publishedAt)}
                    </span>
                </div>

                <h3 className="text-[0.9375rem] font-bold text-slate-900 leading-snug
                               group-hover:text-blue-700 transition-colors">
                    {update.title}
                </h3>

                {update.summary ? (
                    <p className="text-[0.8125rem] text-slate-600 mt-1.5 leading-relaxed line-clamp-2">
                        {update.summary}
                    </p>
                ) : null}

                {update.attachmentUrl ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-blue-600">
                        <Paperclip className="w-3.5 h-3.5" />
                        {update.attachmentLabel || 'Attachment'}
                    </p>
                ) : null}
            </div>
        </Link>
    );
}
