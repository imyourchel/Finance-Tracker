import { useState, useEffect } from "react";
import { confirmDialog } from "../utils/confirm";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";
import FormScreen from "../components/ui/FormScreen";
import { useFinance } from "../context/FinanceContext";
import {
    createWalletAPI,
    updateWalletAPI,
    createTransactionAPI,
    archiveWalletAPI,
} from "../services/api";
import DropdownMenu from "../components/ui/DropdownMenu";
import { FiArrowRight } from "react-icons/fi";
import "../styles/wallet.css";
import ColorSwatches from "../components/ui/ColorSwatches";
import {
    formatNumberInput,
    formatRupiah,
    parseNumberInput,
} from "../utils/format";

const typeLabel = {
    cash: "Cash",
    bank: "Bank",
    "e-wallet": "E-Wallet",
    investment: "Investasi",
    gold: "Emas",
    other: "Lainnya",
};

const GOLD_COLOR = "#b8923f";

// "12,5" atau "12.5" → 12.5 (berat emas boleh desimal)
const parseWeight = (v) => Number(String(v || "").replace(",", "."));
const cleanWeightInput = (v) =>
    v.replace(/[^0-9.,]/g, "").replace(/([.,].*)[.,]/g, "$1").slice(0, 8);
const formatWeight = (n) =>
    Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 3 });

function getTextColorForBg(hex) {
    const safeHex = (hex || "#1e6e55").replace("#", "");
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

    return luminance > 0.62 ? "#13221e" : "#ffffff";
}

