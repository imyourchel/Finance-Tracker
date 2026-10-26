/* eslint-disable react-refresh/only-export-components */
import { FiArrowDownLeft, FiArrowUpRight, FiTag, FiDownload } from "react-icons/fi";
import { CATEGORY_ICONS } from "../../utils/categoryIcons";
import { formatRupiah } from "../../utils/format";
import CountUp from "./CountUp";

const fmtInt = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtDate = (key, withDow = true) =>
    new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
        weekday: withDow ? "long" : undefined,
        day: "numeric",
        month: "long",
    });

// Elemen yang masuk bergiliran (delay lewat --i)
const In = ({ i = 0, as: Tag = "div", className = "", children, ...rest }) => (
    <Tag className={`wr-in ${className}`} style={{ "--i": i }} {...rest}>
        {children}
    </Tag>
);

function Change({ value, goodWhen = "down", prev }) {
    if (value === null || value === undefined) return null;
    const up = value > 0;
    const same = Math.abs(value) < 1;
    const good = same ? null : goodWhen === "down" ? !up : up;
    return (
        <span className={`wr-change ${good === null ? "" : good ? "is-good" : "is-bad"}`}>
            {same ? `Sama seperti ${prev}` : `${up ? "▲" : "▼"} ${Math.abs(Math.round(value))}% vs ${prev}`}
        </span>
    );
}

