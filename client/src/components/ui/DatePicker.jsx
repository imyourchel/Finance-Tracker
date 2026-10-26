import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import { useDismiss, usePopoverPosition } from "./usePopover";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function toYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const parseYMD = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null);

function formatDateID(v) {
    const d = parseYMD(v);
    if (!d || Number.isNaN(d.getTime())) return "";
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// 6 minggu penuh, termasuk tanggal bulan sebelum/sesudah (dengan tanggal yang benar)
function buildCells(year, monthIndex) {
    const first = new Date(year, monthIndex, 1);
    const start = new Date(year, monthIndex, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        return { date: d, current: d.getMonth() === monthIndex };
    });
}

/**
 * Pemilih tanggal bertema. value & onChange memakai format "YYYY-MM-DD".
 * Prop lama (accent, width, placeholder) tetap didukung.
 */
export default function DatePicker({
    value,
    onChange,
    placeholder = "Pilih tanggal",
    accent,
    width = "100%",
    clearable = true,
    min,
    max,
}) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState(() => parseYMD(value) || new Date());
    const triggerRef = useRef(null);
    const panelRef = useRef(null);

    const close = useCallback(() => setOpen(false), []);
    useDismiss(open, [triggerRef, panelRef], close);
    const pos = usePopoverPosition(open, triggerRef, panelRef, { width: 300 });

    const year = view.getFullYear();
    const monthIndex = view.getMonth();
    const cells = buildCells(year, monthIndex);
    const today = toYMD(new Date());
    const selected = value ? String(value).slice(0, 10) : "";

    const openPicker = () => {
        setView(parseYMD(value) || new Date());
        setOpen(true);
    };
    const pick = (d) => {
        onChange(toYMD(d));
        setOpen(false);
        triggerRef.current?.focus();
    };
    const outOfRange = (ymd) => (min && ymd < min) || (max && ymd > max);

    return (
        <div className="dp" style={{ width, "--dp-accent": accent || "var(--accent)" }}>
            <button
                ref={triggerRef}
                type="button"
                className={`field-trigger ${open ? "is-open" : ""}`}
                onClick={() => (open ? setOpen(false) : openPicker())}
                aria-haspopup="dialog"
                aria-expanded={open}
            >
                <FiCalendar className="field-trigger-icon" aria-hidden />
                <span className={`field-trigger-text ${selected ? "" : "is-placeholder"}`}>
                    {selected ? formatDateID(selected) : placeholder}
                </span>
                {clearable && selected && (
                    <span
                        role="button"
                        tabIndex={-1}
                        className="field-trigger-clear"
                        aria-label="Hapus tanggal"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange("");
                        }}
                    >
                        <FiX aria-hidden />
                    </span>
                )}
            </button>

            {open &&
                createPortal(
                    <div
                        ref={panelRef}
                        className={`pop-panel dp-panel pop-${pos.placement}`}
                        style={{ top: pos.top, left: pos.left, width: pos.width, "--dp-accent": accent || "var(--accent)" }}
                        role="dialog"
                        aria-label="Pilih tanggal"
                    >
                        <div className="dp-head">
                            <button
                                type="button"
                                className="pop-icon-btn"
                                onClick={() => setView(new Date(year, monthIndex - 1, 1))}
                                aria-label="Bulan sebelumnya"
                            >
                                <FiChevronLeft />
                            </button>
                            <div className="dp-title">
                                {MONTHS[monthIndex]} {year}
                            </div>
                            <button
                                type="button"
                                className="pop-icon-btn"
                                onClick={() => setView(new Date(year, monthIndex + 1, 1))}
                                aria-label="Bulan berikutnya"
                            >
                                <FiChevronRight />
                            </button>
                        </div>

                        <div className="dp-grid dp-days">
                            {DAY_NAMES.map((d) => (
                                <div key={d}>{d}</div>
                            ))}
                        </div>
                        <div className="dp-grid">
                            {cells.map(({ date, current }) => {
                                const ymd = toYMD(date);
                                const disabled = outOfRange(ymd);
                                return (
                                    <button
                                        key={ymd}
                                        type="button"
                                        disabled={disabled}
                                        className={[
                                            "dp-cell",
                                            current ? "" : "is-outside",
                                            ymd === today ? "is-today" : "",
                                            ymd === selected ? "is-selected" : "",
                                        ].join(" ")}
                                        onClick={() => pick(date)}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pop-foot">
                            {clearable && selected ? (
                                <button
                                    type="button"
                                    className="pop-text-btn"
                                    onClick={() => {
                                        onChange("");
                                        setOpen(false);
                                    }}
                                >
                                    Hapus
                                </button>
                            ) : (
                                <span />
                            )}
                            <button
                                type="button"
                                className="pop-text-btn is-accent"
                                onClick={() => pick(new Date())}
                                disabled={outOfRange(today)}
                            >
                                Hari ini
                            </button>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
