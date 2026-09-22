import { useSearchParams } from 'react-router-dom';
import { HeaderSection } from '../../components/layout/HeaderSection';
import { FooterSection } from '../../components/layout/FooterSection';
import { GallerySection } from './components/GallerySection';
import { RegionGallery } from './components/RegionGallery';
import { AcrossIndia } from '@/components/shared/AcrossIndia';

/**
 * The gallery, in two modes on one URL.
 *
 * =========================================================================
 * WHY ONE ROUTE AND NOT TWO
 * =========================================================================
 *
 * `/gallery` is the association's own gallery — the chips and the ordering the
 * CMS's gallery settings define, unchanged. `/gallery?state=Andhra Pradesh` is
 * the same photographs, filtered, with Category and Sector dropdowns, a search
 * and paging: what the state pages' "Photo Gallery" link opens.
 *
 * One route because it is one gallery. Two routes would give the site two
 * "Photo Gallery" pages that look different, and the link a visitor was sent
 * would decide which one they got — with nothing on either page explaining the
 * difference.
 *
 * The switch is the presence of a filter in the URL, which is also what makes
 * the filtered view shareable: the mode travels with the link.
 */

const FILTER_KEYS = ['state', 'region', 'category', 'sector', 'q', 'offset'];

export default function GalleryPage() {
    const [params] = useSearchParams();
    const filtered = FILTER_KEYS.some((key) => !!params.get(key));

    return (
        <div className="flex flex-col min-h-screen font-sans bg-white">
            <HeaderSection />
            {filtered ? <RegionGallery /> : <GallerySection />}
            {/* Above the footer, on every content page — see `AcrossIndia`. */}
            <AcrossIndia />

            <FooterSection />
        </div>
    );
}