/** Susun daftar slide dari data Wrapped. */
export function buildSlides(w, { persona, gamification, onDownload, downloading }) {
    const p = w.period;
    const isYear = p.type === "year";
    const per = isYear ? "tahun ini" : "bulan ini";
    const slides = [];
    const add = (id, tone, title, node) => slides.push({ id, tone, title, node });

    add(
        "intro",
        "ink",
        "Pembuka",
        <div className="wr-center">
            <In i={0} className="wr-kicker">
                DailyTrack Wrapped
            </In>
            <In i={1} as="h2" className="wr-display">
                {p.shortLabel}
                {!isYear && <span>{p.year}</span>}
            </In>
            <In i={2} as="p" className="wr-lead">
                {p.isComplete
                    ? `Ini cerita uangmu sepanjang ${isYear ? "tahun" : "bulan"} itu.`
                    : `Cerita uangmu ${per} sejauh ini, ${p.days} hari pertama.`}
            </In>
            <In i={3} className="wr-hint">
                Ketuk sisi kanan untuk lanjut
            </In>
        </div>,
    );

    const t = w.totals;
    add(
        "money",
        "jade",
        "Arus uang",
        <div className="wr-stack">
            <In i={0} className="wr-kicker">
                Arus uang {per}
            </In>
            <In i={1} className="wr-flow">
                <div>
                    <span>
                        <FiArrowDownLeft aria-hidden /> Uang masuk
                    </span>
                    <strong>
                        <CountUp value={t.income} format={formatRupiah} />
                    </strong>
                    <Change value={w.change.income} goodWhen="up" prev={p.previousLabel} />
                </div>
                <div>
                    <span>
                        <FiArrowUpRight aria-hidden /> Uang keluar
                    </span>
                    <strong>
                        <CountUp value={t.expense} format={formatRupiah} />
                    </strong>
                    <Change value={w.change.expense} goodWhen="down" prev={p.previousLabel} />
                </div>
            </In>
            <In i={2} className="wr-big">
                <span>Sisa</span>
                <strong className={t.net < 0 ? "is-neg" : ""}>
                    {t.net < 0 ? "−" : ""}
                    <CountUp value={Math.abs(t.net)} format={formatRupiah} duration={1400} />
                </strong>
            </In>
            <In i={3} as="p" className="wr-lead">
                {t.savingRate === null
                    ? "Belum ada pemasukan tercatat, jadi rasio tabungan belum bisa dihitung."
                    : t.savingRate >= 20
                      ? `Kamu menyisakan ${Math.round(t.savingRate)}% dari pemasukan. Di atas target sehat 20%!`
                      : `Kamu menyisakan ${Math.max(0, Math.round(t.savingRate))}% dari pemasukan. Target sehatnya 20%.`}
                {t.goalSaved > 0 && ` Plus ${formatRupiah(t.goalSaved)} masuk ke goal.`}
            </In>
        </div>,
    );

    if (w.topCategories.length) {
        const top = w.topCategories[0];
        const Icon = CATEGORY_ICONS[top.icon] || FiTag;
        add(
            "category",
            "brass",
            "Kategori #1",
            <div className="wr-stack">
                <In i={0} className="wr-kicker">
                    Uangmu paling banyak lari ke
                </In>
                <In i={1} className="wr-cat-hero">
                    <span className="wr-cat-icon">
                        <Icon aria-hidden />
                    </span>
                    <h2 className="wr-display is-sm">{top.name}</h2>
                </In>
                <In i={2} as="p" className="wr-lead">
                    <strong>{Math.round(top.share)}%</strong> dari pengeluaranmu, {formatRupiah(top.total)} lewat{" "}
                    {top.count} transaksi.
                </In>
                <In i={3} as="ol" className="wr-rank">
                    {w.topCategories.map((c, idx) => (
                        <li key={c.name}>
                            <b>{idx + 1}</b>
                            <span>{c.name}</span>
                            <div className="wr-rank-bar">
                                <span style={{ width: `${c.share}%` }} />
                            </div>
                            <em>{Math.round(c.share)}%</em>
                        </li>
                    ))}
                </In>
            </div>,
        );
    }

    if (w.busiestDay) {
        const b = w.busiestDay;
        add(
            "day",
            "cream",
            "Hari paling boros",
            <div className="wr-stack">
                <In i={0} className="wr-kicker">
                    Hari paling boros
                </In>
                <In i={1} as="h2" className="wr-display is-sm">
                    {fmtDate(b.date)}
                </In>
                <In i={2} className="wr-big">
                    <strong>
                        <CountUp value={b.total} format={formatRupiah} />
                    </strong>
                </In>
                <In i={3} as="p" className="wr-lead">
                    Habis dalam {b.count} transaksi, paling banyak untuk {b.topCategory.toLowerCase()}.
                </In>
                {w.favoriteDay && (
                    <In i={4} className="wr-note">
                        Secara keseluruhan, hari <strong>{w.favoriteDay.dow}</strong> paling sering bikin dompet tipis.
                        {w.weekendShare >= 35 && ` ${Math.round(w.weekendShare)}% belanjamu terjadi di akhir pekan.`}
                    </In>
                )}
            </div>,
        );
    }

    if (w.biggest) {
        const g = w.biggest;
        const Icon = CATEGORY_ICONS[g.category?.icon] || FiTag;
        add(
            "biggest",
            "ink",
            "Transaksi terbesar",
            <div className="wr-stack">
                <In i={0} className="wr-kicker">
                    Satu transaksi paling besar
                </In>
                <In i={1} className="wr-big is-xl">
                    <strong>
                        <CountUp value={g.amount} format={formatRupiah} duration={1500} />
                    </strong>
                </In>
                <In i={2} className="wr-receipt">
                    <span className="wr-cat-icon is-sm">
                        <Icon aria-hidden />
                    </span>
                    <div>
                        <strong>{g.description || g.category.name}</strong>
                        <span>
                            {g.category.name} · {fmtDate(g.date, false)}
                        </span>
                    </div>
                </In>
                <In i={3} as="p" className="wr-lead">
                    Itu {Math.round(g.share)}% dari seluruh pengeluaranmu {per}. Tagihan rutin tidak dihitung.
                </In>
            </div>,
        );
    }

    const a = w.activity;
    add(
        "habits",
        "jade",
        "Kebiasaan mencatat",
        <div className="wr-stack">
            <In i={0} className="wr-kicker">
                Kebiasaan mencatatmu
            </In>
            <In i={1} className="wr-stats">
                <div>
                    <strong>
                        <CountUp value={a.logged} format={fmtInt} />
                    </strong>
                    <span>transaksi dicatat</span>
                </div>
                <div>
                    <strong>
                        <CountUp value={a.activeDays} format={fmtInt} />
                    </strong>
                    <span>hari aktif</span>
                </div>
                <div>
                    <strong>
                        <CountUp value={a.bestStreak} format={fmtInt} />
                    </strong>
                    <span>hari streak terpanjang</span>
                </div>
                <div>
                    <strong>
                        <CountUp value={a.noSpendDays} format={fmtInt} />
                    </strong>
                    <span>hari tanpa jajan</span>
                </div>
            </In>
            <In i={2} as="p" className="wr-lead">
                Rata-rata kamu belanja {formatRupiah(a.avgDailyExpense)} per hari.
                {a.activeDays >= Math.max(1, p.days) * 0.7 ? " Konsisten sekali!" : " Makin rutin mencatat, makin jelas polanya."}
            </In>
        </div>,
    );

    add(
        "mood",
        "rose",
        "Mood belanja",
        w.mood ? (
            <div className="wr-center">
                <In i={0} className="wr-kicker">
                    Mood paling sering saat belanja
                </In>
                <In i={1} className="wr-emoji" aria-hidden>
                    {w.mood.emoji}
                </In>
                <In i={2} as="h2" className="wr-display is-sm">
                    {w.mood.label}
                </In>
                <In i={3} as="p" className="wr-lead">
                    Muncul di {Math.round(w.mood.share)}% belanja yang kamu beri mood, total {formatRupiah(w.mood.total)}.
                </In>
                {w.moods.length > 1 && (
                    <In i={4} className="wr-chips">
                        {w.moods.slice(1).map((m) => (
                            <span key={m.id}>
                                {m.emoji} {m.label} · {m.count}×
                            </span>
                        ))}
                    </In>
                )}
            </div>
        ) : (
            <div className="wr-center">
                <In i={0} className="wr-kicker">
                    Mood belanja
                </In>
                <In i={1} className="wr-emoji" aria-hidden>
                    🤔
                </In>
                <In i={2} as="h2" className="wr-display is-sm">
                    Masih misteri
                </In>
                <In i={3} as="p" className="wr-lead">
                    Kamu belum mencatat mood saat belanja. Coba isi mood di transaksi berikutnya, Wrapped depan akan
                    lebih seru.
                </In>
            </div>
        ),
    );

    const pz = w.personality;
    add(
        "personality",
        "brass",
        "Kepribadian belanja",
        <div className="wr-center">
            <In i={0} className="wr-kicker">
                Kepribadian belanjamu
            </In>
            <In i={1} className="wr-emoji is-badge" aria-hidden>
                {pz.emoji}
            </In>
            <In i={2} as="h2" className="wr-display is-sm">
                {pz.title}
            </In>
            <In i={3} as="p" className="wr-lead">
                {pz.description}
            </In>
            {pz.others?.length > 0 && (
                <In i={4} className="wr-chips">
                    <span className="wr-chips-label">Juga sedikit:</span>
                    {pz.others.map((o) => (
                        <span key={o.id}>
                            {o.emoji} {o.title}
                        </span>
                    ))}
                </In>
            )}
        </div>,
    );

    if (persona) {
        add(
            "persona",
            "jade",
            "Maskotmu",
            <div className="wr-center">
                <In i={0} className="wr-kicker">
                    Maskot yang menemanimu
                </In>
                <In i={1} className="wr-mascot">
                    <img src={persona.image} alt={persona.name} />
                </In>
                <In i={2} as="h2" className="wr-display is-sm">
                    {persona.name}
                    <em>{persona.title}</em>
                </In>
                <In i={3} as="p" className="wr-lead is-sm">
                    {persona.meaning}
                </In>
                {gamification && (
                    <In i={4} className="wr-chips">
                        <span>
                            Level {gamification.level} · {gamification.levelTitle}
                        </span>
                        {gamification.streak && <span>🔥 {gamification.streak.current} hari streak</span>}
                    </In>
                )}
            </div>,
        );
    }

    add(
        "summary",
        "ink",
        "Ringkasan",
        <div className="wr-stack wr-summary">
            <In i={0} className="wr-summary-head">
                <span className="wr-kicker">Wrapped · {p.label}</span>
                <span className="wr-summary-pz">
                    {pz.emoji} {pz.title}
                </span>
            </In>
            <In i={1} className="wr-summary-grid">
                <div>
                    <span>Uang masuk</span>
                    <strong>{formatRupiah(t.income)}</strong>
                </div>
                <div>
                    <span>Uang keluar</span>
                    <strong>{formatRupiah(t.expense)}</strong>
                </div>
                <div>
                    <span>Sisa</span>
                    <strong>
                        {t.net < 0 ? "−" : ""}
                        {formatRupiah(Math.abs(t.net))}
                    </strong>
                </div>
                <div>
                    <span>Rasio tabungan</span>
                    <strong>{t.savingRate === null ? "–" : `${Math.round(t.savingRate)}%`}</strong>
                </div>
                <div>
                    <span>Kategori #1</span>
                    <strong>{w.topCategories[0]?.name || "–"}</strong>
                </div>
                <div>
                    <span>Streak terpanjang</span>
                    <strong>{a.bestStreak} hari</strong>
                </div>
            </In>
            {w.tips.length > 0 && (
                <In i={2} className="wr-tips">
                    <span className="wr-kicker">Untuk {isYear ? "tahun" : "bulan"} depan</span>
                    <ul>
                        {w.tips.map((tip) => (
                            <li key={tip}>{tip}</li>
                        ))}
                    </ul>
                </In>
            )}
            <In i={3}>
                <button
                    type="button"
                    className="wr-download"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload();
                    }}
                    disabled={downloading}
                >
                    <FiDownload aria-hidden /> {downloading ? "Menyiapkan gambar..." : "Unduh kartu untuk story"}
                </button>
            </In>
        </div>,
    );

    return slides;
}
