// Layar loading penuh — dipakai saat app mengecek sesi login.
export default function AppLoader({ label = "Menyiapkan bukumu..." }) {
    return (
        <div className="app-loader" role="status" aria-live="polite">
            <div className="app-loader-mark" aria-hidden>
                <img src="/brand/logo-128.webp" alt="" className="sidebar-brand-mark" />
                <span className="app-loader-ring" />
            </div>
            <div className="app-loader-label">{label}</div>
        </div>
    );
}
