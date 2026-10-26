import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
    FiGrid,
    FiRepeat,
    FiCreditCard,
    FiPlus,
    FiMenu,
    FiPieChart,
    FiTarget,
    FiFlag,
    FiCalendar,
    FiUsers,
    FiActivity,
    FiAward,
    FiFilm,
    FiDownload,
    FiSettings,
    FiLogOut,
    FiX,
    FiSmartphone,
} from "react-icons/fi";
import { PiFlameFill } from "react-icons/pi";
import { useAuth } from "../../context/AuthContext";
import { useFinance } from "../../context/FinanceContext";
import { openQuickAdd } from "../../utils/quickAddBus";
import { confirmDialog } from "../../utils/confirm";
import { personaById } from "../../utils/personas";
import { formatRupiah } from "../../utils/format";

// Menu di lembar "Lainnya"
const MORE = [
    {
        label: "Uang",
        items: [
            { to: "/analytics", icon: FiPieChart, label: "Analitik" },
            { to: "/budgets", icon: FiTarget, label: "Budget" },
            { to: "/goals", icon: FiFlag, label: "Goals" },
            { to: "/recurring", icon: FiCalendar, label: "Tagihan Rutin" },
        ],
    },
    {
        label: "Rencana",
        items: [
            { to: "/utang", icon: FiUsers, label: "Utang & Patungan" },
            { to: "/kesehatan", icon: FiActivity, label: "Kesehatan" },
            { to: "/pencapaian", icon: FiAward, label: "Pencapaian" },
            { to: "/wrapped", icon: FiFilm, label: "Wrapped" },
        ],
    },
    {
        label: "Akun",
        items: [
            { to: "/data", icon: FiDownload, label: "Ekspor & Impor" },
            { to: "/settings", icon: FiSettings, label: "Pengaturan" },
        ],
    },
];
const MORE_PATHS = MORE.flatMap((g) => g.items.map((i) => i.to));

const TITLES = [
    ["/transactions/new", "Catat transaksi"],
    ["/transactions/", "Ubah transaksi"],
    ["/transactions", "Transaksi"],
    ["/wallets/", "Detail wallet"],
    ["/wallets", "Wallet"],
    ["/analytics", "Analitik"],
    ["/budgets", "Budget"],
    ["/goals", "Goals"],
    ["/recurring", "Tagihan Rutin"],
    ["/utang", "Utang & Patungan"],
    ["/kesehatan", "Kesehatan Finansial"],
    ["/pencapaian", "Pencapaian"],
    ["/wrapped", "Wrapped"],
    ["/data", "Ekspor & Impor"],
    ["/settings", "Pengaturan"],
];
const titleFor = (path) => (path === "/" ? "Dashboard" : TITLES.find(([p]) => path.startsWith(p))?.[1] || "DailyTrack");

// "Rp 23,9 jt" supaya muat di bilah atas
const compactRupiah = (n) => {
    const v = Number(n || 0);
    const abs = Math.abs(v);
    const sign = v < 0 ? "−" : "";
    const fmt = (x, unit) => `${sign}Rp ${x.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${unit}`;
    if (abs >= 1e9) return fmt(abs / 1e9, "M");
    if (abs >= 1e6) return fmt(abs / 1e6, "jt");
    if (abs >= 1e4) return fmt(abs / 1e3, "rb");
    return formatRupiah(v);
};

const isStandalone = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

