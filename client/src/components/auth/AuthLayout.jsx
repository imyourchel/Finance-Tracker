import { Link } from "react-router-dom";
import AuthShowcase from "./AuthShowcase";

export default function AuthLayout({
    children,
    title = "Setiap rupiah punya cerita.",
    subtitle = "Catat pemasukan dan pengeluaran harian, atur budget per kategori, dan lihat ke mana uangmu pergi setiap bulan.",
}) {
    return (
        <div className="auth">
            <aside className="auth-aside">
                <Link to="/login" className="auth-brand">
                    <img src="/brand/logo-128.webp" alt="" className="sidebar-brand-mark" />
                    <span>DailyTrack</span>
                </Link>

                <div className="auth-hero">
                    <h1>{title}</h1>
                    <p>{subtitle}</p>
                </div>

                <AuthShowcase />

                <div className="auth-foot">
                    © {new Date().getFullYear()} DailyTrack
                </div>
            </aside>

            <main className="auth-main">
                <div className="auth-panel">{children}</div>
            </main>
        </div>
    );
}
