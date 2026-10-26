import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    Area,
    ComposedChart,
    CartesianGrid,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { FiArrowRight, FiPlus, FiTarget, FiZap, FiFilm, FiActivity, FiUsers, FiCreditCard, FiTrendingUp } from "react-icons/fi";
import EmptyState from "../components/ui/EmptyState";
import { openQuickAdd } from "../utils/quickAddBus";
import DropdownMenu from "../components/ui/DropdownMenu";
import { useFinance } from "../context/FinanceContext";
import { getTransactionsAPI } from "../services/api";
import { getInsightsOverviewAPI } from "../services/insightsApi";
import { formatRupiah, MONTHS } from "../utils/format";
import TransactionItem from "../components/Transaction/TransactionItem";
import PageHeader from "../components/Layout/PageHeader";
import DashboardQuests from "../components/gamification/DashboardQuests";
import PaydayCard from "../components/payday/PaydayCard";
import DeltaChip from "../components/insights/DeltaChip";
import ChartTooltip from "../components/insights/ChartTooltip";
import InsightList from "../components/insights/InsightList";
import CategoryList from "../components/insights/CategoryList";
import { changePct, shortRupiah, signedRupiah } from "../components/insights/format";
import "../styles/insights.css";

const MonthSelector = ({ month, year, setMonth, setYear, availableYears }) => (
    <div className="ins-period">
        <DropdownMenu
            label="Bulan"
            value={month}
            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
            onChange={(v) => setMonth(Number(v))}
        />
        <DropdownMenu
            label="Tahun"
            value={year}
            options={availableYears.map((y) => ({ value: y, label: String(y) }))}
            onChange={(v) => setYear(Number(v))}
        />
    </div>
);

function textOn(hex) {
    const h = (hex || "#1e6e55").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "dark" : "light";
}

const greeting = () => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
};

