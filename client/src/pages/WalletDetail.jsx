import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    FiArrowLeft,
    FiArrowDownLeft,
    FiArrowUpRight,
    FiRepeat,
    FiPlus,
    FiSearch,
    FiTag,
    FiTrash2,
    FiX,
    FiInbox,
    FiUsers,
} from "react-icons/fi";
import { useFinance } from "../context/FinanceContext";
import { getTransactionsAPI, deleteTransactionAPI } from "../services/api";
import { formatRupiah, MONTHS } from "../utils/format";
import { CATEGORY_ICONS } from "../utils/categoryIcons";
import { confirmDialog } from "../utils/confirm";
import DropdownMenu from "../components/ui/DropdownMenu";
import "../styles/wallet.css";

const PAGE_SIZE = 30;

const TYPE_LABEL = {
    cash: "Cash",
    bank: "Bank",
    "e-wallet": "E-Wallet",
    investment: "Investasi",
    gold: "Emas",
    other: "Lainnya",
};

const FILTERS = [
    { value: "", label: "Semua" },
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
];

const formatWeight = (n) =>
    Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 3 });

function textOn(hex) {
    const h = (hex || "#1e6e55").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "dark" : "light";
}

const dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
};
const dayLabel = (d) => {
    const x = new Date(d);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (dayKey(x) === dayKey(today)) return "Hari ini";
    if (dayKey(x) === dayKey(yest)) return "Kemarin";
    return x.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: x.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
};
const timeLabel = (d) =>
    new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

// Efek satu baris transaksi ke saldo wallet ini
const effectOf = (t) =>
    t.type === "income" ? t.amount : -(t.amount + Number(t.transferFee || 0));

