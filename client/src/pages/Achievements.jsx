import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
    FiZap,
    FiCalendar,
    FiCheck,
    FiLock,
    FiEdit3,
    FiList,
    FiTrendingUp,
    FiAward,
    FiShield,
    FiFlag,
    FiStar,
    FiTarget,
    FiX,
    FiClock,
} from "react-icons/fi";
import { PiFlameFill, PiShieldCheckFill, PiTrophyFill, PiFlagCheckeredFill, PiCalendarCheckFill, PiPiggyBankFill, PiSunHorizonFill, PiCoinsFill } from "react-icons/pi";
import { useFinance } from "../context/FinanceContext";
import { PERSONAS, personaById } from "../utils/personas";
import { formatRupiah, formatNumberInput, parseNumberInput } from "../utils/format";
import PageHeader from "../components/Layout/PageHeader";
import useGameActions from "../components/gamification/useGameActions";
import { QuestItem, StreakFlame, streakHint, timeLeft, useNow } from "../components/gamification/GameParts";

const BADGE_ICONS = {
    "first-tx": FiEdit3,
    "streak-7": FiZap,
    "streak-30": FiCalendar,
    "streak-100": FiZap,
    shield: FiShield,
    "tx-100": FiList,
    "quest-25": FiTarget,
    "challenge-1": FiFlag,
    "challenge-5": FiAward,
    "frugal-month": FiTrendingUp,
    "frugal-3": FiAward,
    "budget-safe": FiShield,
    "goal-1": FiFlag,
    gold: FiStar,
};

const CHALLENGE_ICONS = {
    "batas-harian": PiCoinsFill,
    "tanpa-jajan-3": PiCalendarCheckFill,
    "akhir-pekan": PiSunHorizonFill,
    "sisa-bulan": PiPiggyBankFill,
    "52-minggu": PiFlagCheckeredFill,
};

const XP_RULES = [
    ["activeDays", "Setiap hari kamu mencatat", "+10"],
    ["transactions", "Setiap transaksi tercatat", "+2"],
    ["bestStreak", "Setiap hari di streak terbaikmu", "+5"],
    ["quests", "Misi harian & mingguan", "+10–70"],
    ["challenges", "Tantangan menabung selesai", "+100–1.000"],
    ["frugalMonths", "Bulan dengan sisa uang ≥ 20%", "+100"],
    ["budgetsKept", "Budget aman sampai akhir bulan", "+30"],
    ["goalsCompleted", "Goal tabungan tercapai", "+150"],
    ["gold", "Punya wallet emas", "+50"],
];

const TABS = [
    { id: "ringkasan", label: "Ringkasan" },
    { id: "misi", label: "Misi" },
    { id: "tantangan", label: "Tantangan" },
    { id: "lencana", label: "Lencana" },
];

const fmt = (n) => Number(n || 0).toLocaleString("id-ID");
const fmtDay = (key) => {
    const d = new Date(`${key}T00:00:00`);
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
};

function Requirement({ r }) {
    const value = r.boolean
        ? r.met
            ? "Ya"
            : "Belum"
        : `${fmt(r.current)}${r.unit === "%" ? "%" : ""} / ${fmt(r.target)}${r.unit === "%" ? "%" : ` ${r.unit}`}`;
    return (
        <li className={`ach-req ${r.met ? "is-met" : ""}`}>
            <span className="ach-req-check" aria-hidden>
                {r.met ? <FiCheck /> : null}
            </span>
            <div className="ach-req-body">
                <div className="ach-req-top">
                    <span>{r.label}</span>
                    <strong>{value}</strong>
                </div>
                {!r.boolean && (
                    <div className="ach-bar" aria-hidden>
                        <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
                    </div>
                )}
            </div>
        </li>
    );
}

