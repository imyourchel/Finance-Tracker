import { useEffect, useState } from "react";

const reduced = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Angka yang "menghitung naik" saat slide muncul. */
export default function CountUp({ value = 0, format = (n) => n, duration = 1100, delay = 150 }) {
    const [shown, setShown] = useState(() => (reduced() ? value : 0));

    useEffect(() => {
        if (reduced()) return undefined;
        let raf;
        let start;
        const step = (ts) => {
            if (start === undefined) start = ts + delay;
            const p = Math.max(0, Math.min(1, (ts - start) / duration));
            const eased = 1 - (1 - p) ** 3;
            setShown(value * eased);
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, duration, delay]);

    return <>{format(Math.round(shown))}</>;
}
