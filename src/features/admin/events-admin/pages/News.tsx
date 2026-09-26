import NewsManager from '@/pages/cms/NewsManager';
import ContentShell from './ContentShell';

/** The newsroom at /news — the CMS's own editor. */
export default function EventsAdminNews() {
    return (
        <ContentShell
            title="News"
            subtitle="National, state and district news for the newsroom. Save as Draft until a story is ready to publish."
        >
            <NewsManager />
        </ContentShell>
    );
}
