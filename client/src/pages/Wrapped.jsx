import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay, FiDownload, FiPlus } from "react-icons/fi";
import { getWrappedAPI } from "../services/wrappedApi";
import { useFinance } from "../context/FinanceContext";
import { personaById } from "../utils/personas";
import { confirmDialog } from "../utils/confirm";
import DropdownMenu from "../components/ui/DropdownMenu";
import { buildSlides } from "../components/wrapped/slides";
import { downloadShareCard } from "../components/wrapped/shareCard";
import "../styles/wrapped.css";

const SLIDE_MS = 6500;
const prefersReduced = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** DailyTrack Wrapped: rekap bulanan/tahunan bergaya story. */
export default function Wrapped() {
    const { gamification } = useFinance();
    const persona = gamification ? personaById(gamification.persona) : null;

    // null = biarkan server memilih periode default
    const [query, setQuery] = useState(null);
    const [res, setRes] = useState({ key: null, data: null, error: "" });
    const key = JSON.stringify(query);

    useEffect(() => {
        let alive = true;
        getWrappedAPI(query || {})
            .then((r) => alive && setRes({ key, data: r.data, error: "" }))
            .catch((e) => alive && setRes({ key, data: null, error: e.response?.data?.message || "Wrapped gagal dimuat." }));
        return () => {
            alive = false;
        };
    }, [query, key]);

    const loading = res.key !== key;
    // Data lama tetap tampil (redup) selama periode baru dimuat
    const w = res.data;
    const type = query?.period || w?.period.type || "month";

    const monthOptions = useMemo(() => {
        const list = (w?.available?.months || []).map((m) => ({ value: `${m.year}-${m.month}`, label: m.label }));
        if (w?.period.type === "month" && !list.some((o) => o.value === `${w.period.year}-${w.period.month}`))
            list.unshift({ value: `${w.period.year}-${w.period.month}`, label: w.period.label });
        return list;
    }, [w]);
    const yearOptions = useMemo(() => {
        const ys = new Set(w?.available?.years || []);
        if (w) ys.add(w.period.year);
        return [...ys].sort((a, b) => b - a).map((y) => ({ value: y, label: String(y) }));
    }, [w]);

    const setType = (t) => {
        if (t === type) return;
        const y = w?.period.year || new Date().getFullYear();
        if (t === "year") setQuery({ period: "year", year: y });
        else {
            const first = w?.available?.months?.find((m) => m.year === y) || w?.available?.months?.[0];
            setQuery(first ? { period: "month", year: first.year, month: first.month } : { period: "month" });
        }
    };

    const [downloading, setDownloading] = useState(false);
    const onDownload = useCallback(async () => {
        if (!w) return;
        setDownloading(true);
        try {
            await downloadShareCard(w, persona);
        } catch {
            await confirmDialog({ title: "Gagal mengunduh", message: "Kartu tidak bisa dibuat. Coba lagi.", alertOnly: true });
        } finally {
            setDownloading(false);
        }
    }, [w, persona]);

    return (
        <div className="wr-page">
            <header className="wr-top">
                <div>
                    <span className="wr-top-kicker">Rekap</span>
                    <h1>Wrapped</h1>
                    <p>Cerita uangmu dalam beberapa layar. Geser untuk melihat, lalu unduh kartunya untuk dibagikan.</p>
                </div>
                <div className="wr-controls">
                    <div className="ins-seg wr-seg" role="radiogroup" aria-label="Jenis rekap">
                        {[
                            ["month", "Bulanan"],
                            ["year", "Tahunan"],
                        ].map(([v, label]) => (
                            <button
                                key={v}
                                type="button"
                                role="radio"
                                aria-checked={type === v}
                                className={type === v ? "is-active" : ""}
                                onClick={() => setType(v)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {w &&
                        (type === "month" ? (
                            <DropdownMenu
                                value={`${w.period.year}-${w.period.month}`}
                                options={monthOptions}
                                onChange={(v) => {
                                    const [y, m] = String(v).split("-").map(Number);
                                    setQuery({ period: "month", year: y, month: m });
                                }}
                                minWidth="180px"
                            />
                        ) : (
                            <DropdownMenu
                                value={w.period.year}
                                options={yearOptions}
                                onChange={(v) => setQuery({ period: "year", year: Number(v) })}
                                minWidth="120px"
                            />
                        ))}
                    <button type="button" className="wr-dl-btn" onClick={onDownload} disabled={!w || w.empty || downloading}>
                        <FiDownload aria-hidden /> {downloading ? "Menyiapkan..." : "Unduh kartu"}
                    </button>
                </div>
            </header>

            {res.error && !loading && !w ? (
                <div className="wr-error">{res.error}</div>
            ) : !w ? (
                <div className="wr-stage">
                    <div className="wr-story is-skeleton" aria-busy />
                </div>
            ) : (
                <Story
                    key={`${w.period.type}-${w.period.year}-${w.period.month}`}
                    w={w}
                    dim={loading}
                    persona={persona}
                    gamification={gamification}
                    onDownload={onDownload}
                    downloading={downloading}
                />
            )}
        </div>
    );
}

function Story({ w, dim, persona, gamification, onDownload, downloading }) {
    const slides = useMemo(
        () =>
            w.empty
                ? []
                : buildSlides(w, { persona, gamification, onDownload, downloading }),
        [w, persona, gamification, onDownload, downloading],
    );
    const [i, setI] = useState(0);
    const [playing, setPlaying] = useState(() => !prefersReduced());
    const [held, setHeld] = useState(false);
    const frame = useRef(null);
    const last = slides.length - 1;

    const go = useCallback((d) => setI((x) => Math.max(0, Math.min(last, x + d))), [last]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.target.closest?.("input, textarea, [role='listbox']")) return;
            if (e.key === "ArrowRight") go(1);
            else if (e.key === "ArrowLeft") go(-1);
            else if (e.key === " " && document.activeElement === frame.current) {
                e.preventDefault();
                setPlaying((p) => !p);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [go]);

    if (w.empty) {
        return (
            <div className="wr-stage">
                <div className="wr-story tone-ink">
                    <div className="wr-slide">
                        <div className="wr-center">
                            <div className="wr-emoji" aria-hidden>
                                📭
                            </div>
                            <h2 className="wr-display is-sm">Belum ada cerita</h2>
                            <p className="wr-lead">
                                Tidak ada transaksi di {w.period.label}. Pilih periode lain atau mulai mencatat, cerita
                                pertamamu akan muncul di sini.
                            </p>
                            <Link to="/transactions/new" className="wr-download">
                                <FiPlus aria-hidden /> Catat transaksi
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const slide = slides[Math.min(i, last)];
    const autoplay = playing && !held && i < last;

    const onTap = (e) => {
        if (e.target.closest("button, a")) return;
        const rect = e.currentTarget.getBoundingClientRect();
        go(e.clientX - rect.left < rect.width * 0.32 ? -1 : 1);
    };

    return (
        <div className={`wr-stage ${dim ? "is-dim" : ""}`}>
            <div
                ref={frame}
                className={`wr-story tone-${slide.tone}`}
                tabIndex={0}
                role="region"
                aria-roledescription="cerita"
                aria-label={`Wrapped ${w.period.label}, layar ${i + 1} dari ${slides.length}: ${slide.title}`}
                onClick={onTap}
                onPointerDown={() => setHeld(true)}
                onPointerUp={() => setHeld(false)}
                onPointerLeave={() => setHeld(false)}
            >
                <div className="wr-bars" aria-hidden>
                    {slides.map((s, idx) => (
                        <span key={s.id} className={idx < i ? "is-done" : idx === i ? "is-now" : ""}>
                            {idx === i && (
                                <i
                                    key={`${i}-${playing}`}
                                    className={autoplay ? "is-running" : playing && i < last ? "is-paused" : "is-full"}
                                    style={{ animationDuration: `${SLIDE_MS}ms` }}
                                    onAnimationEnd={() => go(1)}
                                />
                            )}
                        </span>
                    ))}
                </div>
                <div className="wr-chrome">
                    <span className="wr-brand">
                        <img src="/brand/logo-128.webp" alt="" />
                        Wrapped · {w.period.label}
                    </span>
                    <button
                        type="button"
                        className="wr-icon-btn"
                        onClick={() => setPlaying((p) => !p)}
                        aria-label={playing ? "Jeda otomatis" : "Putar otomatis"}
                        title={playing ? "Jeda otomatis" : "Putar otomatis"}
                    >
                        {playing ? <FiPause /> : <FiPlay />}
                    </button>
                </div>

                <div key={slide.id} className="wr-slide">
                    {slide.node}
                </div>

                <button
                    type="button"
                    className="wr-nav is-prev"
                    onClick={() => go(-1)}
                    disabled={i === 0}
                    aria-label="Layar sebelumnya"
                >
                    <FiChevronLeft />
                </button>
                <button
                    type="button"
                    className="wr-nav is-next"
                    onClick={() => go(1)}
                    disabled={i === last}
                    aria-label="Layar berikutnya"
                >
                    <FiChevronRight />
                </button>
            </div>

            <aside className="wr-side">
                <span className="wr-side-title">Isi cerita</span>
                <ol>
                    {slides.map((s, idx) => (
                        <li key={s.id}>
                            <button
                                type="button"
                                className={idx === i ? "is-active" : idx < i ? "is-seen" : ""}
                                onClick={() => setI(idx)}
                            >
                                <span className={`wr-side-dot tone-${s.tone}`} />
                                {s.title}
                            </button>
                        </li>
                    ))}
                </ol>
                <p className="wr-side-hint">
                    <kbd>←</kbd> <kbd>→</kbd> pindah layar · tahan untuk jeda
                </p>
            </aside>
        </div>
    );
}
