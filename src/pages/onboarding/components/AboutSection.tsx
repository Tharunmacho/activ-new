import { useEffect, useState } from 'react';
import { getHome, type HomeAbout } from '@/services/cmsApi';
import { AboutBlock } from '@/components/shared/AboutBlock';

/**
 * The About block on the home page.
 *
 * Its content is `home.about` — a different document from the dedicated About
 * page, deliberately: the two render the same layout but say different things,
 * and editing one must not overwrite the other. The layout itself lives in
 * `AboutBlock`, which both call.
 */
export function AboutSection() {
    const [about, setAbout] = useState<HomeAbout | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getHome()
            .then((home) => { if (!cancelled) { setAbout(home.about); setIsLoading(false); } })
            .catch(() => { if (!cancelled) { setAbout(null); setIsLoading(false); } });
        return () => { cancelled = true; };
    }, []);

    if (isLoading) {
        return (
            <div className="w-full py-24 bg-white">
                <div className="container mx-auto px-4 md:px-8 max-w-7xl animate-pulse">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-6">
                            <div className="h-8 bg-slate-200 rounded w-32 mb-6"></div>
                            <div className="h-12 bg-slate-200 rounded w-3/4 mb-4"></div>
                            <div className="h-12 bg-slate-200 rounded w-1/2 mb-6"></div>
                            <div className="space-y-3">
                                <div className="h-4 bg-slate-200 rounded w-full"></div>
                                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                                <div className="h-4 bg-slate-200 rounded w-4/5"></div>
                            </div>
                        </div>
                        <div className="relative h-[600px] bg-slate-200 rounded-3xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!about) return null;

    return (
        <AboutBlock
            badgeIcon={about.badgeIcon}
            // `eyebrow` is where documents written before the badge existed put
            // this text; reading both means an older page still renders.
            badgeText={about.badgeText || about.eyebrow}
            heading={about.heading}
            headingHighlight={about.headingHighlight}
            body={about.body}
            bullets={about.bullets}
            media={about.media}
            logoOverlay={about.logoOverlay}
            statsBar={about.statsBar}
        />
    );
}