export default function Dashboard() {
    const { summary, wallets, totalBalance, month, year, setMonth, setYear, availableYears } = useFinance();
    const isCurrentMonth = month === new Date().getMonth() + 1 && year === new Date().getFullYear();
    const [data, setData] = useState({ key: null, value: null, error: false });
    const [recent, setRecent] = useState([]);
    const key = `${year}-${month}`;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // `summary` berganti tiap kali data keuangan di-refresh (mis. setelah mencatat transaksi)
    useEffect(() => {
        let alive = true;
        getInsightsOverviewAPI({ month, year })
            .then((r) => alive && setData({ key, value: r.data, error: false }))
            .catch(() => alive && setData((d) => ({ key, value: d.key === key ? d.value : null, error: true })));
        getTransactionsAPI({ month, year, limit: 6 })
            .then((r) => alive && setRecent(r.data.transactions || []))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, [month, year, key, summary]);

    const o = data.key === key ? data.value : null;
    const loading = data.key !== key;

    return (
        <div className="ins-root ins-page">
            <PageHeader
                title="Dashboard"
                subtitle={`${greeting()}. Ini gambaran keuanganmu untuk ${MONTHS[month - 1]} ${year}.`}
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

            <div className="dash-top">
                <HeroSummary o={o} loading={loading} fallback={summary} />
                <div className="dash-side">
                    <DashboardQuests />
                </div>
            </div>

            {isCurrentMonth && <PaydayCard />}

            <nav className="dash-shortcuts" aria-label="Fitur lainnya">
                <button type="button" onClick={openQuickAdd}>
                    <span className="is-brass"><FiZap aria-hidden /></span>
                    <span>
                        <strong>Catat cepat</strong>
                        <small>Ketik "kopi 18rb gopay"</small>
                    </span>
                </button>
                <Link to="/wrapped">
                    <span><FiFilm aria-hidden /></span>
                    <span>
                        <strong>Wrapped {new Date().getDate() <= 7 ? "bulan lalu" : "bulan ini"}</strong>
                        <small>Cerita uangmu, siap dibagikan</small>
                    </span>
                </Link>
                <Link to="/kesehatan">
                    <span><FiActivity aria-hidden /></span>
                    <span>
                        <strong>Kesehatan finansial</strong>
                        <small>Dana darurat & langganan</small>
                    </span>
                </Link>
                <Link to="/utang">
                    <span><FiUsers aria-hidden /></span>
                    <span>
                        <strong>Utang & patungan</strong>
                        <small>Siapa utang ke siapa</small>
                    </span>
                </Link>
            </nav>

            <div className="dash-grid">
                <section className="ins-card">
                    <header className="ins-card-head">
                        <div>
                            <h2>Insight bulan ini</h2>
                            <p>Dihitung otomatis dari catatanmu</p>
                        </div>
                    </header>
                    {loading ? <SkeletonLines n={4} /> : <InsightList items={o?.insights || []} />}
                </section>
                <ProjectionCard o={o} loading={loading} totalBalance={totalBalance} />
            </div>

            <div className="dash-grid is-wide-left">
                <PaceCard o={o} loading={loading} />
                <section className="ins-card">
                    <header className="ins-card-head">
                        <div>
                            <h2>Kategori teratas</h2>
                            <p>Dibanding periode yang sama {o?.period?.previousLabel ? `(${o.period.previousLabel})` : "bulan lalu"}</p>
                        </div>
                        <Link to="/analytics" className="ins-link">
                            Analitik <FiArrowRight aria-hidden />
                        </Link>
                    </header>
                    {loading ? <SkeletonLines n={4} /> : <CategoryList items={o?.categories || []} limit={5} />}
                </section>
            </div>

            <section className="ins-card">
                <header className="ins-card-head">
                    <div>
                        <h2>Dompet & rekening</h2>
                        <p>Total {formatRupiah(totalBalance || 0)} di {wallets.length} wallet</p>
                    </div>
                    <Link to="/wallets" className="ins-link">
                        Kelola <FiArrowRight aria-hidden />
                    </Link>
                </header>
                <div className="dash-wallets">
                    {wallets.map((w) => {
                        const share = totalBalance > 0 ? Math.max(0, (w.balance / totalBalance) * 100) : 0;
                        return (
                            <Link
                                key={w._id}
                                to={`/wallets/${w._id}`}
                                className={`dash-wallet on-${textOn(w.color)}`}
                                style={{ "--w": w.color || "#1e6e55" }}
                            >
                                <span className="dash-wallet-name">{w.name}</span>
                                <strong>{formatRupiah(w.balance || 0)}</strong>
                                <span className="dash-wallet-share">{Math.round(share)}% dari total</span>
                            </Link>
                        );
                    })}
                    {wallets.length === 0 && (
                        <EmptyState
                            size="sm"
                            icon={FiCreditCard}
                            title="Belum ada wallet"
                            description="Tambahkan dompet, rekening, atau e-wallet yang kamu pakai."
                            action={{ label: "Tambah wallet", to: "/wallets" }}
                        />
                    )}
                </div>
            </section>

            <section className="ins-card">
                <header className="ins-card-head">
                    <div>
                        <h2>Transaksi terbaru</h2>
                        <p>{MONTHS[month - 1]} {year}</p>
                    </div>
                    <div className="ins-head-actions">
                        <Link to="/transactions/new" className="ins-link">
                            <FiPlus aria-hidden /> Catat
                        </Link>
                        <Link to="/transactions" className="ins-link">
                            Semua <FiArrowRight aria-hidden />
                        </Link>
                    </div>
                </header>
                {recent.length === 0 ? (
                    <EmptyState
                        size="sm"
                        mascot="semut"
                        title="Belum ada transaksi bulan ini"
                        description="Catatan pertamamu cukup satu kalimat, misalnya “kopi 18rb”."
                        action={{ label: "Catat cepat", icon: FiZap, onClick: openQuickAdd }}
                        secondary={{ label: "Isi lengkap", to: "/transactions/new" }}
                    />
                ) : (
                    recent.map((t) => <TransactionItem key={t._id} transaction={t} />)
                )}
            </section>
        </div>
    );
}

function HeroSummary({ o, loading, fallback }) {
    const cur = o?.current || { income: fallback.income || 0, expense: fallback.expense || 0, net: fallback.balance || 0 };
    const prev = o?.previousToDate;
    const rate = o?.current?.savingRate;
    const meter = rate === null || rate === undefined ? 0 : Math.max(0, Math.min(100, rate));
    const isCurrent = o?.period?.isCurrent;

    return (
        <section className="dash-hero">
            <div className="dash-hero-main">
                <span className="dash-eyebrow">Sisa uang {isCurrent ? "sejauh ini" : "bulan ini"}</span>
                <strong className={`dash-hero-value ${cur.net < 0 ? "is-neg" : ""}`}>
                    {signedRupiah(cur.net, formatRupiah)}
                </strong>
                <div className="dash-rate">
                    <div className="dash-rate-top">
                        <span>Rasio tabungan</span>
                        <strong>{rate === null || rate === undefined ? "–" : `${Math.round(rate)}%`}</strong>
                    </div>
                    <div
                        className="dash-rate-track"
                        role="meter"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(meter)}
                        aria-label="Rasio tabungan"
                    >
                        <span className={meter >= 20 ? "is-good" : ""} style={{ width: `${meter}%` }} />
                        <i style={{ left: "20%" }} title="Target 20%" />
                    </div>
                    <span className="dash-rate-note">
                        {rate === null || rate === undefined
                            ? "Belum ada pemasukan bulan ini."
                            : rate >= 20
                              ? "Sehat — di atas target 20%."
                              : "Target sehat: sisihkan minimal 20% dari pemasukan."}
                    </span>
                </div>
            </div>
            <div className="dash-kpis">
                <Kpi
                    label="Pemasukan"
                    tone="in"
                    value={cur.income}
                    delta={o && changePct(cur.income, prev?.income)}
                    goodWhen="up"
                    loading={loading}
                />
                <Kpi
                    label="Pengeluaran"
                    tone="out"
                    value={cur.expense}
                    delta={o && changePct(cur.expense, prev?.expense)}
                    goodWhen="down"
                    loading={loading}
                />
                <div className="dash-kpi">
                    <span className="dash-kpi-label">
                        <FiTarget aria-hidden /> Disisihkan ke goal
                    </span>
                    <strong>{formatRupiah(Math.max(0, o?.current?.goalSaved || 0))}</strong>
                    <span className="dash-kpi-sub">{o?.current?.count ?? "–"} transaksi tercatat</span>
                </div>
            </div>
        </section>
    );
}

