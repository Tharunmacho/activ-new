import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { sizedMediaUrl } from '@/config/api.config';

/**
 * ============================================================================
 * THE WHOLE PHOTOGRAPH, IN A FRAME THAT DOES NOT CHANGE SHAPE
 * ============================================================================
 *
 * Every picture of a person on the public site goes through this, and there
 * were nine separate copies of it before: the leadership card, the region
 * panel, the state dashboard's four lists, the contact strip, the detail page.
 * Each one wrote `object-cover object-top` on the reasoning that a formal
 * head-and-shoulders portrait puts the head in the top third, so a centred
 * crop of one returns a tie.
 *
 * THE ASSOCIATION DOES NOT SEND FORMAL PORTRAITS. It sends the photograph of
 * the person that exists — a phone picture, a face off-centre, something
 * wider than it is tall, a group shot with one person in it. `cover` on one of
 * those throws away whatever does not fit the frame's shape, and `object-top`
 * makes it worse on the common case: a landscape photograph aligned to its top
 * edge loses the chin, which is the one part of a face a reader checks.
 *
 * The editor could not see any of this coming either. They upload a picture,
 * the CMS shows it whole, and the site shows two thirds of it.
 *
 * ---------------------------------------------------------------- the rule
 *
 * The FRAME keeps its shape, always — 4:5 on the leadership cards, 3:4 in the
 * lists, 4:3 on the wide ones. A grid whose cells change shape per upload is
 * not a grid, and the alignment work those ratios represent is not something
 * to spend on a photograph nobody chose carefully.
 *
 * The PICTURE is contained inside it. All of it, whatever shape it is.
 *
 * What fills the rest is a blurred, scaled copy of the same picture. That
 * detail is load-bearing: bars of flat grey beside a portrait read as an image
 * that failed to load, and every card on the page would carry them. The same
 * image out of focus behind itself reads as depth, in the subject's own
 * colours, and needs nobody to choose a background per person.
 *
 * `aria-hidden` on the backdrop, and an empty `alt`. It is one photograph
 * drawn twice; a screen reader announcing the chairman's name twice is this
 * decision leaking somewhere it has no business being.
 */
export function PersonPhoto({
    url, name, width = 400, imgClassName = '', fallbackSize = 28,
}: {
    url?: string | null;
    /** Used as the alt text. A photograph of a person is never decorative. */
    name?: string | null;
    /** The width to request from the media server, in device pixels. */
    width?: number;
    /** Anything the call site adds to the picture itself — a hover transform. */
    imgClassName?: string;
    fallbackSize?: number;
}) {
    /*
     * ======================================================================
     * A PHOTOGRAPH THAT DOES NOT LOAD IS A PHOTOGRAPH THAT IS NOT THERE
     * ======================================================================
     *
     * `photoUrl` is free text an editor pasted, and it points at somebody
     * else’s server. It can 404 today, or in a year when the image is moved,
     * and the browser then draws its broken-image glyph — a torn page icon
     * with the alt text beside it, in the middle of a leadership board.
     *
     * That reads as a broken SITE. The silhouette below reads as a person
     * whose photograph has not been supplied, which is the truth and is what
     * the card already shows for a leader with no `photoUrl` at all. Two ways
     * of having no photograph, drawn one way.
     *
     * Reset on `url`, so an editor replacing a broken link sees the new
     * picture without a reload.
     */
    const [broken, setBroken] = useState(false);
    useEffect(() => { setBroken(false); }, [url]);

    if (!url || broken) {
        return (
            <span className="flex h-full w-full items-center justify-center text-gray-300">
                <User size={fallbackSize} />
            </span>
        );
    }

    return (
        /* Its own positioned box, so a call site's frame needs no `relative`
           added to it — nine frames each remembering to is nine chances for
           the backdrop to escape to the nearest positioned ancestor. */
        <span className="relative block h-full w-full overflow-hidden">
            <img
                src={sizedMediaUrl(url, width)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl saturate-150"
            />
            <img
                src={sizedMediaUrl(url, width)}
                alt={name || 'Photograph'}
                loading="lazy"
                decoding="async"
                /* Only the foreground reports. The backdrop is the same file,
                   so it fails at the same moment and a second handler would
                   set the same flag twice. */
                onError={() => setBroken(true)}
                className={`relative h-full w-full object-contain ${imgClassName}`}
            />
        </span>
    );
}
