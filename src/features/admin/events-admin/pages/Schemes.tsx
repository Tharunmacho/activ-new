import SchemesManager from '@/pages/cms/SchemesManager';
import ContentShell from './ContentShell';

/** Central, state and district schemes at /schemes — the CMS's own editor. */
export default function EventsAdminSchemes() {
    return (
        <ContentShell
            title="Schemes"
            subtitle="Central, state and district schemes members can benefit from. Save as Draft until the details are confirmed."
        >
            <SchemesManager />
        </ContentShell>
    );
}