function Kpi({ label, value, delta, goodWhen, tone, loading }) {
    return (
        <div className={`dash-kpi is-${tone}`}>
            <span className="dash-kpi-label">
                <i aria-hidden />
                {label}
            </span>
            <strong>{formatRupiah(value || 0)}</strong>
            {loading ? (
                <span className="ins-skel" style={{ width: 90 }} />
            ) : (
                <DeltaChip value={delta} goodWhen={goodWhen} suffix="vs bulan lalu" />
            )}
        </div>
    );
}

function ProjectionCard({ o, loading, totalBalance }) {
    const p = o?.projection;
    const period = o?.period;
    const progress = period ? (period.daysElapsed / period.daysInMonth) * 100 : 0;

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>{p ? "Proyeksi akhir bulan" : "Ringkasan bulan"}</h2>
                    <p>
                        {p
                            ? `Hari ke-${period.daysElapsed} dari ${period.daysInMonth} · sisa ${p.remainingDays} hari`
                            : period?.daysElapsed
                              ? "Bulan ini sudah selesai"
                              : "Bulan ini belum berjalan"}
                    </p>
                </div>
            </header>
            {loading ? (
                <SkeletonLines n={4} />
            ) : p && !(o?.current?.count > 0) ? (
                <EmptyState
                    size="sm"
                    icon={FiTrendingUp}
                    title="Proyeksi belum bisa dihitung"
                    description="Begitu ada pemasukan atau pengeluaran bulan ini, kamu akan melihat perkiraan sisa uang di akhir bulan."
                />
            ) : p ? (
                <>
                    <div className="proj-track" aria-hidden>
                        <span style={{ width: `${progress}%` }} />
                    </div>
                    <dl className="proj-list">
                        <div>
                            <dt>Perkiraan pengeluaran</dt>
                            <dd>{formatRupiah(p.expense)}</dd>
                        </div>
                        <div>
                            <dt>Perkiraan sisa uang</dt>
                            <dd className={p.net < 0 ? "is-neg" : "is-pos"}>{signedRupiah(p.net, formatRupiah)}</dd>
                        </div>
                        <div>
                            <dt>Rata-rata belanja harian</dt>
                            <dd>{formatRupiah(p.dailyAvg)}</dd>
                        </div>
                        <div>
                            <dt>Batas aman per hari</dt>
                            <dd className={p.safeDaily === 0 ? "is-neg" : ""}>
                                {p.safeDaily === null ? "–" : p.safeDaily === 0 ? "Sudah terlewati" : formatRupiah(p.safeDaily)}
                            </dd>
                        </div>
                        <div>
                            <dt>Perkiraan total saldo</dt>
                            <dd>{formatRupiah((totalBalance || 0) - p.dailyAvg * p.remainingDays)}</dd>
                        </div>
                    </dl>
                    <p className="proj-note">
                        Tagihan rutin dihitung sekali; sisanya diproyeksikan dari rata-rata belanja harian. Batas aman
                        menjaga sisa minimal 20% dari pemasukan.
                    </p>
                </>
            ) : (
                <dl className="proj-list">
                    <div>
                        <dt>Pemasukan</dt>
                        <dd>{formatRupiah(o?.current?.income || 0)}</dd>
                    </div>
                    <div>
                        <dt>Pengeluaran</dt>
                        <dd>{formatRupiah(o?.current?.expense || 0)}</dd>
                    </div>
                    <div>
                        <dt>Sisa</dt>
                        <dd className={(o?.current?.net || 0) < 0 ? "is-neg" : "is-pos"}>
                            {signedRupiah(o?.current?.net || 0, formatRupiah)}
                        </dd>
                    </div>
                    <div>
                        <dt>Rata-rata belanja harian</dt>
                        <dd>
                            {formatRupiah(period?.daysElapsed ? Math.round((o?.current?.expense || 0) / period.daysElapsed) : 0)}
                        </dd>
                    </div>
                </dl>
            )}
        </section>
    );
}

