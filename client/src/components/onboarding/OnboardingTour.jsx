import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiX, FiZap, FiCalendar, FiAward } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { personaById } from "../../utils/personas";
import { readOnb, writeOnb, resetOnb } from "./storage";
import OnboardingChecklist from "./OnboardingChecklist";
import "../../styles/onboarding.css";

const STEPS = [
    {
        target: ".sidebar-quick",
        title: "Catat dalam hitungan detik",
        body: "Tekan Ctrl+K dari halaman mana pun lalu ketik seperti chat, misalnya “kopi 18rb gopay”. Nominal, wallet, dan kategori terisi sendiri.",
    },
    {
        target: ".pd-card",
        title: "Jatah aman sampai gajian",
        body: "Atur tanggal gajianmu, lalu lihat berapa yang aman dipakai per hari setelah tagihan rutin diperhitungkan.",
    },
    {
        target: ".dq-card",
        title: "Misi harian & streak",
        body: "Selesaikan misi kecil setiap hari untuk XP. Streak dijaga perisai kalau kamu lupa mencatat sehari.",
    },
    {
        target: '.sidebar-nav a[href="/pencapaian"]',
        title: "Maskotmu ikut tumbuh",
        body: "Dari Semut sampai Koi, maskot profilmu naik tingkat mengikuti kebiasaan menabungmu 30 hari terakhir.",
    },
    {
        target: '.sidebar-nav a[href="/kesehatan"]',
        title: "Cek kesehatan finansial",
        body: "Skor 0–100, dana darurat, dan langganan yang diam-diam menguras dompet, semua dihitung otomatis.",
    },
    {
        target: ".onb-check",
        title: "Langkah awal",
        body: "Checklist ini menemanimu sampai semua fitur dasar siap. Centangnya terisi otomatis dari datamu.",
    },
];

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;

/** Sambutan pertama, tur singkat dengan sorotan, dan checklist langkah awal. */
export default function OnboardingTour() {
    const { user } = useAuth();
    const uid = user?._id;
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [phase, setPhase] = useState(null); // null | "welcome" | "tour"
    const [step, setStep] = useState(0);
    const [checklistKey, setChecklistKey] = useState(0);
    const [loadedFor, setLoadedFor] = useState(null);

    // Sambutan sekali per pengguna
    if (uid && loadedFor !== uid) {
        setLoadedFor(uid);
        const st = readOnb(uid);
        if (!st.welcomed) setPhase("welcome");
    }

    useEffect(() => {
        const replay = () => {
            resetOnb(uid);
            setChecklistKey((k) => k + 1);
            setStep(0);
            setPhase("welcome");
        };
        window.addEventListener("dt:onboarding", replay);
        return () => window.removeEventListener("dt:onboarding", replay);
    }, [uid]);

    const finish = useCallback(() => {
        writeOnb(uid, { welcomed: true, tourDone: true });
        setPhase(null);
    }, [uid]);

    const startTour = () => {
        writeOnb(uid, { welcomed: true, checklistOpen: !isMobile() });
        setChecklistKey((k) => k + 1);
        if (pathname !== "/") navigate("/");
        setStep(0);
        setPhase("tour");
    };

    const skip = () => {
        writeOnb(uid, { welcomed: true, tourDone: true, checklistOpen: !isMobile() });
        setChecklistKey((k) => k + 1);
        setPhase(null);
    };

    if (!uid) return null;

    return (
        <>
            <OnboardingChecklist
                key={checklistKey}
                uid={uid}
                suspended={phase === "welcome" || (phase === "tour" && step < STEPS.length - 1)}
            />
            {phase === "welcome" &&
                createPortal(<Welcome user={user} onStart={startTour} onSkip={skip} />, document.body)}
            {phase === "tour" &&
                createPortal(
                    <Tour
                        step={step}
                        onPrev={() => setStep((s) => Math.max(0, s - 1))}
                        onNext={() => (step >= STEPS.length - 1 ? finish() : setStep((s) => s + 1))}
                        onClose={finish}
                    />,
                    document.body,
                )}
        </>
    );
}

