import { useCountUp } from '@/hooks/useCountUp';

/**
 * A figure that counts up the first time it is seen. See `useCountUp` for why
 * it parses rather than assumes a number — these values are authored in the CMS.
 *
 * `tabular-nums` is not optional here. Counting through proportional digits
 * changes the width of the element on almost every frame, which shoves whatever
 * sits beside it left and right for the length of the animation. Fixed-width
 * figures make the number change without the layout moving at all.
 */
export function CountUp({ value, className = '' }: { value: string; className?: string }) {
    const { ref, display } = useCountUp(value);
    return (
        <span
            ref={ref as React.RefObject<HTMLSpanElement>}
            className={`tabular-nums ${className}`}
        >
            {display}
        </span>
    );
}

export default CountUp;
