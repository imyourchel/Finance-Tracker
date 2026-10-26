import { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { FiCalendar, FiTable, FiBarChart2, FiTag, FiZap, FiPercent } from "react-icons/fi";
import EmptyState from "../components/ui/EmptyState";
import { openQuickAdd } from "../utils/quickAddBus";
import DropdownMenu from "../components/ui/DropdownMenu";
import PageHeader from "../components/Layout/PageHeader";
import { useFinance } from "../context/FinanceContext";
import { getInsightsAnalyticsAPI } from "../services/insightsApi";
import { formatRupiah, MONTHS } from "../utils/format";
import { CATEGORY_ICONS } from "../utils/categoryIcons";
import DeltaChip from "../components/insights/DeltaChip";
import ChartTooltip from "../components/insights/ChartTooltip";
import CategoryList from "../components/insights/CategoryList";
import MoodCard from "../components/insights/MoodCard";
import { changePct, DOW_SHORT, shortRupiah, signedRupiah } from "../components/insights/format";
import "../styles/insights.css";

const RANGES = [
    { value: 3, label: "3 bulan" },
    { value: 6, label: "6 bulan" },
    { value: 12, label: "12 bulan" },
];

const rateText = (r) => (r === null || r === undefined ? "–" : `${Math.round(r)}%`);

export default function Analytics() {
    const { month, year, setMonth, setYear, availableYears, summary } = useFinance();
    const [months, setMonths] = useState(6);
    const [data, setData] = useState({ key: null, value: null, error: "" });
    const key = `${year}-${month}-${months}`;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        let alive = true;
        getInsightsAnalyticsAPI({ month, year, months })
            .then((r) => alive && setData({ key, value: r.data, error: "" }))
            .catch((e) =>
                alive && setData({ key, value: null, error: e.response?.data?.message || "Analitik gagal dimuat." }),
            );
        return () => {
            alive = false;
        };
    }, [month, year, months, key, summary]);

    const a = data.key === key ? data.value : null;
    const loading = data.key !== key;
    const t = a?.totals;
    const pt = a?.previousTotals;

    return (
        <div className="ins-root ins-page">
            <PageHeader
                title="Analitik"
                subtitle={a ? `Pola keuanganmu ${a.range.label}` : "Pola keuanganmu dari waktu ke waktu"}
                action={
                    <div className="ins-period">
                        <div className="ins-seg" role="radiogroup" aria-label="Rentang waktu">
                            {RANGES.map((r) => (
                                <button
                                    key={r.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={months === r.value}
                                    className={months === r.value ? "is-active" : ""}
                                    onClick={() => setMonths(r.value)}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <DropdownMenu
                            label="Sampai"
                            value={month}
                            options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))}
                            onChange={(v) => setMonth(Number(v))}
                        />
                        <DropdownMenu
                            label="Tahun"
                            value={year}
                            options={availableYears.map((y) => ({ value: y, label: String(y) }))}
                            onChange={(v) => setYear(Number(v))}
                            minWidth="110px"
                        />
                    </div>
                }
            />

            {data.error && !loading && <p className="ins-error">{data.error}</p>}

            <div className="ana-kpis">
                <KpiTile
                    label="Total pemasukan"
                    value={t && formatRupiah(t.income)}
                    delta={t && changePct(t.income, pt?.income)}
                    goodWhen="up"
                    loading={loading}
                />
                <KpiTile
                    label="Total pengeluaran"
                    value={t && formatRupiah(t.expense)}
                    delta={t && changePct(t.expense, pt?.expense)}
                    goodWhen="down"
                    loading={loading}
                />
                <KpiTile
                    label="Rasio tabungan"
                    value={t && rateText(t.savingRate)}
                    sub={
                        t?.best
                            ? `Terbaik ${t.best.label} (${rateText(t.best.savingRate)})`
                            : "Belum ada bulan dengan pemasukan"
                    }
                    loading={loading}
                />
                <KpiTile
                    label="Rata-rata belanja harian"
                    value={t && formatRupiah(t.avgDailyExpense)}
                    sub={t && `${t.noSpendDays} hari tanpa belanja dari ${t.trackedDays} hari`}
                    loading={loading}
                />
            </div>

            <TrendCard a={a} loading={loading} />

            <div className="dash-grid">
                <RateCard a={a} loading={loading} />
                <section className="ins-card">
                    <header className="ins-card-head">
                        <div>
                            <h2>Kategori paling boros</h2>
                            <p>{a ? `Dibanding ${a.range.previousLabel}` : "Dibanding periode sebelumnya"}</p>
                        </div>
                    </header>
                    {loading ? (
                        <div className="ins-skel ins-skel-chart" />
                    ) : (
                        <CategoryList items={a?.categories || []} limit={6} compareLabel="periode lalu" />
                    )}
                </section>
            </div>

            <HeatmapCard a={a} loading={loading} />

            <MoodCard month={month} year={year} months={months} />

            <div className="dash-grid">
                <WeekdayCard a={a} loading={loading} />
                <LargestCard a={a} loading={loading} />
            </div>
        </div>
    );
}

