import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function buildCalendarCells(year, monthIndex) {
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevMonthDays = new Date(year, monthIndex, 0).getDate();
    const cells = [];

    for (let i = firstDay - 1; i >= 0; i -= 1) {
        cells.push({ day: prevMonthDays - i, current: false, filler: false });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
        cells.push({ day: d, current: true, filler: false });
    }
    while (cells.length % 7 !== 0) {
        cells.push({ day: 0, current: false, filler: true });
    }
    return cells;
}

export default function DatePicker({
    value,
    onChange,
    placeholder,
    accent = "#7c3aed",
    width = "209px",
}) {
    const [open, setOpen] = useState(false);
    const [viewDate, setViewDate] = useState(() =>
        value ? new Date(`${value}T00:00:00`) : new Date(),
    );
    const triggerRef = useRef(null);
    const portalRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });

    useEffect(() => {
        if (value) setViewDate(new Date(`${value}T00:00:00`));
    }, [value]);

    useLayoutEffect(() => {
        if (!open) return;
        const update = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const maxWidth = Math.min(320, window.innerWidth - 16);
            let left = rect.left;
            if (left + maxWidth > window.innerWidth - 8) {
                left = window.innerWidth - maxWidth - 8;
            }
            
            const calendarHeight = portalRef.current?.offsetHeight || 350;
            let top = rect.bottom + 8;
            
            // Cek apakah melebihi tinggi layar
            if (top + calendarHeight > window.innerHeight) {
                const spaceAbove = rect.top - 8;
                const spaceBelow = window.innerHeight - rect.bottom - 8;
                // Pilih area yang memiliki ruang lebih luas
                if (spaceAbove > spaceBelow) {
                    top = Math.max(8, rect.top - calendarHeight - 8);
                }
            }

            setPos({
                top,
                left: Math.max(8, left),
                width: maxWidth,
            });
        };
        update();
        const handle = requestAnimationFrame(update);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            cancelAnimationFrame(handle);
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open]);

    useEffect(() => {
        const onDocClick = (e) => {
            if (
                triggerRef.current?.contains(e.target) ||
                portalRef.current?.contains(e.target)
            )
                return;
            setOpen(false);
        };
        const onEsc = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDocClick);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDocClick);
            document.removeEventListener("keydown", onEsc);
        };
    }, []);

    const year = viewDate.getFullYear();
    const monthIndex = viewDate.getMonth();
    const monthLabel = viewDate.toLocaleString("en-US", { month: "long" });
    const cells = buildCalendarCells(year, monthIndex);
    const today = toYMD(new Date());

    const selectDate = (date) => {
        onChange(toYMD(date));
        setOpen(false);
    };

    const calendar = (
        <div
            ref={portalRef}
            data-calendar-portal
            style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                zIndex: 10000,
                width: pos.width,
                maxWidth: "90vw",
                backgroundColor: "var(--app-surface)",
                border: "1px solid var(--app-border)",
                borderRadius: 16,
                boxShadow: "0 20px 50px rgba(0,0,0,0.24)",
                padding: 14,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                }}
            >
                <button
                    type="button"
                    onClick={() =>
                        setViewDate(new Date(year, monthIndex - 1, 1))
                    }
                    style={navBtn}
                >
                    ←
                </button>
                <div
                    style={{ fontWeight: 800, color: "var(--app-text-strong)" }}
                >
                    {monthLabel} {year}
                </div>
                <button
                    type="button"
                    onClick={() =>
                        setViewDate(new Date(year, monthIndex + 1, 1))
                    }
                    style={navBtn}
                >
                    →
                </button>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 6,
                    marginBottom: 8,
                }}
            >
                {DAY_NAMES.map((d) => (
                    <div
                        key={d}
                        style={{
                            textAlign: "center",
                            fontSize: 11,
                            color: "var(--app-muted)",
                            fontWeight: 700,
                        }}
                    >
                        {d}
                    </div>
                ))}
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 6,
                }}
            >
                {cells.map((cell, index) => {
                    if (cell.filler) return <div key={`f-${index}`} />;
                    const cellDate = new Date(year, monthIndex, cell.day);
                    const selected = value === toYMD(cellDate);
                    const isToday = toYMD(cellDate) === today;
                    return (
                        <button
                            key={`${cell.current ? "c" : "p"}-${cell.day}-${index}`}
                            type="button"
                            onClick={() => selectDate(cellDate)}
                            style={{
                                height: 36,
                                borderRadius: 10,
                                border: selected
                                    ? "none"
                                    : `1px solid ${isToday ? accent : "transparent"}`,
                                backgroundColor: selected
                                    ? accent
                                    : isToday
                                      ? `${accent}15`
                                      : "transparent",
                                color: selected
                                    ? "white"
                                    : "var(--app-text-strong)",
                                cursor: "pointer",
                                fontWeight: selected ? 800 : 600,
                            }}
                        >
                            {cell.day}
                        </button>
                    );
                })}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 12,
                }}
            >
                <button
                    type="button"
                    onClick={() => {
                        onChange("");
                        setOpen(false);
                    }}
                    style={{ ...navBtn, width: "auto", padding: "8px 12px" }}
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={() => selectDate(new Date())}
                    style={{ ...navBtn, width: "auto", padding: "8px 12px" }}
                >
                    Today
                </button>
            </div>
        </div>
    );

    return (
        <div style={{ position: "relative", width }}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((p) => !p)}
                style={{
                    width: "100%",
                    border: "1.5px solid var(--app-border)",
                    borderRadius: "12px",
                    backgroundColor: "var(--app-surface)",
                    padding: "10px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    color: value
                        ? "var(--app-text-strong)"
                        : "var(--app-muted)",
                    textAlign: "left",
                }}
            >
                <div
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${accent}18`,
                        color: accent,
                        flexShrink: 0,
                        fontSize: 16,
                    }}
                >
                    📅
                </div>
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            fontSize: 12,
                            color: "var(--app-muted)",
                            marginBottom: 2,
                        }}
                    >
                        {placeholder}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {value || "Pilih tanggal"}
                    </div>
                </div>
                <div style={{ color: "var(--app-muted)" }}>▾</div>
            </button>
            {open && createPortal(calendar, document.body)}
        </div>
    );
}

const navBtn = {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--app-border)",
    backgroundColor: "var(--app-surface-soft)",
    color: "var(--app-text-strong)",
    cursor: "pointer",
    fontWeight: 800,
};
