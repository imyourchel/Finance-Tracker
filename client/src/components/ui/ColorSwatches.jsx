import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiPlus } from "react-icons/fi";
import { Saturation, Hue, hsvaToHex, hexToHsva } from "@uiw/react-color";

// Pilihan warna wallet — selaras dengan palet DailyTrack
const WALLET_COLORS = [
    "#1e6e55", // jade
    "#10b981", // hijau
    "#0ea5e9", // biru langit
    "#2563eb", // biru
    "#b8923f", // emas
    "#f97316", // oranye
    "#e11d48", // merah
    "#8b5cf6", // ungu
];

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const normalizeHex = (v) => {
    let h = v.trim().replace(/^#/, "").toLowerCase();
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return `#${h}`;
};

const PICKER_W = 272;

function SatPointer({ left, top, color }) {
    return (
        <div
            className="cp-sat-pointer"
            style={{ left, top, backgroundColor: color }}
        />
    );
}
function HuePointer({ left }) {
    return <div className="cp-hue-pointer" style={{ left }} />;
}

/** Popover pemilih warna kustom (pengganti picker bawaan browser). */
function ColorPopover({ anchorRef, initial, onApply, onClose }) {
    const [hsva, setHsva] = useState(() => ({
        ...hexToHsva(initial || "#1e6e55"),
        a: 1,
    }));
    const [hexText, setHexText] = useState(
        (initial || "#1e6e55").replace("#", "").toUpperCase(),
    );
    const [pos, setPos] = useState({ top: -9999, left: -9999 });
    const panelRef = useRef(null);
    const hex = hsvaToHex(hsva);
    const canEyedrop = typeof window !== "undefined" && "EyeDropper" in window;

    // Posisi popover menempel ke tombol "+", pindah ke atas kalau ruang bawah sempit
    useLayoutEffect(() => {
        const place = () => {
            const a = anchorRef.current?.getBoundingClientRect();
            const p = panelRef.current;
            if (!a || !p) return;
            const h = p.offsetHeight;
            const below = a.bottom + 10;
            const top =
                below + h > window.innerHeight - 12
                    ? Math.max(12, a.top - h - 10)
                    : below;
            const left = Math.min(
                Math.max(12, a.left + a.width / 2 - PICKER_W / 2),
                window.innerWidth - PICKER_W - 12,
            );
            setPos({ top, left });
        };
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [anchorRef]);

    // Tutup dengan Esc atau klik di luar
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
        };
        const onDown = (e) => {
            if (
                !panelRef.current?.contains(e.target) &&
                !anchorRef.current?.contains(e.target)
            )
                onClose();
        };
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerdown", onDown, true);
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.removeEventListener("pointerdown", onDown, true);
        };
    }, [anchorRef, onClose]);

    const updateFromHsva = (next) => {
        setHsva(next);
        setHexText(hsvaToHex(next).replace("#", "").toUpperCase());
    };

    const handleHexInput = (v) => {
        const clean = v.replace(/[^0-9a-f]/gi, "").slice(0, 6);
        setHexText(clean.toUpperCase());
        if (HEX_RE.test(clean)) setHsva({ ...hexToHsva(normalizeHex(clean)), a: 1 });
    };

    const eyedrop = async () => {
        try {
            const res = await new window.EyeDropper().open();
            updateFromHsva({ ...hexToHsva(res.sRGBHex), a: 1 });
        } catch {
            /* dibatalkan user */
        }
    };

    return createPortal(
        <div
            ref={panelRef}
            className="cp-panel"
            style={{ top: pos.top, left: pos.left, width: PICKER_W }}
            role="dialog"
            aria-label="Pilih warna"
        >
            <Saturation
                hsva={hsva}
                onChange={(c) => updateFromHsva({ ...hsva, ...c, a: 1 })}
                pointer={SatPointer}
                radius="10px"
                style={{ width: "100%", height: 156 }}
            />

            <div className="cp-hue-row">
                <Hue
                    hue={hsva.h}
                    onChange={({ h }) => updateFromHsva({ ...hsva, h })}
                    pointer={HuePointer}
                    radius="999px"
                    height={12}
                    width="100%"
                />
            </div>

            <div className="cp-row">
                <span
                    className="cp-preview"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                />
                <label className="cp-hex">
                    <span>#</span>
                    <input
                        value={hexText}
                        onChange={(e) => handleHexInput(e.target.value)}
                        onBlur={() =>
                            setHexText(hex.replace("#", "").toUpperCase())
                        }
                        maxLength={6}
                        spellCheck={false}
                        aria-label="Kode warna hex"
                    />
                </label>
                {canEyedrop && (
                    <button
                        type="button"
                        className="cp-icon-btn"
                        onClick={eyedrop}
                        title="Ambil warna dari layar"
                        aria-label="Ambil warna dari layar"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                        >
                            <path d="m2 22 1-1h3l9-9" />
                            <path d="M3 21v-3l9-9" />
                            <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="cp-actions">
                <button type="button" className="cp-btn-ghost" onClick={onClose}>
                    Batal
                </button>
                <button
                    type="button"
                    className="cp-btn-primary"
                    onClick={() => onApply(hex)}
                >
                    Pakai warna
                </button>
            </div>
        </div>,
        document.body,
    );
}

export default function ColorSwatches({ value, onChange, colors = WALLET_COLORS }) {
    const current = (value || "").toLowerCase();
    const isCustom = Boolean(current) && !colors.includes(current);
    const [open, setOpen] = useState(false);
    const plusRef = useRef(null);

    return (
        <div className="swatches" role="radiogroup" aria-label="Warna">
            {colors.map((c) => {
                const active = c === current;
                return (
                    <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={c}
                        className={`swatch ${active ? "is-active" : ""}`}
                        style={{ backgroundColor: c }}
                        onClick={() => onChange(c)}
                    >
                        {active && <FiCheck size={14} aria-hidden />}
                    </button>
                );
            })}

            <button
                ref={plusRef}
                type="button"
                className={`swatch swatch-custom ${isCustom ? "is-active" : ""} ${open ? "is-open" : ""}`}
                style={isCustom ? { backgroundColor: current } : undefined}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={open}
                title="Warna lain"
                aria-label="Pilih warna lain"
            >
                {isCustom ? (
                    <FiCheck size={14} aria-hidden />
                ) : (
                    <FiPlus size={15} aria-hidden />
                )}
            </button>

            {open && (
                <ColorPopover
                    anchorRef={plusRef}
                    initial={current || colors[0]}
                    onClose={() => setOpen(false)}
                    onApply={(hex) => {
                        onChange(hex);
                        setOpen(false);
                    }}
                />
            )}
        </div>
    );
}
