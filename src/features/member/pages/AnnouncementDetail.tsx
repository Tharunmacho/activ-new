import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Pin, Paperclip, Megaphone, Download } from 'lucide-react';
import MemberPageShell from '@/pages/member/MemberPageShell';
import { EmptyState, RowsSkeleton } from '@/features/member/components/MemberUI';
import { CATEGORY_STYLE } from '@/features/member/components/UpdateCard';
import { formatDate } from '@/features/member/components/eventFormat';
import { getAnnouncement, type Announcement } from '@/services/memberHubApi';
import { errorMessage } from '@/services/activApi';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * One Association Update, in full.
 *
 * The body is rendered as HTML because the CMS editor is a rich-text one and
 * the association writes notices with headings, lists and links in them. The
 * markup is sanitised on the SERVER — `richText.js` runs over everything the
 * CMS stores — which is where it has to happen: sanitising here would protect
 * this one component and nothing else that reads the same field, and the mobile
 * app reads it too.
 *
 * No sidebar-less shell: this is a place a member navigates TO, not a step they
 * are working through, so the rail stays.
 */
export default function AnnouncementDetail() {
    const { id = '' } = useParams();
    const navigate = useNavigate();

    const [update, setUpdate] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        getAnnouncement(id)
            .then((row) => { if (!cancelled) setUpdate(row); })
            .catch((err) => {
                if (!cancelled) setError(errorMessage(err, 'Could not open this update'));
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [id]);

    const style = update ? (CATEGORY_STYLE[update.category] || CATEGORY_STYLE.general) : null;
    const banner = resolveMediaUrl(update?.bannerUrl);
    const attachment = resolveMediaUrl(update?.attachmentUrl);

    return (
        <MemberPageShell
            title={update?.title || 'Update'}
            subtitle="Association Updates"
            width="narrow"
            actions={
                <button
                    type="button"
                    onClick={() => navigate('/member/updates')}
                    className="text-[0.8125rem] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                >
                    All updates
                </button>
            }
        >
            {loading ? (
                <RowsSkeleton rows={5} />
            ) : error || !update ? (
                <EmptyState
                    icon={<Megaphone className="w-6 h-6" />}
                    title="This update is not available"
                    detail={error || 'It may have been withdrawn, or it was never for your region.'}
                />
            ) : (
                <article className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {banner ? (
                        <div className="w-full bg-slate-100">
                            {/*
                              * Not cropped to a band. An update banner is often
                              * a scanned circular or a poster, where the text is
                              * the content — a fixed-height strip shows the top
                              * inch of it and nothing readable.
                              */}
                            <img
                                src={banner}
                                alt={update.bannerAlt || ''}
                                className="w-full h-auto max-h-[32.5rem] object-contain mx-auto"
                            />
                        </div>
                    ) : null}

                    <div className="p-5 lg:p-7">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            {style ? (
                                <span className={`text-[0.65625rem] font-bold uppercase tracking-wide px-2 py-0.5
                                                  rounded-full ${style.cls}`}>
                                    {style.label}
                                </span>
                            ) : null}

                            {update.pinned ? (
                                <span className="inline-flex items-center gap-1 text-[0.65625rem] font-bold
                                                 uppercase tracking-wide text-blue-700">
                                    <Pin className="w-3 h-3" /> Pinned
                                </span>
                            ) : null}

                            <span className="text-[0.75rem] text-slate-400">
                                {formatDate(update.publishedAt)}
                            </span>
                        </div>

                        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 leading-tight">
                            {update.title}
                        </h1>

                        {update.targetLabel ? (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.78125rem] text-slate-500">
                                <MapPin className="w-3.5 h-3.5" />
                                For {update.targetLabel}
                            </p>
                        ) : (
                            <p className="mt-2 text-[0.78125rem] text-slate-500">For all members</p>
                        )}

                        {update.summary ? (
                            <p className="mt-4 text-[0.9375rem] text-slate-700 leading-relaxed font-medium">
                                {update.summary}
                            </p>
                        ) : null}

                        {update.body ? (
                            <div
                                className="mt-4 text-[0.90625rem] text-slate-700 leading-relaxed
                                           [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                                           [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                                           [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-5 [&_h2]:mb-2
                                           [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-4 [&_h3]:mb-2
                                           [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold"
                                // Sanitised server-side by `richText.js` — see the
                                // note at the top of this file for why not here.
                                dangerouslySetInnerHTML={{ __html: update.body }}
                            />
                        ) : null}

                        {attachment ? (
                            <a
                                href={attachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-6 inline-flex items-center justify-between gap-3 w-full sm:w-auto
                                           p-4 rounded-xl border border-slate-200 hover:border-blue-400
                                           hover:bg-blue-50 transition-colors"
                            >
                                <span className="flex items-center gap-3 min-w-0">
                                    <span className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 shrink-0
                                                     flex items-center justify-center">
                                        <Paperclip className="w-5 h-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-slate-900 truncate">
                                            {update.attachmentLabel || 'Attachment'}
                                        </span>
                                        <span className="block text-xs text-slate-500">Opens in a new tab</span>
                                    </span>
                                </span>
                                <Download className="w-5 h-5 text-blue-500 shrink-0" />
                            </a>
                        ) : null}
                    </div>
                </article>
            )}
        </MemberPageShell>
    );
}
