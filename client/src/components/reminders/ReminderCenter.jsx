import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBell, FiTarget, FiCalendar, FiUsers, FiFlag, FiAward, FiFilm, FiCheck, FiSettings } from "react-icons/fi";
import { PiFlameFill } from "react-icons/pi";
import { useFinance } from "../../context/FinanceContext";
import { getNotificationsAPI, markNotificationsReadAPI } from "../../services/notificationApi";
import { openQuickAdd } from "../../utils/quickAddBus";
import { BROWSER_NOTIF_EVENT, showBrowserNotifications } from "./browserNotif";
import "../../styles/reminders.css";

const ICONS = {
    streak: PiFlameFill,
    budget: FiTarget,
    bill: FiCalendar,
    debt: FiUsers,
    goal: FiFlag,
    quest: FiAward,
    challenge: FiAward,
    wrapped: FiFilm,
};

const POLL_MS = 5 * 60 * 1000;

/** Lonceng notifikasi + panelnya. Dipasang sekali di layout aplikasi. */
export default function ReminderCenter() {
    const { gamification } = useFinance();
    const navigate = useNavigate();
    const [data, setData] = useState({ items: [], unread: 0 });
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const bellRef = useRef(null);
    const panelRef = useRef(null);
    const openItemRef = useRef(null);

    const openItem = useCallback(
        (item) => {
            setOpen(false);
            if (item.action === "quickadd") openQuickAdd();
            else if (item.link) navigate(item.link);
            if (!item.read) {
                markNotificationsReadAPI([item.id])
                    .then((res) => setData(res.data))
                    .catch(() => {});
            }
        },
        [navigate],
    );
    useEffect(() => {
        openItemRef.current = openItem;
    }, [openItem]);

    const load = useCallback(async () => {
        try {
            const res = await getNotificationsAPI();
            setData(res.data);
            showBrowserNotifications(res.data.items || [], (item) => openItemRef.current?.(item));
        } catch {
            /* biarkan data lama */
        }
    }, []);

    // Muat saat dibuka, tiap 5 menit, saat tab kembali aktif, dan saat data keuangan berubah
    useEffect(() => {
        const first = setTimeout(load, 0);
        const timer = setInterval(load, POLL_MS);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        window.addEventListener(BROWSER_NOTIF_EVENT, onFocus);
        return () => {
            clearTimeout(first);
            clearInterval(timer);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener(BROWSER_NOTIF_EVENT, onFocus);
        };
    }, [load]);

    const gKey = gamification ? `${gamification.xp}:${gamification.streak?.current}:${gamification.streak?.activeToday}` : "";
    useEffect(() => {
        if (!gKey) return;
        const t = setTimeout(load, 800);
        return () => clearTimeout(t);
    }, [gKey, load]);

    // Tutup saat klik di luar / Esc
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (panelRef.current?.contains(e.target) || bellRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const markAll = async () => {
        const ids = data.items.filter((i) => !i.read).map((i) => i.id);
        if (!ids.length) return;
        setBusy(true);
        try {
            const res = await markNotificationsReadAPI(ids);
            setData(res.data);
        } catch {
            /* abaikan */
        } finally {
            setBusy(false);
        }
    };

    const unread = data.unread || 0;

    return (
        <>
            <button
                ref={bellRef}
                type="button"
                className={`rc-bell ${unread ? "has-unread" : ""} ${open ? "is-open" : ""}`}
                onClick={() => setOpen((o) => !o)}
                aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <FiBell aria-hidden />
                {unread > 0 && <span className="rc-badge">{unread > 9 ? "9+" : unread}</span>}
            </button>

            {open && (
                <div ref={panelRef} className="rc-panel" role="dialog" aria-label="Notifikasi">
                    <header className="rc-head">
                        <div>
                            <h2>Notifikasi</h2>
                            <span>{unread ? `${unread} belum dibaca` : "Semua sudah dibaca"}</span>
                        </div>
                        <button type="button" className="rc-markall" onClick={markAll} disabled={!unread || busy}>
                            <FiCheck aria-hidden /> Tandai semua dibaca
                        </button>
                    </header>

                    {data.items.length === 0 ? (
                        <div className="rc-empty">
                            <span className="rc-empty-icon">
                                <FiCheck aria-hidden />
                            </span>
                            <strong>Semua beres</strong>
                            <p>Tidak ada budget, tagihan, atau tenggat yang perlu kamu perhatikan sekarang.</p>
                        </div>
                    ) : (
                        <ul className="rc-list">
                            {data.items.map((item) => {
                                const Icon = ICONS[item.kind] || FiBell;
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            className={`rc-item is-${item.tone} ${item.read ? "is-read" : ""}`}
                                            onClick={() => openItem(item)}
                                        >
                                            <span className={`rc-icon is-${item.kind}`}>
                                                <Icon aria-hidden />
                                            </span>
                                            <span className="rc-text">
                                                <strong>{item.title}</strong>
                                                <span>{item.body}</span>
                                            </span>
                                            {!item.read && <span className="rc-dot" aria-label="Belum dibaca" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <footer className="rc-foot">
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false);
                                navigate("/settings#notifikasi");
                                // Halaman dimuat malas; tunggu bagiannya ada lalu gulir ke sana
                                let tries = 0;
                                const seek = () => {
                                    const el = document.getElementById("notifikasi");
                                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                    else if (tries++ < 20) setTimeout(seek, 100);
                                };
                                setTimeout(seek, 50);
                            }}
                        >
                            <FiSettings aria-hidden /> Atur pengingat & email
                        </button>
                    </footer>
                </div>
            )}
        </>
    );
}
