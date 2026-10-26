import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiClock, FiCalendar, FiTag, FiPlus } from "react-icons/fi";
import { getInsightsMoodAPI } from "../../services/insightsApi";
import { formatRupiah } from "../../utils/format";
import { CATEGORY_ICONS } from "../../utils/categoryIcons";
import InsightList from "./InsightList";
import { pctLabel, shortRupiah } from "./format";

const TONE_LABEL = { emotional: "Emosional", positive: "Positif", neutral: "Netral" };

/** Mood vs belanja: pola belanja emosional dari mood yang dicatat. */
export default function MoodCard({ month, year, months }) {
    const key = `${year}-${month}-${months}`;
    const [state, setState] = useState({ key: null, data: null, error: "" });

    useEffect(() => {
        let alive = true;
        getInsightsMoodAPI({ month, year, months })
            .then((r) => {
                if (!alive) return;
                // Jaga-jaga respons tak lengkap (mis. server lama belum di-restart)
                const ok = r.data && r.data.range && r.data.coverage && Array.isArray(r.data.moods);
                setState({ key, data: ok ? r.data : null, error: ok ? "" : "Analisis mood belum tersedia. Muat ulang setelah server diperbarui." });
            })
            .catch((e) => alive && setState({ key, data: null, error: e.response?.data?.message || "Analisis mood gagal dimuat." }));
        return () => {
            alive = false;
        };
    }, [month, year, months, key]);

    const loading = state.key !== key;
    const d = loading ? null : state.data;

    return (
        <section className="ins-card mood-card">
            <header className="ins-card-head">
                <div>
                    <h2>Mood vs belanja</h2>
                    <p>{d ? `Belanja emosional ${d.range.label}` : "Seberapa besar perasaan memengaruhi belanjamu"}</p>
                </div>
                {d && d.coverage.expenseCount > 0 && (
                    <div className="mood-coverage" title="Pengeluaran yang dicatat dengan mood">
                        <div className="mood-coverage-bar">
                            <span style={{ width: `${Math.min(100, d.coverage.pct)}%` }} />
                        </div>
                        <span>
                            <strong>{Math.round(d.coverage.pct)}%</strong> pengeluaran punya mood ({d.coverage.withMood}/
                            {d.coverage.expenseCount})
                        </span>
                    </div>
                )}
            </header>

            {loading ? (
                <div className="mood-grid">
                    <div className="ins-skel ins-skel-chart" />
                    <div className="ins-skel ins-skel-chart" />
                </div>
            ) : state.error ? (
                <p className="ins-error">{state.error}</p>
            ) : !d.moods.length ? (
                <div className="mood-empty">
                    <span className="mood-empty-emoji" aria-hidden>
                        😄 😐 😔 🎁
                    </span>
                    <strong>Belum ada pengeluaran dengan mood</strong>
                    <p>
                        Saat mencatat pengeluaran, pilih mood-mu di bagian "Detail lain". Dari situ DailyTrack bisa
                        menunjukkan perasaan mana yang paling sering bikin boros.
                    </p>
                    <Link to="/transactions/new" className="mood-cta">
                        <FiPlus aria-hidden /> Catat pengeluaran dengan mood
                    </Link>
                </div>
            ) : (
                <div className="mood-grid">
                    <MoodList d={d} />
                    <EmotionalPanel d={d} />
                </div>
            )}
        </section>
    );
}

