import { useState, useEffect, useCallback } from "react";
import DropdownMenu from "../components/ui/DropdownMenu";
import {
    getBudgetsAPI,
    createBudgetAPI,
    deleteBudgetAPI,
} from "../services/api";
import { useFinance } from "../context/FinanceContext";
import {
    formatNumberInput,
    formatRupiah,
    MONTHS,
    parseNumberInput,
} from "../utils/format";
import Card from "../components/ui/Card";
import ProgressBar from "../components/ui/ProgressBar";
import PageHeader from "../components/Layout/PageHeader";
import Modal from "../components/ui/Modal";

export default function Budgets() {
    const { categories, month, year, setMonth, setYear } = useFinance();
    const [budgets, setBudgets] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        categoryId: "",
        limit: "",
        alertThreshold: 80,
    });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const fetch = useCallback(async () => {
        const res = await getBudgetsAPI({ month, year });
        setBudgets(res.data);
    }, [month, year]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetch();
    }, [fetch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.categoryId) {
            alert("Pilih kategori terlebih dahulu");
            return;
        }
        window.scrollTo(0, 0);
        await createBudgetAPI({
            ...form,
            limit: parseNumberInput(form.limit),
            month,
            year,
        });
        setForm({ categoryId: "", limit: "", alertThreshold: 80 });
        setShowForm(false);
        await fetch();
    };

    const handleDelete = async (id) => {
        if (!confirm("Hapus budget ini?")) return;
        await deleteBudgetAPI(id);
        await fetch();
    };

    const expenseCategories = categories.filter(
        (c) => c.type === "expense" || c.type === "both",
    );
    const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <PageHeader
                title="Budgets"
                subtitle="Kelola budget bulanan"
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
                        <button
                            onClick={() => setShowModal(true)}
                            style={{
                                padding: "8px 16px",
                                background:
                                    "linear-gradient(135deg,#4f46e5,#7c3aed)",
                                color: "white",
                                border: "none",
                                borderRadius: "10px",
                                cursor: "pointer",
                                fontWeight: "700",
                                fontSize: "14px",
                            }}
                        >
                            + Budget
                        </button>
                    </div>
                }
            />

            {/* Ringkasan total */}
            {budgets.length > 0 && (
                <Card style={{ marginBottom: "20px" }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "12px",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: "13px",
                                    color: "var(--app-muted)",
                                }}
                            >
                                Total pengeluaran vs budget
                            </div>
                            <div
                                style={{
                                    fontSize: "18px",
                                    fontWeight: "800",
                                    color: "var(--app-text-strong)",
                                    marginTop: "2px",
                                }}
                            >
                                {formatRupiah(totalSpent)}{" "}
                                <span
                                    style={{
                                        fontSize: "13px",
                                        color: "var(--app-muted)",
                                        fontWeight: "400",
                                    }}
                                >
                                    dari {formatRupiah(totalLimit)}
                                </span>
                            </div>
                        </div>
                        <div
                            style={{
                                fontSize: "22px",
                                fontWeight: "800",
                                color:
                                    totalSpent > totalLimit
                                        ? "#ef4444"
                                        : "#10b981",
                            }}
                        >
                            {totalLimit > 0
                                ? Math.round((totalSpent / totalLimit) * 100)
                                : 0}
                            %
                        </div>
                    </div>
                    <ProgressBar
                        percentage={
                            totalLimit > 0
                                ? Math.round((totalSpent / totalLimit) * 100)
                                : 0
                        }
                    />
                </Card>
            )}

            {/* Form tambah budget (modal) */}
            {showModal && (
                <Modal
                    title="Tambah Budget Baru"
                    onClose={() => setShowModal(false)}
                >
                    <form
                        onSubmit={async (e) => {
                            await handleSubmit(e);
                            setShowModal(false);
                        }}
                    >
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "12px",
                                marginBottom: "12px",
                            }}
                        >
                            <div>
                                <label style={lbl}>Kategori</label>
                                <DropdownMenu
                                    label=""
                                    value={form.categoryId}
                                    options={[
                                        {
                                            value: "",
                                            label: "Pilih kategori...",
                                        },
                                        ...expenseCategories.map((c) => ({
                                            value: c._id,
                                            label: c.name,
                                        })),
                                    ]}
                                    onChange={(v) =>
                                        setForm({ ...form, categoryId: v })
                                    }
                                />
                            </div>
                            <div>
                                <label style={lbl}>Limit (Rp)</label>
                                <input
                                    type="text"
                                    value={form.limit}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            limit: formatNumberInput(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    style={inp}
                                    placeholder="1.500.000"
                                    inputMode="numeric"
                                    required
                                />
                            </div>
                            <div>
                                <label style={lbl}>
                                    Alert di % (default 80%)
                                </label>
                                <input
                                    type="number"
                                    value={form.alertThreshold}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            alertThreshold: Number(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    style={inp}
                                    min="1"
                                    max="100"
                                />
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-end",
                                }}
                            >
                                <button
                                    type="submit"
                                    style={{
                                        width: "100%",
                                        padding: "10px",
                                        background: "#10b981",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "10px",
                                        cursor: "pointer",
                                        fontWeight: "700",
                                        fontSize: "14px",
                                    }}
                                >
                                    Simpan Budget
                                </button>
                            </div>
                        </div>
                    </form>
                </Modal>
            )}

            {/* List budget */}
            {budgets.length === 0 ? (
                <Card style={{ textAlign: "center", padding: "60px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                        🎯
                    </div>
                    <div
                        style={{
                            fontWeight: "600",
                            color: "var(--app-text)",
                            marginBottom: "6px",
                        }}
                    >
                        Belum ada budget
                    </div>
                    <div
                        style={{ color: "var(--app-muted)", fontSize: "14px" }}
                    >
                        Buat budget untuk mengontrol pengeluaranmu
                    </div>
                </Card>
            ) : (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                    }}
                >
                    {budgets.map((b) => {
                        const pct = b.percentage;
                        const isOver = b.isOverBudget;
                        const isWarn = pct >= b.alertThreshold && !isOver;
                        const barColor = isOver
                            ? "#ef4444"
                            : isWarn
                              ? "#f59e0b"
                              : b.category?.color || "#10b981";

                        return (
                            <Card key={b._id}>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        marginBottom: "14px",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "38px",
                                                height: "38px",
                                                borderRadius: "10px",
                                                fontSize: "18px",
                                                backgroundColor:
                                                    (b.category?.color ||
                                                        "#4f46e5") + "18",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            🎯
                                        </div>
                                        <div>
                                            <div
                                                style={{
                                                    fontWeight: "700",
                                                    fontSize: "15px",
                                                    color: "var(--app-text-strong)",
                                                }}
                                            >
                                                {b.category?.name || "Kategori"}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "var(--app-muted)",
                                                    marginTop: "2px",
                                                }}
                                            >
                                                {formatRupiah(b.spent)} /{" "}
                                                {formatRupiah(b.limit)}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <div style={{ textAlign: "right" }}>
                                            <div
                                                style={{
                                                    fontWeight: "800",
                                                    fontSize: "18px",
                                                    color: barColor,
                                                }}
                                            >
                                                {pct}%
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: isOver
                                                        ? "#ef4444"
                                                        : "var(--app-muted)",
                                                }}
                                            >
                                                {isOver
                                                    ? `Lewat ${formatRupiah(Math.abs(b.remaining))}`
                                                    : `Sisa ${formatRupiah(b.remaining)}`}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(b._id)}
                                            style={{
                                                width: "30px",
                                                height: "30px",
                                                borderRadius: "8px",
                                                border: "none",
                                                backgroundColor:
                                                    "var(--app-surface-soft)",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <ProgressBar
                                    percentage={pct}
                                    color={barColor}
                                    height={10}
                                />
                                {isOver && (
                                    <div
                                        style={{
                                            marginTop: "8px",
                                            fontSize: "12px",
                                            color: "#ef4444",
                                            fontWeight: "600",
                                        }}
                                    >
                                        ⚠️ Budget sudah melebihi batas!
                                    </div>
                                )}
                                {isWarn && (
                                    <div
                                        style={{
                                            marginTop: "8px",
                                            fontSize: "12px",
                                            color: "#f59e0b",
                                            fontWeight: "600",
                                        }}
                                    >
                                        🔔 Hampir mencapai batas budget!
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const sel = {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--app-border)",
    fontSize: "13px",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
};
const lbl = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--app-text)",
    marginBottom: "6px",
};
const inp = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid var(--app-border)",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
};