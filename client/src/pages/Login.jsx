import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
    const [form, setForm] = useState({ username: "", password: "" });
    // const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();


    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError("");
            await login(form.username, form.password);
            navigate("/"); // arahkan setelah login sukses
        } catch (err) {
            setError(err.message || "Terjadi kesalahan");
        } finally {
            setLoading(false);
        }
    };

    { error && <p style={{ color: "var(--color-text-danger)" }}>{error}</p> }

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                background:
                    "linear-gradient(135deg, #0f172a 0%, #111827 48%, #1e293b 100%)",
            }}
        >
            {/* Panel kiri — dekorasi */}
            <div className="login-left" style={{ padding: "80px 60px" }}>
                <div className="login-bg-blob blob-1" aria-hidden />
                <div className="login-bg-blob blob-2" aria-hidden />
                <div className="login-bg-blob blob-3" aria-hidden />

                <div
                    className="login-money-icon"
                    style={{
                        fontSize: "96px",
                        marginBottom: "24px",
                        lineHeight: 1,
                    }}
                >
                    💰
                </div>
                <h1
                    style={{
                        fontSize: "48px",
                        fontWeight: "800",
                        margin: "0 0 18px",
                        textAlign: "center",
                        color: "var(--login-left-title)",
                    }}
                >
                    DailyTrack
                </h1>
                <p
                    style={{
                        opacity: 0.8,
                        textAlign: "center",
                        fontSize: "18px",
                        maxWidth: "420px",
                        lineHeight: 1.6,
                        marginTop: 0,
                        color: "var(--login-left-text)",
                    }}
                >
                    Kelola keuangan harianmu dengan mudah dan cerdas
                </p>
                {/* Statistik palsu buat dekorasi */}
                <div
                    style={{ display: "flex", gap: "28px", marginTop: "44px" }}
                >
                    {[
                        ["📊", "Analitik", "Detail"],
                        ["🎯", "Budget", "Pintar"],
                        ["⭐", "Goals", "Tercapai"],
                    ].map(([icon, title, sub]) => (
                        <div key={title} style={{ textAlign: "center" }}>
                            <div
                                className="login-feature-icon"
                                style={{
                                    fontSize: "36px",
                                    color: "var(--accent)",
                                }}
                            >
                                {icon}
                            </div>
                            <div
                                style={{
                                    fontWeight: "700",
                                    fontSize: "15px",
                                    marginTop: "6px",
                                }}
                            >
                                {title}
                            </div>
                            <div
                                style={{
                                    opacity: 0.7,
                                    fontSize: "12px",
                                    marginTop: "2px",
                                }}
                            >
                                {sub}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Panel kanan — form */}
            <div
                style={{
                    width: "440px",
                    flexShrink: 0,
                    backgroundColor: "var(--app-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "48px",
                }}
            >
                <div style={{ width: "100%" }}>
                    <h2
                        style={{
                            fontSize: "26px",
                            fontWeight: "800",
                            color: "var(--app-text-strong)",
                            margin: "0 0 6px",
                        }}
                    >
                        Masuk
                    </h2>
                    <p
                        style={{
                            color: "var(--app-muted)",
                            margin: "0 0 32px",
                            fontSize: "14px",
                        }}
                    >
                        Belum punya akun?{" "}
                        <Link
                            to="/register"
                            style={{
                                color: "var(--accent)",
                                fontWeight: "600",
                            }}
                        >
                            Daftar gratis
                        </Link>
                    </p>

                    {error && (
                        <div
                            style={{
                                padding: "12px 14px",
                                backgroundColor: "var(--app-surface-soft)",
                                color: "var(--app-button-danger-to)",
                                borderRadius: "10px",
                                fontSize: "13px",
                                marginBottom: "20px",
                                border: "1px solid var(--app-border)",
                            }}
                        >
                            ⚠️ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: "16px" }}>
                            <label
                                style={{
                                    display: "block",
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    color: "var(--app-text)",
                                    marginBottom: "6px",
                                }}
                            >
                                Username
                            </label>
                            <input
                                type="text"
                                value={form.username}
                                autoComplete="username"
                                required
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        username: e.target.value,
                                    })
                                }
                                placeholder="username kamu"
                                style={{
                                    width: "100%",
                                    padding: "11px 14px",
                                    border: "1.5px solid var(--app-border)",
                                    borderRadius: "10px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    outline: "none",
                                    backgroundColor: "var(--app-surface-soft)",
                                    color: "var(--app-text-strong)",
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: "24px" }}>
                            <label
                                style={{
                                    display: "block",
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    color: "var(--app-text)",
                                    marginBottom: "6px",
                                }}
                            >
                                Password
                            </label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    autoComplete="current-password"
                                    required
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            password: e.target.value,
                                        })
                                    }
                                    placeholder="••••••••"
                                    style={{
                                        width: "100%",
                                        padding: "11px 14px",
                                        paddingRight: "56px",
                                        border: "1.5px solid var(--app-border)",
                                        borderRadius: "10px",
                                        fontSize: "14px",
                                        boxSizing: "border-box",
                                        outline: "none",
                                        backgroundColor:
                                            "var(--app-surface-soft)",
                                        color: "var(--app-text-strong)",
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((prev) => !prev)
                                    }
                                    style={{
                                        position: "absolute",
                                        top: "50%",
                                        right: "10px",
                                        transform: "translateY(-50%)",
                                        border: "none",
                                        background: "transparent",
                                        cursor: "pointer",
                                        padding: "0px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: "none",
                                        outline: "none",
                                        color: showPassword
                                            ? "var(--accent)"
                                            : "var(--app-muted)",
                                    }}
                                    aria-label={
                                        showPassword
                                            ? "Sembunyikan password"
                                            : "Lihat password"
                                    }
                                    onMouseEnter={(e) => {
                                        e.target.style.background =
                                            "transparent";
                                        e.target.style.boxShadow = "none";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.background =
                                            "transparent";
                                        e.target.style.boxShadow = "none";
                                    }}
                                >
                                    <svg
                                        width="18"
                                        height="18"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                        style={{ flexShrink: 0 }}
                                    >
                                        <path
                                            style={{
                                                display: showPassword
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
                                        />
                                        <path
                                            style={{
                                                display: showPassword
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                                        />
                                        <path
                                            style={{
                                                display: showPassword
                                                    ? "none"
                                                    : "block",
                                            }}
                                            d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                                        />
                                        <line
                                            style={{
                                                display: showPassword
                                                    ? "none"
                                                    : "block",
                                            }}
                                            x1="2"
                                            x2="22"
                                            y1="2"
                                            y2="22"
                                        />
                                        <path
                                            style={{
                                                display: showPassword
                                                    ? "block"
                                                    : "none",
                                            }}
                                            d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
                                        />
                                        <circle
                                            style={{
                                                display: showPassword
                                                    ? "block"
                                                    : "none",
                                            }}
                                            cx="12"
                                            cy="12"
                                            r="3"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: "100%",
                                padding: "13px",
                                background: loading
                                    ? "var(--app-muted)"
                                    : "linear-gradient(135deg, var(--accent), #7c3aed)",
                                color: "var(--app-button-primary-text)",
                                border: "none",
                                borderRadius: "10px",
                                fontSize: "15px",
                                fontWeight: "700",
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            {loading ? "Masuk..." : "Masuk →"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

