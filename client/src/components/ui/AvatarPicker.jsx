import { FiCheck } from "react-icons/fi";

const PRESETS = [
    { src: "/avatars/celengan-ayam.webp", name: "Celengan Ayam", meaning: "Rajin menabung" },
    { src: "/avatars/tupai.webp", name: "Tupai", meaning: "Siap untuk masa depan" },
    { src: "/avatars/semut.webp", name: "Semut", meaning: "Rajin & disiplin" },
    { src: "/avatars/burung-hantu.webp", name: "Burung Hantu", meaning: "Bijak mengatur uang" },
    { src: "/avatars/koi.webp", name: "Koi", meaning: "Hoki & rezeki lancar" },
];

const initials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "U";

/**
 * Pilihan foto profil: 5 avatar maskot, foto yang sudah ada (mis. dari Google),
 * atau inisial nama. value = URL avatar atau "" untuk inisial.
 */
export default function AvatarPicker({ value, onChange, name, originalAvatar }) {
    const isPreset = (src) => PRESETS.some((p) => p.src === src);
    const external =
        originalAvatar && !isPreset(originalAvatar) ? originalAvatar : null;
    const current = PRESETS.find((p) => p.src === value);

    const options = [
        ...PRESETS.map((p) => ({ key: p.src, src: p.src, title: p.name })),
        ...(external ? [{ key: "external", src: external, title: "Foto akun" }] : []),
        { key: "initials", src: "", title: "Inisial nama" },
    ];

    return (
        <div className="avatar-picker">
            <div className="avatar-current">
                <div className="avatar-lg">
                    {value ? (
                        <img src={value} alt="" referrerPolicy="no-referrer" />
                    ) : (
                        <span>{initials(name)}</span>
                    )}
                </div>
                <div>
                    <div className="avatar-current-name">
                        {current?.name || (value ? "Foto akun" : "Inisial nama")}
                    </div>
                    <div className="avatar-current-meaning">
                        {current?.meaning || "Pilih maskot di samping untuk foto profilmu"}
                    </div>
                </div>
            </div>

            <div className="avatar-options" role="radiogroup" aria-label="Pilih foto profil">
                {options.map((o) => {
                    const selected = (value || "") === o.src;
                    return (
                        <button
                            key={o.key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            title={o.title}
                            aria-label={o.title}
                            className={`avatar-opt ${selected ? "is-selected" : ""}`}
                            onClick={() => onChange(o.src)}
                        >
                            {o.src ? (
                                <img src={o.src} alt="" referrerPolicy="no-referrer" />
                            ) : (
                                <span>{initials(name)}</span>
                            )}
                            {selected && (
                                <span className="avatar-opt-check" aria-hidden>
                                    <FiCheck />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
