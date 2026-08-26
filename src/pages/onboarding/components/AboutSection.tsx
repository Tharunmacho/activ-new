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

    useEffect(() => {
        let cancelled = false;
        getHome()
            .then((home) => { if (!cancelled) setAbout(home.about); })
            .catch(() => { if (!cancelled) setAbout(null); });
        return () => { cancelled = true; };
    }, []);

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