function Welcome({ user, onStart, onSkip }) {
    const semut = personaById("semut");
    const koi = personaById("koi");
    const first = (user?.name || "").trim().split(/\s+/)[0];

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onSkip();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onSkip]);

    return (
        <div className="onb-overlay">
            <div className="onb-welcome" role="dialog" aria-modal="true" aria-labelledby="onb-title">
                <div className="onb-welcome-art" aria-hidden>
                    <img src={semut.image} alt="" className="onb-m1" />
                    <img src={koi.image} alt="" className="onb-m2" />
                    <span className="onb-glow" />
                </div>
                <div className="onb-welcome-body">
                    <span className="onb-kicker">Selamat datang{first ? `, ${first}` : ""}</span>
                    <h2 id="onb-title">
                        Setiap rupiah <em>punya cerita.</em>
                    </h2>
                    <p className="onb-lead">
                        DailyTrack membantumu mencatat tanpa ribet, tahu berapa yang aman dipakai, dan membangun
                        kebiasaan menabung yang menyenangkan.
                    </p>
                    <ul className="onb-points">
                        <li>
                            <span>
                                <FiZap aria-hidden />
                            </span>
                            <div>
                                <strong>Catat seperti chat</strong>
                                <p>“Kopi 18rb gopay”, langsung jadi transaksi.</p>
                            </div>
                        </li>
                        <li>
                            <span>
                                <FiCalendar aria-hidden />
                            </span>
                            <div>
                                <strong>Tahu jatah amanmu</strong>
                                <p>Berapa yang boleh dipakai per hari sampai gajian.</p>
                            </div>
                        </li>
                        <li>
                            <span>
                                <FiAward aria-hidden />
                            </span>
                            <div>
                                <strong>Kebiasaan baik dapat hadiah</strong>
                                <p>XP, misi harian, dan maskot yang naik tingkat.</p>
                            </div>
                        </li>
                    </ul>
                    <div className="onb-actions">
                        <button type="button" className="onb-btn is-ghost" onClick={onSkip}>
                            Lewati
                        </button>
                        <button type="button" className="onb-btn is-primary" onClick={onStart} autoFocus>
                            Mulai tur singkat <FiArrowRight aria-hidden />
                        </button>
                    </div>
                    <span className="onb-note">Kurang dari satu menit · bisa diulang dari Pengaturan</span>
                </div>
            </div>
        </div>
    );
}

function Tour({ step, onPrev, onNext, onClose }) {
    const s = STEPS[step];
    const [rect, setRect] = useState(null);
    const [mobile, setMobile] = useState(isMobile);

    const measure = useCallback(() => {
        setMobile(isMobile());
        const el = document.querySelector(s.target);
        if (!el || isMobile()) return setRect(null);
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return setRect(null);
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }, [s.target]);

    // Gulirkan target ke tengah layar lalu ukur posisinya
    useLayoutEffect(() => {
        const el = document.querySelector(s.target);
        if (el && !isMobile()) {
            const r = el.getBoundingClientRect();
            if (r.top < 70 || r.bottom > window.innerHeight - 70) el.scrollIntoView({ block: "center" });
        }
        const raf = requestAnimationFrame(measure);
        const t = setTimeout(measure, 350); // tunggu elemen/animasi selesai
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(t);
        };
    }, [s.target, measure]);

    useEffect(() => {
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowRight" || e.key === "Enter") onNext();
            else if (e.key === "ArrowLeft") onPrev();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
            window.removeEventListener("keydown", onKey);
        };
    }, [measure, onClose, onNext, onPrev]);

    const pad = 8;
    const tipW = 340;
    let tipStyle = null;
    if (rect) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const spaceRight = vw - (rect.left + rect.width);
        if (spaceRight > tipW + 32) {
            tipStyle = {
                left: rect.left + rect.width + 18,
                top: Math.min(Math.max(16, rect.top + rect.height / 2 - 90), vh - 240),
            };
        } else if (rect.top + rect.height + 230 < vh) {
            tipStyle = { left: Math.min(Math.max(16, rect.left), vw - tipW - 16), top: rect.top + rect.height + 16 };
        } else {
            tipStyle = { left: Math.min(Math.max(16, rect.left), vw - tipW - 16), top: Math.max(16, rect.top - 220) };
        }
    }

    return (
        <div className={`onb-tour ${rect ? "has-spot" : "is-centered"}`} role="dialog" aria-modal="true" aria-label="Tur DailyTrack">
            {rect ? (
                <div
                    className="onb-spot"
                    style={{
                        top: rect.top - pad,
                        left: rect.left - pad,
                        width: rect.width + pad * 2,
                        height: rect.height + pad * 2,
                    }}
                />
            ) : (
                <div className="onb-dim" onClick={onClose} />
            )}
            <div className={`onb-tip ${mobile ? "is-mobile" : ""}`} style={tipStyle || undefined} key={step}>
                <div className="onb-tip-top">
                    <span className="onb-step">
                        Langkah {step + 1} dari {STEPS.length}
                    </span>
                    <button type="button" className="onb-x" onClick={onClose} aria-label="Tutup tur">
                        <FiX />
                    </button>
                </div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <div className="onb-dots" aria-hidden>
                    {STEPS.map((_, i) => (
                        <i key={i} className={i === step ? "is-on" : i < step ? "is-done" : ""} />
                    ))}
                </div>
                <div className="onb-tip-actions">
                    {step > 0 ? (
                        <button type="button" className="onb-btn is-ghost is-sm" onClick={onPrev}>
                            <FiArrowLeft aria-hidden /> Kembali
                        </button>
                    ) : (
                        <button type="button" className="onb-btn is-ghost is-sm" onClick={onClose}>
                            Lewati tur
                        </button>
                    )}
                    <button type="button" className="onb-btn is-primary is-sm" onClick={onNext}>
                        {step >= STEPS.length - 1 ? "Selesai" : "Lanjut"} <FiArrowRight aria-hidden />
                    </button>
                </div>
            </div>
        </div>
    );
}
