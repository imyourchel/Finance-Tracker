import { useMemo, useState } from "react";
import { FiCheck, FiInfo, FiFlag, FiShield } from "react-icons/fi";
import { rp, rpShort, num, monthYear, durationLabel } from "./helpers";

const STAGE = {
    "belum-ada-data": { label: "Belum ada data", tone: "muted" },
    kosong: { label: "Belum dimulai", tone: "low" },
    rentan: { label: "Rentan", tone: "low" },
    mulai: { label: "Mulai aman", tone: "warn" },
    kuat: { label: "Cukup kuat", tone: "good" },
    aman: { label: "Aman", tone: "great" },
};

/** Dana darurat: progres, tonggak, perkiraan waktu, dan pengaturan profil & sumber dana. */
export default function EmergencyFund({ emergency: e, profile, sources, onSave, onMakeGoal, busy }) {
    const initial = useMemo(
        () => ({
            household: profile.household || "",
            multiplier: profile.multiplier || e.multiplier,
            fundWallets: e.sources.wallets,
            fundGoals: e.sources.goals,
        }),
        [profile.household, profile.multiplier, e.multiplier, e.sources.wallets, e.sources.goals],
    );
    const [form, setForm] = useState(initial);
    const dirty = JSON.stringify(form) !== JSON.stringify(initial) || (!profile.configured && e.sources.auto);

    const hh = profile.households.find((h) => h.id === form.household);
    const previewTarget = Math.round((e.monthlyExpense * form.multiplier) / 1000) * 1000;
    const stage = STAGE[e.stage] || STAGE.kosong;
    const maxMark = Math.max(e.multiplier, 1);
    const coveredPct = Math.min(100, (e.monthsCovered / maxMark) * 100);

    const toggle = (field, id) =>
        setForm((f) => ({
            ...f,
            [field]: f[field].includes(id) ? f[field].filter((x) => x !== id) : [...f[field], id],
        }));

    if (e.stage === "belum-ada-data") {
        return (
            <div className="wl-card wl-empty">
                <FiInfo aria-hidden />
                <div>
                    <strong>Belum cukup data</strong>
                    <span>Catat pengeluaranmu setidaknya sebulan supaya target dana darurat bisa dihitung.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="wl-ef">
            <article className="wl-card wl-ef-main">
                <div className="wl-ef-head">
                    <span className={`wl-stage is-${stage.tone}`}>
                        <FiShield aria-hidden /> {stage.label}
                    </span>
                    <span className="wl-muted">
                        Target {e.multiplier}× pengeluaran bulanan
                    </span>
                </div>

                <h3 className="wl-ef-title">
                    Aman <em>{num(e.monthsCovered)}</em> bulan
                </h3>
                <p className="wl-ef-lead">
                    Kalau pemasukan berhenti hari ini, dana daruratmu cukup untuk {num(e.monthsCovered)} bulan
                    pengeluaran normal.
                </p>

                <div className="wl-track" aria-label={`${Math.round(e.progress * 100)}% dari target`}>
                    <div className="wl-track-bar">
                        <span style={{ width: `${coveredPct}%` }} />
                    </div>
                    {e.milestones.map((m) => (
                        <div
                            key={m.months}
                            className={`wl-mark ${m.reached ? "is-reached" : ""} ${m.months === maxMark ? "is-end" : ""}`}
                            style={{ left: `${(m.months / maxMark) * 100}%` }}
                        >
                            <i>{m.reached ? <FiCheck /> : null}</i>
                            <span>{m.months} bln</span>
                            <small>{rpShort(m.amount)}</small>
                        </div>
                    ))}
                </div>

                <dl className="wl-ef-nums">
                    <div>
                        <dt>Terkumpul</dt>
                        <dd>{rp(e.collected)}</dd>
                    </div>
                    <div>
                        <dt>Target</dt>
                        <dd>{rp(e.target)}</dd>
                    </div>
                    <div>
                        <dt>Kurang</dt>
                        <dd className={e.remaining ? "" : "is-done"}>{e.remaining ? rp(e.remaining) : "Tercapai"}</dd>
                    </div>
                </dl>

                <p className="wl-ef-eta">
                    {e.remaining === 0 ? (
                        <>Target sudah tercapai. Pertahankan dan sesuaikan kalau pengeluaranmu naik.</>
                    ) : e.monthsToTarget != null ? (
                        <>
                            Dengan laju {e.paceSource === "goal" ? "setoran ke dana darurat" : "sisa uang bulananmu"}{" "}
                            <strong>{rp(e.pace)}/bulan</strong>, target tercapai sekitar{" "}
                            <strong>{monthYear(e.etaKey)}</strong> ({durationLabel(e.monthsToTarget)} lagi).
                        </>
                    ) : (
                        <>Belum ada sisa uang bulanan yang bisa disisihkan. Mulai dari nominal kecil tapi rutin.</>
                    )}
                </p>

                <p className="wl-basis">
                    <FiInfo aria-hidden />
                    <span>
                        Rata-rata pengeluaran{" "}
                        {e.estimated ? "(perkiraan bulan ini)" : `${e.basisMonths.length} bulan terakhir`}:{" "}
                        <strong>{rp(e.monthlyExpense)}/bulan</strong>. Transfer, setoran goal, dan utang tidak dihitung.
                    </span>
                </p>

                {!e.hasFundGoal && (
                    <div className="wl-ef-cta">
                        <div>
                            <strong>Pisahkan dana daruratmu</strong>
                            <span>Buat goal khusus supaya setorannya terlacak dan tidak terpakai belanja.</span>
                        </div>
                        <button type="button" className="btn-primary" onClick={onMakeGoal} disabled={busy === "goal"}>
                            <FiFlag aria-hidden /> {busy === "goal" ? "Membuat..." : `Jadikan goal ${rpShort(e.target)}`}
                        </button>
                    </div>
                )}
            </article>

            <aside className="wl-card wl-ef-settings">
                <h4>Profil</h4>
                <p className="wl-muted">Semakin tidak pasti penghasilanmu, semakin besar dana darurat yang dibutuhkan.</p>
                <div className="wl-households" role="radiogroup" aria-label="Profil rumah tangga">
                    {profile.households.map((h) => (
                        <button
                            key={h.id}
                            type="button"
                            role="radio"
                            aria-checked={form.household === h.id}
                            className={`wl-hh ${form.household === h.id ? "is-active" : ""}`}
                            onClick={() => setForm((f) => ({ ...f, household: h.id, multiplier: h.default }))}
                        >
                            <strong>{h.label}</strong>
                            <span>{h.hint}</span>
                            <em>
                                {h.options.length > 1 ? `${h.options[0]}–${h.options[h.options.length - 1]}` : h.options[0]}×
                            </em>
                        </button>
                    ))}
                </div>

                {hh && hh.options.length > 1 && (
                    <div className="wl-mult">
                        <span>Pengali</span>
                        <div className="tx-chips">
                            {hh.options.map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    className={`tx-chip ${form.multiplier === m ? "is-active" : ""}`}
                                    onClick={() => setForm((f) => ({ ...f, multiplier: m }))}
                                >
                                    {m} bulan
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <h4>Sumber dana darurat</h4>
                <p className="wl-muted">
                    Pilih wallet atau goal yang khusus disimpan untuk keadaan darurat.
                    {e.sources.auto && !profile.configured && " Terpilih otomatis dari namanya."}
                </p>
                <ul className="wl-sources">
                    {sources.goals.map((g) => (
                        <li key={g._id}>
                            <label className={form.fundGoals.includes(g._id) ? "is-on" : ""}>
                                <input
                                    type="checkbox"
                                    checked={form.fundGoals.includes(g._id)}
                                    onChange={() => toggle("fundGoals", g._id)}
                                />
                                <span className="wl-src-box" aria-hidden>
                                    <FiCheck />
                                </span>
                                <span className="wl-src-name">
                                    {g.name}
                                    <small>Goal</small>
                                </span>
                                <span className="wl-src-amt">{rpShort(g.currentAmount)}</span>
                            </label>
                        </li>
                    ))}
                    {sources.wallets.map((w) => (
                        <li key={w._id}>
                            <label className={form.fundWallets.includes(w._id) ? "is-on" : ""}>
                                <input
                                    type="checkbox"
                                    checked={form.fundWallets.includes(w._id)}
                                    onChange={() => toggle("fundWallets", w._id)}
                                />
                                <span className="wl-src-box" aria-hidden>
                                    <FiCheck />
                                </span>
                                <span className="wl-src-name">
                                    {w.name}
                                    <small>Wallet</small>
                                </span>
                                <span className="wl-src-amt">{rpShort(w.balance)}</span>
                            </label>
                        </li>
                    ))}
                </ul>

                <div className="wl-settings-foot">
                    {form.multiplier !== e.multiplier && (
                        <span className="wl-preview">
                            Target baru <strong>{rp(previewTarget)}</strong>
                        </span>
                    )}
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={!dirty || busy === "profile"}
                        onClick={() =>
                            onSave({
                                household: form.household || null,
                                multiplier: form.multiplier,
                                fundWallets: form.fundWallets,
                                fundGoals: form.fundGoals,
                            })
                        }
                    >
                        {busy === "profile" ? "Menyimpan..." : "Simpan"}
                    </button>
                </div>
            </aside>
        </div>
    );
}