/** Navigasi khusus layar kecil: bilah atas, bilah bawah, dan lembar "Lainnya". */
export default function MobileNav() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { totalBalance, gamification } = useFinance();
    const [sheet, setSheet] = useState(false);
    const [canInstall, setCanInstall] = useState(() => Boolean(window.__dtInstallPrompt));

    const persona = gamification ? personaById(gamification.persona) : null;
    const claimable = gamification?.quests
        ? [...gamification.quests.daily, ...gamification.quests.weekly].filter((q) => q.claimable).length
        : 0;
    const moreActive = MORE_PATHS.some((p) => pathname.startsWith(p));

    useEffect(() => {
        const onInstallable = () => setCanInstall(true);
        const onInstalled = () => setCanInstall(false);
        window.addEventListener("dt:installable", onInstallable);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("dt:installable", onInstallable);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    useEffect(() => {
        if (!sheet) return undefined;
        const onKey = (e) => e.key === "Escape" && setSheet(false);
        window.addEventListener("keydown", onKey);
        document.documentElement.classList.add("mn-lock");
        return () => {
            window.removeEventListener("keydown", onKey);
            document.documentElement.classList.remove("mn-lock");
        };
    }, [sheet]);

    const close = () => setSheet(false);

    const install = async () => {
        const prompt = window.__dtInstallPrompt;
        if (!prompt) return;
        prompt.prompt();
        try {
            await prompt.userChoice;
        } finally {
            window.__dtInstallPrompt = null;
            setCanInstall(false);
        }
    };

    const handleLogout = async () => {
        close();
        const ok = await confirmDialog({
            title: "Keluar dari DailyTrack?",
            message: "Kamu perlu masuk lagi untuk melihat catatan keuanganmu.",
            confirmLabel: "Keluar",
        });
        if (!ok) return;
        logout();
        navigate("/login");
    };

    const tab = (to, Icon, label, end = false) => (
        <NavLink to={to} end={end} className={({ isActive }) => `mn-tab ${isActive ? "is-active" : ""}`} onClick={close}>
            <Icon aria-hidden />
            <span>{label}</span>
        </NavLink>
    );

    return (
        <>
            <header className="mn-top">
                <NavLink to="/" className="mn-brand" aria-label="Dashboard" onClick={close}>
                    <img src="/brand/logo-128.webp" alt="" />
                </NavLink>
                <div className="mn-title">
                    <strong>{titleFor(pathname)}</strong>
                    <span>Saldo {compactRupiah(totalBalance)}</span>
                </div>
            </header>

            <nav className="mn-bar" aria-label="Navigasi utama">
                {tab("/", FiGrid, "Beranda", true)}
                {tab("/transactions", FiRepeat, "Transaksi")}
                <button type="button" className="mn-add" onClick={openQuickAdd} aria-label="Catat cepat">
                    <FiPlus aria-hidden />
                </button>
                {tab("/wallets", FiCreditCard, "Wallet")}
                <button
                    type="button"
                    className={`mn-tab ${moreActive || sheet ? "is-active" : ""}`}
                    onClick={() => setSheet((s) => !s)}
                    aria-expanded={sheet}
                    aria-controls="mn-sheet"
                >
                    <FiMenu aria-hidden />
                    <span>Lainnya</span>
                    {claimable > 0 && <i className="mn-dot" aria-label={`${claimable} misi siap diklaim`} />}
                </button>
            </nav>

            {sheet && (
                <div className="mn-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
                    <div className="mn-sheet" id="mn-sheet" role="dialog" aria-modal="true" aria-label="Menu lainnya">
                        <div className="mn-grip" aria-hidden />
                        <div className="mn-sheet-head">
                            <NavLink to="/pencapaian" className="mn-me" onClick={close}>
                                <span className="mn-avatar">
                                    {persona ? <img src={persona.image} alt="" /> : (user?.name || "U").slice(0, 1)}
                                    {gamification && <b>{gamification.level}</b>}
                                </span>
                                <span className="mn-me-text">
                                    <strong>{user?.name}</strong>
                                    <span>
                                        {persona ? persona.title : `@${user?.username || "user"}`}
                                        {gamification?.streak && (
                                            <em>
                                                <PiFlameFill aria-hidden /> {gamification.streak.current} hari
                                            </em>
                                        )}
                                    </span>
                                </span>
                            </NavLink>
                            <button type="button" className="mn-close" onClick={close} aria-label="Tutup menu">
                                <FiX />
                            </button>
                        </div>

                        {MORE.map((g) => (
                            <section key={g.label} className="mn-group">
                                <h3>{g.label}</h3>
                                <div className="mn-grid">
                                    {g.items.map(({ to, icon: Icon, label }) => (
                                        <NavLink
                                            key={to}
                                            to={to}
                                            className={({ isActive }) => `mn-item ${isActive ? "is-active" : ""}`}
                                            onClick={close}
                                        >
                                            <span className="mn-item-icon">
                                                <Icon aria-hidden />
                                                {to === "/pencapaian" && claimable > 0 && <i>{claimable}</i>}
                                            </span>
                                            <span>{label}</span>
                                        </NavLink>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <div className="mn-actions">
                            {canInstall && !isStandalone() && (
                                <button type="button" className="mn-install" onClick={install}>
                                    <FiSmartphone aria-hidden /> Pasang aplikasi di HP
                                </button>
                            )}
                            <button type="button" className="mn-logout" onClick={handleLogout}>
                                <FiLogOut aria-hidden /> Keluar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
