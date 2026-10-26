import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function PasswordInput({ id, invalid, ...props }) {
    const [show, setShow] = useState(false);

    return (
        <div className="pw-wrap">
            <input
                id={id}
                type={show ? "text" : "password"}
                aria-invalid={invalid ? "true" : undefined}
                {...props}
            />
            <button
                type="button"
                className="pw-toggle"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Sembunyikan password" : "Lihat password"}
                aria-controls={id}
                tabIndex={-1}
            >
                {show ? <FiEyeOff size={17} /> : <FiEye size={17} />}
            </button>
        </div>
    );
}

// Skor 0–4 sederhana untuk indikator kekuatan password
function passwordScore(pw = "") {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 0.5;
    return Math.min(4, Math.floor(score));
}

const LABELS = ["Terlalu pendek", "Lemah", "Cukup", "Kuat", "Sangat kuat"];
const COLORS = ["#c2453b", "#c2453b", "#b8923f", "#1f8a5b", "#1e6e55"];

export function PasswordMeter({ value }) {
    if (!value) return null;
    const score = value.length < 6 ? 0 : Math.max(1, passwordScore(value));
    return (
        <>
            <div className="pw-meter" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                    <span
                        key={i}
                        style={{
                            backgroundColor:
                                i <= score ? COLORS[score] : undefined,
                        }}
                    />
                ))}
            </div>
            <div
                className="auth-hint"
                style={{ color: COLORS[score] }}
                aria-live="polite"
            >
                {LABELS[score]}
                {value.length < 6 && " — minimal 6 karakter"}
            </div>
        </>
    );
}
