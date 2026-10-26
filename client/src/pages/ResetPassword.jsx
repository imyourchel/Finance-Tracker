import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertCircle } from "react-icons/fi";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordInput, { PasswordMeter } from "../components/auth/PasswordInput";
import { resetPasswordAPI } from "../services/api";

export default function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get("token");
    const navigate = useNavigate();
    const [form, setForm] = useState({ password: "", confirm: "" });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        if (form.password.length < 6)
            return setError("Password minimal 6 karakter");
        if (form.password !== form.confirm)
            return setError("Konfirmasi belum sama dengan password baru");

        try {
            setLoading(true);
            setError("");
            await resetPasswordAPI(token, { newPassword: form.password });
            navigate("/login", {
                replace: true,
                state: {
                    notice: "Password berhasil diganti. Silakan masuk dengan password baru.",
                },
            });
        } catch (err) {
            setError(err.message || "Gagal mengganti password.");
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <AuthLayout>
                <h2 className="auth-title">Link tidak lengkap</h2>
                <p className="auth-sub">
                    Link reset password ini tidak berisi token. Buka ulang link
                    dari email, atau minta link baru.
                </p>
                <Link
                    to="/forgot-password"
                    className="auth-btn"
                    style={{ textDecoration: "none" }}
                >
                    Minta link baru
                </Link>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Mulai lagi dengan kunci baru."
            subtitle="Pilih password yang belum pernah kamu pakai di aplikasi lain."
        >
            <h2 className="auth-title">Buat password baru</h2>
            <p className="auth-sub">
                Setelah disimpan, kamu akan diarahkan ke halaman masuk.
            </p>

            {error && (
                <div className="auth-alert error" role="alert">
                    <FiAlertCircle size={16} />
                    <span>
                        {error}
                        {/expired|tidak valid/i.test(error) && (
                            <>
                                {" "}
                                <Link to="/forgot-password" className="auth-link">
                                    Minta link baru
                                </Link>
                            </>
                        )}
                    </span>
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="reset-password">
                        Password baru
                    </label>
                    <PasswordInput
                        id="reset-password"
                        autoComplete="new-password"
                        autoFocus
                        value={form.password}
                        disabled={loading}
                        onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                        }
                        placeholder="Min. 6 karakter"
                    />
                    <PasswordMeter value={form.password} />
                </div>
                <div className="auth-field" style={{ marginBottom: 24 }}>
                    <label className="auth-label" htmlFor="reset-confirm">
                        Ulangi password baru
                    </label>
                    <PasswordInput
                        id="reset-confirm"
                        autoComplete="new-password"
                        value={form.confirm}
                        disabled={loading}
                        onChange={(e) =>
                            setForm({ ...form, confirm: e.target.value })
                        }
                        placeholder="Ketik ulang"
                    />
                </div>
                <button
                    type="submit"
                    className="auth-btn"
                    disabled={loading}
                    aria-busy={loading}
                >
                    {loading && <span className="btn-spinner" aria-hidden />}
                    {loading ? "Menyimpan..." : "Simpan password baru"}
                </button>
            </form>
        </AuthLayout>
    );
}
