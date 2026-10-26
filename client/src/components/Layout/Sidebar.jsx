import { NavLink, useNavigate } from "react-router-dom";
import { confirmDialog } from "../../utils/confirm";
import {
    FiGrid,
    FiCreditCard,
    FiRepeat,
    FiPieChart,
    FiTarget,
    FiFlag,
    FiCalendar,
    FiAward,
    FiSettings,
    FiLogOut,
    FiUsers,
    FiActivity,
    FiFilm,
    FiZap,
    FiDownload,
} from "react-icons/fi";
import { openQuickAdd } from "../../utils/quickAddBus";
import { useAuth } from "../../context/AuthContext";
import { useFinance } from "../../context/FinanceContext";
import { formatRupiah } from "../../utils/format";
import { personaById } from "../../utils/personas";
import { PiFlameFill } from "react-icons/pi";

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U";

const MENU = [
    {
        label: "Utama",
        items: [
            { to: "/", icon: FiGrid, label: "Dashboard" },
            { to: "/wallets", icon: FiCreditCard, label: "Wallet" },
            { to: "/transactions", icon: FiRepeat, label: "Transaksi" },
            { to: "/analytics", icon: FiPieChart, label: "Analitik" },
        ],
    },
    {
        label: "Rencana",
        items: [
            { to: "/budgets", icon: FiTarget, label: "Budget" },
            { to: "/goals", icon: FiFlag, label: "Goals" },
            { to: "/recurring", icon: FiCalendar, label: "Tagihan Rutin" },
            { to: "/utang", icon: FiUsers, label: "Utang & Patungan" },
            { to: "/kesehatan", icon: FiActivity, label: "Kesehatan Finansial" },
        ],
    },
    {
        label: "Lainnya",
        items: [
            { to: "/pencapaian", icon: FiAward, label: "Pencapaian" },
            { to: "/wrapped", icon: FiFilm, label: "Wrapped" },
            { to: "/data", icon: FiDownload, label: "Ekspor & Impor" },
            { to: "/settings", icon: FiSettings, label: "Pengaturan" },
        ],
    },
];

const IS_MAC = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { totalBalance, gamification } = useFinance();
    const persona = gamification ? personaById(gamification.persona) : null;
    const claimable = gamification?.quests
        ? [...gamification.quests.daily, ...gamification.quests.weekly].filter((q) => q.claimable).length
        : 0;
    const streak = gamification?.streak;
    const navigate = useNavigate();

    const handleLogout = async () => {
        const ok = await confirmDialog({
            title: "Keluar dari DailyTrack?",
            message: "Kamu perlu masuk lagi untuk melihat catatan keuanganmu.",
            confirmLabel: "Keluar",
        });
        if (!ok) return;
        logout();
        navigate("/login");
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <img src="/brand/logo-128.webp" alt="" className="sidebar-brand-mark" />
                <span className="sidebar-brand-name">DailyTrack</span>
            </div>

            <div className="sidebar-balance">
                <div className="sidebar-balance-label">Total saldo</div>
                <div
                    className="sidebar-balance-amount"
                    title={formatRupiah(totalBalance)}
                >
                    {formatRupiah(totalBalance)}
                </div>
            </div>

            <button type="button" className="sidebar-quick" onClick={openQuickAdd}>
                <FiZap aria-hidden /> <span className="sidebar-nav-text">Catat cepat</span>
                <kbd>{IS_MAC ? "⌘K" : "Ctrl K"}</kbd>
            </button>

            <nav className="sidebar-nav" aria-label="Menu utama">
                {MENU.map((group) => (
                    <div key={group.label} className="sidebar-group">
                        <div className="sidebar-group-label">{group.label}</div>
                        {group.items.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === "/"}
                                className={({ isActive }) => `sidebar-nav-link ${isActive ? "active" : ""}`}
                                title={label}
                            >
                                <Icon aria-hidden />
                                <span className="sidebar-nav-text">{label}</span>
                                {to === "/pencapaian" && claimable > 0 && (
                                    <span className="sidebar-nav-badge" title={`${claimable} misi siap diklaim`}>
                                        {claimable}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <NavLink
                    to="/pencapaian"
                    className="sidebar-me"
                    title={persona ? `${persona.name}, ${persona.title}` : "Pencapaian"}
                >
                    <span className="sidebar-avatar">
                        {persona ? (
                            <img src={persona.image} alt="" />
                        ) : (
                            getInitials(user?.name)
                        )}
                        {gamification && (
                            <span className="sidebar-level">{gamification.level}</span>
                        )}
                    </span>
                    <span className="sidebar-user">
                        <span className="sidebar-user-name">{user?.name}</span>
                        <span className="sidebar-user-handle">
                            {persona ? persona.title : `@${user?.username || "user"}`}
                        </span>
                        {streak && (
                            <span
                                className={`sidebar-streak ${streak.current === 0 ? "is-cold" : ""} ${streak.atRisk ? "is-risk" : ""}`}
                                title={streak.atRisk ? "Belum mencatat hari ini" : "Streak harian"}
                            >
                                <PiFlameFill aria-hidden /> {streak.current} hari
                            </span>
                        )}
                    </span>
                </NavLink>
                <button
                    type="button"
                    className="sidebar-logout"
                    onClick={handleLogout}
                    title="Keluar"
                    aria-label="Keluar"
                >
                    <FiLogOut size={16} />
                </button>
            </div>
        </aside>
    );
}
