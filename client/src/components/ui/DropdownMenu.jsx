import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function DropdownMenu({
    label,
    value,
    options,
    onChange,
    minWidth = "150px",
    width,
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const selectedLabel = useMemo(() => {
        const found = options.find(
            (opt) => String(opt.value) === String(value),
        );
        return found?.label || "-";
    }, [options, value]);

    const [menuPos, setMenuPos] = useState(null);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("click", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("click", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        const btn = rootRef.current?.querySelector("button");
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        setMenuPos({
            top: rect.bottom + 8,
            right: window.innerWidth - rect.right,
            width: rect.width,
        });

        const update = () => {
            const r = btn.getBoundingClientRect();
            setMenuPos({
                top: r.bottom + 8,
                right: window.innerWidth - r.right,
                width: r.width,
            });
        };
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open]);

    return (
        <div
            ref={rootRef}
            style={{ position: "relative", width: width || "auto" }}
        >
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={open}
                style={{
                    width: width || "100%",
                    minWidth: width ? width : minWidth,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1.5px solid var(--app-border)",
                    backgroundColor: "var(--app-surface)",
                    color: "var(--app-text-strong)",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                }}
            >
                <span>
                    {label ? `${label}: ${selectedLabel}` : selectedLabel}
                </span>
                <span style={{ color: "var(--app-muted)", fontSize: "12px" }}>
                    ▾
                </span>
            </button>

            {open &&
                menuPos &&
                createPortal(
                    <div
                        role="menu"
                        style={{
                            position: "fixed",
                            top: menuPos.top,
                            right: menuPos.right,
                            width: width || menuPos.width,
                            boxSizing: "border-box",
                            maxHeight: "260px",
                            overflowY: "auto",
                            borderRadius: "12px",
                            border: "1px solid var(--app-border)",
                            backgroundColor: "var(--app-surface)",
                            boxShadow: "var(--app-card-shadow)",
                            padding: "6px",
                            zIndex: 9999,
                        }}
                    >
                        {options.map((opt) => {
                            const active = String(opt.value) === String(value);
                            return (
                                <button
                                    key={String(opt.value)}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        onChange(opt.value);
                                        setOpen(false);
                                    }}
                                    style={{
                                        width: "100%",
                                        textAlign: "left",
                                        padding: "8px 10px",
                                        borderRadius: "8px",
                                        border: "none",
                                        backgroundColor: active
                                            ? "var(--accent-bg)"
                                            : "transparent",
                                        color: active
                                            ? "var(--accent)"
                                            : "var(--app-text-strong)",
                                        fontSize: "13px",
                                        fontWeight: active ? "700" : "500",
                                        cursor: "pointer",
                                    }}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
