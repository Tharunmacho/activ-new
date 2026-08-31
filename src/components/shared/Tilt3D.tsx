import { useCallback, useRef, useState, type ReactNode } from 'react';

/**
 * A card that tilts in 3D toward the pointer, with a specular highlight that
 * tracks the same position.
 *
 * This is the depth primitive the public pages share, the counterpart to
 * `Reveal`: `Reveal` gives a section its entrance, this gives a card its
 * substance once it is on screen. Before both, every block on the site was a
 * flat rectangle painted at full opacity, and a page of them read as a
 * document rather than as a product.
 *
 * Four decisions carry most of the weight here:
 *
 * NOTHING GOES THROUGH REACT STATE. A pointer move fires up to 120 times a
 * second, and a `setState` per event re-renders the card — and its children —
 * on every one of them. The transform is written straight onto the node through
 * a ref inside a `requestAnimationFrame`, so a burst of pointer events collapses
 * into one write per frame and React never re-renders at all. The only state on
 * this component is the boolean for whether the pointer is inside, which
 * changes twice per hover rather than a hundred times.
 *
 * TOUCH GETS NOTHING. A tilt driven by pointer position has no meaning on a
 * touchscreen: the first `pointerdown` would snap the card to a tilt and leave
 * it there until the next tap somewhere else, which reads as a rendering bug
 * rather than as an effect. `(hover: hover)` is the honest test — it asks
 * whether the device can hover at all, not how wide the screen is, so a
 * touchscreen laptop and a phone are treated correctly and a narrow desktop
 * window still tilts.
 *
 * REDUCED MOTION IS NOT A SMALLER TILT, IT IS NO TILT. Someone who has asked
 * their OS for less motion gets a completely static card. The check matches
 * `Reveal`'s so the two never disagree about whether a page is animating.
 *
 * ONLY `transform` AND `opacity` ARE ANIMATED. Both are composited: none of
 * this triggers layout or repaints the section underneath, which is what keeps
 * a grid of twenty tilting cards costing about as much as twenty static ones.
 */

/** Does this device have a real pointer that can hover? */
const canHover = (): boolean => {
    try {
        return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch {
        // Non-DOM environment: assume not, so the static card is the fallback.
        return false;
    }
};

const prefersReducedMotion = (): boolean => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

interface Props {
    children: ReactNode;
    /**
     * Maximum tilt in degrees at the corners. Keep it small — past about 14deg
     * the near edge of a card grows enough to overlap its neighbour in a grid,
     * and text on the far edge starts to lose its hinting.
     */
    intensity?: number;
    /** Scale applied while hovered. 1 disables the lift. */
    lift?: number;
    /** Draw the moving specular highlight. Off for cards that are mostly photo. */
    glare?: boolean;
    className?: string;
    /**
     * Perspective distance. Lower is a wider-angle lens and a stronger effect;
     * below ~600px a card in a grid starts to look fish-eyed.
     */
    perspective?: number;
}

export function Tilt3D({
    children,
    intensity = 9,
    lift = 1.03,
    glare = true,
    className = '',
    perspective = 900,
}: Props) {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const glareRef = useRef<HTMLDivElement | null>(null);
    const frame = useRef<number | null>(null);

    /*
     * Read both media queries once, on first render. Re-reading per render puts
     * a layout query in the render path, and neither setting meaningfully
     * changes mid-visit.
     */
    const [enabled] = useState<boolean>(() => canHover() && !prefersReducedMotion());
    const [hovered, setHovered] = useState(false);

    const handleMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!enabled) return;

            const node = innerRef.current;
            if (!node) return;

            // Read geometry in the handler, write in the frame: doing both in
            // the frame would interleave a read after every write and force a
            // synchronous layout on each one.
            const rect = node.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            // -0.5 at one edge, +0.5 at the other.
            const px = (event.clientX - rect.left) / rect.width - 0.5;
            const py = (event.clientY - rect.top) / rect.height - 0.5;

            if (frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                const el = innerRef.current;
                if (!el) return;

                // Y follows horizontal travel, X is inverted so pushing the
                // pointer down tips the top of the card away from the viewer —
                // the direction a physical panel would move.
                el.style.transform =
                    `perspective(${perspective}px) ` +
                    `rotateX(${(-py * intensity).toFixed(2)}deg) ` +
                    `rotateY(${(px * intensity).toFixed(2)}deg) ` +
                    `scale3d(${lift}, ${lift}, 1)`;

                const sheen = glareRef.current;
                if (sheen) {
                    sheen.style.backgroundImage =
                        `radial-gradient(38rem circle at ${((px + 0.5) * 100).toFixed(1)}% ` +
                        `${((py + 0.5) * 100).toFixed(1)}%, rgb(255 255 255 / 0.55), transparent 42%)`;
                }
            });
        },
        [enabled, intensity, lift, perspective],
    );

    const handleEnter = useCallback(() => {
        if (enabled) setHovered(true);
    }, [enabled]);

    const handleLeave = useCallback(() => {
        if (!enabled) return;
        setHovered(false);

        if (frame.current !== null) {
            cancelAnimationFrame(frame.current);
            frame.current = null;
        }
        const el = innerRef.current;
        // Clearing the property rather than writing an identity transform lets
        // the CSS transition below carry it home, and leaves no inline style
        // behind to fight the next hover.
        if (el) el.style.transform = '';
    }, [enabled]);

    return (
        <div
            className={className}
            onPointerMove={handleMove}
            onPointerEnter={handleEnter}
            onPointerLeave={handleLeave}
            style={{ perspective: `${perspective}px` }}
        >
            <div
                ref={innerRef}
                className="relative h-full w-full"
                style={{
                    transformStyle: 'preserve-3d',
                    /*
                     * Long and eased on the way out, short on the way in. A
                     * single duration either makes the card lag the pointer
                     * while hovered or snap back the instant it leaves; the
                     * settle is the part that should be watchable.
                     */
                    transition: hovered
                        ? 'transform 120ms ease-out'
                        : 'transform 620ms cubic-bezier(0.16, 1, 0.3, 1)',
                    // Promoted only while hovered: a permanent layer per card is
                    // memory a grid of twenty never gets back.
                    willChange: hovered ? 'transform' : undefined,
                }}
            >
                {children}

                {glare && enabled && (
                    <div
                        ref={glareRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
                        style={{
                            opacity: hovered ? 1 : 0,
                            transition: 'opacity 380ms ease-out',
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default Tilt3D;
