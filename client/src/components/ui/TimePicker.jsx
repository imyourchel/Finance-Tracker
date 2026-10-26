import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiClock } from "react-icons/fi";
import { useDismiss, usePopoverPosition } from "./usePopover";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const PRESETS = ["07:00", "12:00", "19:00", "21:00"];

/** Pemilih jam bertema. value & onChange memakai format "HH:MM". */
export default function TimePicker({
    value,
    onChange,
    placeholder = "Pilih jam",
    width = "100%",
}) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const hourCol = useRef(null);
    const minCol = useRef(null);

    const close = useCallback(() => setOpen(false), []);
    useDismiss(open, [triggerRef, panelRef], close);
    const pos = usePopoverPosition(open, triggerRef, panelRef, { width: 236 });

    const [hh, mm] = (value || "").split(":");
    const minutes = mm && !MINUTES.includes(mm) ? [...MINUTES, mm].sort() : MINUTES;

    // Gulir ke jam/menit terpilih saat dibuka
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => {
            [hourCol, minCol].forEach((col) => {
                const el = col.current?.querySelector(".is-selected");
                if (el) col.current.scrollTop = el.offsetTop - col.current.clientHeight / 2 + el.clientHeight / 2;
            });
        });
        return () => cancelAnimationFrame(id);
    }, [open]);

    const set = (h, m) => onChange(`${h ?? hh ?? "00"}:${m ?? mm ?? "00"}`);

    return (
        <div className="tp" style={{ width }}>
            <button
                ref={triggerRef}
                type="button"
                className={`field-trigger ${open ? "is-open" : ""}`}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <FiClock className="field-trigger-icon" aria-hidden />
                <span className={`field-trigger-text ${value ? "" : "is-placeholder"}`}>
                    {value || placeholder}
                </span>
            </button>

            {open &&
                createPortal(
                    <div
                        ref={panelRef}
                        className={`pop-panel tp-panel pop-${pos.placement}`}
                        style={{ top: pos.top, left: pos.left, width: pos.width }}
                        role="dialog"
                        aria-label="Pilih jam"
                    >
                        <div className="tp-cols">
                            <div>
                                <div className="tp-col-label">Jam</div>
                                <div className="tp-col" ref={hourCol}>
                                    {HOURS.map((h) => (
                                        <button
                                            key={h}
                                            type="button"
                                            className={`tp-item ${h === hh ? "is-selected" : ""}`}
                                            onClick={() => set(h, undefined)}
                                        >
                                            {h}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="tp-sep">:</div>
                            <div>
                                <div className="tp-col-label">Menit</div>
                                <div className="tp-col" ref={minCol}>
                                    {minutes.map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            className={`tp-item ${m === mm ? "is-selected" : ""}`}
                                            onClick={() => set(undefined, m)}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="tp-presets">
                            {PRESETS.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    className={`tp-chip ${p === value ? "is-selected" : ""}`}
                                    onClick={() => onChange(p)}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <div className="pop-foot">
                            <span />
                            <button
                                type="button"
                                className="pop-text-btn is-accent"
                                onClick={() => {
                                    setOpen(false);
                                    triggerRef.current?.focus();
                                }}
                            >
                                Selesai
                            </button>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
