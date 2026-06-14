import { useState, useEffect, useCallback } from "react";
import { useFinance } from "../context/FinanceContext";
import {
    getGoalsAPI,
    createGoalAPI,
    addSavingAPI,
    deleteGoalAPI,
} from "../services/api";
import { formatRupiah, formatDateShort } from "../utils/format";
import { formatNumberInput, parseNumberInput } from "../utils/format";
import Card from "../components/ui/Card";
import ProgressBar from "../components/ui/ProgressBar";
import PageHeader from "../components/Layout/PageHeader";
import Modal from "../components/ui/Modal";
import DropdownMenu from "../components/ui/DropdownMenu";

const PRIORITY_CFG = {
    high: { label: "🔴 Tinggi", color: "#ef4444" },
    medium: { label: "🟡 Sedang", color: "#f59e0b" },
    low: { label: "🟢 Rendah", color: "#10b981" },
};

export default function Goals() {
    const [goals, setGoals] = useState([]);
    const [showModal, setShowModal] = useState(false);
    // const { wallets } = useFinance();
    const { wallets, refresh } = useFinance();

    const [form, setForm] = useState({
        name: "",
        targetAmount: "",
        deadline: "",
        priority: "medium",
        color: "#10b981",
        note: "",
        walletId: "",
    });

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const fetch = useCallback(async () => {
        const res = await getGoalsAPI();
        setGoals(res.data);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetch();
    }, [fetch]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        window.scrollTo(0, 0);
        await createGoalAPI({
            ...form,
            targetAmount: parseNumberInput(form.targetAmount),
        });
        setForm({
            name: "",
            targetAmount: "",
            deadline: "",
            priority: "medium",
            color: "#10b981",
            note: "",
            walletId: "",
        });
        setShowModal(false);
        await fetch();
        await refresh();
    };

    const [deleteModal, setDeleteModal] = useState({ show: false, id: null, walletId: "" });
    const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
    const [deleteConfirmError, setDeleteConfirmError] = useState("");

    const handleDelete = async (id) => {
        const g = goals.find((x) => x._id === id);
        if (!g) return;
        // if there's remaining funds require choosing wallet
        if (g.currentAmount > 0) {
            setDeleteModal({ show: true, id });
            return;
        }
        if (!confirm("Hapus goal ini?")) return;
        await deleteGoalAPI(id);
        setGoals((prev) => prev.filter((g2) => g2._id !== id));
        await refresh();
    };

    const confirmDelete = async (walletId) => {
        const id = deleteModal.id;
        if (!id) return;
        await deleteGoalAPI(id, { walletId });
        setGoals((prev) => prev.filter((g) => g._id !== id));
        setDeleteModal({ show: false, id: null });

        await fetch();
        await refresh();
    };

    const handleAddSaving = async (
        id,
        amount,
        walletId,
        action = "deposit",
    ) => {
        window.scrollTo(0, 0);
        const parsedAmount = parseNumberInput(amount);
        if (!amount || parsedAmount <= 0) return;
        if (!walletId) {
            alert("Pilih wallet terlebih dahulu");
            return;
        }

        await addSavingAPI(id, { amount: parsedAmount, walletId, action });

        await fetch();
        await refresh();
    };

    const activeGoals = goals.filter((g) => g.status === "active");
    const completedGoals = goals.filter((g) => g.status === "completed");

    return (
        <div style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
            <PageHeader
                title="Goals & Tabungan"
                subtitle={`${activeGoals.length} aktif · ${completedGoals.length} tercapai`}
                action={
                    <button
                        onClick={() => setShowModal(true)}
                        style={btnPrimary}
                    >
                        + Buat Goal
                    </button>
                }
            />

            {/* Form buat goal baru (modal) */}
            {showModal && (
                <Modal title="Goal Baru" onClose={() => setShowModal(false)}>
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
                                <label style={lbl}>Nama Goal</label>
                                <input
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            name: e.target.value,
                                        })
                                    }
                                    style={inp}
                                    placeholder="Laptop baru, Liburan Bali..."
                                    required
                                />
                            </div>
                            <div>
                                <label style={lbl}>Target (Rp)</label>
                                <input
                                    type="text"
                                    value={form.targetAmount}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            targetAmount: formatNumberInput(
                                                e.target.value,
                                            ),
                                        })
                                    }
                                    style={inp}
                                    placeholder="8.000.000"
                                    required
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <label style={lbl}>Wallet Penyimpanan</label>
                                <DropdownMenu
                                    label=""
                                    value={form.walletId}
                                    options={[
                                        { value: "", label: "Pilih wallet" },
                                        ...wallets.map((w) => ({
                                            value: w._id,
                                            label: w.name,
                                        })),
                                    ]}
                                    onChange={(v) =>
                                        setForm({
                                            ...form,
                                            walletId: v,
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <label style={lbl}>Deadline (opsional)</label>
                                <input
                                    type="date"
                                    value={form.deadline}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            deadline: e.target.value,
                                        })
                                    }
                                    style={inp}
                                />
                            </div>
                            <div>
                                <label style={lbl}>Prioritas</label>
                                <DropdownMenu
                                    label=""
                                    value={form.priority}
                                    options={[
                                        { value: "high", label: "🔴 Tinggi" },
                                        { value: "medium", label: "🟡 Sedang" },
                                        { value: "low", label: "🟢 Rendah" },
                                    ]}
                                    onChange={(v) =>
                                        setForm({ ...form, priority: v })
                                    }
                                />
                            </div>
                            <div>
                                <label style={lbl}>Warna</label>
                                <input
                                    type="color"
                                    value={form.color}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            color: e.target.value,
                                        })
                                    }
                                    style={{
                                        ...inp,
                                        height: "42px",
                                        padding: "4px",
                                    }}
                                />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <label style={lbl}>Catatan</label>
                                <input
                                    value={form.note}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            note: e.target.value,
                                        })
                                    }
                                    style={inp}
                                    placeholder="Beli laptop buat kerja..."
                                />
                            </div>
                        </div>
                        <button type="submit" style={btnSuccess}>
                            Simpan Goal
                        </button>
                    </form>
                </Modal>
            )}

            {/* Goal aktif */}
            {activeGoals.length > 0 && (
                <>
                    <h2
                        style={{
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "var(--app-text-strong)",
                            marginBottom: "14px",
                        }}
                    >
                        Sedang Berjalan
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(360px, 1fr))",
                            gap: "16px",
                            marginBottom: "32px",
                        }}
                    >
                        {activeGoals.map((g) => (
                            <GoalCard
                                key={g._id}
                                goal={g}
                                wallets={wallets}
                                onAddSaving={handleAddSaving}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Goal selesai */}
            {completedGoals.length > 0 && (
                <>
                    <h2
                        style={{
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "var(--app-text-strong)",
                            marginBottom: "14px",
                        }}
                    >
                        ✅ Sudah Tercapai
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(360px, 1fr))",
                            gap: "16px",
                        }}
                    >
                        {completedGoals.map((g) => (
                            <GoalCard
                                key={g._id}
                                goal={g}
                                wallets={wallets}
                                onAddSaving={handleAddSaving}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                </>
            )}

            {deleteModal.show && (
                <Modal
                    title="Hapus Goal"
                    onClose={() => {
                        setDeleteModal({ show: false, id: null, walletId: "" });
                        setDeleteConfirmInput("");
                        setDeleteConfirmError("");
                    }}
                >
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                            Dana tersisa akan dikembalikan ke dompet:
                        </div>
                        <DropdownMenu
                            label=""
                            value={wallets[0]?._id || ""}
                            options={[
                                { value: "", label: "Pilih dompet" },
                                ...wallets.map((w) => ({
                                    value: w._id,
                                    label: w.name,
                                })),
                            ]}
                            onChange={(v) =>
                                setDeleteModal((d) => ({ ...d, walletId: v }))
                            }
                        />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <div
                            style={{
                                marginBottom: 8,
                                color: "var(--app-muted)",
                            }}
                        >
                            Ketik nama goal untuk konfirmasi hapus:
                        </div>
                        <input
                            type="text"
                            value={deleteConfirmInput}
                            onChange={(e) =>
                                setDeleteConfirmInput(e.target.value)
                            }
                            placeholder={
                                goals.find((x) => x._id === deleteModal.id)
                                    ?.name || ""
                            }
                            style={{ ...inp, marginBottom: 6 }}
                        />
                        {deleteConfirmError && (
                            <div style={{ color: "#ef4444", marginBottom: 8 }}>
                                {deleteConfirmError}
                            </div>
                        )}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                        }}
                    >
                        <button
                            onClick={() => {
                                setDeleteModal({ show: false, id: null, walletId: "" });
                                setDeleteConfirmInput("");
                                setDeleteConfirmError("");
                            }}
                            style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "none",
                                backgroundColor: "var(--app-surface)",
                                color: "var(--app-muted)",
                                cursor: "pointer",
                            }}
                        >
                            Batal
                        </button>
                        <button
                            onClick={() => {
                                const goal = goals.find(
                                    (x) => x._id === deleteModal.id,
                                );
                                if (!goal) return;
                                setDeleteConfirmError("");
                                if (deleteConfirmInput !== goal.name) {
                                    setDeleteConfirmError(
                                        "Nama goal tidak cocok",
                                    );
                                    return;
                                }
                                confirmDelete(deleteModal.walletId);
                                setDeleteConfirmInput("");
                            }}
                            disabled={
                                !deleteModal.walletId ||
                                deleteConfirmInput !==
                                (goals.find((x) => x._id === deleteModal.id)
                                    ?.name || "")
                            }
                            style={{
                                padding: "8px 12px",
                                backgroundColor: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: 8,
                                cursor: "pointer",
                                fontWeight: 700,
                                opacity:
                                    !deleteModal.walletId ||
                                        deleteConfirmInput !==
                                        (goals.find(
                                            (x) => x._id === deleteModal.id,
                                        )?.name || "")
                                        ? 0.6
                                        : 1,
                            }}
                        >
                            Hapus dan Kembalikan Dana
                        </button>
                    </div>
                </Modal>
            )}

            {goals.length === 0 && (
                <Card style={{ textAlign: "center", padding: "60px" }}>
                    <div style={{ fontSize: "40px", marginBottom: "12px" }}>
                        ⭐
                    </div>
                    <div
                        style={{
                            fontWeight: "600",
                            color: "var(--app-text)",
                            marginBottom: "6px",
                        }}
                    >
                        Belum ada goal
                    </div>
                    <div
                        style={{ color: "var(--app-muted)", fontSize: "14px" }}
                    >
                        Buat target tabungan pertama kamu!
                    </div>
                </Card>
            )}
        </div>
    );
}

