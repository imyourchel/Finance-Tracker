import { FiRepeat, FiArrowDownLeft, FiArrowUpRight, FiEdit2, FiTrash2 } from "react-icons/fi";
import { formatRupiah, formatDateShort, TYPE_COLOR } from "../../utils/format";
import { CATEGORY_ICONS } from "../../utils/categoryIcons";

const MOOD_EMOJI = {
    // new keys
    senang: "😄",
    sedih: "😔",
    biasa: "😐",
    self_reward: "🎁",
    terpaksa: "😩",
    bangga: "😌",
    bersalah: "😖",
    // fallback old keys
    happy: "😄",
    neutral: "😐",
    stressed: "😩",
    guilty: "😖",
    proud: "😌",
};

export default function TransactionItem({ transaction: t, onDelete, onEdit }) {
    const color = TYPE_COLOR[t.type] || "#64748b";
    const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "↔";
    const transferTitle =
        t.type === "expense" ? "Transfer Keluar" : "Transfer Masuk";
    const title = t.isTransfer ? transferTitle : t.debtId ? (t.type === "income" ? "Utang / pelunasan masuk" : "Pinjaman / bayar utang") : t.goalId ? (t.type === "income" ? "Tarik dari goal" : "Tabungan goal") : t.category?.name || "Lainnya";
    let walletLabel;
    if (t.isTransfer && t.transferTo) {
        if (t.type === "expense") {
            walletLabel = `${t.wallet?.name || "—"} → ${t.transferTo?.name || "—"}`;
        } else if (t.type === "income") {
            walletLabel = `${t.wallet?.name || "—"} ← ${t.transferTo?.name || "—"}`;
        } else {
            walletLabel = `${t.wallet?.name || "—"} ↔ ${t.transferTo?.name || "—"}`;
        }
    } else {
        walletLabel = t.wallet?.name || "—";
    }

    const Icon = t.isTransfer
        ? FiRepeat
        : CATEGORY_ICONS[t.category?.icon] || (t.type === "income" ? FiArrowDownLeft : FiArrowUpRight);
    const iconColor = t.isTransfer ? "var(--accent)" : t.category?.color || color;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderBottom: "1px solid var(--app-border)",
            }}
        >
            {/* Ikon kategori (+ mood kecil di pojok) */}
            <div
                style={{
                    position: "relative",
                    width: "40px",
                    height: "40px",
                    borderRadius: "11px",
                    flexShrink: 0,
                    backgroundColor: `color-mix(in srgb, ${iconColor} 14%, transparent)`,
                    color: iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                }}
            >
                <Icon aria-hidden />
                {MOOD_EMOJI[t.mood] && (
                    <span
                        title="Mood"
                        style={{
                            position: "absolute",
                            right: "-5px",
                            bottom: "-5px",
                            fontSize: "13px",
                            lineHeight: 1,
                            background: "var(--app-surface)",
                            borderRadius: "50%",
                            padding: "1px",
                        }}
                    >
                        {MOOD_EMOJI[t.mood]}
                    </span>
                )}
            </div>

            {/* Info transaksi */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                    }}
                >
                    <span
                        style={{
                            fontWeight: "600",
                            fontSize: "14px",
                            color: "var(--app-text-strong)",
                        }}
                    >
                        {title}
                    </span>
                    {t.isTransfer && (
                        <span
                            style={{
                                fontSize: "10px",
                                backgroundColor: "var(--accent-bg)",
                                color: "var(--accent)",
                                padding: "1px 6px",
                                borderRadius: "10px",
                            }}
                        >
                            Transfer
                        </span>
                    )}
                    {t.isRecurring && (
                        <span
                            style={{
                                fontSize: "10px",
                                backgroundColor: "rgba(16, 185, 129, 0.16)",
                                color: "#10b981",
                                padding: "1px 6px",
                                borderRadius: "10px",
                            }}
                        >
                            Rutin
                        </span>
                    )}
                </div>
                <div
                    style={{
                        fontSize: "12px",
                        color: "var(--app-muted)",
                        marginTop: "2px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {t.description || walletLabel}
                </div>
                <div
                    style={{
                        fontSize: "11px",
                        color: "var(--app-muted)",
                        marginTop: "1px",
                    }}
                >
                    {formatDateShort(t.date)} • {walletLabel}
                </div>
            </div>

            {/* Jumlah */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: "700", color, fontSize: "15px" }}>
                    {sign}
                    {formatRupiah(t.amount)}
                </div>
                {t.isTransfer && Number(t.transferFee || 0) > 0 && (
                    <div
                        style={{ fontSize: "11px", color: "var(--app-muted)" }}
                    >
                        Fee {formatRupiah(t.transferFee)}
                    </div>
                )}
                {t.tags?.length > 0 && (
                    <div
                        style={{ fontSize: "11px", color: "var(--app-muted)" }}
                    >
                        {t.tags.slice(0, 2).join(", ")}
                    </div>
                )}
            </div>

            {/* Tombol aksi */}
            {!t.debtId && ((onEdit && !t.isTransfer) || onDelete) && (
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    {onEdit && !t.isTransfer && (
                        <button
                            onClick={() => onEdit(t)}
                            style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "8px",
                                border: "1px solid var(--app-border)",
                                backgroundColor: "var(--app-surface-soft)",
                                color: "var(--app-text-strong)",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            <FiEdit2 aria-label="Edit" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={() => onDelete(t._id)}
                            style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "8px",
                                border: "1px solid rgba(239, 68, 68, 0.28)",
                                backgroundColor: "rgba(239, 68, 68, 0.12)",
                                color: "#ef4444",
                                cursor: "pointer",
                                fontSize: "13px",
                            }}
                        >
                            <FiTrash2 aria-label="Hapus" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
