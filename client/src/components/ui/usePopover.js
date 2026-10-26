import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Posisi popover (fixed) yang menempel ke elemen pemicu.
 * Otomatis pindah ke atas kalau ruang di bawah tidak cukup,
 * dan tidak keluar dari layar di kiri/kanan.
 */
export function usePopoverPosition(open, anchorRef, panelRef, { width, matchWidth = false, gap = 8 } = {}) {
    const [pos, setPos] = useState({ top: -9999, left: -9999, width, placement: "bottom" });

    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const a = anchorRef.current?.getBoundingClientRect();
            if (!a) return;
            const w = matchWidth ? Math.max(a.width, width || 0) : width || a.width;
            const h = panelRef.current?.offsetHeight || 0;
            const spaceBelow = window.innerHeight - a.bottom - gap;
            const spaceAbove = a.top - gap;
            const up = h > spaceBelow && spaceAbove > spaceBelow;
            const top = up ? Math.max(8, a.top - h - gap) : a.bottom + gap;
            const left = Math.min(Math.max(8, a.left), window.innerWidth - w - 8);
            setPos({ top, left, width: w, placement: up ? "top" : "bottom" });
        };
        place();
        const raf = requestAnimationFrame(place);
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [open, anchorRef, panelRef, width, matchWidth, gap]);

    return pos;
}

/** Tutup popover saat klik di luar atau tekan Esc. */
export function useDismiss(open, refs, onClose) {
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (refs.some((r) => r.current?.contains(e.target))) return;
            onClose();
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener("pointerdown", onDown, true);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("pointerdown", onDown, true);
            document.removeEventListener("keydown", onKey, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, onClose]);
}
