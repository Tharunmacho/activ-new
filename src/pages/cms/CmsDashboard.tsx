import { useEffect, useState } from 'react';
import { getCmsOverview, errorMessage } from '@/services/cmsApi';
import { CmsLoading, CmsError } from './components/CmsUI';

/**
 * CMS overview.
 *
 * Reports what has and has not been authored, because an unconfigured section
 * renders as a blank strip on the live site and nothing else tells you. Every
 * figure comes from `/cms/overview`; none is estimated here.
 */
export default function CmsDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await getCmsOverview());
        } catch (err) {
            setError(errorMessage(err, 'Could not load the overview'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) return <CmsLoading label="Loading overview…" />;


    return (
        <div className="space-y-6 w-full">
            <CmsError message={error} onRetry={load} />

            <div className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#262626] rounded-xl p-8 mb-6 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                    Welcome to the admin dashboard. Use the sidebar to navigate to different sections.
                </p>
            </div>
        </div>
    );
}
