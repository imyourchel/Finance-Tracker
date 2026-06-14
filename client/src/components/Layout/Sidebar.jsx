import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFinance } from "../../context/FinanceContext";
import { formatRupiah } from "../../utils/format";

const getInitials = (name = "") =>
    name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "U";

const MENU = [
    { to: "/", emoji: "🏠", label: "Dashboard" },
    { to: "/wallets", emoji: "👛", label: "Wallet" },
    { to: "/transactions", emoji: "💸", label: "Transaksi" },
    { to: "/analytics", emoji: "📊", label: "Analitik" },
    { to: "/budgets", emoji: "🎯", label: "Budget" },
    { to: "/goals", emoji: "⭐", label: "Goals" },
    { to: "/recurring", emoji: "🔄", label: "Tagihan Rutin" },
    { to: "/settings", emoji: "⚙️", label: "Pengaturan" },
];

export default function Sidebar() {
    const { user, logout } = useAuth();
    const { totalBalance } = useFinance();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <aside
            style={{
                width: "220px",
                minHeight: "100vh",
                height: "100vh",
                flexShrink: 0,
                background:
                    "linear-gradient(180deg, var(--app-sidebar-from) 0%, var(--app-sidebar-to) 100%)",
                display: "flex",
                flexDirection: "column",
                position: "sticky",
                top: 0,
            }}
        >
            {/* Logo */}
            <div style={{ padding: "24px 20px 20px" }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "14px",
                    }}
                >
                    <div
                        style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "14px",
                            background: "rgba(255,255,255,0.12)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            color: "#ffffff",
                            fontWeight: "800",
                            fontSize: "15px",
                        }}
                    >
                        {user?.avatar ? (
                            <img
                                src={user.avatar}
                                alt={user?.name || "Avatar user"}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                }}
                            />
                        ) : (
                            getInitials(user?.name)
                        )}
                    </div>
                    <div
                        style={{
                            minWidth: 0,
                        }}
                    >
                        <div
                            style={{
                                fontSize: "18px",
                                fontWeight: "800",
                                color: "#ffffff",
                                letterSpacing: "-0.5px",
                                lineHeight: 1.1,
                            }}
                        >
                            💰 DailyTrack
                        </div>
                        <div
                            style={{
                                fontSize: "11px",
                                color: "rgba(255,255,255,0.65)",
                                marginTop: "4px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            @{user?.username || user?.email || "user"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Kartu saldo */}
            <div
                style={{
                    margin: "0 12px 8px",
                    padding: "14px 16px",
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    backdropFilter: "blur(10px)",
                }}
            >
                <div
                    style={{
                        fontSize: "11px",
                        color: "var(--app-sidebar-muted)",
                        marginBottom: "4px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                    }}
                >
                    Total Saldo
                </div>
                <div
                    style={{
                        fontSize: "18px",
                        fontWeight: "800",
                        color: "#a5f3fc",
                    }}
                >
                    {formatRupiah(totalBalance)}
                </div>
                <div
                    style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.5)",
                        marginTop: "2px",
                    }}
                >
                    {user?.name}
                </div>
            </div>

            {/* Navigasi */}
            <nav
                style={{
                    flex: 1,
                    padding: "8px 0 90px",
                    overflowY: "auto",
                }}
            >
                {MENU.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `sidebar-nav-link ${isActive ? "active" : ""}`
                        }
                    >
                        <span style={{ fontSize: "16px" }}>{item.emoji}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* Tombol logout */}
            <div
                style={{
                    position: "fixed",
                    left: "12px",
                    bottom: "12px",
                    width: "196px",
                    zIndex: 50,
                }}
            >
                <button
                    onClick={handleLogout}
                    style={{
                        width: "100%",
                        padding: "11px 12px",
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #ef4444, #dc2626)",
                        color: "#ffffff",
                        border: "1px solid rgba(255,255,255,0.22)",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "700",
                        boxShadow: "0 8px 18px rgba(220, 38, 38, 0.35)",
                    }}
                >
                    🚪 Keluar
                </button>
            </div>
        </aside>
    );
}
