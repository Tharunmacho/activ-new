import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Fit the paper to the available screen width; print always uses its real size. */
export default function CertificatePreview({ children, widthMm = 210 }: { children: ReactNode; widthMm?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const resize = () => setScale(Math.min(1, container.clientWidth / (widthMm * 96 / 25.4)));
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        return () => observer.disconnect();
    }, [widthMm]);
    return (
        <div ref={containerRef} className="mx-auto w-full" style={{ maxWidth: `${widthMm}mm` }}>
            <style>{'@media print { .certificate-preview__scale { zoom: 1 !important; } }'}</style>
            <div className="certificate-preview__scale" style={{ zoom: scale }}>{children}</div>
        </div>
    );
}
