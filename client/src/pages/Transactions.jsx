import { useState, useEffect, useCallback } from "react";
import DropdownMenu from "../components/ui/DropdownMenu";
import { getTransactionsAPI, deleteTransactionAPI } from "../services/api";
import { useFinance } from "../context/FinanceContext";
import { MONTHS } from "../utils/format";
import TransactionForm from "../components/Transaction/TransactionForm";
import TransactionItem from "../components/Transaction/TransactionItem";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";

const sel = {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--app-border)",
    fontSize: "13px",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
};

export default function Transactions() {
    const { wallets, month, year, setMonth, setYear, refresh, availableYears } = useFinance();

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState({
        type: "",
        category: "",
        wallet: "",
        search: "",
    });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                month,
                year,
                page,
                limit: 20,
                ...(filter.type && { type: filter.type }),
                ...(filter.wallet && { wallet: filter.wallet }),
                ...(filter.category && { category: filter.category }),
                ...(filter.search && { search: filter.search }),
            };

            const res = await getTransactionsAPI(params);
            setTransactions(res.data.transactions || []);
            setTotalPages(res.data.pagination?.totalPages || 1);
            setTotal(res.data.pagination?.total || 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [month, year, page, filter]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    useEffect(() => {
        setPage(1);
    }, [month, year, filter.type, filter.wallet, filter.category, filter.search]);

    const handleDelete = async (id) => {
        if (!confirm("Hapus transaksi ini?")) return;
        await deleteTransactionAPI(id);
        await fetchTransactions();
        refresh();
    };

    const handleEdit = (t) => {
        setEditData(t);
        setShowForm(true);
    };

    const handleSaved = async () => {
        window.scrollTo(0, 0);
        setShowForm(false);
        setEditData(null);
        await fetchTransactions();
        refresh();
    };

    const setF = (field, val) =>
        setFilter((prev) => ({ ...prev, [field]: val }));

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <PageHeader
                title="Transaksi"
                subtitle={`${total} transaksi ditemukan`}
                action={
                    <button
                        onClick={() => {
                            setEditData(null);
                            setShowForm(true);
                        }}
                        style={{
                            padding: "10px 20px",
                            background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                            color: "white",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontWeight: "700",
                            fontSize: "14px",
                        }}
                    >
                        + Tambah
                    </button>
                }
            />

            <Card style={{ marginBottom: "20px", padding: "16px" }}>
                <div
                    style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "center",
                    }}
                >
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
                        options={(availableYears?.length ? availableYears : [2024, 2025, 2026]).map((y) => ({
                            value: y,
                            label: String(y),
                        }))}
                        onChange={(v) => setYear(Number(v))}
                    />

                    <DropdownMenu
                        label="Tipe"
                        value={filter.type}
                        options={[
                            { value: "", label: "Semua Tipe" },
                            { value: "income", label: "📈 Pemasukan" },
                            { value: "expense", label: "📉 Pengeluaran" },
                            { value: "transfer", label: "🔄 Transfer" },
                        ]}
                        onChange={(v) => setF("type", v)}
                    />

                    <DropdownMenu
                        label="Wallet"
                        value={filter.wallet}
                        options={[
                            { value: "", label: "Semua Wallet" },
                            ...wallets.map((w) => ({
                                value: w._id,
                                label: w.name,
                            })),
                        ]}
                        onChange={(v) => setF("wallet", v)}
                    />

                    <input
                        value={filter.search}
                        onChange={(e) => setF("search", e.target.value)}
                        placeholder="🔍 Cari keterangan..."
                        style={{ ...sel, flex: 1, minWidth: "160px" }}
                    />

                    {Object.values(filter).some(Boolean) && (
                        <button
                            onClick={() => {
                                setFilter({
                                    type: "",
                                    category: "",
                                    wallet: "",
                                    search: "",
                                });
                                setPage(1);
                                const now = new Date();
                                setMonth(now.getMonth() + 1);
                                setYear(now.getFullYear());
                            }}
                            style={{
                                padding: "8px 14px",
                                backgroundColor: "#f1f5f9",
                                border: "none",
                                borderRadius: "8px",
                                cursor: "pointer",
                                fontSize: "13px",
                                color: "#64748b",
                            }}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </Card>

            <Card style={{ padding: "8px 20px" }}>
                {loading ? (
                    <p style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
                        Memuat...
                    </p>
                ) : transactions.length === 0 ? (
                    <p style={{ textAlign: "center", padding: "48px", color: "#94a3b8", fontSize: "14px" }}>
                        Tidak ada transaksi ditemukan
                    </p>
                ) : (
                    transactions.map((t) => (
                        <TransactionItem
                            key={t._id}
                            transaction={t}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                        />
                    ))
                )}
            </Card>

            {totalPages > 1 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 0",
                        borderTop: "1px solid var(--color-border-tertiary)",
                        marginTop: "8px",
                    }}
                >
                    <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
                        {total} transaksi · halaman {page} dari {totalPages}
                    </span>

                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={() => setPage((p) => p - 1)}
                            disabled={page === 1}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border-secondary)",
                                background: "var(--color-background-primary)",
                                color: "var(--color-text-primary)",
                                cursor: page === 1 ? "not-allowed" : "pointer",
                                opacity: page === 1 ? 0.4 : 1,
                                fontSize: "13px",
                            }}
                        >
                            ← Prev
                        </button>

                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page === totalPages}
                            style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                border: "1px solid var(--color-border-secondary)",
                                background: "var(--color-background-primary)",
                                color: "var(--color-text-primary)",
                                cursor: page === totalPages ? "not-allowed" : "pointer",
                                opacity: page === totalPages ? 0.4 : 1,
                                fontSize: "13px",
                            }}
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}

            {showForm && (
                <TransactionForm
                    editData={editData}
                    onClose={() => {
                        setShowForm(false);
                        setEditData(null);
                    }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    );
}