export default function Achievements() {
    const { gamification: g } = useFinance();
    const [params, setParams] = useSearchParams();
    const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "ringkasan";
    const setTab = (id) => setParams(id === "ringkasan" ? {} : { tab: id }, { replace: true });

    if (!g?.quests) {
        return (
            <div className="ach-page">
                <PageHeader title="Pencapaian" subtitle="Memuat kebiasaan keuanganmu..." />
                <div className="loading-spinner" style={{ margin: "60px auto" }} />
            </div>
        );
    }

    const claimable = [...g.quests.daily, ...g.quests.weekly].filter((q) => q.claimable).length;
    const unlocked = g.badges.filter((b) => b.unlocked).length;
    const counts = {
        misi: claimable ? { n: claimable, hot: true } : null,
        tantangan: g.challenges.active.length ? { n: g.challenges.active.length } : null,
        lencana: { n: `${unlocked}/${g.badges.length}` },
    };

    return (
        <div className="ach-page">
            <PageHeader
                title="Pencapaian"
                subtitle="Kumpulkan XP dari kebiasaan baik, selesaikan misi, dan taklukkan tantangan menabung."
            />

            <Hero g={g} />

            <nav className="ach-tabs" role="tablist" aria-label="Bagian pencapaian">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className={`ach-tab ${tab === t.id ? "is-active" : ""}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                        {counts[t.id] && (
                            <span className={`ach-tab-count ${counts[t.id].hot ? "is-hot" : ""}`}>{counts[t.id].n}</span>
                        )}
                    </button>
                ))}
            </nav>

            {tab === "ringkasan" && <Overview g={g} />}
            {tab === "misi" && <Quests g={g} />}
            {tab === "tantangan" && <Challenges g={g} />}
            {tab === "lencana" && <Badges g={g} />}
        </div>
    );
}

/* ───────────────────────── Hero ───────────────────────── */
function Hero({ g }) {
    const persona = personaById(g.persona);
    const levelSpan = Math.max(1, g.nextLevelXp - g.levelStartXp);
    const levelPct = Math.min(100, Math.round(((g.xp - g.levelStartXp) / levelSpan) * 100));

    return (
        <section className="ach-hero">
            <div className="ach-hero-figure">
                <img src={persona.image} alt={persona.name} />
                <span className="ach-tier">Tingkat {g.tier} dari 5</span>
            </div>
            <div className="ach-hero-text">
                <div className="ach-kicker">Maskotmu saat ini</div>
                <h2>
                    {persona.name}, <em>{persona.title}</em>
                </h2>
                <p className="ach-meaning">{persona.meaning}</p>

                <div className="ach-level">
                    <div className="ach-level-top">
                        <strong>
                            Level {g.level} <span className="ach-level-title">{g.levelTitle}</span>
                        </strong>
                        <span>
                            {fmt(g.xp)} / {fmt(g.nextLevelXp)} XP
                        </span>
                    </div>
                    <div className="ach-bar is-gold" aria-label={`${levelPct}% menuju level ${g.level + 1}`}>
                        <span style={{ width: `${levelPct}%` }} />
                    </div>
                    {g.xpToday > 0 && <div className="ach-today">+{fmt(g.xpToday)} XP hari ini</div>}
                </div>

                <div className="ach-stats">
                    <div>
                        <FiCalendar aria-hidden />
                        <strong>{g.stats.activeDays30}/30</strong>
                        <span>hari aktif</span>
                    </div>
                    <div>
                        <FiTrendingUp aria-hidden />
                        <strong>{fmt(g.stats.savingRate30)}%</strong>
                        <span>sisa uang (30 hari)</span>
                    </div>
                    <div>
                        <FiTarget aria-hidden />
                        <strong>{fmt(g.stats.questsClaimed)}</strong>
                        <span>misi diklaim</span>
                    </div>
                </div>
            </div>
            <aside className="ach-hero-streak">
                <StreakFlame streak={g.streak} size="lg" />
                <p className={g.streak?.atRisk ? "is-risk" : ""}>{streakHint(g.streak)}</p>
                {g.streak?.recent && (
                    <ol className="gm-week" aria-label="Aktivitas 7 hari terakhir">
                        {g.streak.recent.map((d) => (
                            <li
                                key={d.key}
                                className={`is-${d.state} ${d.today ? "is-today" : ""}`}
                                title={
                                    d.state === "active"
                                        ? "Mencatat"
                                        : d.state === "saved"
                                          ? "Diselamatkan perisai"
                                          : d.today
                                            ? "Hari ini, belum mencatat"
                                            : "Tidak mencatat"
                                }
                            >
                                <i>
                                    {d.state === "active" ? (
                                        <PiFlameFill />
                                    ) : d.state === "saved" ? (
                                        <PiShieldCheckFill />
                                    ) : null}
                                </i>
                                <span>
                                    {new Date(`${d.key}T00:00:00`).toLocaleDateString("id-ID", { weekday: "narrow" })}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
                <dl>
                    <div>
                        <dt>Rekor</dt>
                        <dd>{fmt(g.streak?.best)} hari</dd>
                    </div>
                    <div>
                        <dt>Diselamatkan</dt>
                        <dd>{fmt(g.stats.shieldSaves)}×</dd>
                    </div>
                </dl>
            </aside>
        </section>
    );
}

/* ───────────────────────── Ringkasan ───────────────────────── */
function Overview({ g }) {
    const persona = personaById(g.persona);
    const next = g.nextPersona ? personaById(g.nextPersona) : null;

    return (
        <>
            <div className="ach-grid">
                <section className="ach-card">
                    {next ? (
                        <>
                            <div className="ach-next-head">
                                <img src={next.image} alt="" className="ach-next-img" />
                                <div>
                                    <div className="ach-kicker">Tingkat berikutnya</div>
                                    <h3>
                                        {next.name}, {next.title}
                                    </h3>
                                </div>
                            </div>
                            <p className="ach-muted">Penuhi semua syarat di bawah supaya maskotmu naik tingkat.</p>
                            <ul className="ach-reqs">
                                {g.nextRequirements.map((r) => (
                                    <Requirement key={r.key} r={r} />
                                ))}
                            </ul>
                        </>
                    ) : (
                        <>
                            <div className="ach-kicker">Tingkat tertinggi</div>
                            <h3>Kamu sudah di puncak</h3>
                            <p className="ach-muted">
                                Maskot dinilai dari kebiasaan 30 hari terakhir. Tetap konsisten supaya Koi tetap jadi
                                maskotmu.
                            </p>
                        </>
                    )}
                    <p className="ach-tip">
                        <strong>Fokus sekarang:</strong> {persona.focus}
                    </p>
                </section>

                <section className="ach-card">
                    <h3>Sumber XP-mu</h3>
                    <p className="ach-muted">XP dihitung dari seluruh riwayatmu, jadi level tidak pernah turun.</p>
                    <table className="ach-xp">
                        <tbody>
                            {XP_RULES.map(([key, label, pts]) => (
                                <tr key={key}>
                                    <td>{label}</td>
                                    <td>{pts}</td>
                                    <td>{fmt(g.xpBreakdown?.[key])}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>Total</td>
                                <td />
                                <td>{fmt(g.xp)} XP</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>
            </div>

            <section className="ach-section">
                <h3>Lima maskot dan artinya</h3>
                <div className="ach-ladder">
                    {PERSONAS.map((p) => {
                        const reached = p.tier <= g.tier;
                        const current = p.tier === g.tier;
                        const reqs = g.requirements?.[p.id] || [];
                        return (
                            <article
                                key={p.id}
                                className={`ach-step ${current ? "is-current" : ""} ${reached ? "" : "is-locked"}`}
                            >
                                <div className="ach-step-img">
                                    <img src={p.image} alt={p.name} />
                                    {!reached && (
                                        <span className="ach-lock" aria-label="Belum tercapai">
                                            <FiLock />
                                        </span>
                                    )}
                                </div>
                                <div className="ach-step-tier">
                                    Tingkat {p.tier}
                                    {current && <span className="ach-here">Kamu di sini</span>}
                                </div>
                                <h4>{p.name}</h4>
                                <div className="ach-step-title">{p.title}</div>
                                <p>{p.meaning}</p>
                                <div className="ach-step-req">
                                    {reqs.length ? (
                                        <>
                                            <span>Syarat:</span>
                                            {reqs.map((r) => (
                                                <span key={r.key}>
                                                    {r.boolean
                                                        ? r.label
                                                        : `${r.label.replace(/ \(.*\)$/, "")} ${r.unit === "%" ? `≥ ${r.target}%` : `≥ ${r.target} ${r.unit}`}`}
                                                </span>
                                            ))}
                                        </>
                                    ) : (
                                        <span>Maskot awal semua pengguna.</span>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </>
    );
}

/* ───────────────────────── Misi ───────────────────────── */
function Quests({ g }) {
    const { claim, busy } = useGameActions();
    const now = useNow();
    const groups = [
        { key: "daily", title: "Misi harian", resets: g.quests.dailyResetsAt, items: g.quests.daily },
        { key: "weekly", title: "Misi mingguan", resets: g.quests.weeklyResetsAt, items: g.quests.weekly },
    ];

    return (
        <div className="ach-grid">
            {groups.map((grp) => {
                const done = grp.items.filter((q) => q.claimed).length;
                const total = grp.items.reduce((s, q) => s + q.xp, 0);
                return (
                    <section key={grp.key} className="ach-card">
                        <div className="ach-quest-head">
                            <div>
                                <h3>{grp.title}</h3>
                                <span className="ach-muted">
                                    {done}/{grp.items.length} selesai · total {total} XP
                                </span>
                            </div>
                            <span className="ach-reset">
                                <FiClock aria-hidden /> Reset {timeLeft(grp.resets, now)}
                            </span>
                        </div>
                        <ul className="gm-quests">
                            {grp.items.map((q) => (
                                <QuestItem key={q.id} q={q} onClaim={claim} busy={busy} />
                            ))}
                        </ul>
                    </section>
                );
            })}
            <p className="ach-note">
                Misi berganti setiap hari dan setiap Senin. Misi yang sudah selesai tapi belum diklaim akan hilang saat
                periode berganti, jadi jangan lupa klaim.
            </p>
        </div>
    );
}

/* ───────────────────────── Tantangan ───────────────────────── */
function Challenges({ g }) {
    const { join, abandon, busy } = useGameActions();
    const [open, setOpen] = useState(null);
    const { active, catalog, history, maxActive } = g.challenges;
    const full = active.length >= maxActive;

    return (
        <>
            <section className="ach-section">
                <h3>
                    Sedang diikuti <span className="ach-count">{active.length} dari {maxActive}</span>
                </h3>
                {active.length === 0 ? (
                    <div className="ch-empty">
                        <PiTrophyFill aria-hidden />
                        <div>
                            <strong>Belum ada tantangan aktif</strong>
                            <span>Pilih satu tantangan di bawah. Hadiahnya XP besar dan lencana.</span>
                        </div>
                    </div>
                ) : (
                    <div className="ch-active">
                        {active.map((c) => (
                            <ActiveChallenge key={c.id} c={c} onAbandon={() => abandon(c)} busy={busy === c.id} />
                        ))}
                    </div>
                )}
            </section>

            <section className="ach-section">
                <h3>Pilih tantangan</h3>
                <div className="ch-catalog">
                    {catalog.map((c) => (
                        <CatalogCard
                            key={c.type}
                            c={c}
                            open={open === c.type}
                            disabled={full && !c.joined}
                            busy={busy === c.type}
                            onToggle={() => setOpen(open === c.type ? null : c.type)}
                            onJoin={async (params) => {
                                if (await join(c.type, params)) setOpen(null);
                            }}
                        />
                    ))}
                </div>
                {full && <p className="ach-note">Kamu sudah mengikuti {maxActive} tantangan. Selesaikan dulu sebelum menambah.</p>}
            </section>

            {history.length > 0 && (
                <section className="ach-section">
                    <h3>Riwayat</h3>
                    <ul className="ch-history">
                        {history.map((c) => (
                            <li key={c.id} className={`is-${c.status}`}>
                                <span className="ch-history-icon">
                                    {c.status === "completed" ? <FiCheck /> : <FiX />}
                                </span>
                                <div>
                                    <strong>{c.title}</strong>
                                    <span>
                                        {fmtDay(c.startKey)} – {fmtDay(c.endKey)} · {c.summary}
                                    </span>
                                </div>
                                <em>
                                    {c.status === "completed"
                                        ? `+${fmt(c.xpReward)} XP`
                                        : c.status === "abandoned"
                                          ? "Keluar"
                                          : "Belum berhasil"}
                                </em>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </>
    );
}

function ActiveChallenge({ c, onAbandon, busy }) {
    const Icon = CHALLENGE_ICONS[c.type] || PiTrophyFill;
    const pct = Math.round(c.progress * 100);
    return (
        <article className="ch-card">
            <header>
                <span className="ch-icon">
                    <Icon aria-hidden />
                </span>
                <div>
                    <h4>{c.title}</h4>
                    <span className="ch-when">
                        {c.started
                            ? `Sisa ${c.daysLeft} hari · sampai ${fmtDay(c.endKey)}`
                            : `Mulai ${fmtDay(c.startKey)} (${c.startsIn} hari lagi)`}
                    </span>
                </div>
                <span className="ch-reward">+{fmt(c.xpReward)} XP</span>
            </header>

            {c.type === "52-minggu" ? (
                <div className="ch-52">
                    <div>
                        <span>Minggu ini (ke-{c.week})</span>
                        <strong>{formatRupiah(c.thisWeek)}</strong>
                    </div>
                    <div>
                        <span>Terkumpul</span>
                        <strong>{formatRupiah(c.saved)}</strong>
                    </div>
                    <div>
                        <span>Seharusnya</span>
                        <strong>{formatRupiah(c.dueSoFar)}</strong>
                    </div>
                    <span className={`ch-track ${c.onTrack ? "is-ok" : "is-behind"}`}>
                        {c.onTrack
                            ? "Sesuai jadwal"
                            : `Tertinggal ${formatRupiah(c.dueSoFar - c.saved)}`}
                    </span>
                </div>
            ) : c.days ? (
                <ol className="ch-days" aria-label="Progres harian">
                    {c.days.map((d) => (
                        <li
                            key={d.key}
                            className={`is-${d.state}`}
                            title={`${fmtDay(d.key)}: ${d.state === "future" ? "belum" : formatRupiah(d.spend)}`}
                        >
                            <span>{new Date(`${d.key}T00:00:00`).toLocaleDateString("id-ID", { weekday: "narrow" })}</span>
                            <i>{d.state === "ok" ? <FiCheck /> : d.state === "fail" ? <FiX /> : null}</i>
                        </li>
                    ))}
                </ol>
            ) : null}

            <div className="ch-progress">
                <div className="ach-bar is-gold">
                    <span style={{ width: `${pct}%` }} />
                </div>
                <div className="ch-progress-text">
                    <span>{c.summary}</span>
                    {c.type === "batas-harian" && <span>Batas {formatRupiah(c.params.dailyLimit)}/hari</span>}
                    {c.type === "52-minggu" && <span>Target akhir {formatRupiah(c.finalTarget)}</span>}
                </div>
            </div>

            <button type="button" className="ch-leave" onClick={onAbandon} disabled={busy}>
                Keluar dari tantangan
            </button>
        </article>
    );
}

function CatalogCard({ c, open, disabled, busy, onToggle, onJoin }) {
    const Icon = CHALLENGE_ICONS[c.type] || PiTrophyFill;
    const p = c.param;
    const [choice, setChoice] = useState(p ? p.options[1] ?? p.options[0] : null);
    const [custom, setCustom] = useState("");
    const value = p?.kind === "money" && custom ? parseNumberInput(custom) : choice;
    const reward = p?.rewards ? p.rewards[value] ?? c.xp : c.xp;

    return (
        <article className={`ch-option ${open ? "is-open" : ""} ${c.joined ? "is-joined" : ""}`}>
            <div className="ch-option-top">
                <span className="ch-icon">
                    <Icon aria-hidden />
                </span>
                <div>
                    <h4>{c.title}</h4>
                    <span className="ch-meta">
                        {c.duration} · <strong>+{fmt(reward)} XP</strong>
                    </span>
                </div>
            </div>
            <p>{c.description}</p>

            {open && (
                <div className="ch-form">
                    {p && (
                        <>
                            <span className="ch-form-label">{p.label}</span>
                            <div className="tx-chips">
                                {p.options.map((o) => (
                                    <button
                                        key={o}
                                        type="button"
                                        className={`tx-chip ${!custom && choice === o ? "is-active" : ""}`}
                                        onClick={() => {
                                            setChoice(o);
                                            setCustom("");
                                        }}
                                    >
                                        {p.kind === "money" ? formatRupiah(o) : `${o}%`}
                                    </button>
                                ))}
                            </div>
                            {p.kind === "money" && (
                                <label className="ch-custom">
                                    <span>Rp</span>
                                    <input
                                        inputMode="numeric"
                                        placeholder="Nominal lain"
                                        value={custom}
                                        onChange={(e) => setCustom(formatNumberInput(e.target.value))}
                                    />
                                </label>
                            )}
                            {c.type === "52-minggu" && value > 0 && (
                                <span className="ch-form-hint">
                                    Minggu 1 {formatRupiah(value)}, minggu 52 {formatRupiah(value * 52)}. Total{" "}
                                    {formatRupiah(value * 1378)} dalam setahun. Setor lewat menu Goals.
                                </span>
                            )}
                        </>
                    )}
                    <div className="ch-form-actions">
                        <button type="button" className="btn-ghost" onClick={onToggle}>
                            Batal
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={busy || (p && !(value > 0))}
                            onClick={() => onJoin(p ? { [p.key]: value } : {})}
                        >
                            {busy ? "Memulai..." : "Mulai tantangan"}
                        </button>
                    </div>
                </div>
            )}

            {!open && (
                <button
                    type="button"
                    className="ch-join"
                    onClick={onToggle}
                    disabled={c.joined || disabled}
                    title={disabled ? "Maksimal tantangan aktif tercapai" : undefined}
                >
                    {c.joined ? "Sedang diikuti" : "Ikuti tantangan"}
                </button>
            )}
        </article>
    );
}

/* ───────────────────────── Lencana ───────────────────────── */
function Badges({ g }) {
    return (
        <section className="ach-section">
            <div className="ach-badges">
                {g.badges.map((b) => {
                    const Icon = BADGE_ICONS[b.id] || FiAward;
                    const pct = Math.round((b.current / Math.max(1, b.target)) * 100);
                    return (
                        <div key={b.id} className={`ach-badge ${b.unlocked ? "is-on" : ""}`}>
                            <span className="ach-badge-icon">
                                <Icon aria-hidden />
                            </span>
                            <div>
                                <strong>{b.title}</strong>
                                <span>{b.description}</span>
                                {!b.unlocked && b.target > 1 && (
                                    <>
                                        <div className="ach-bar ach-badge-bar" aria-hidden>
                                            <span style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="ach-badge-prog">
                                            {fmt(b.current)} / {fmt(b.target)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