function MoodList({ d }) {
    const max = Math.max(1, ...d.moods.map((m) => m.total));
    return (
        <div className="mood-list-wrap">
            <div className="mood-list-head">
                <span>Mood</span>
                <span>Total · rata-rata per transaksi</span>
            </div>
            <ul className="mood-list">
                {d.moods.map((m) => {
                    const Icon = CATEGORY_ICONS[m.topCategory?.icon] || FiTag;
                    const isPriciest = d.priciest?.id === m.id;
                    return (
                        <li key={m.id} className={`is-${m.tone}`}>
                            <span className="mood-emoji" aria-hidden>
                                {m.emoji}
                            </span>
                            <div className="mood-main">
                                <div className="mood-row-top">
                                    <strong>
                                        {m.label}
                                        <em className={`mood-tone is-${m.tone}`}>{TONE_LABEL[m.tone]}</em>
                                        {isPriciest && <em className="mood-tone is-pricey">Paling mahal</em>}
                                    </strong>
                                    <span className="mood-total">{formatRupiah(m.total)}</span>
                                </div>
                                <div className="mood-bar" aria-hidden>
                                    <span style={{ width: `${(m.total / max) * 100}%` }} />
                                </div>
                                <div className="mood-row-meta">
                                    <span>
                                        {m.count}× · {Math.round(m.share)}% dari belanja bermood
                                        {m.topCategory && (
                                            <>
                                                {" · "}
                                                <Icon aria-hidden className="mood-cat-icon" style={{ color: m.topCategory.color }} />
                                                {m.topCategory.name}
                                            </>
                                        )}
                                    </span>
                                    <span className="mood-avg">
                                        {shortRupiah(m.avg)}/trx
                                        {m.vsAvg !== null && Math.abs(m.vsAvg) >= 5 && (
                                            <b className={m.vsAvg > 0 ? "is-up" : "is-down"}>{pctLabel(m.vsAvg)}</b>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <p className="mood-foot">Persentase di kanan = rata-rata per transaksi dibanding semua mood ({formatRupiah(d.totals.avgPerTx)}).</p>
        </div>
    );
}

function EmotionalPanel({ d }) {
    const e = d.emotional;
    const maxBlock = Math.max(1, ...d.byTime.map((b) => b.emotional + b.other));
    const ring = Math.min(100, e.share);
    return (
        <div className="mood-emo">
            <div className="mood-emo-top">
                <div className="mood-ring" style={{ "--p": ring }} role="img" aria-label={`${Math.round(e.share)}% belanja emosional`}>
                    <div>
                        <strong>{Math.round(e.share)}%</strong>
                        <span>emosional</span>
                    </div>
                </div>
                <div className="mood-emo-text">
                    <span className="mood-kicker">Belanja emosional</span>
                    <strong>{formatRupiah(e.total)}</strong>
                    <span>
                        {e.count} transaksi saat sedih, self reward, terpaksa, atau merasa bersalah
                        {e.avg ? ` · rata-rata ${formatRupiah(e.avg)}` : ""}
                    </span>
                </div>
            </div>

            <dl className="mood-facts">
                <div>
                    <dt>
                        <FiClock aria-hidden /> Jam rawan
                    </dt>
                    <dd>{e.peakTime ? `${e.peakTime.label} · ${e.peakTime.range}` : "–"}</dd>
                </div>
                <div>
                    <dt>
                        <FiCalendar aria-hidden /> Hari rawan
                    </dt>
                    <dd>{e.peakDay || "–"}</dd>
                </div>
                <div>
                    <dt>
                        <FiTag aria-hidden /> Paling sering untuk
                    </dt>
                    <dd>{e.topCategory ? `${e.topCategory.name} (${Math.round(e.topCategory.share)}%)` : "–"}</dd>
                </div>
            </dl>

            <div className="mood-time">
                <div className="mood-time-legend">
                    <span>
                        <i className="is-emo" /> Emosional
                    </span>
                    <span>
                        <i /> Mood lain
                    </span>
                </div>
                <ul>
                    {d.byTime.map((b) => (
                        <li key={b.id} title={`${b.label} ${b.range}: emosional ${formatRupiah(b.emotional)}, lainnya ${formatRupiah(b.other)}`}>
                            <div className="mood-time-col">
                                <span className="is-other" style={{ height: `${(b.other / maxBlock) * 100}%` }} />
                                <span className="is-emo" style={{ height: `${(b.emotional / maxBlock) * 100}%` }} />
                            </div>
                            <strong>{b.label}</strong>
                            <small>{b.range}</small>
                        </li>
                    ))}
                </ul>
            </div>

            {d.insights.length > 0 && <InsightList items={d.insights.map((i, idx) => ({ ...i, id: `mood-${idx}` }))} />}
        </div>
    );
}
