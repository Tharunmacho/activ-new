import { useEffect, useState } from 'react';
import { getAbout, type AboutContent } from '@/services/cmsApi';
import { AboutBlock } from '@/components/shared/AboutBlock';

/**
 * The dedicated About page.
 *
 * Reads the `about` document, which is separate from the home page's About
 * block so the two can say different things. The layout is shared — see
 * `AboutBlock`.
 */
export function AboutDetailsSection() {
    const [about, setAbout] = useState<AboutContent | null>(null);

    useEffect(() => {
        let cancelled = false;
        getAbout()
            .then((data) => { if (!cancelled) setAbout(data); })
            .catch(() => { if (!cancelled) setAbout(null); });
        return () => { cancelled = true; };
    }, []);

    if (!about) return null;

    return (
        <AboutBlock
            badgeIcon={about.badgeIcon}
            badgeText={about.badgeText}
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