export default function Wallets() {
    const { wallets, totalBalance, loadingData, refresh } = useFinance();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: "",
        type: "bank",
        balance: "0",
        color: "#1e6e55",
        goldWeight: "",
        goldBuyPrice: "",
    });
    const isGoldForm = form.type === "gold";
    const goldValue =
        parseWeight(form.goldWeight) * parseNumberInput(form.goldBuyPrice || "0");
    const [error, setError] = useState("");
    const [editModal, setEditModal] = useState(false);
    const [editingWallet, setEditingWallet] = useState(null);
    const [editColor, setEditColor] = useState("#1e6e55");
    const [editBalance, setEditBalance] = useState("0");
    const [editGoldWeight, setEditGoldWeight] = useState("");
    const [editGoldPrice, setEditGoldPrice] = useState("");
    const [editDefault, setEditDefault] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const isOnboarding =
        searchParams.get("onboarding") === "1" ||
        localStorage.getItem("wallet-onboarding") === "1";

    const handleOpenModal = () => {
        setError("");
        setShowModal(true);
    };

    const handleCloseModal = () => {
        if (saving) return;
        setShowModal(false);
        setError("");
    };

    const handleFinishOnboarding = () => {
        localStorage.removeItem("wallet-onboarding");
        navigate("/");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const parsedBalance = parseNumberInput(form.balance);
        if (!form.name.trim()) {
            setError("Nama wallet wajib diisi");
            return;
        }
        if (isGoldForm) {
            if (!(parseWeight(form.goldWeight) > 0))
                return setError("Isi berat emas dalam gram, contoh: 5 atau 2,5");
            if (!(parseNumberInput(form.goldBuyPrice || "0") > 0))
                return setError("Isi harga beli emas per gram");
        } else if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
            setError("Saldo awal harus angka dan tidak boleh negatif");
            return;
        }

        setSaving(true);
        window.scrollTo(0, 0);
        try {
            await createWalletAPI({
                name: form.name.trim(),
                type: form.type,
                balance: isGoldForm ? Math.round(goldValue) : parsedBalance,
                initialBalance: isGoldForm
                    ? Math.round(goldValue)
                    : parsedBalance,
                color: form.color,
                icon:
                    form.type === "e-wallet"
                        ? "smartphone"
                        : isGoldForm
                          ? "gold"
                          : "wallet",
                ...(isGoldForm && {
                    goldWeight: parseWeight(form.goldWeight),
                    goldBuyPrice: parseNumberInput(form.goldBuyPrice),
                }),
            });
            await refresh();
            setForm({
                name: "",
                type: "bank",
                balance: "0",
                color: "#1e6e55",
                goldWeight: "",
                goldBuyPrice: "",
            });
            setShowModal(false);
        } catch (err) {
            setError(err.response?.data?.message || "Gagal membuat wallet");
        } finally {
            setSaving(false);
        }
    };

    if (showModal) {
        return (
        <FormScreen backLabel="Wallet" title="Tambah wallet"
            subtitle="Tambahkan rekening bank, e-wallet, uang tunai, atau emas." onClose={handleCloseModal}>
            <form onSubmit={handleSubmit}>
                {error && <div style={errorBox}>⚠️ {error}</div>}

                <div style={modalGridTwo}>
                    <Field label="Nama Wallet">
                        <input
                            value={form.name}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    name: e.target.value,
                                })
                            }
                            style={inputStyle}
                            placeholder={
                                isGoldForm
                                    ? "Antam, Pegadaian, Tabungan Emas"
                                    : "BCA, Gopay, OVO, Cash"
                            }
                            autoFocus
                            required
                        />
                    </Field>
                    <Field label="Tipe Wallet">
                        <DropdownMenu
                            label=""
                            value={form.type}
                            options={Object.keys(typeLabel).map(
                                (k) => ({
                                    value: k,
                                    label: typeLabel[k],
                                }),
                            )}
                            onChange={(v) =>
                                setForm({
                                    ...form,
                                    type: v,
                                    color:
                                        v === "gold"
                                            ? GOLD_COLOR
                                            : form.color === GOLD_COLOR
                                              ? "#1e6e55"
                                              : form.color,
                                })
                            }
                        />
                    </Field>
                </div>

                {isGoldForm ? (
                    <div style={{ marginBottom: "14px" }}>
                        <div style={modalGridTwo}>
                            <Field label="Berat emas">
                                <div className="unit-input">
                                    <input
                                        type="text"
                                        value={form.goldWeight}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                goldWeight:
                                                    cleanWeightInput(
                                                        e.target.value,
                                                    ),
                                            })
                                        }
                                        style={inputStyle}
                                        placeholder="contoh: 5 atau 2,5"
                                        inputMode="decimal"
                                        required
                                    />
                                    <span>gram</span>
                                </div>
                            </Field>
                            <Field label="Harga beli per gram">
                                <div className="money-input">
                                    <input
                                        type="text"
                                        value={form.goldBuyPrice}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                goldBuyPrice:
                                                    formatNumberInput(
                                                        e.target.value,
                                                    ),
                                            })
                                        }
                                        style={inputStyle}
                                        placeholder="1.350.000"
                                        inputMode="numeric"
                                        required
                                    />
                                </div>
                            </Field>
                        </div>
                        <div className="gold-summary">
                            <span>Nilai emas (harga beli)</span>
                            <strong>
                                {goldValue > 0
                                    ? formatRupiah(Math.round(goldValue))
                                    : "Rp 0"}
                            </strong>
                        </div>
                    </div>
                ) : (
                <div style={{ marginBottom: "14px" }}>
                    <Field label="Saldo Awal">
                        <div className="money-input">
                            <input
                                type="text"
                                value={form.balance}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        balance: formatNumberInput(
                                            e.target.value,
                                        ),
                                    })
                                }
                                style={inputStyle}
                                placeholder="0"
                                inputMode="numeric"
                                required
                            />
                        </div>
                    </Field>
                </div>
                )}

                <div style={{ marginBottom: "22px" }}>
                    <Field label="Warna kartu">
                        <ColorSwatches
                            value={form.color}
                            onChange={(c) =>
                                setForm({ ...form, color: c })
                            }
                        />
                    </Field>
                </div>

                <div style={modalActions}>
                    <button
                        type="button"
                        onClick={handleCloseModal}
                        style={secondaryBtn}
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        aria-busy={saving}
                        style={{
                            ...actionBtn,
                            minWidth: "140px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            opacity: saving ? 0.85 : 1,
                        }}
                    >
                        {saving && (
                            <span className="btn-spinner" aria-hidden />
                        )}
                        {saving ? "Menyimpan..." : "Buat Wallet"}
                    </button>
                </div>
            </form>
        </FormScreen>
        );
    }

    if (editModal) {
        return (
        <FormScreen backLabel="Wallet"
            title={`Edit wallet ${editingWallet?.name || ""}`}
            onClose={() => setEditModal(false)}
        >
            {editError && <div style={errorBox}>⚠️ {editError}</div>}
            <form
                onSubmit={async (e) => {
                    e.preventDefault();
                    setEditError("");
                    const isGoldEdit = editingWallet?.type === "gold";
                    const parsed = parseNumberInput(editBalance);
                    if (isGoldEdit) {
                        if (!(parseWeight(editGoldWeight) > 0))
                            return setEditError(
                                "Isi berat emas dalam gram",
                            );
                        if (!(parseNumberInput(editGoldPrice || "0") > 0))
                            return setEditError(
                                "Isi harga beli emas per gram",
                            );
                    } else if (Number.isNaN(parsed) || parsed < 0) {
                        return setEditError(
                            "Saldo harus angka dan >= 0",
                        );
                    }
                    // Check if trying to remove default status when it's the only default
                    if (
                        editingWallet.isDefault &&
                        !editDefault &&
                        wallets.filter((w) => w.isDefault).length === 1
                    ) {
                        return setEditError(
                            "Minimal satu wallet harus default.",
                        );
                    }
                    const balanceDelta = isGoldEdit
                        ? 0
                        : parsed - (editingWallet?.balance || 0);
                    const okEdit = await confirmDialog({
                        title: `Simpan perubahan ${editingWallet?.name}?`,
                        message:
                            balanceDelta !== 0
                                ? `Saldo berubah ${balanceDelta > 0 ? "+" : "−"}${formatRupiah(Math.abs(balanceDelta))}. Selisihnya dicatat sebagai transaksi "Penyesuaian saldo".`
                                : "Perubahan warna, status default, atau data emas akan disimpan.",
                        confirmLabel: "Simpan",
                        danger: false,
                    });
                    if (!okEdit) return;
                    setEditSaving(true);
                    window.scrollTo(0, 0);
                    try {
                        // prepare update payload
                        const updatePayload = {};
                        if (editColor !== editingWallet.color) {
                            updatePayload.color = editColor;
                        }
                        if (editDefault !== editingWallet.isDefault) {
                            updatePayload.isDefault = editDefault;
                        }
                        if (isGoldEdit) {
                            // saldo emas dihitung ulang di server
                            updatePayload.goldWeight =
                                parseWeight(editGoldWeight);
                            updatePayload.goldBuyPrice =
                                parseNumberInput(editGoldPrice);
                        }
                        if (Object.keys(updatePayload).length > 0) {
                            await updateWalletAPI(
                                editingWallet._id,
                                updatePayload,
                            );
                        }
                        // handle balance difference by creating transaction
                        const delta = isGoldEdit
                            ? 0
                            : parsed - (editingWallet?.balance || 0);
                        if (delta !== 0) {
                            const t = {
                                walletId: editingWallet._id,
                                type: delta > 0 ? "income" : "expense",
                                amount: Math.abs(delta),
                                description: "Penyesuaian saldo",
                            };
                            await createTransactionAPI(t);
                        }
                        await refresh();
                        setEditModal(false);
                    } catch (err) {
                        setEditError(
                            err.response?.data?.message ||
                                "Gagal menyimpan perubahan",
                        );
                    } finally {
                        setEditSaving(false);
                    }
                }}
            >
                <div style={{ display: "grid", gap: "12px" }}>
                    <Field label="Warna">
                        <ColorSwatches
                            value={editColor}
                            onChange={setEditColor}
                        />
                    </Field>
                    {editingWallet?.type === "gold" ? (
                        <>
                            <div style={modalGridTwo}>
                                <Field label="Berat emas">
                                    <div className="unit-input">
                                        <input
                                            type="text"
                                            value={editGoldWeight}
                                            onChange={(e) =>
                                                setEditGoldWeight(
                                                    cleanWeightInput(
                                                        e.target.value,
                                                    ),
                                                )
                                            }
                                            style={inputStyle}
                                            inputMode="decimal"
                                        />
                                        <span>gram</span>
                                    </div>
                                </Field>
                                <Field label="Harga beli per gram">
                                    <div className="money-input">
                                        <input
                                            type="text"
                                            value={editGoldPrice}
                                            onChange={(e) =>
                                                setEditGoldPrice(
                                                    formatNumberInput(
                                                        e.target.value,
                                                    ),
                                                )
                                            }
                                            style={inputStyle}
                                            inputMode="numeric"
                                        />
                                    </div>
                                </Field>
                            </div>
                            <div className="gold-summary">
                                <span>Nilai emas (harga beli)</span>
                                <strong>
                                    {formatRupiah(
                                        Math.round(
                                            parseWeight(editGoldWeight) *
                                                parseNumberInput(
                                                    editGoldPrice || "0",
                                                ),
                                        ) || 0,
                                    )}
                                </strong>
                            </div>
                        </>
                    ) : (
                    <Field label="Saldo Saat Ini">
                        <input
                            type="text"
                            value={editBalance}
                            onChange={(e) =>
                                setEditBalance(
                                    formatNumberInput(e.target.value),
                                )
                            }
                            style={inputStyle}
                            inputMode="numeric"
                        />
                    </Field>
                    )}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <input
                            type="checkbox"
                            id="editDefaultCheckbox"
                            checked={editDefault}
                            onChange={(e) =>
                                setEditDefault(e.target.checked)
                            }
                            style={{
                                cursor: "pointer",
                                width: "16px",
                                height: "16px",
                            }}
                        />
                        <label
                            htmlFor="editDefaultCheckbox"
                            style={{
                                fontSize: "14px",
                                color: "var(--app-text-strong)",
                                cursor: "pointer",
                            }}
                        >
                            Jadikan Wallet Default
                        </label>
                    </div>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            alignItems: "center",
                        }}
                    >
                        <div>
                            <button
                                type="button"
                                onClick={() => setEditModal(false)}
                                style={secondaryBtn}
                            >
                                Batal
                            </button>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                alignItems: "center",
                            }}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    setShowDeleteConfirm((s) => !s)
                                }
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid rgba(239,68,68,0.28)",
                                    backgroundColor:
                                        "rgba(239,68,68,0.08)",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                }}
                            >
                                Hapus
                            </button>
                            <button
                                type="submit"
                                disabled={editSaving}
                                aria-busy={editSaving}
                                style={{
                                    ...actionBtn,
                                    minWidth: "140px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "8px",
                                    opacity: editSaving ? 0.85 : 1,
                                }}
                            >
                                {editSaving && (
                                    <span
                                        className="btn-spinner"
                                        aria-hidden
                                    />
                                )}
                                {editSaving
                                    ? "Menyimpan..."
                                    : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>

                    {showDeleteConfirm && (
                        <div
                            style={{
                                marginTop: "14px",
                                borderTop:
                                    "1px solid var(--app-border)",
                                paddingTop: "12px",
                            }}
                        >
                            <div
                                style={{
                                    marginBottom: "8px",
                                    color: "var(--app-text-strong)",
                                    fontWeight: 700,
                                }}
                            >
                                Konfirmasi Hapus
                            </div>
                            <div
                                style={{
                                    marginBottom: "8px",
                                    color: "var(--app-muted)",
                                }}
                            >
                                Ketik nama wallet{" "}
                                <strong>{editingWallet?.name}</strong>{" "}
                                untuk menghapus.
                            </div>
                            {deleteError && (
                                <div
                                    style={{
                                        color: "#ef4444",
                                        marginBottom: "8px",
                                    }}
                                >
                                    {deleteError}
                                </div>
                            )}
                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    alignItems: "center",
                                }}
                            >
                                <input
                                    type="text"
                                    value={deleteInput}
                                    onChange={(e) =>
                                        setDeleteInput(e.target.value)
                                    }
                                    placeholder={
                                        editingWallet?.name || ""
                                    }
                                    style={{ ...inputStyle }}
                                />
                                <button
                                    type="button"
                                    disabled={
                                        deleteLoading ||
                                        deleteInput !==
                                            editingWallet?.name
                                    }
                                    onClick={async () => {
                                        setDeleteError("");
                                        if (
                                            deleteInput !==
                                            editingWallet?.name
                                        )
                                            return setDeleteError(
                                                "Nama tidak cocok",
                                            );
                                        setDeleteLoading(true);
                                        try {
                                            await archiveWalletAPI(
                                                editingWallet._id,
                                            );
                                            await refresh();
                                            setEditModal(false);
                                        } catch (err) {
                                            setDeleteError(
                                                err.response?.data
                                                    ?.message ||
                                                    "Gagal menghapus wallet",
                                            );
                                        } finally {
                                            setDeleteLoading(false);
                                        }
                                    }}
                                    style={{
                                        padding: "10px 12px",
                                        borderRadius: "10px",
                                        border: "none",
                                        backgroundColor: "#ef4444",
                                        color: "white",
                                        cursor: deleteLoading
                                            ? "not-allowed"
                                            : "pointer",
                                        fontWeight: 700,
                                    }}
                                >
                                    {deleteLoading
                                        ? "Menghapus..."
                                        : "Konfirmasi Hapus"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </FormScreen>
        );
    }

    return (
        <div
            style={{
                padding: "32px",
                maxWidth: "1100px",
                margin: "0 auto",
                minHeight: "100%",
                paddingBottom: "48px",
            }}
        >
            <PageHeader
                title="Wallet"
                subtitle="Lihat semua dompet yang kamu miliki beserta saldo masing-masing"
                action={
                    <button onClick={handleOpenModal} style={actionBtn}>
                        + Tambah Wallet
                    </button>
                }
            />

            {isOnboarding && (
                <Card style={{ marginBottom: "24px" }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "16px",
                            flexWrap: "wrap",
                        }}
                    >
                        <div>
                            <div
                                style={{
                                    fontSize: "13px",
                                    fontWeight: "700",
                                    color: "var(--app-button-primary-to)",
                                    marginBottom: "6px",
                                }}
                            >
                                Onboarding Wallet
                            </div>
                            <h2
                                style={{
                                    margin: 0,
                                    color: "var(--app-text-strong)",
                                }}
                            >
                                Tambahkan semua wallet yang kamu pakai
                            </h2>
                            <p
                                style={{
                                    marginTop: "8px",
                                    color: "var(--app-muted)",
                                    fontSize: "14px",
                                }}
                            >
                                Cash sudah dibuat. Silakan tambahkan BCA, Gopay,
                                OVO, dan wallet lain yang kamu pakai, lalu masuk
                                dashboard.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleFinishOnboarding}
                            style={actionBtn}
                        >
                            Masuk Dashboard
                        </button>
                    </div>
                </Card>
            )}

            <div
                className="wallets-summary"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "16px",
                    marginBottom: "24px",
                }}
            >
                <Card>
                    <div style={statLabel}>Total Wallet</div>
                    <div style={statValue}>{wallets.length}</div>
                </Card>
                <Card>
                    <div style={statLabel}>Total Saldo</div>
                    <div style={statValue}>{formatRupiah(totalBalance)}</div>
                </Card>
                <Card>
                    <div style={statLabel}>Wallet Aktif</div>
                    <div style={statValue}>
                        {wallets.filter((w) => !w.isArchived).length}
                    </div>
                </Card>
            </div>

            <Card>
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        margin: "0 0 16px",
                        color: "var(--app-text-strong)",
                    }}
                >
                    Daftar Wallet
                </h2>

                {loadingData ? (
                    <p style={emptyStyle}>Memuat wallet...</p>
                ) : wallets.length === 0 ? (
                    <p style={emptyStyle}>
                        Belum ada wallet. Klik Tambah Wallet untuk menambah
                        rekening pertama.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "14px",
                        }}
                    >
                        {wallets.map((wallet) => {
                            const baseColor = wallet.color || "#1e6e55";
                            const textColor = getTextColorForBg(baseColor);
                            const mutedTextColor =
                                textColor === "#13221e"
                                    ? "rgba(17, 24, 39, 0.72)"
                                    : "rgba(255, 255, 255, 0.82)";
                            const chipBgColor =
                                textColor === "#13221e"
                                    ? "rgba(17, 24, 39, 0.12)"
                                    : "rgba(255, 255, 255, 0.18)";

                            const openDetail = () => navigate(`/wallets/${wallet._id}`);
                            return (
                                <div
                                    key={wallet._id}
                                    className="wallet-card-link"
                                    role="link"
                                    tabIndex={0}
                                    aria-label={`Lihat histori ${wallet.name}`}
                                    onClick={openDetail}
                                    onKeyDown={(e) => {
                                        if (e.target !== e.currentTarget) return;
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            openDetail();
                                        }
                                    }}
                                    style={{
                                        borderRadius: "16px",
                                        padding: "18px",
                                        color: textColor,
                                        background: `linear-gradient(135deg, ${baseColor}, ${baseColor}cc)`,
                                        boxShadow:
                                            "0 12px 24px rgba(15, 23, 42, 0.12)",
                                        position: "relative",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "12px",
                                            alignItems: "flex-start",
                                        }}
                                    >
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: mutedTextColor,
                                                    textTransform: "uppercase",
                                                    letterSpacing: "0.5px",
                                                }}
                                            >
                                                {typeLabel[wallet.type] ||
                                                    wallet.type}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "18px",
                                                    fontWeight: "800",
                                                    marginTop: "6px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "8px",
                                                }}
                                            >
                                                {wallet.name}
                                                {wallet.isDefault && (
                                                    <span
                                                        style={{
                                                            fontSize: "11px",
                                                            fontWeight: "700",
                                                            padding: "4px 8px",
                                                            borderRadius:
                                                                "999px",
                                                            backgroundColor:
                                                                chipBgColor,
                                                            color: textColor,
                                                        }}
                                                    >
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingWallet(wallet);
                                                setEditColor(
                                                    wallet.color || "#1e6e55",
                                                );
                                                setEditBalance(
                                                    formatNumberInput(
                                                        String(
                                                            wallet.balance || 0,
                                                        ),
                                                    ),
                                                );
                                                setEditDefault(
                                                    wallet.isDefault || false,
                                                );
                                                setEditGoldWeight(
                                                    wallet.goldWeight
                                                        ? String(
                                                              wallet.goldWeight,
                                                          ).replace(".", ",")
                                                        : "",
                                                );
                                                setEditGoldPrice(
                                                    wallet.goldBuyPrice
                                                        ? formatNumberInput(
                                                              String(
                                                                  wallet.goldBuyPrice,
                                                              ),
                                                          )
                                                        : "",
                                                );
                                                setEditError("");
                                                setEditModal(true);
                                            }}
                                            style={{
                                                marginLeft: "8px",
                                                padding: "6px 8px",
                                                borderRadius: "8px",
                                                backgroundColor: chipBgColor,
                                                color: textColor,
                                                border: "none",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                            }}
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    <div
                                        style={{
                                            marginTop: "20px",
                                            fontSize: "13px",
                                            color: mutedTextColor,
                                        }}
                                    >
                                        Saldo
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "24px",
                                            fontWeight: "800",
                                            marginTop: "4px",
                                        }}
                                    >
                                        {formatRupiah(wallet.balance || 0)}
                                    </div>
                                    {wallet.type === "gold" &&
                                        wallet.goldWeight > 0 && (
                                            <div
                                                style={{
                                                    marginTop: "6px",
                                                    fontSize: "13px",
                                                    color: mutedTextColor,
                                                }}
                                            >
                                                {formatWeight(wallet.goldWeight)}{" "}
                                                gram · beli{" "}
                                                {formatRupiah(
                                                    wallet.goldBuyPrice || 0,
                                                )}
                                                /gram
                                            </div>
                                        )}
                                    {wallet.type === "gold" && (
                                        <div className="gold-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                style={{ backgroundColor: chipBgColor, color: textColor }}
                                                onClick={() =>
                                                    navigate("/transactions/new", {
                                                        state: {
                                                            preset: {
                                                                type: "transfer",
                                                                transferTo: wallet._id,
                                                                walletId:
                                                                    wallets.find((w) => w.type !== "gold" && w.isDefault)?._id ||
                                                                    wallets.find((w) => w.type !== "gold")?._id ||
                                                                    "",
                                                            },
                                                        },
                                                    })
                                                }
                                            >
                                                + Beli emas
                                            </button>
                                            {wallet.goldWeight > 0 && (
                                                <button
                                                    type="button"
                                                    style={{ backgroundColor: chipBgColor, color: textColor }}
                                                    onClick={() =>
                                                        navigate("/transactions/new", {
                                                            state: {
                                                                preset: {
                                                                    type: "transfer",
                                                                    walletId: wallet._id,
                                                                    transferTo:
                                                                        wallets.find((w) => w.type !== "gold" && w.isDefault)?._id ||
                                                                        wallets.find((w) => w.type !== "gold")?._id ||
                                                                        "",
                                                                },
                                                            },
                                                        })
                                                    }
                                                >
                                                    Jual emas
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="wallet-card-hint" style={{ color: mutedTextColor }}>
                                        Lihat histori <FiArrowRight aria-hidden />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label style={fieldLabel}>{label}</label>
            {children}
        </div>
    );
}

const statLabel = {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--app-muted)",
    marginBottom: "8px",
};

const statValue = {
    fontSize: "22px",
    fontWeight: "800",
    color: "var(--app-text-strong)",
};

const emptyStyle = {
    textAlign: "center",
    padding: "28px",
    color: "var(--app-muted)",
    fontSize: "14px",
};

// chipStyle removed (unused) — initial balance chip intentionally hidden

const actionBtn = {
    padding: "11px 16px",
    border: "none",
    borderRadius: "10px",
    background:
        "linear-gradient(135deg,var(--app-button-primary-from),var(--app-button-primary-to))",
    color: "var(--app-button-primary-text)",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
};

const secondaryBtn = {
    padding: "11px 16px",
    border: "1px solid var(--app-button-secondary-border)",
    borderRadius: "10px",
    backgroundColor: "var(--app-button-secondary-bg)",
    color: "var(--app-button-secondary-text)",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
};

const modalGridTwo = {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "14px",
    marginBottom: "14px",
};

const modalActions = {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
};

const fieldLabel = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--app-muted)",
    marginBottom: "6px",
};

const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid var(--app-border)",
    borderRadius: "10px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
    outline: "none",
};

const errorBox = {
    padding: "10px 14px",
    borderRadius: "10px",
    marginBottom: "14px",
    backgroundColor: "var(--app-surface-soft)",
    color: "var(--app-button-danger-to)",
    border: "1px solid var(--app-border)",
    fontSize: "13px",
};