function GoalCard({ goal: g, wallets = [], onAddSaving, onDelete }) {
    const [input, setInput] = useState("");
    const [showInput, setShowInput] = useState(false);
    const [mode, setMode] = useState("deposit"); // deposit or withdraw
    const defaultWalletId = g.wallet?._id || g.wallet || wallets[0]?._id || "";
    const [selectedWallet, setSelectedWallet] = useState("");

    useEffect(() => {
        setSelectedWallet((prev) => prev || defaultWalletId);
    }, [defaultWalletId]);
    const pCfg = PRIORITY_CFG[g.priority] || PRIORITY_CFG.medium;

    return (
        <Card style={{ borderTop: `4px solid ${g.color}` }}>
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "14px",
                }}
            >
                <div>
                    <div
                        style={{
                            fontWeight: "700",
                            fontSize: "16px",
                            color: "var(--app-text-strong)",
                        }}
                    >
                        {g.name}
                    </div>
                    <div
                        style={{
                            fontSize: "12px",
                            color: pCfg.color,
                            fontWeight: "600",
                            marginTop: "3px",
                        }}
                    >
                        {pCfg.label}
                    </div>
                    {g.note && (
                        <div
                            style={{
                                fontSize: "12px",
                                color: "var(--app-muted)",
                                marginTop: "2px",
                            }}
                        >
                            {g.note}
                        </div>
                    )}
                </div>
                {g.status === "completed" ? (
                    <span
                        style={{
                            backgroundColor: "#d1fae5",
                            color: "#065f46",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "700",
                        }}
                    >
                        ✅ Tercapai
                    </span>
                ) : (
                    <span
                        style={{
                            backgroundColor: "#e0e7ff",
                            color: "#3730a3",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                        }}
                    >
                        Aktif
                    </span>
                )}
            </div>

            {/* Jumlah */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "13px",
                    marginBottom: "8px",
                }}
            >
                <span style={{ color: "var(--app-muted)" }}>Terkumpul</span>
                <span
                    style={{
                        fontWeight: "700",
                        color: "var(--app-text-strong)",
                    }}
                >
                    {formatRupiah(g.currentAmount)} /{" "}
                    {formatRupiah(g.targetAmount)}
                </span>
            </div>

            {/* Progress */}
            <ProgressBar
                percentage={g.percentage}
                color={g.color}
                height={10}
                showLabel
            />

            {/* Info tambahan */}
            <div
                style={{
                    display: "flex",
                    gap: "16px",
                    marginTop: "10px",
                    fontSize: "12px",
                    color: "var(--app-muted)",
                }}
            >
                {g.deadline && <span>🗓️ {formatDateShort(g.deadline)}</span>}
                {g.monthlyTarget > 0 && (
                    <span>💵 {formatRupiah(g.monthlyTarget)}/bln</span>
                )}
                <span>Sisa {formatRupiah(g.remaining)}</span>
            </div>

            {/* Tambah tabungan */}
            {g.status !== "completed" && (
                <div style={{ marginTop: "14px" }}>
                    {showInput ? (
                        <div style={{ display: "grid", gap: "8px" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                                <DropdownMenu
                                    label=""
                                    value={selectedWallet}
                                    options={[
                                        { value: "", label: "Pilih dompet" },
                                        ...wallets.map((w) => ({
                                            value: w._id,
                                            label: w.name,
                                        })),
                                    ]}
                                    onChange={(v) => setSelectedWallet(v)}
                                />
                                <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                        onClick={() => setMode("deposit")}
                                        style={{
                                            padding: "9px 12px",
                                            borderRadius: 8,
                                            border:
                                                mode === "deposit"
                                                    ? "1px solid rgba(16, 185, 129, 0.35)"
                                                    : "1px solid var(--app-border)",
                                            backgroundColor:
                                                mode === "deposit"
                                                    ? "rgba(16, 185, 129, 0.14)"
                                                    : "var(--app-surface-soft)",
                                            color:
                                                mode === "deposit"
                                                    ? "#34d399"
                                                    : "var(--app-muted)",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Setor
                                    </button>
                                    <button
                                        onClick={() => setMode("withdraw")}
                                        style={{
                                            padding: "9px 12px",
                                            borderRadius: 8,
                                            border:
                                                mode === "withdraw"
                                                    ? "1px solid rgba(251, 113, 133, 0.35)"
                                                    : "1px solid var(--app-border)",
                                            backgroundColor:
                                                mode === "withdraw"
                                                    ? "rgba(251, 113, 133, 0.14)"
                                                    : "var(--app-surface-soft)",
                                            color:
                                                mode === "withdraw"
                                                    ? "#fb7185"
                                                    : "var(--app-muted)",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Tarik
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) =>
                                        setInput(
                                            formatNumberInput(e.target.value),
                                        )
                                    }
                                    placeholder={
                                        mode === "deposit"
                                            ? "Jumlah tabungan..."
                                            : "Jumlah tarik..."
                                    }
                                    inputMode="numeric"
                                    style={{
                                        flex: 1,
                                        padding: "9px 12px",
                                        border: "1.5px solid var(--app-border)",
                                        borderRadius: "8px",
                                        fontSize: "14px",
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        onAddSaving(
                                            g._id,
                                            input,
                                            selectedWallet,
                                            mode,
                                        );
                                        setInput("");
                                        setShowInput(false);
                                    }}
                                    style={{
                                        padding: "9px 14px",
                                        backgroundColor:
                                            mode === "deposit"
                                                ? "#10b981"
                                                : "#ef4444",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                        fontWeight: "700",
                                    }}
                                >
                                    {mode === "deposit" ? "Tambah" : "Tarik"}
                                </button>
                                <button
                                    onClick={() => setShowInput(false)}
                                    style={{
                                        padding: "9px 12px",
                                        backgroundColor:
                                            "var(--app-surface-soft)",
                                        border: "none",
                                        borderRadius: "8px",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowInput(true)}
                            style={{
                                ...btnOutlineDashed,
                                borderColor: g.color,
                                color: g.color,
                            }}
                        >
                            {"+ Tambah / Tarik Dana"}
                        </button>
                    )}
                </div>
            )}

            <button onClick={() => onDelete(g._id)} style={btnGhostFull}>
                Hapus goal
            </button>
        </Card>
    );
}

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

const btnPrimary = {
    padding: "10px 20px",
    background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
};

const btnSuccess = {
    padding: "10px 24px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "14px",
};

const btnDanger = {
    padding: "8px 12px",
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "700",
};

const btnGhost = {
    padding: "8px 12px",
    backgroundColor: "var(--app-surface-soft)",
    color: "var(--app-text)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
};

const btnGhostFull = {
    ...btnGhost,
    width: "100%",
    textAlign: "center",
    marginTop: "8px",
    color: "#fb7185",
    fontSize: "12px",
    backgroundColor: "rgba(251, 113, 133, 0.12)",
    border: "1px solid rgba(251, 113, 133, 0.22)",
    fontWeight: "700",
};

const btnOutlineDashed = {
    width: "100%",
    padding: "10px",
    backgroundColor: "rgba(79, 70, 229, 0.08)",
    color: "var(--accent)",
    border: "1.5px solid rgba(79, 70, 229, 0.24)",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "13px",
};