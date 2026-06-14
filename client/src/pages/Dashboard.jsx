import { useEffect, useState } from "react";
import DropdownMenu from "../components/ui/DropdownMenu";
import { useFinance } from "../context/FinanceContext";
import { getComparisonAPI, getTransactionsAPI } from "../services/api";
import { formatRupiah, MONTHS } from "../utils/format";
import PieChartComp from "../components/Charts/PieChartComp";
import BarChartComp from "../components/Charts/BarChartComp";
import TransactionItem from "../components/Transaction/TransactionItem";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";

// Sesudah — terima availableYears sebagai prop
const MonthSelector = ({ month, year, setMonth, setYear, availableYears }) => (
    <div style={{ display: "flex", gap: "8px" }}>
        <DropdownMenu
            label="Bulan"
            value={month}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            onChange={(v) => setMonth(Number(v))}
        />
        <DropdownMenu
            label="Tahun"
            value={year}
            options={availableYears.map((y) => ({
                value: y,
                label: String(y),
            }))}
            onChange={(v) => setYear(Number(v))}
        />
    </div>
);

function getTextColorForBg(hex) {
    const safeHex = (hex || "#4f46e5").replace("#", "");
    const normalized =
        safeHex.length === 3
            ? safeHex
                  .split("")
                  .map((c) => c + c)
                  .join("")
            : safeHex;
    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.62 ? "#1e3a8a" : "#ffffff";
}

