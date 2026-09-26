import GalleryManager from '@/pages/cms/GalleryManager';
import ContentShell from './ContentShell';

/** The public gallery's albums and photographs — the CMS's own editor. */
export default function EventsAdminGallery() {
    return (
        <ContentShell
            title="Gallery"
            subtitle="Albums and photographs from the association's events. Hide a photo to take it off the public gallery without deleting it."
        >
            <GalleryManager />
        </ContentShell>
    );
}
