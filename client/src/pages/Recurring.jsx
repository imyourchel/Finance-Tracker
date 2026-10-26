import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "../utils/confirm";
import Card from "../components/ui/Card";
import PageHeader from "../components/Layout/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import { FiCalendar, FiPlus } from "react-icons/fi";
import FormScreen from "../components/ui/FormScreen";
import DropdownMenu from "../components/ui/DropdownMenu";
import { useFinance } from "../context/FinanceContext";
import {
    createRecurringAPI,
    deleteRecurringAPI,
    getRecurringsAPI,
    toggleRecurringAPI,
} from "../services/api";
import { formatDateShort, formatRupiah } from "../utils/format";
import { formatNumberInput, parseNumberInput } from "../utils/format";
import DatePicker from "../components/ui/DatePicker";

const FREQUENCY_OPTIONS = [
    { value: "daily", label: "Harian" },
    { value: "weekly", label: "Mingguan" },
    { value: "monthly", label: "Bulanan" },
    { value: "yearly", label: "Tahunan" },
];


const initialForm = {
    walletId: "",
    type: "expense",
    amount: "",
    categoryId: "",
    description: "",
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
};

export default function Recurring() {
    const { wallets, categories } = useFinance();
    const [recurrings, setRecurrings] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const categoryOptions = useMemo(
        () => categories.filter((cat) => cat.type === form.type),
        [categories, form.type],
    );

    const loadRecurrings = async () => {
        setLoading(true);
        try {
            const res = await getRecurringsAPI();
            setRecurrings(res.data);
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal memuat tagihan rutin",
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data saat halaman dibuka
        loadRecurrings();
    }, []);

    useEffect(() => {
        if (!form.walletId && wallets[0]?._id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- isi default saat data siap
            setForm((prev) => ({ ...prev, walletId: wallets[0]._id }));
        }
    }, [wallets, form.walletId]);

    useEffect(() => {
        if (!form.categoryId && categoryOptions[0]?._id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- isi default saat data siap
            setForm((prev) => ({
                ...prev,
                categoryId: categoryOptions[0]._id,
            }));
        }
        if (
            form.categoryId &&
            !categoryOptions.some((cat) => cat._id === form.categoryId)
        ) {
            setForm((prev) => ({
                ...prev,
                categoryId: categoryOptions[0]?._id || "",
            }));
        }
    }, [categoryOptions, form.categoryId]);

    const setField = (field, value) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.walletId) return setError("Pilih dompet terlebih dahulu");
        if (!form.categoryId) return setError("Pilih kategori terlebih dahulu");

        const amount = parseNumberInput(form.amount);
        if (Number.isNaN(amount) || amount <= 0)
            return setError("Nominal harus lebih dari 0");

        if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
            return setError("Tanggal selesai tidak boleh sebelum tanggal mulai");
        }

        setSaving(true);
        window.scrollTo(0, 0);
        try {
            await createRecurringAPI({
                walletId: form.walletId,
                type: form.type,
                amount,
                categoryId: form.categoryId,
                description: form.description,
                frequency: form.frequency,
                startDate: form.startDate,
                endDate: form.endDate || null,
            });
            setForm((prev) => ({
                ...initialForm,
                walletId: prev.walletId,
                categoryId: categoryOptions[0]?._id || "",
            }));
            await loadRecurrings();
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal menyimpan tagihan rutin",
            );
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id) => {
        const item = recurrings.find((r) => r._id === id);
        const pausing = item?.isActive !== false;
        const ok = await confirmDialog({
            title: pausing ? "Jeda tagihan rutin ini?" : "Aktifkan lagi tagihan ini?",
            message: pausing
                ? "Tagihan tidak akan dicatat otomatis sampai kamu mengaktifkannya lagi."
                : "Tagihan akan kembali dicatat otomatis sesuai jadwal.",
            confirmLabel: pausing ? "Jeda" : "Aktifkan",
            danger: pausing,
        });
        if (!ok) return;
        await toggleRecurringAPI(id);
        await loadRecurrings();
    };

    const handleDelete = async (id) => {
        if (
            !(await confirmDialog({
                title: "Hapus tagihan rutin ini?",
                message: "Tagihan tidak akan dicatat otomatis lagi. Transaksi yang sudah tercatat tetap ada.",
                confirmLabel: "Hapus",
            }))
        )
            return;
        await deleteRecurringAPI(id);
        await loadRecurrings();
    };

    if (showModal) {
        return (
        <FormScreen backLabel="Tagihan Rutin"
            title="Tambah tagihan rutin"
            subtitle="Tagihan dicatat otomatis sesuai jadwal, jadi kamu tidak perlu input manual tiap bulan."
            onClose={() => setShowModal(false)}
        >
            {error && (
                <div
                    style={{
                        padding: "10px 14px",
                        marginBottom: "16px",
                        borderRadius: "10px",
                        backgroundColor: "var(--app-surface-soft)",
                        color: "var(--app-button-danger-to)",
                        border: "1px solid var(--app-border)",
                        fontSize: "13px",
                    }}
                >
                    ⚠️ {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "14px",
                        marginBottom: "14px",
                    }}
                >
                    <Field label="Dompet" fullWidth>
                        <div
                            style={{
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <DropdownMenu
                                label=""
                                value={form.walletId}
                                width="100%"
                                options={[
                                    {
                                        value: "",
                                        label: "Pilih dompet",
                                    },
                                    ...wallets.map((w) => ({
                                        value: w._id,
                                        label: w.name,
                                    })),
                                ]}
                                onChange={(v) =>
                                    setField("walletId", v)
                                }
                            />
                        </div>
                    </Field>
                    <Field label="Tipe" fullWidth>
                        <div
                            style={{
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <DropdownMenu
                                label=""
                                value={form.type}
                                width="100%"
                                options={[
                                    {
                                        value: "expense",
                                        label: "Pengeluaran",
                                    },
                                    {
                                        value: "income",
                                        label: "Pemasukan",
                                    },
                                ]}
                                onChange={(v) => setField("type", v)}
                            />
                        </div>
                    </Field>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "14px",
                        marginBottom: "14px",
                    }}
                >
                    <Field label="Kategori" fullWidth>
                        <div
                            style={{
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <DropdownMenu
                                label=""
                                value={form.categoryId}
                                width="100%"
                                options={[
                                    {
                                        value: "",
                                        label: "Pilih kategori",
                                    },
                                    ...categoryOptions.map((c) => ({
                                        value: c._id,
                                        label: c.name,
                                    })),
                                ]}
                                onChange={(v) =>
                                    setField("categoryId", v)
                                }
                            />
                        </div>
                    </Field>
                    <Field label="Nominal" fullWidth>
                        <input
                            type="text"
                            value={form.amount}
                            onChange={(e) =>
                                setField(
                                    "amount",
                                    formatNumberInput(e.target.value),
                                )
                            }
                            style={{
                                ...inp,
                                width: "100%",
                                textAlign: "right",
                            }}
                            placeholder="0"
                            inputMode="numeric"
                        />
                    </Field>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "14px",
                        marginBottom: "14px",
                    }}
                >
                    <Field label="Deskripsi" fullWidth>
                        <input
                            value={form.description}
                            onChange={(e) =>
                                setField("description", e.target.value)
                            }
                            style={{
                                ...inp,
                                width: "100%",
                            }}
                            placeholder="Kos, Netflix, listrik, dll"
                        />
                    </Field>
                    <Field label="Frekuensi" fullWidth>
                        <div
                            style={{
                                width: "100%",
                                minWidth: 0,
                            }}
                        >
                            <DropdownMenu
                                label=""
                                value={form.frequency}
                                width="100%"
                                options={FREQUENCY_OPTIONS}
                                onChange={(v) =>
                                    setField("frequency", v)
                                }
                            />
                        </div>
                    </Field>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: "14px",
                        marginBottom: "18px",
                    }}
                >
                    <Field label="Tanggal Mulai" fullWidth>
                        <DatePicker
                            value={form.startDate}
                            onChange={(v) => setField("startDate", v)}
                            placeholder="Pilih tanggal mulai"
                            accent="var(--app-button-primary-to)"
                            width="100%"
                        />
                    </Field>
                    <Field label="Tanggal Selesai (opsional)" fullWidth>
                        <DatePicker
                            value={form.endDate}
                            onChange={(v) => setField("endDate", v)}
                            placeholder="Tanpa tanggal selesai"
                            accent="#f59e0b"
                            width="100%"
                        />
                    </Field>
                </div>

                <div style={{ marginTop: 6 }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            ...btnPrimary,
                            width: "100%",
                            height: "48px",
                            fontSize: 15,
                            marginTop: 6,
                            opacity: saving ? 0.8 : 1,
                        }}
                    >
                        {saving ? "Menyimpan..." : "Simpan Tagihan"}
                    </button>
                </div>
            </form>
        </FormScreen>
        );
    }

    return (
        <div style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
            <PageHeader
                title="Tagihan Rutin"
                subtitle="Kelola tagihan bulanan seperti kos, Netflix, listrik, dan langganan lainnya"
                action={
                    <button
                        onClick={() => setShowModal(true)}
                        style={btnPrimary}
                    >
                        + Tambah Tagihan
                    </button>
                }
            />

            <Card>
                <h2
                    style={{
                        fontSize: "16px",
                        fontWeight: "700",
                        margin: "0 0 16px",
                        color: "var(--app-text-strong)",
                    }}
                >
                    Daftar Tagihan Rutin
                </h2>

                {loading ? (
                    <p
                        style={{
                            color: "#94a3b8",
                            textAlign: "center",
                            padding: "32px",
                        }}
                    >
                        Memuat...
                    </p>
                ) : recurrings.length === 0 ? (
                    <EmptyState
                        icon={FiCalendar}
                        title="Belum ada tagihan rutin"
                        description="Catat kos, internet, atau langganan sekali saja. DailyTrack mencatatnya otomatis tiap jatuh tempo."
                        action={{ label: "Tambah tagihan", icon: FiPlus, onClick: () => setShowModal(true) }}
                    />
                ) : (
                    <div style={{ display: "grid", gap: "12px" }}>
                        {recurrings.map((item) => (
                            <div
                                key={item._id}
                                style={{
                                    border: "1px solid var(--app-border)",
                                    borderRadius: "12px",
                                    padding: "16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "16px",
                                    alignItems: "center",
                                }}
                            >
                                <div>
                                    <div style={{
                                        fontWeight: "700",
                                        color: "var(--app-text-strong)"
                                    }}>
                                        {item.description || item.category?.name || "Tagihan rutin"}
                                    </div>

                                    <div style={{
                                        fontSize: "13px",
                                        color: "var(--app-muted)",
                                        marginTop: "4px"
                                    }}>
                                        {item.wallet?.name || "Dompet"} • {item.frequency} • Mulai{" "}
                                        {formatDateShort(item.startDate)}
                                    </div>

                                    <div style={{
                                        fontSize: "14px",
                                        fontWeight: "700",
                                        color: "var(--app-text-strong)",
                                        marginTop: "6px"
                                    }}>
                                        {formatRupiah(item.amount)}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                        justifyContent: "flex-end",
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleToggle(item._id)}
                                        style={smallBtn}
                                    >
                                        {item.isActive
                                            ? "Nonaktifkan"
                                            : "Aktifkan"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item._id)}
                                        style={{
                                            ...smallBtn,
                                            backgroundColor: "#df1515ff",
                                            color: "var(--app-button-danger-text)",
                                        }}
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

function Field({ label, children, style = {}, fullWidth = false }) {
    return (
        <div
            style={{
                minWidth: 0,
                width: fullWidth ? "100%" : "auto",
                ...style,
            }}
        >
            <label
                style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "var(--app-text)",
                    marginBottom: "6px",
                }}
            >
                {label}
            </label>
            {children}
        </div>
    );
}

const inp = {
    width: "100%",
    minWidth: 0,
    padding: "11px 14px",
    border: "1.5px solid var(--app-border)",
    borderRadius: "12px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: "var(--app-surface)",
    color: "var(--app-text-strong)",
    minHeight: "44px",
};

const btnPrimary = {
    padding: "11px 18px",
    background: "linear-gradient(135deg, var(--app-button-primary-from), var(--app-button-primary-to))",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
};


const smallBtn = {
    padding: "9px 12px",
    backgroundColor: "var(--app-button-secondary-bg)",
    color: "var(--app-button-secondary-text)",
    border: "1px solid var(--app-button-secondary-border)",
    borderRadius: "8px",
    fontWeight: "700",
    cursor: "pointer",
};

