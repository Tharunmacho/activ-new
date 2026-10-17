import { ArrowUpRight, FileText, Link2 } from 'lucide-react';
import type { NewsArticle } from '@/services/cmsNewsApi';
import { newsDocumentHref, newsFileSize, newsLinkHref } from '@/lib/newsContent';

/** Explicit links keep public documents and videos usable without embedded third-party scripts. */
export function NewsResources({ article }: { article: Partial<NewsArticle> }) {
    const documents = (article.attachments || []).map(file => ({ ...file, href: newsDocumentHref(file?.url) })).filter(file => file.href);
    const links = (article.links || []).map(link => ({ ...link, href: newsLinkHref(link?.url) })).filter(link => link.href);
    const card = 'flex min-h-14 min-w-0 items-center gap-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 text-brand-800 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600';
    return <div className="space-y-8">
        {documents.length > 0 && <section aria-label="News documents" className="mt-8">
            <h2 className="mb-4 text-xl font-bold text-brand-900">Documents</h2>
            <div className="space-y-3">{documents.map((file, index) => <a key={`${file.url}-${index}`} href={file.href} target="_blank" rel="noopener noreferrer" className={card}>
                <FileText size={22} className="shrink-0" />
                <span className="min-w-0 flex-1"><span className="block break-words font-semibold">{file.label || file.filename || `Document ${index + 1}`}</span>
                    <span className="mt-1 block break-words text-sm text-slate-600">{[file.filename, newsFileSize(file.size), 'Opens in a new tab'].filter(Boolean).join(' · ')}</span></span>
                <ArrowUpRight size={18} className="shrink-0" />
            </a>)}</div>
        </section>}
        {links.length > 0 && <section aria-label="News related links" className="mt-8">
            <h2 className="mb-4 text-xl font-bold text-brand-900">Useful links</h2>
            <div className="space-y-3">{links.map((link, index) => <a key={`${link.url}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer" className={card}>
                <Link2 size={22} className="shrink-0" /><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{link.label || new URL(link.href).hostname}</span><span className="mt-1 block break-all text-sm text-slate-600">{new URL(link.href).hostname} · Opens in a new tab</span></span><ArrowUpRight size={18} className="shrink-0" />
            </a>)}</div>
        </section>}
    </div>;
}
