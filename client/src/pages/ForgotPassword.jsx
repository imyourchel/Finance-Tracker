import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiMail } from "react-icons/fi";
import AuthLayout from "../components/auth/AuthLayout";
import { forgotPasswordAPI } from "../services/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sentTo, setSentTo] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        const value = email.trim();
        if (!EMAIL_RE.test(value)) {
            setError("Format email belum benar, contoh: nama@gmail.com");
            return;
        }
        try {
            setLoading(true);
            setError("");
            await forgotPasswordAPI({ email: value });
            setSentTo(value);
        } catch (err) {
            setError(err.message || "Gagal mengirim link reset. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    if (sentTo) {
        return (
            <AuthLayout
                title="Tenang, catatanmu aman."
                subtitle="Password bisa diganti kapan saja. Semua transaksi, budget, dan goals tetap tersimpan."
            >
                <div className="auth-mail-icon">
                    <FiMail size={24} />
                </div>
                <h2 className="auth-title">Cek email kamu</h2>
                <p className="auth-sub">
                    Kalau <strong>{sentTo}</strong> terdaftar, kami sudah
                    mengirim link untuk membuat password baru. Link berlaku 30
                    menit. Tidak ada di kotak masuk? Cek folder Spam atau
                    Promosi.
                </p>
                <button
                    type="button"
                    className="auth-btn-google"
                    onClick={() => setSentTo("")}
                >
                    Kirim ulang ke email lain
                </button>
                <p className="auth-switch">
                    Sudah ingat password? <Link to="/login">Kembali masuk</Link>
                </p>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Tenang, catatanmu aman."
            subtitle="Password bisa diganti kapan saja. Semua transaksi, budget, dan goals tetap tersimpan."
        >
            <Link to="/login" className="auth-back">
                <FiArrowLeft size={15} /> Kembali ke halaman masuk
            </Link>
            <h2 className="auth-title">Lupa password?</h2>
            <p className="auth-sub">
                Masukkan email yang kamu pakai saat daftar. Kami akan kirim link
                untuk membuat password baru.
            </p>

            {error && (
                <div className="auth-alert error" role="alert">
                    <FiAlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field" style={{ marginBottom: 24 }}>
                    <label className="auth-label" htmlFor="forgot-email">
                        Email
                    </label>
                    <input
                        id="forgot-email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        disabled={loading}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@gmail.com"
                    />
                </div>
                <button
                    type="submit"
                    className="auth-btn"
                    disabled={loading}
                    aria-busy={loading}
                >
                    {loading && <span className="btn-spinner" aria-hidden />}
                    {loading ? "Mengirim link..." : "Kirim link reset"}
                </button>
            </form>

            <p className="auth-switch">
                Daftar pakai Google? Langsung saja{" "}
                <Link to="/login">masuk dengan Google</Link>.
            </p>
        </AuthLayout>
    );
}
