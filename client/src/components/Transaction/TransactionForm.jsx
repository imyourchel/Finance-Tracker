import { useEffect, useState } from "react";
import { createTransactionAPI, updateTransactionAPI } from "../../services/api";
import { useFinance } from "../../context/FinanceContext";
import {
    formatDateInput,
    formatNumberInput,
    parseNumberInput,
} from "../../utils/format";
import Modal from "../ui/Modal";
import DropdownMenu from "../ui/DropdownMenu";

const MOODS = [
    { value: "senang", label: "😄 Senang" },
    { value: "sedih", label: "😔 Sedih" },
    { value: "biasa", label: "😐 Biasa" },
    { value: "self_reward", label: "🎁 Self Reward" },
    { value: "terpaksa", label: "😩 Terpaksa" },
    { value: "bangga", label: "😌 Bangga" },
    { value: "bersalah", label: "😖 Bersalah" },
];

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid var(--app-border)",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    color: "var(--app-text-strong)",
    backgroundColor: "var(--app-surface)",
};

const labelStyle = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--app-text)",
    marginBottom: "6px",
};

export default function TransactionForm({ editData, onClose, onSaved }) {
    const { wallets, categories } = useFinance();

    const [form, setForm] = useState({
        type: editData?.type || "expense",
        walletId: editData?.wallet?._id || wallets[0]?._id || "",
        categoryId: editData?.category?._id || "",
        transferTo: editData?.transferTo?._id || "",
        transferFee:
            editData?.transferFee !== undefined &&
                editData?.transferFee !== null
                ? formatNumberInput(editData.transferFee)
                : "",
        amount:
            editData?.amount !== undefined && editData?.amount !== null
                ? formatNumberInput(editData.amount)
                : "",
        description: editData?.description || "",
        date: editData?.date
            ? formatDateInput(editData.date)
            : formatDateInput(new Date()),
        mood: editData?.mood || "",
        tags: editData?.tags?.join(", ") || "",
        subCategory: editData?.subCategory || "",
        location: editData?.location || "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [receiptFile, setReceiptFile] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(
        editData?.receiptImage || null,
    );
    const [receiptRemoved, setReceiptRemoved] = useState(false);

    const filteredCategories = categories.filter(
        (c) => c.type === form.type || c.type === "both",
    );

    const transferWalletOptions = wallets.filter(
        (wallet) => wallet._id !== form.walletId,
    );

    useEffect(() => {
        if (form.type !== "transfer") return;

        const hasValidDestination = transferWalletOptions.some(
            (wallet) => wallet._id === form.transferTo,
        );
        if (!hasValidDestination) {
            set("transferTo", transferWalletOptions[0]?._id || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.type, form.walletId, transferWalletOptions]);

    const set = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.walletId) return setError("Pilih dompet terlebih dahulu");
        if (form.type !== "transfer" && !form.categoryId)
            return setError("Pilih kategori terlebih dahulu");
        if (form.type === "transfer" && !form.transferTo)
            return setError("Pilih wallet tujuan transfer");
        const amount = parseNumberInput(form.amount);
        const transferFee = parseNumberInput(form.transferFee);

        if (!form.amount || amount <= 0)
            return setError("Masukkan jumlah yang valid");
        if (form.type === "transfer" && transferFee < 0)
            return setError("Transfer fee tidak boleh negatif");

        setLoading(true);
        try {
            const basePayload = {
                walletId: form.walletId,
                categoryId:
                    form.type === "transfer"
                        ? undefined
                        : form.categoryId || undefined,
                type: form.type,
                amount: parseNumberInput(form.amount),
                transferTo: form.type === "transfer" ? form.transferTo : null,
                transferFee: form.type === "transfer" ? parseNumberInput(form.transferFee) : 0,
                mood: form.mood || null,
                tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [],
                description: form.description,
                date: form.date,
            };

            // If there's a file or the user removed an existing receipt, send as FormData
            if (receiptFile || receiptRemoved) {
                const fd = new FormData();
                Object.keys(basePayload).forEach((k) => {
                    const v = basePayload[k];
                    if (v !== undefined && v !== null) fd.append(k, v);
                });
                if (receiptFile) fd.append("receipt", receiptFile);
                if (receiptRemoved) fd.append("receiptRemoved", "true");

                editData
                    ? await updateTransactionAPI(editData._id, fd)
                    : await createTransactionAPI(fd);
            } else {
                editData
                    ? await updateTransactionAPI(editData._id, basePayload)
                    : await createTransactionAPI(basePayload);
            }
            onSaved();
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal menyimpan transaksi",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setReceiptFile(f);
        setReceiptPreview(URL.createObjectURL(f));
        setReceiptRemoved(false);
    };

    const handleRemoveReceipt = () => {
        setReceiptFile(null);
        setReceiptPreview(null);
        setReceiptRemoved(true);
    };

    return (
        <Modal
            title={editData ? "Edit Transaksi" : "Tambah Transaksi"}
            onClose={onClose}
        >
            {error && (
                <div
                    style={{
                        padding: "10px 14px",
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        marginBottom: "16px",
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* Tipe */}
                <div style={{ marginBottom: "18px" }}>
                    <label style={labelStyle}>Tipe Transaksi</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {[
                            {
                                v: "expense",
                                label: "📉 Keluar",
                                color: "#ef4444",
                            },
                            {
                                v: "income",
                                label: "📈 Masuk",
                                color: "#10b981",
                            },
                            {
                                v: "transfer",
                                label: "🔄 Transfer",
                                color: "#4f46e5",
                            },
                        ].map(({ v, label, color }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => {
                                    set("type", v);
                                    set("categoryId", "");
                                    if (v === "transfer") {
                                        const fallback = wallets.find(
                                            (wallet) =>
                                                wallet._id !== form.walletId,
                                        );
                                        set("transferTo", fallback?._id || "");
                                    } else {
                                        set("transferTo", "");
                                        set("transferFee", "");
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: "10px 6px",
                                    borderRadius: "10px",
                                    border: `2px solid ${form.type === v ? color : "var(--app-border)"}`,
                                    backgroundColor:
                                        form.type === v
                                            ? color + "1a"
                                            : "var(--app-surface)",
                                    color:
                                        form.type === v
                                            ? color
                                            : "var(--app-text)",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    transition: "all 0.15s",
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Jumlah */}
                <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Jumlah (Rp)</label>
                    <input
                        type="text"
                        value={form.amount}
                        onChange={(e) =>
                            set("amount", formatNumberInput(e.target.value))
                        }
                        placeholder="0"
                        inputMode="numeric"
                        required
                        style={{
                            ...inputStyle,
                            fontSize: "18px",
                            fontWeight: "700",
                        }}
                    />
                </div>

                {/* Wallet */}
                <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>
                        {form.type === "transfer" ? "Dompet Asal" : "Dompet"}
                    </label>
                    <DropdownMenu
                        label=""
                        value={form.walletId}
                        options={[
                            { value: "", label: "Pilih dompet..." },
                            ...wallets.map((w) => ({
                                value: w._id,
                                label: w.name,
                            })),
                        ]}
                        onChange={(v) => set("walletId", v)}
                    />
                </div>

                {/* Kategori */}
                {form.type !== "transfer" ? (
                    <div style={{ marginBottom: "16px" }}>
                        <label style={labelStyle}>Kategori</label>
                        <DropdownMenu
                            label=""
                            value={form.categoryId}
                            options={[
                                { value: "", label: "Pilih kategori..." },
                                ...filteredCategories.map((c) => ({
                                    value: c._id,
                                    label: c.name,
                                })),
                            ]}
                            onChange={(v) => set("categoryId", v)}
                        />
                    </div>
                ) : (
                    <div style={{ marginBottom: "16px" }}>
                        <label style={labelStyle}>Wallet Tujuan</label>
                        <DropdownMenu
                            label=""
                            value={form.transferTo}
                            options={[
                                { value: "", label: "Pilih wallet tujuan..." },
                                ...transferWalletOptions.map((w) => ({
                                    value: w._id,
                                    label: w.name,
                                })),
                            ]}
                            onChange={(v) => set("transferTo", v)}
                        />
                    </div>
                )}

                {form.type === "transfer" && (
                    <div style={{ marginBottom: "16px" }}>
                        <label style={labelStyle}>Transfer Fee (Rp)</label>
                        <input
                            type="text"
                            value={form.transferFee}
                            onChange={(e) =>
                                set(
                                    "transferFee",
                                    formatNumberInput(e.target.value),
                                )
                            }
                            placeholder="0"
                            inputMode="numeric"
                            style={inputStyle}
                        />
                    </div>
                )}

                {/* Grid: Tanggal & Lokasi */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "12px",
                        marginBottom: "16px",
                    }}
                >
                    <div>
                        <label style={labelStyle}>Tanggal</label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => set("date", e.target.value)}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>Lokasi (opsional)</label>
                        <input
                            type="text"
                            value={form.location}
                            onChange={(e) => set("location", e.target.value)}
                            placeholder="Warung Pak Budi..."
                            style={inputStyle}
                        />
                    </div>
                </div>

                {/* Keterangan */}
                <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Keterangan (opsional)</label>
                    <input
                        type="text"
                        value={form.description}
                        onChange={(e) => set("description", e.target.value)}
                        placeholder="Nasi goreng 2x, bayar tagihan..."
                        style={inputStyle}
                    />
                </div>

                {/* Mood */}
                <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Mood saat bayar</label>
                    <div
                        style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                        }}
                    >
                        {MOODS.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() =>
                                    set(
                                        "mood",
                                        form.mood === m.value ? "" : m.value,
                                    )
                                }
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: "12px",
                                    fontSize: "13px",
                                    cursor: "pointer",
                                    border: `1.5px solid ${form.mood === m.value ? "#4f46e5" : "var(--app-border)"}`,
                                    backgroundColor:
                                        form.mood === m.value
                                            ? "rgba(79, 70, 229, 0.08)"
                                            : "var(--app-surface)",
                                    color:
                                        form.mood === m.value
                                            ? "#4338ca"
                                            : "var(--app-text)",
                                    fontWeight:
                                        form.mood === m.value ? "600" : "500",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    minWidth: 140,
                                }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tags */}
                <div style={{ marginBottom: "24px" }}>
                    <label style={labelStyle}>Tags (pisahkan koma)</label>
                    <input
                        type="text"
                        value={form.tags}
                        onChange={(e) => set("tags", e.target.value)}
                        placeholder="kopi, nongkrong, weekend..."
                        style={inputStyle}
                    />
                </div>

                {/* Receipt image - improved upload UI */}
                {/* <div style={{ marginBottom: "16px" }}>
                    <label style={labelStyle}>Bukti (opsional)</label>

                    <div
                        onDrop={(e) => {
                            e.preventDefault();
                            const f =
                                e.dataTransfer.files && e.dataTransfer.files[0];
                            if (f) {
                                setReceiptFile(f);
                                setReceiptPreview(URL.createObjectURL(f));
                                setReceiptRemoved(false);
                            }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        style={{
                            border: "1.5px dashed var(--app-border)",
                            borderRadius: 10,
                            padding: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            background: "var(--app-surface)",
                        }}
                    >
                        <input
                            id="receipt-input"
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ display: "none" }}
                        />

                        {receiptPreview ? (
                            <>
                                <img
                                    src={receiptPreview}
                                    alt="receipt"
                                    style={{
                                        width: 120,
                                        height: 84,
                                        objectFit: "cover",
                                        borderRadius: 8,
                                        border: "1px solid var(--app-border)",
                                    }}
                                />
                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            color: "var(--app-text-strong)",
                                        }}
                                    >
                                        {receiptFile?.name || "Preview gambar"}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 8,
                                            display: "flex",
                                            gap: 8,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                document
                                                    .getElementById(
                                                        "receipt-input",
                                                    )
                                                    .click()
                                            }
                                            style={{
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid var(--app-border)",
                                                background:
                                                    "var(--app-surface)",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Ganti
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveReceipt}
                                            style={{
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid rgba(239,68,68,0.28)",
                                                background:
                                                    "rgba(239,68,68,0.08)",
                                                color: "#ef4444",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    flex: 1,
                                }}
                            >
                                <div style={{ fontSize: 28 }}>📎</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>
                                        Tarik & lepas gambar di sini
                                    </div>
                                    <div
                                        style={{
                                            color: "var(--app-muted)",
                                            marginTop: 6,
                                            fontSize: 13,
                                        }}
                                    >
                                        Atau klik tombol untuk memilih file
                                    </div>
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            document
                                                .getElementById("receipt-input")
                                                .click()
                                        }
                                        style={{
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            border: "1px solid var(--app-border)",
                                            background: "var(--app-surface)",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Pilih File
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div> */}

                {/* Tombol simpan */}
                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: "13px",
                        background: loading
                            ? "var(--app-surface-soft)"
                            : "linear-gradient(135deg,var(--app-button-primary-from),var(--app-button-primary-to))",
                        color: loading
                            ? "var(--app-muted)"
                            : "var(--app-button-primary-text)",
                        border: "none",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "15px",
                        cursor: loading ? "not-allowed" : "pointer",
                        transition: "background 0.15s",
                    }}
                >
                    {loading
                        ? "Menyimpan..."
                        : editData
                            ? "💾 Simpan Perubahan"
                            : "✅ Simpan Transaksi"}
                </button>
            </form>
        </Modal>
    );
}