function PaceCard({ o, loading }) {
    const chart = useMemo(() => {
        if (!o) return [];
        const p = o.projection;
        const elapsed = o.period.daysElapsed;
        return o.pace.map((d) => {
            const row = { ...d };
            if (p && d.day >= elapsed) {
                const base = o.pace[elapsed - 1]?.current ?? 0;
                row.projected = Math.round(base + p.dailyAvg * (d.day - elapsed));
            }
            return row;
        });
    }, [o]);
    const hasData = chart.some((d) => d.current || d.previous);

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Laju pengeluaran</h2>
                    <p>Kumulatif harian dibanding {o?.period?.previousLabel || "bulan lalu"}</p>
                </div>
                <ul className="ins-legend" aria-label="Keterangan grafik">
                    <li>
                        <i className="sw-cur" /> Bulan ini
                    </li>
                    {o?.projection && (
                        <li>
                            <i className="sw-proj" /> Proyeksi
                        </li>
                    )}
                    <li>
                        <i className="sw-prev" /> Bulan lalu
                    </li>
                </ul>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" />
            ) : !hasData ? (
                <EmptyState
                    size="sm"
                    icon={FiActivity}
                    title="Belum ada pengeluaran"
                    description="Grafik laju belanja bulan ini dibanding bulan lalu muncul setelah ada pengeluaran."
                />
            ) : (
                <div className="ins-chart" style={{ minHeight: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--ins-expense)" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="var(--ins-expense)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="var(--ins-grid)" />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "var(--app-muted)" }}
                                interval="preserveStartEnd"
                                minTickGap={16}
                            />
                            <YAxis
                                tickFormatter={shortRupiah}
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                tick={{ fontSize: 11, fill: "var(--app-muted)" }}
                            />
                            <Tooltip
                                cursor={{ stroke: "var(--app-border-strong)", strokeWidth: 1 }}
                                content={
                                    <ChartTooltip
                                        title={(d) => `Tanggal ${d.day}`}
                                        rows={(d) => [
                                            d.current !== null && d.current !== undefined && {
                                                label: "Bulan ini",
                                                value: formatRupiah(d.current),
                                                color: "var(--ins-expense)",
                                            },
                                            d.projected !== undefined &&
                                                (d.current === null || d.current === undefined) && {
                                                    label: "Proyeksi",
                                                    value: formatRupiah(d.projected),
                                                    color: "var(--ins-expense)",
                                                    muted: true,
                                                },
                                            d.previous !== null && d.previous !== undefined && {
                                                label: "Bulan lalu",
                                                value: formatRupiah(d.previous),
                                                color: "var(--ins-prev)",
                                            },
                                        ]}
                                    />
                                }
                            />
                            <Line
                                type="monotone"
                                dataKey="previous"
                                stroke="var(--ins-prev)"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--app-surface)" }}
                                connectNulls={false}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="projected"
                                stroke="var(--ins-expense)"
                                strokeOpacity={0.55}
                                strokeWidth={2}
                                strokeDasharray="2 5"
                                dot={false}
                                activeDot={false}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="current"
                                stroke="var(--ins-expense)"
                                strokeWidth={2}
                                fill="url(#paceFill)"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--app-surface)" }}
                                connectNulls={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
}

function SkeletonLines({ n = 3 }) {
    return (
        <div className="ins-skel-lines">
            {Array.from({ length: n }, (_, i) => (
                <span key={i} className="ins-skel" style={{ width: `${90 - i * 12}%` }} />
            ))}
        </div>
    );
}