export default function Dashboard() {
    const { summary, wallets, month, year, setMonth, setYear, availableYears } = useFinance();
    const [comparison, setComparison] = useState(null);
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        getComparisonAPI()
            .then((r) => setComparison(r.data))
            .catch(() => {});
        getTransactionsAPI({ month, year, limit: 5 })
            .then((r) => setRecent(r.data.transactions))
            .catch(() => {});
    }, [month, year]);

    return (
        <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
            <PageHeader
                title="Dashboard"
                subtitle={`${MONTHS[month - 1]} ${year}`}
                action={
                    <MonthSelector
                        month={month}
                        year={year}
                        setMonth={setMonth}
                        setYear={setYear}
                        availableYears={availableYears}   
                    />
                }
            />

            {/* Summary cards */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                    marginBottom: "20px",
                }}
            >
                {[
                    {
                        label: "Pemasukan",
                        amount: summary.income,
                        color: "#10b981",
                        bg: "#d1fae5",
                        icon: "📈",
                    },
                    {
                        label: "Pengeluaran",
                        amount: summary.expense,
                        color: "#ef4444",
                        bg: "#fee2e2",
                        icon: "📉",
                    },
                    {
                        label: "Selisih",
                        amount: summary.balance,
                        color: "#4f46e5",
                        bg: "#e0e7ff",
                        icon: "💰",
                    },
                ].map(({ label, amount, color, bg, icon }) => (
                    <Card key={label}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "10px",
                            }}
                        >
                            <div
                                style={{
                                    width: "38px",
                                    height: "38px",
                                    borderRadius: "10px",
                                    backgroundColor: bg,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "18px",
                                }}
                            >
                                {icon}
                            </div>
                            <span
                                style={{
                                    fontSize: "13px",
                                    color: "var(--app-muted)",
                                    fontWeight: "500",
                                }}
                            >
                                {label}
                            </span>
                        </div>
                        <div
                            style={{
                                fontSize: "22px",
                                fontWeight: "800",
                                color,
                            }}
                        >
                            {formatRupiah(amount)}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Banner perbandingan bulan */}
            {comparison && (
                <div
                    style={{
                        padding: "14px 18px",
                        borderRadius: "12px",
                        marginBottom: "20px",
                        backgroundColor: comparison.isMoreExpensive
                            ? "rgba(239, 68, 68, 0.1)"
                            : "rgba(16, 185, 129, 0.1)",
                        border: `1px solid ${comparison.isMoreExpensive ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                    }}
                >
                    <span style={{ fontSize: "22px" }}>
                        {comparison.isMoreExpensive ? "⚠️" : "🎉"}
                    </span>
                    <div>
                        <div
                            style={{
                                fontWeight: "700",
                                fontSize: "14px",
                                color: comparison.isMoreExpensive
                                    ? "#ef4444"
                                    : "#10b981",
                            }}
                        >
                            {comparison.isMoreExpensive
                                ? `Bulan ini lebih boros ${comparison.percentage}% dari bulan lalu`
                                : `Bulan ini lebih hemat ${Math.abs(comparison.percentage)}% dari bulan lalu`}
                        </div>
                        <div
                            style={{
                                fontSize: "12px",
                                color: "var(--app-muted)",
                                marginTop: "2px",
                            }}
                        >
                            Bulan lalu {formatRupiah(comparison.lastMonth)} →
                            Bulan ini {formatRupiah(comparison.thisMonth)}
                        </div>
                    </div>
                </div>
            )}

            {/* Wallet cards */}
            <div style={{ marginBottom: "24px" }}>
                <h2
                    style={{
                        fontSize: "15px",
                        fontWeight: "700",
                        color: "var(--app-text-strong)",
                        marginBottom: "12px",
                    }}
                >
                    Dompet & Rekening
                </h2>
                <div
                    style={{
                        display: "flex",
                        gap: "12px",
                        overflowX: "auto",
                        paddingBottom: "6px",
                    }}
                >
                    {wallets.map((w) => {
                        const baseColor = w.color || "#4f46e5";
                        const textColor = getTextColorForBg(baseColor);
                        const mutedTextColor =
                            textColor === "#1e3a8a"
                                ? "rgba(30, 58, 138, 0.78)"
                                : "rgba(255, 255, 255, 0.82)";

                        return (
                            <div
                                key={w._id}
                                style={{
                                    minWidth: "160px",
                                    padding: "16px 18px",
                                    flexShrink: 0,
                                    background: `linear-gradient(135deg, ${baseColor}, ${baseColor}cc)`,
                                    borderRadius: "12px",
                                    color: textColor,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: mutedTextColor,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                    }}
                                >
                                    {w.name}
                                </div>
                                <div
                                    style={{
                                        fontSize: "17px",
                                        fontWeight: "800",
                                        marginTop: "6px",
                                    }}
                                >
                                    {formatRupiah(w.balance)}
                                </div>
                                <div
                                    style={{
                                        fontSize: "11px",
                                        color: mutedTextColor,
                                        marginTop: "2px",
                                    }}
                                >
                                    {w.type}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chart row */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    marginBottom: "20px",
                }}
            >
                <Card>
                    <h2
                        style={{
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "var(--app-text-strong)",
                            margin: "0 0 16px",
                        }}
                    >
                        Pengeluaran per Kategori
                    </h2>
                    <PieChartComp data={summary.byCategory} />
                </Card>
                <Card>
                    <h2
                        style={{
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "var(--app-text-strong)",
                            margin: "0 0 16px",
                        }}
                    >
                        Tren Harian
                    </h2>
                    <BarChartComp data={summary.dailyTrend} />
                </Card>
            </div>

            {/* Transaksi terbaru */}
            <Card>
                <h2
                    style={{
                        fontSize: "15px",
                        fontWeight: "700",
                        color: "var(--app-text-strong)",
                        margin: "0 0 4px",
                    }}
                >
                    Transaksi Terbaru
                </h2>
                {recent.length === 0 ? (
                    <p
                        style={{
                            textAlign: "center",
                            color: "var(--app-muted)",
                            padding: "32px 0",
                            fontSize: "14px",
                        }}
                    >
                        Belum ada transaksi
                    </p>
                ) : (
                    recent.map((t) => (
                        <TransactionItem key={t._id} transaction={t} />
                    ))
                )}
            </Card>
        </div>
    );
}

const selStyle = {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid #e2e8f0",
    fontSize: "13px",
    backgroundColor: "white",
    color: "#374151",
    cursor: "pointer",
};
