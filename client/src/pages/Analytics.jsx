import { useState, useEffect } from "react";
import DropdownMenu from "../components/ui/DropdownMenu";
import { getComparisonAPI } from "../services/api";
import { useFinance } from "../context/FinanceContext";
import { formatRupiah, MONTHS } from "../utils/format";
import PieChartComp from "../components/Charts/PieChartComp";
import BarChartComp from "../components/Charts/BarChartComp";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";
import ProgressBar from "../components/ui/ProgressBar";

export default function Analytics() {
    const { summary, month, year, setMonth, setYear } = useFinance();

    const [comparison, setComparison] = useState(null);
    const [topExpense, setTopExpense] = useState([]);

    // =========================
    // RESET ON MOUNT
    // =========================
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // =========================
    // FETCH COMPARISON (FIXED)
    // =========================
    useEffect(() => {
        setComparison(null); // penting: reset biar tidak nyangkut data lama

        getComparisonAPI(month, year)
            .then((res) => {
                setComparison(res.data || null);
            })
            .catch(() => {
                setComparison(null);
            });
    }, [month, year]);

    // =========================
    // TOP EXPENSE HANDLING
    // =========================
    useEffect(() => {
        if (summary?.byCategory?.length) {
            setTopExpense(summary.byCategory.slice(0, 5));
        } else {
            setTopExpense([]);
        }
    }, [summary]);

    // =========================
    // SAFE VALUES
    // =========================
    const total = summary?.expense || 0;

    const safeComparison = comparison || {
        thisMonth: 0,
        lastMonth: 0,
        diff: 0,
        isMoreExpensive: false,
    };

    return (
        <div style={{ padding: "32px", maxWidth: "1000px", margin: "0 auto" }}>
            <PageHeader
                title="Analitik"
                subtitle="Visualisasi pola keuangan kamu"
                action={
                    <div style={{ display: "flex", gap: "8px" }}>
                        <DropdownMenu
                            label="Bulan"
                            value={month}
                            options={MONTHS.map((m, i) => ({
                                value: i + 1,
                                label: m,
                            }))}
                            onChange={(v) => setMonth(Number(v))}
                        />

                        <DropdownMenu
                            label="Tahun"
                            value={year}
                            options={[2024, 2025, 2026].map((y) => ({
                                value: y,
                                label: String(y),
                            }))}
                            onChange={(v) => setYear(Number(v))}
                        />
                    </div>
                }
            />

            {/* =========================
                3 SUMMARY CARDS (ALWAYS SHOW)
            ========================= */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "16px",
                    marginBottom: "24px",
                }}
            >
                {[
                    {
                        label: "Bulan Ini",
                        value: safeComparison.thisMonth,
                        color: "#4f46e5",
                        icon: "💰",
                    },
                    {
                        label: "Bulan Lalu",
                        value: safeComparison.lastMonth,
                        color: "#64748b",
                        icon: "📅",
                    },
                    {
                        label: "Selisih",
                        value: Math.abs(safeComparison.diff),
                        color: safeComparison.isMoreExpensive
                            ? "#ef4444"
                            : "#10b981",
                        prefix: safeComparison.isMoreExpensive ? "🔺 " : "🔻 ",
                        icon: safeComparison.isMoreExpensive ? "⚠️" : "✅",
                    },
                ].map(({ label, value, color, prefix = "", icon = "" }) => (
                    <Card
                        key={label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "16px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 40,
                                width: 64,
                                height: 64,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 12,
                            }}
                        >
                            {icon}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div
                                style={{
                                    fontSize: "12px",
                                    color: "var(--app-muted)",
                                    marginBottom: 6,
                                }}
                            >
                                {label}
                            </div>
                            <div
                                style={{
                                    fontSize: "20px",
                                    fontWeight: "800",
                                    color,
                                }}
                            >
                                {prefix}
                                {formatRupiah(value)}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* =========================
                CHART SECTION
            ========================= */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    marginBottom: "24px",
                }}
            >
                <Card>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                        Distribusi Pengeluaran
                    </h3>
                    <PieChartComp data={summary?.byCategory || []} />
                </Card>

                <Card>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                        Tren Harian
                    </h3>
                    <BarChartComp
                        data={summary?.dailyTrend || []}
                        month={month}
                        year={year}
                    />
                </Card>
            </div>

            {/* =========================
                TOP CATEGORY
            ========================= */}
            <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                    Top Pengeluaran per Kategori
                </h3>

                {topExpense.length === 0 ? (
                    <p
                        style={{
                            color: "var(--app-muted)",
                            textAlign: "center",
                            padding: "20px",
                        }}
                    >
                        Belum ada data
                    </p>
                ) : (
                    topExpense.map((item, i) => {
                        const pct =
                            total > 0
                                ? Math.round((item.total / total) * 100)
                                : 0;

                        return (
                            <div key={i} style={{ marginBottom: 16 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        marginBottom: 6,
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: "50%",
                                                backgroundColor:
                                                    item.category?.color ||
                                                    "#999",
                                            }}
                                        />
                                        <span>
                                            {item.category?.name || "Lainnya"}
                                        </span>
                                    </div>

                                    <div>
                                        <strong>
                                            {formatRupiah(item.total)}
                                        </strong>{" "}
                                        <span>{pct}%</span>
                                    </div>
                                </div>

                                <ProgressBar
                                    percentage={pct}
                                    color={
                                        item.category?.color || "#4f46e5"
                                    }
                                />
                            </div>
                        );
                    })
                )}
            </Card>
        </div>
    );
}