function KpiTile({ label, value, delta, goodWhen, sub, loading }) {
    return (
        <div className="ana-kpi">
            <span className="ana-kpi-label">{label}</span>
            {loading || !value ? <span className="ins-skel" style={{ width: "70%", height: 22 }} /> : <strong>{value}</strong>}
            {delta !== undefined && !loading ? (
                <DeltaChip value={delta} goodWhen={goodWhen} suffix="vs periode lalu" />
            ) : (
                sub && !loading && <span className="ana-kpi-sub">{sub}</span>
            )}
        </div>
    );
}

function TrendCard({ a, loading }) {
    const [asTable, setAsTable] = useState(false);
    const rows = a?.months || [];
    const hasData = rows.some((m) => m.income || m.expense);

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Pemasukan vs pengeluaran</h2>
                    <p>Per bulan · transfer dan setoran goal tidak dihitung</p>
                </div>
                <div className="ins-head-actions">
                    <ul className="ins-legend" aria-label="Keterangan grafik">
                        <li>
                            <i className="sw-in" /> Pemasukan
                        </li>
                        <li>
                            <i className="sw-out" /> Pengeluaran
                        </li>
                    </ul>
                    <button
                        type="button"
                        className="ins-toggle"
                        onClick={() => setAsTable((v) => !v)}
                        aria-pressed={asTable}
                    >
                        {asTable ? <FiBarChart2 aria-hidden /> : <FiTable aria-hidden />}
                        {asTable ? "Grafik" : "Tabel"}
                    </button>
                </div>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" />
            ) : !hasData ? (
                <EmptyState
                    icon={FiBarChart2}
                    title="Belum ada transaksi di rentang ini"
                    description="Tren pemasukan dan pengeluaran per bulan muncul setelah kamu mulai mencatat."
                    action={{ label: "Catat transaksi", icon: FiZap, onClick: openQuickAdd }}
                />
            ) : asTable ? (
                <div className="ins-table-wrap">
                    <table className="ins-table">
                        <thead>
                            <tr>
                                <th>Bulan</th>
                                <th>Pemasukan</th>
                                <th>Pengeluaran</th>
                                <th>Sisa</th>
                                <th>Rasio</th>
                                <th>Ke goal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((m) => (
                                <tr key={m.key}>
                                    <td>{m.label}</td>
                                    <td>{formatRupiah(m.income)}</td>
                                    <td>{formatRupiah(m.expense)}</td>
                                    <td className={m.net < 0 ? "is-neg" : ""}>{signedRupiah(m.net, formatRupiah)}</td>
                                    <td>{rateText(m.savingRate)}</td>
                                    <td>{formatRupiah(Math.max(0, m.goalSaved))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="ins-chart" style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} stroke="var(--ins-grid)" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11.5, fill: "var(--app-muted)" }}
                            />
                            <YAxis
                                tickFormatter={shortRupiah}
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                tick={{ fontSize: 11, fill: "var(--app-muted)" }}
                            />
                            <Tooltip
                                cursor={{ fill: "var(--ins-hover)" }}
                                content={
                                    <ChartTooltip
                                        title={(d) => `${MONTHS[d.month - 1]} ${d.year}`}
                                        rows={(d) => [
                                            { label: "Pemasukan", value: formatRupiah(d.income), color: "var(--ins-income)" },
                                            { label: "Pengeluaran", value: formatRupiah(d.expense), color: "var(--ins-expense)" },
                                            { label: "Sisa", value: signedRupiah(d.net, formatRupiah) },
                                            { label: "Rasio tabungan", value: rateText(d.savingRate), muted: true },
                                        ]}
                                    />
                                }
                            />
                            <Bar dataKey="income" name="Pemasukan" fill="var(--ins-income)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                            <Bar dataKey="expense" name="Pengeluaran" fill="var(--ins-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
}

function RateCard({ a, loading }) {
    const rows = (a?.months || []).map((m) => ({ ...m, rate: m.savingRate ?? 0, hasRate: m.savingRate !== null }));
    const hasData = rows.some((m) => m.hasRate);
    const min = Math.min(0, ...rows.map((r) => r.rate));
    const max = Math.max(40, ...rows.map((r) => r.rate));
    const step = max - min > 80 ? 20 : 10;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Rasio tabungan per bulan</h2>
                    <p>Garis putus-putus = target sehat 20%</p>
                </div>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" />
            ) : !hasData ? (
                <EmptyState
                    size="sm"
                    icon={FiPercent}
                    title="Belum ada pemasukan"
                    description="Rasio tabungan per bulan muncul setelah ada pemasukan tercatat."
                />
            ) : (
                <div className="ins-chart" style={{ minHeight: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="var(--ins-grid)" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "var(--app-muted)" }} />
                            <YAxis
                                domain={[lo, hi]}
                                ticks={ticks}
                                tickFormatter={(v) => `${v}%`}
                                tickLine={false}
                                axisLine={false}
                                width={44}
                                tick={{ fontSize: 11, fill: "var(--app-muted)" }}
                            />
                            <ReferenceLine y={20} stroke="var(--app-muted)" strokeDasharray="4 4" />
                            <ReferenceLine y={0} stroke="var(--app-border-strong)" />
                            <Tooltip
                                cursor={{ fill: "var(--ins-hover)" }}
                                content={
                                    <ChartTooltip
                                        title={(d) => `${MONTHS[d.month - 1]} ${d.year}`}
                                        rows={(d) => [
                                            { label: "Rasio tabungan", value: d.hasRate ? rateText(d.savingRate) : "Tidak ada pemasukan" },
                                            { label: "Sisa", value: signedRupiah(d.net, formatRupiah), muted: true },
                                        ]}
                                    />
                                }
                            />
                            <Bar dataKey="rate" radius={[4, 4, 4, 4]} maxBarSize={30} isAnimationActive={false}>
                                {rows.map((r) => (
                                    <Cell
                                        key={r.key}
                                        fill={!r.hasRate ? "var(--ins-prev)" : r.rate >= 0 ? "var(--ins-income)" : "var(--ins-expense)"}
                                        fillOpacity={r.hasRate && r.rate < 20 && r.rate >= 0 ? 0.55 : 1}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
}

function HeatmapCard({ a, loading }) {
    const [hover, setHover] = useState(null);
    const { weeks, levels, monthsRow } = useMemo(() => {
        const days = a?.heatmap || [];
        if (!days.length) return { weeks: [], levels: [], monthsRow: [] };
        // Ambang level dari kuantil hari yang ada belanjanya
        const vals = days.map((d) => d.total).filter((v) => v > 0).sort((x, y) => x - y);
        const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
        const lv = vals.length ? [q(0.25), q(0.5), q(0.75)] : [];
        // Susun per minggu (Senin di atas)
        const cols = [];
        const lead = (days[0].dow + 6) % 7;
        let col = Array(lead).fill(null);
        for (const d of days) {
            col.push(d);
            if (col.length === 7) {
                cols.push(col);
                col = [];
            }
        }
        if (col.length) cols.push([...col, ...Array(7 - col.length).fill(null)]);
        const mr = cols.map((c, i) => {
            const first = c.find((d) => d && d.date.endsWith("-01")) || (i === 0 ? c.find(Boolean) : null);
            return first ? MONTHS[Number(first.date.slice(5, 7)) - 1].slice(0, 3) : "";
        });
        return { weeks: cols, levels: lv, monthsRow: mr };
    }, [a]);

    const levelOf = (v) => {
        if (!v) return 0;
        if (v <= levels[0]) return 1;
        if (v <= levels[1]) return 2;
        if (v <= levels[2]) return 3;
        return 4;
    };
    const label = (d) =>
        new Date(`${d.date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Kalender pengeluaran</h2>
                    <p>Makin gelap, makin besar belanja hari itu</p>
                </div>
                <div className="heat-legend" aria-hidden>
                    <span>Sedikit</span>
                    {[0, 1, 2, 3, 4].map((l) => (
                        <i key={l} className={`heat-l${l}`} />
                    ))}
                    <span>Banyak</span>
                </div>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" style={{ height: 150 }} />
            ) : !weeks.length || !a?.totals?.expense ? (
                <EmptyState
                    size="sm"
                    icon={FiCalendar}
                    title="Kalender masih kosong"
                    description="Setiap hari kamu belanja akan terwarnai di sini, makin gelap makin besar."
                />
            ) : (
                <>
                    <div className="heat-wrap" style={{ "--cell": `${weeks.length <= 16 ? 26 : weeks.length <= 30 ? 20 : 14}px` }}>
                        <div className="heat-dows" aria-hidden>
                            {["Sen", "", "Rab", "", "Jum", "", "Min"].map((d, i) => (
                                <span key={i}>{d}</span>
                            ))}
                        </div>
                        <div className="heat-scroll">
                            <div className="heat-months" aria-hidden>
                                {monthsRow.map((m, i) => (
                                    <span key={i}>{m}</span>
                                ))}
                            </div>
                            <div className="heat-grid" role="grid" aria-label="Pengeluaran harian" onMouseLeave={() => setHover(null)}>
                                {weeks.map((w, i) => (
                                    <div key={i} className="heat-col" role="row">
                                        {w.map((d, j) =>
                                            d ? (
                                                <button
                                                    type="button"
                                                    key={d.date}
                                                    role="gridcell"
                                                    className={`heat-cell heat-l${levelOf(d.total)} ${hover?.date === d.date ? "is-hover" : ""}`}
                                                    aria-label={`${label(d)}: ${formatRupiah(d.total)}`}
                                                    onMouseEnter={() => setHover(d)}
                                                    onFocus={() => setHover(d)}
                                                />
                                            ) : (
                                                <span key={`e${j}`} className="heat-cell is-empty" />
                                            ),
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="heat-readout" aria-live="polite">
                        <FiCalendar aria-hidden />
                        {hover ? (
                            <>
                                <span>{label(hover)}</span>
                                <strong>{hover.total ? formatRupiah(hover.total) : "Tanpa belanja"}</strong>
                                {hover.count > 0 && <span className="muted">{hover.count} transaksi</span>}
                            </>
                        ) : (
                            <span className="muted">Arahkan ke kotak untuk melihat detail hari itu.</span>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}

function WeekdayCard({ a, loading }) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const rows = order.map((dow) => a?.weekday?.find((w) => w.dow === dow) || { dow, avg: 0 });
    const max = Math.max(1, ...rows.map((r) => r.avg));
    const top = [...rows].sort((x, y) => y.avg - x.avg)[0];

    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Rata-rata per hari</h2>
                    <p>{top?.avg ? `Paling boros di hari ${DOW_SHORT[top.dow]}` : "Pengeluaran rata-rata per hari dalam seminggu"}</p>
                </div>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" style={{ height: 200 }} />
            ) : !top?.avg ? (
                <EmptyState
                    size="sm"
                    icon={FiBarChart2}
                    title="Belum ada pola harian"
                    description="Hari yang paling sering bikin boros akan terlihat setelah beberapa minggu mencatat."
                />
            ) : (
                <ul className="dow-bars">
                    {rows.map((r) => (
                        <li key={r.dow} className={r.dow === top?.dow && r.avg ? "is-top" : ""}>
                            <span>{DOW_SHORT[r.dow]}</span>
                            <div className="dow-bar-track">
                                <span style={{ width: `${(r.avg / max) * 100}%` }} />
                            </div>
                            <strong>{shortRupiah(r.avg)}</strong>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function LargestCard({ a, loading }) {
    const list = a?.largest || [];
    return (
        <section className="ins-card">
            <header className="ins-card-head">
                <div>
                    <h2>Transaksi terbesar</h2>
                    <p>{a ? `${a.range.label} · di luar tagihan rutin` : "Di luar tagihan rutin"}</p>
                </div>
            </header>
            {loading ? (
                <div className="ins-skel ins-skel-chart" style={{ height: 200 }} />
            ) : !list.length ? (
                <EmptyState
                    size="sm"
                    icon={FiTag}
                    title="Belum ada pengeluaran"
                    description="Transaksi terbesar di luar tagihan rutin akan tampil di sini."
                />
            ) : (
                <ol className="big-list">
                    {list.map((t, i) => {
                        const Icon = CATEGORY_ICONS[t.category?.icon] || FiTag;
                        const share = a.totals.expense > 0 ? (t.amount / a.totals.expense) * 100 : 0;
                        return (
                            <li key={t._id || i}>
                                <span className="big-rank">{i + 1}</span>
                                <span className="ins-cat-icon" style={{ "--cat": t.category?.color }}>
                                    <Icon aria-hidden />
                                </span>
                                <div className="big-body">
                                    <strong>{t.description || t.category?.name || "Pengeluaran"}</strong>
                                    <span>
                                        {t.category?.name} ·{" "}
                                        {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                        {t.wallet?.name ? ` · ${t.wallet.name}` : ""}
                                    </span>
                                </div>
                                <div className="big-amount">
                                    <strong>{formatRupiah(t.amount)}</strong>
                                    <span>{share.toFixed(share < 10 ? 1 : 0).replace(".", ",")}% dari total</span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