/** Halaman detail wallet: saldo, ringkasan arus kas, dan histori transaksinya. */
export default function WalletDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { wallets, loadingData, availableYears, refresh } = useFinance();
    const wallet = wallets.find((w) => w._id === id);

    const [type, setType] = useState("");
    const [period, setPeriod] = useState("all");
    const [searchDraft, setSearchDraft] = useState("");
    const [search, setSearch] = useState("");
    const [reloadTick, setReloadTick] = useState(0);
    const [data, setData] = useState({ key: null, items: [], page: 1, totalPages: 1, total: 0, totals: null });
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    // Cari setelah berhenti mengetik sebentar
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchDraft.trim()), 300);
        return () => clearTimeout(t);
    }, [searchDraft]);

    const params = useMemo(() => {
        const p = { wallet: id, limit: PAGE_SIZE, sort: "date_desc" };
        if (type) p.type = type;
        if (search) p.search = search;
        if (period !== "all") {
            const [y, m] = period.split("-");
            p.year = y;
            p.month = m;
        }
        return p;
    }, [id, type, search, period]);
    const key = JSON.stringify(params) + reloadTick;
    const loading = data.key !== key;

    useEffect(() => {
        let alive = true;
        getTransactionsAPI({ ...params, page: 1 })
            .then((res) => {
                if (!alive) return;
                setError("");
                setData({
                    key,
                    items: res.data.transactions || [],
                    page: 1,
                    totalPages: res.data.pagination?.totalPages || 1,
                    total: res.data.pagination?.total || 0,
                    totals: res.data.totals || null,
                });
            })
            .catch((err) => {
                if (!alive) return;
                setError(err.response?.data?.message || "Histori gagal dimuat.");
                setData((d) => ({ ...d, key, items: [], total: 0, totals: null }));
            });
        return () => {
            alive = false;
        };
    }, [params, key]);

    const loadMore = async () => {
        setLoadingMore(true);
        try {
            const res = await getTransactionsAPI({ ...params, page: data.page + 1 });
            setData((d) => ({
                ...d,
                items: [...d.items, ...(res.data.transactions || [])],
                page: d.page + 1,
                totalPages: res.data.pagination?.totalPages || d.totalPages,
            }));
        } finally {
            setLoadingMore(false);
        }
    };

    const periodOptions = useMemo(() => {
        const opts = [{ value: "all", label: "Semua waktu" }];
        const now = new Date();
        const first = Math.min(...(availableYears?.length ? availableYears : [now.getFullYear()]));
        let y = now.getFullYear();
        let m = now.getMonth() + 1;
        while ((y > first || (y === first && m >= 1)) && opts.length < 37) {
            opts.push({ value: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}` });
            m -= 1;
            if (m === 0) {
                m = 12;
                y -= 1;
            }
        }
        return opts;
    }, [availableYears]);

    const groups = useMemo(() => {
        const out = [];
        for (const t of data.items) {
            const k = dayKey(t.date);
            let g = out[out.length - 1];
            if (!g || g.key !== k) {
                g = { key: k, date: t.date, items: [], net: 0 };
                out.push(g);
            }
            g.items.push(t);
            g.net += effectOf(t);
        }
        return out;
    }, [data.items]);

    if (!wallet) {
        if (loadingData) {
            return (
                <div className="wd-page">
                    <div className="wd-hero wd-skeleton" />
                </div>
            );
        }
        return (
            <div className="wd-page">
                <Link to="/wallets" className="tx-back">
                    <FiArrowLeft aria-hidden /> Semua wallet
                </Link>
                <div className="wd-empty">
                    <FiInbox aria-hidden />
                    <strong>Wallet tidak ditemukan</strong>
                    <span>Mungkin sudah dihapus atau diarsipkan.</span>
                </div>
            </div>
        );
    }

    const isGold = wallet.type === "gold";
    const tone = textOn(wallet.color);
    const otherWallet = (wid) => wallets.find((w) => w._id === (wid?._id || wid));
    const firstNonGold =
        wallets.find((w) => w.type !== "gold" && w.isDefault)?._id ||
        wallets.find((w) => w.type !== "gold" && w._id !== id)?._id ||
        "";
    const back = { returnTo: `/wallets/${id}`, returnLabel: wallet.name };

    const openNew = (preset) => navigate("/transactions/new", { state: { ...back, preset } });

    const handleDelete = async (t) => {
        const ok = await confirmDialog({
            title: t.isTransfer ? "Hapus transfer ini?" : "Hapus transaksi ini?",
            message: t.isTransfer
                ? "Kedua sisi transfer akan dihapus dan saldo kedua wallet dikembalikan."
                : "Saldo wallet akan dikembalikan seperti sebelum transaksi ini dicatat.",
            confirmLabel: "Hapus",
        });
        if (!ok) return;
        try {
            await deleteTransactionAPI(t._id);
            setReloadTick((n) => n + 1);
            refresh();
        } catch (err) {
            await confirmDialog({
                title: "Gagal menghapus",
                message: err.response?.data?.message || "Coba lagi sebentar.",
                alertOnly: true,
            });
        }
    };

    const totals = data.totals;
    const net = totals ? totals.income - totals.expense : 0;
    const hasFilter = type || search || period !== "all";

    return (
        <div className="wd-page">
            <Link to="/wallets" className="tx-back">
                <FiArrowLeft aria-hidden /> Semua wallet
            </Link>

            <section
                className={`wd-hero on-${tone}`}
                style={{ "--wd-color": wallet.color || "#1e6e55" }}
            >
                <div className="wd-hero-main">
                    <span className="wd-kicker">
                        {TYPE_LABEL[wallet.type] || wallet.type}
                        {wallet.isDefault && <span className="wd-chip">Default</span>}
                    </span>
                    <h1 className="wd-name">{wallet.name}</h1>
                    <span className="wd-label">Saldo saat ini</span>
                    <strong className="wd-balance">{formatRupiah(wallet.balance || 0)}</strong>
                    {isGold && (
                        <span className="wd-gold">
                            {formatWeight(wallet.goldWeight)} gram
                            {wallet.goldWeight > 0 &&
                                ` · rata-rata beli ${formatRupiah(wallet.goldBuyPrice || 0)}/gram`}
                        </span>
                    )}
                </div>
                <div className="wd-hero-actions">
                    {isGold ? (
                        <>
                            <button
                                type="button"
                                className="wd-btn is-solid"
                                onClick={() => openNew({ type: "transfer", transferTo: id, walletId: firstNonGold })}
                            >
                                <FiPlus aria-hidden /> Beli emas
                            </button>
                            {wallet.goldWeight > 0 && (
                                <button
                                    type="button"
                                    className="wd-btn"
                                    onClick={() => openNew({ type: "transfer", walletId: id, transferTo: firstNonGold })}
                                >
                                    Jual emas
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="wd-btn is-solid"
                                onClick={() => openNew({ type: "expense", walletId: id })}
                            >
                                <FiPlus aria-hidden /> Catat transaksi
                            </button>
                            {wallets.length > 1 && (
                                <button
                                    type="button"
                                    className="wd-btn"
                                    onClick={() => openNew({ type: "transfer", walletId: id })}
                                >
                                    <FiRepeat aria-hidden /> Transfer
                                </button>
                            )}
                        </>
                    )}
                </div>
            </section>

            <div className="wd-stats" aria-busy={loading}>
                <Stat label="Uang masuk" tone="in" value={totals && formatRupiah(totals.income)} />
                <Stat label="Uang keluar" tone="out" value={totals && formatRupiah(totals.expense)} />
                <Stat
                    label="Selisih"
                    tone={net >= 0 ? "in" : "out"}
                    value={totals && `${net > 0 ? "+" : net < 0 ? "−" : ""}${formatRupiah(Math.abs(net))}`}
                />
                {isGold ? (
                    <Stat
                        label="Perubahan emas"
                        value={
                            totals &&
                            `${totals.goldIn - totals.goldOut >= 0 ? "+" : "−"}${formatWeight(
                                Math.abs(totals.goldIn - totals.goldOut),
                            )} g`
                        }
                    />
                ) : (
                    <Stat label="Jumlah transaksi" value={!loading && String(data.total)} />
                )}
            </div>

            <div className="wd-toolbar">
                <div className="tx-chips" role="tablist" aria-label="Jenis transaksi">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            role="tab"
                            aria-selected={type === f.value}
                            className={`tx-chip ${type === f.value ? "is-active" : ""}`}
                            onClick={() => setType(f.value)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="wd-toolbar-right">
                    <label className="wd-search">
                        <FiSearch aria-hidden />
                        <input
                            value={searchDraft}
                            onChange={(e) => setSearchDraft(e.target.value)}
                            placeholder="Cari catatan..."
                            aria-label="Cari catatan transaksi"
                        />
                        {searchDraft && (
                            <button type="button" onClick={() => setSearchDraft("")} aria-label="Hapus pencarian">
                                <FiX />
                            </button>
                        )}
                    </label>
                    <DropdownMenu value={period} options={periodOptions} onChange={setPeriod} minWidth="170px" />
                </div>
            </div>

            <section className="wd-history">
                <header className="wd-history-head">
                    <h2>Histori</h2>
                    {!loading && <span>{data.total} transaksi</span>}
                </header>

                {loading ? (
                    <div className="wd-rows">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="wd-row wd-skeleton-row" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="wd-empty">
                        <strong>{error}</strong>
                        <button type="button" className="btn-ghost" onClick={() => setReloadTick((n) => n + 1)}>
                            Coba lagi
                        </button>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="wd-empty">
                        <FiInbox aria-hidden />
                        <strong>{hasFilter ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}</strong>
                        <span>
                            {hasFilter
                                ? "Coba ubah filter atau periode."
                                : "Transaksi yang memakai wallet ini akan muncul di sini."}
                        </span>
                    </div>
                ) : (
                    <>
                        {groups.map((g) => (
                            <div key={g.key} className="wd-day">
                                <div className="wd-day-head">
                                    <span>{dayLabel(g.date)}</span>
                                    <span className={g.net >= 0 ? "is-in" : "is-out"}>
                                        {g.net > 0 ? "+" : g.net < 0 ? "−" : ""}
                                        {formatRupiah(Math.abs(g.net))}
                                    </span>
                                </div>
                                <div className="wd-rows">
                                    {g.items.map((t) => (
                                        <Row
                                            key={t._id}
                                            t={t}
                                            isGold={isGold}
                                            other={otherWallet(t.transferTo)}
                                            onOpen={
                                                t.isTransfer || t.debtId
                                                    ? null
                                                    : () =>
                                                          navigate(`/transactions/${t._id}/edit`, {
                                                              state: { ...back, transaction: t },
                                                          })
                                            }
                                            onDelete={() => handleDelete(t)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                        {data.page < data.totalPages && (
                            <button type="button" className="wd-more" onClick={loadMore} disabled={loadingMore}>
                                {loadingMore ? "Memuat..." : `Muat lebih banyak (${data.total - data.items.length} lagi)`}
                            </button>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}

function Stat({ label, value, tone }) {
    return (
        <div className={`wd-stat ${tone ? `is-${tone}` : ""}`}>
            <span>{label}</span>
            {value ? <strong>{value}</strong> : <i className="wd-skeleton-line" />}
        </div>
    );
}

function Row({ t, isGold, other, onOpen, onDelete }) {
    const incoming = t.type === "income";
    const otherName = t.transferTo?.name || other?.name || "wallet lain";
    const goldTrade = t.isTransfer && (isGold || other?.type === "gold");

    let title;
    let Icon;
    if (t.isTransfer) {
        Icon = FiRepeat;
        if (goldTrade) {
            // Dilihat dari wallet emas: masuk = beli, keluar = jual. Dari wallet uang: kebalikannya.
            const buying = isGold ? incoming : !incoming;
            title = buying ? "Beli emas" : "Jual emas";
        } else {
            title = incoming ? `Transfer dari ${otherName}` : `Transfer ke ${otherName}`;
        }
    } else if (t.debtId) {
        Icon = FiUsers;
        title = incoming ? "Utang-piutang masuk" : "Utang-piutang keluar";
    } else {
        Icon = CATEGORY_ICONS[t.category?.icon] || (incoming ? FiArrowDownLeft : FiArrowUpRight) || FiTag;
        title = t.category?.name || (incoming ? "Pemasukan" : "Pengeluaran");
    }

    const meta = [
        timeLabel(t.date),
        goldTrade && (incoming ? `dari ${otherName}` : `ke ${otherName}`),
        t.description,
        t.tags?.length ? t.tags.slice(0, 2).map((x) => `#${x}`).join(" ") : null,
    ].filter(Boolean);

    const fee = Number(t.transferFee || 0);
    const color = t.category?.color;

    const body = (
        <>
            <span
                className={`wd-row-icon ${t.isTransfer ? "is-transfer" : incoming ? "is-in" : "is-out"}`}
                style={color && !t.isTransfer ? { "--cat": color } : undefined}
            >
                <Icon aria-hidden />
            </span>
            <span className="wd-row-text">
                <span className="wd-row-title">
                    {title}
                    {t.isRecurring && <em>Rutin</em>}
                </span>
                <span className="wd-row-meta">{meta.join(" · ")}</span>
            </span>
            <span className="wd-row-amount">
                <strong className={incoming ? "is-in" : "is-out"}>
                    {incoming ? "+" : "−"}
                    {formatRupiah(t.amount)}
                </strong>
                {fee > 0 && !incoming && <small>Biaya {formatRupiah(fee)}</small>}
                {t.goldWeight > 0 && (
                    <small className="is-gold">
                        {(isGold ? incoming : !incoming) ? "+" : "−"}
                        {formatWeight(t.goldWeight)} g emas
                    </small>
                )}
            </span>
        </>
    );

    return (
        <div className="wd-row">
            {onOpen ? (
                <button type="button" className="wd-row-main" onClick={onOpen} title="Buka untuk mengedit">
                    {body}
                </button>
            ) : (
                <div className="wd-row-main">{body}</div>
            )}
            {!t.debtId && (
                <button type="button" className="wd-row-del" onClick={onDelete} aria-label="Hapus transaksi">
                    <FiTrash2 />
                </button>
            )}
        </div>
    );
}
