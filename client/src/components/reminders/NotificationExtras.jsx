import { useState } from "react";
import { FiMail } from "react-icons/fi";
import Switch from "../ui/Switch";
import { sendTestEmailAPI } from "../../services/notificationApi";
import { browserNotifEnabled, browserNotifSupported, setBrowserNotif } from "./browserNotif";
import "../../styles/reminders.css";

const permissionNow = () => (browserNotifSupported() ? Notification.permission : "unsupported");

/** Bagian tambahan di Pengaturan → Notifikasi: notifikasi browser, email uji, dan jadwal. */
export default function NotificationExtras({ reminderTime = "20:00" }) {
    const [browserOn, setBrowserOn] = useState(browserNotifEnabled);
    const [permission, setPermission] = useState(permissionNow);
    const [sending, setSending] = useState(false);
    const [msg, setMsg] = useState(null);

    const toggleBrowser = async (on) => {
        if (!on) {
            setBrowserNotif(false);
            setBrowserOn(false);
            return;
        }
        let p = permissionNow();
        if (p === "default") p = await Notification.requestPermission();
        setPermission(p);
        const ok = p === "granted";
        setBrowserNotif(ok);
        setBrowserOn(ok);
        if (ok) {
            try {
                new Notification("Notifikasi DailyTrack aktif", {
                    body: "Kamu akan dikabari saat streak hampir putus atau budget jebol.",
                    icon: "/brand/logo-128.webp",
                });
            } catch {
                /* abaikan */
            }
        }
    };

    const testEmail = async () => {
        setSending(true);
        setMsg(null);
        try {
            const res = await sendTestEmailAPI();
            setMsg({ ok: true, text: res.data.message });
        } catch (err) {
            setMsg({ ok: false, text: err.response?.data?.message || "Gagal mengirim email uji." });
        } finally {
            setSending(false);
        }
    };

    const browserDesc =
        permission === "unsupported"
            ? "Browser ini tidak mendukung notifikasi."
            : permission === "denied"
              ? "Izin notifikasi diblokir. Aktifkan lewat ikon gembok di address bar, lalu coba lagi."
              : "Muncul di layar saat streak hampir putus atau budget jebol, selama DailyTrack terbuka di salah satu tab.";

    return (
        <div className="rc-settings">
            <Switch
                id="notif-browser"
                label="Notifikasi browser"
                description={browserDesc}
                checked={browserOn}
                onChange={toggleBrowser}
            />

            <div className="rc-settings-card">
                <div>
                    <strong>Kirim email uji</strong>
                    <p>Pastikan email pengingat benar-benar sampai ke kotak masukmu (cek juga folder spam).</p>
                    {msg && <span className={`rc-settings-msg ${msg.ok ? "is-ok" : "is-err"}`}>{msg.text}</span>}
                </div>
                <button type="button" className="btn-ghost" onClick={testEmail} disabled={sending}>
                    <FiMail aria-hidden /> {sending ? "Mengirim..." : "Kirim email uji"}
                </button>
            </div>

            <p className="rc-schedule">
                <b>Pengingat harian</b> dikirim pukul {reminderTime} WIB, hanya kalau kamu belum mencatat apa pun hari
                itu. <b>Peringatan budget</b> dikirim tiap pagi (09.00) saat budget mencapai ambang atau jebol, sekali
                per kondisi. <b>Peringatan goal</b> dikirim pukul 08.00 saat tenggat tinggal 7 hari atau 1 hari, dan saat
                goal tercapai. Semua notifikasi juga muncul di ikon lonceng (di sidebar, atau di bilah atas saat dibuka di HP).
            </p>
        </div>
    );
}
