import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import AppLoader from "../components/Layout/AppLoader";
import LoginForm from "../components/auth/LoginForm";
import RegisterForm from "../components/auth/RegisterForm";
import AuthShowcase from "../components/auth/AuthShowcase";

/**
 * Halaman masuk & daftar dalam satu layar.
 * Login di kanan, daftar di kiri — panel hijau bergeser menutupi
 * form yang sedang tidak dipakai.
 */
export default function Auth() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [hold, setHold] = useState(false);

    const mode = pathname.startsWith("/register") ? "register" : "login";
    const isRegister = mode === "register";

    const switchTo = (next) => {
        if (next === mode) return;
        navigate(next === "register" ? "/register" : "/login");
    };

    if (loading && !hold) return <AppLoader label="Memeriksa sesi..." />;
    // Sudah login → langsung ke dashboard, kecuali sedang proses daftar/masuk
    if (user && !hold) return <Navigate to="/" replace />;

    return (
        <div className={`auth-slider is-${mode}`}>
            {/* Kiri: form daftar */}
            <section
                className="auth-pane auth-pane--register"
                aria-hidden={!isRegister}
                inert={!isRegister}
            >
                <div className="auth-panel">
                    <RegisterForm
                        onSwitch={() => switchTo("login")}
                        holdRedirect={setHold}
                    />
                </div>
            </section>

            {/* Kanan: form masuk */}
            <section
                className="auth-pane auth-pane--login"
                aria-hidden={isRegister}
                inert={isRegister}
            >
                <div className="auth-panel">
                    <LoginForm
                        onSwitch={() => switchTo("register")}
                        holdRedirect={setHold}
                    />
                </div>
            </section>

            {/* Panel hijau yang bergeser */}
            <aside className="auth-aside auth-overlay">
                <Link to="/login" className="auth-brand">
                    <img src="/brand/logo-128.webp" alt="" className="sidebar-brand-mark" />
                    <span>DailyTrack</span>
                </Link>

                <div className="auth-hero">
                    <h1>Setiap rupiah punya cerita.</h1>
                    <div className="auth-swap">
                        <p className={!isRegister ? "on" : ""}>
                            Catat pemasukan dan pengeluaran harian, atur budget
                            per kategori, dan lihat ke mana uangmu pergi setiap
                            bulan.
                        </p>
                        <p className={isRegister ? "on" : ""}>
                            Mulai dari catatan pertama. Buat akun gratis, lalu
                            catat transaksi harianmu.
                        </p>
                    </div>
                </div>

                <AuthShowcase />

                <div className="auth-cta">
                    <span>
                        {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}
                    </span>
                    <button
                        type="button"
                        className="auth-cta-btn"
                        onClick={() =>
                            switchTo(isRegister ? "login" : "register")
                        }
                    >
                        {isRegister ? (
                            <>
                                <FiArrowLeft size={16} aria-hidden /> Masuk
                            </>
                        ) : (
                            <>
                                Daftar gratis{" "}
                                <FiArrowRight size={16} aria-hidden />
                            </>
                        )}
                    </button>
                </div>
            </aside>
        </div>
    );
}
