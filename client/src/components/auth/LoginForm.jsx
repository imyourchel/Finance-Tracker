import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "./PasswordInput";
import GoogleButton from "./GoogleButton";

export default function LoginForm({ onSwitch, holdRedirect }) {
    const [form, setForm] = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");
    const { login, loginWithGoogle } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const notice = location.state?.notice;

    const busy = loading || googleLoading;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setLoading(true);
        setError("");
        holdRedirect(true);
        try {
            await login(form.username, form.password);
            navigate("/", { replace: true });
        } catch (err) {
            holdRedirect(false);
            setError(err.message || "Gagal masuk. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async (accessToken) => {
        setGoogleLoading(true);
        setError("");
        holdRedirect(true);
        try {
            const isNew = await loginWithGoogle(accessToken);
            navigate(isNew ? "/setup-initial-balance" : "/", { replace: true });
        } catch (err) {
            holdRedirect(false);
            setError(err.message || "Login Google gagal.");
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <>
            <h2 className="auth-title">Selamat datang kembali</h2>
            <p className="auth-sub">
                Masuk untuk melanjutkan catatan keuanganmu.
            </p>

            {notice && !error && (
                <div className="auth-alert success" role="status">
                    <FiCheckCircle size={16} />
                    <span>{notice}</span>
                </div>
            )}

            {error && (
                <div className="auth-alert error" role="alert">
                    <FiAlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <GoogleButton
                onToken={handleGoogle}
                onError={setError}
                disabled={loading}
            />

            <div className="auth-divider">atau masuk dengan username</div>

            <form onSubmit={handleSubmit}>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="login-username">
                        Username
                    </label>
                    <input
                        id="login-username"
                        type="text"
                        value={form.username}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        disabled={busy}
                        onChange={(e) =>
                            setForm({ ...form, username: e.target.value })
                        }
                        placeholder="Masukkan username kamu"
                    />
                </div>

                <div className="auth-field" style={{ marginBottom: 24 }}>
                    <div className="auth-label-row">
                        <label className="auth-label" htmlFor="login-password">
                            Password
                        </label>
                        <Link to="/forgot-password" className="auth-link">
                            Lupa password?
                        </Link>
                    </div>
                    <PasswordInput
                        id="login-password"
                        value={form.password}
                        autoComplete="current-password"
                        required
                        disabled={busy}
                        onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                        }
                        placeholder="Password kamu"
                    />
                </div>

                <button
                    type="submit"
                    className="auth-btn"
                    disabled={busy}
                    aria-busy={loading}
                >
                    {loading && <span className="btn-spinner" aria-hidden />}
                    {loading ? "Memeriksa akun..." : "Masuk"}
                </button>
            </form>

            <p className="auth-switch auth-switch-inline">
                Belum punya akun?{" "}
                <button type="button" className="auth-text-btn" onClick={onSwitch}>
                    Daftar gratis
                </button>
            </p>
        </>
    );
}
