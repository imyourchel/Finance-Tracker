import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { useDismiss, usePopoverPosition } from "./usePopover";

/**
 * Dropdown pilihan bertema DailyTrack.
 * API sama seperti sebelumnya: label, value, options [{value,label}], onChange, minWidth, width.
 */
export default function DropdownMenu({
    label,
    value,
    options,
    onChange,
    minWidth = "150px",
    width,
    placeholder = "Pilih...",
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const selectedIndex = useMemo(
        () => options.findIndex((o) => String(o.value) === String(value)),
        [options, value],
    );
    const selectedLabel = options[selectedIndex]?.label;

    const close = useCallback(() => setOpen(false), []);
    useDismiss(open, [triggerRef, menuRef], close);
    const pos = usePopoverPosition(open, triggerRef, menuRef, {
        width: 180,
        matchWidth: true,
    });

    const openMenu = () => {
        setActive(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
    };

    const choose = (opt) => {
        onChange(opt.value);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const onKeyDown = (e) => {
        if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
            e.preventDefault();
            openMenu();
            return;
        }
        if (!open) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (options[active]) choose(options[active]);
        } else if (e.key === "Tab") {
            setOpen(false);
        }
    };

    return (
        <div className="dd" style={{ width: width || "auto" }}>
            <button
                ref={triggerRef}
                type="button"
                className={`dd-trigger ${open ? "is-open" : ""}`}
                onClick={() => (open ? setOpen(false) : openMenu())}
                onKeyDown={onKeyDown}
                aria-haspopup="listbox"
                aria-expanded={open}
                style={{
                    width: width || "100%",
                    minWidth: width ? width : minWidth,
                }}
            >
                <span className="dd-value">
                    {label && <span className="dd-label">{label}</span>}
                    <span className={selectedLabel ? "" : "dd-placeholder"}>
                        {selectedLabel || placeholder}
                    </span>
                </span>
                <FiChevronDown className="dd-chevron" aria-hidden />
            </button>

            {open &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="listbox"
                        className={`dd-menu pop-${pos.placement}`}
                        style={{ top: pos.top, left: pos.left, width: pos.width }}
                    >
                        {options.map((opt, i) => {
                            const selected = i === selectedIndex;
                            return (
                                <button
                                    key={String(opt.value)}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={`dd-option ${selected ? "is-selected" : ""} ${i === active ? "is-active" : ""}`}
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(opt)}
                                >
                                    <span>{opt.label}</span>
                                    {selected && <FiCheck aria-hidden />}
                                </button>
                            );
                        })}
                        {options.length === 0 && (
                            <div className="dd-empty">Belum ada pilihan</div>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
