import DropdownMenu from "../components/ui/DropdownMenu";
import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "../utils/confirm";
import {
    FiUser,
    FiDollarSign,
    FiSun,
    FiMoon,
    FiMonitor,
    FiBell,
    FiLock,
    FiCheckCircle,
    FiAlertCircle,
} from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { updateProfileAPI, changePasswordAPI } from "../services/api";
import PageHeader from "../components/Layout/PageHeader";
import DatePicker from "../components/ui/DatePicker";
import TimePicker from "../components/ui/TimePicker";
import Switch from "../components/ui/Switch";
import { Link } from "react-router-dom";
import { useFinance } from "../context/FinanceContext";
import { personaById } from "../utils/personas";
import PasswordInput from "../components/auth/PasswordInput";
import NotificationExtras from "../components/reminders/NotificationExtras";
import {
    formatDateInput,
    formatNumberInput,
    parseNumberInput,
} from "../utils/format";

const SECTIONS = [
    { id: "profil", label: "Profil", icon: FiUser },
    { id: "keuangan", label: "Keuangan", icon: FiDollarSign },
    { id: "tampilan", label: "Tampilan", icon: FiSun },
    { id: "notifikasi", label: "Notifikasi", icon: FiBell },
    { id: "keamanan", label: "Keamanan", icon: FiLock },
];

const THEMES = [
    { value: "light", label: "Terang", icon: FiSun },
    { value: "dark", label: "Gelap", icon: FiMoon },
    { value: "system", label: "Ikuti sistem", icon: FiMonitor },
];

const NOTIFS = [
    ["dailyReminder", "Pengingat harian", "Email di jam pilihanmu kalau hari itu belum ada catatan, lengkap dengan status streak & budget"],
    ["budgetAlert", "Peringatan budget", "Email saat budget kategori mencapai ambang (biasanya 80%) dan saat jebol"],
    ["goalAlert", "Peringatan goal", "Email saat tenggat goal tinggal 7 hari / 1 hari, dan saat goal tercapai"],
];

const initialProfile = (user) => ({
    name: user?.name || "",
    dateOfBirth: user?.dateOfBirth ? formatDateInput(user.dateOfBirth) : "",
    theme: user?.theme || "system",
    monthlyIncome: user?.monthlyIncome ? formatNumberInput(String(user.monthlyIncome)) : "",
    monthlyBudget: user?.monthlyBudget ? formatNumberInput(String(user.monthlyBudget)) : "",
    payday: user?.payday ? String(user.payday) : "",
});

const initialNotifs = (user) => ({
    dailyReminder: user?.notifications?.dailyReminder ?? true,
    budgetAlert: user?.notifications?.budgetAlert ?? true,
    goalAlert: user?.notifications?.goalAlert ?? true,
    reminderTime: user?.notifications?.reminderTime || "20:00",
});

export default function Settings() {
    const { user, updateUser } = useAuth();
    const { gamification } = useFinance();
    const persona = gamification ? personaById(gamification.persona) : null;

    const [profile, setProfile] = useState(() => initialProfile(user));
    const [notifications, setNotifications] = useState(() => initialNotifs(user));
    const [saved, setSaved] = useState(() => ({
        profile: initialProfile(user),
        notifications: initialNotifs(user),
    }));
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState({ type: "", text: "" });

    const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirm: "" });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

    const [activeSection, setActiveSection] = useState("profil");

    const dirty = useMemo(
        () =>
            JSON.stringify(profile) !== JSON.stringify(saved.profile) ||
            JSON.stringify(notifications) !== JSON.stringify(saved.notifications),
        [profile, notifications, saved],
    );

    const setP = (k) => (v) => setProfile((p) => ({ ...p, [k]: v }));

    // Sorot menu sesuai bagian yang sedang terlihat
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveSection(visible[0].target.id);
            },
            { rootMargin: "-20% 0px -60% 0px" },
        );
        SECTIONS.forEach(({ id }) => {
            const el = document.getElementById(id);
            if (el) obs.observe(el);
        });
        return () => obs.disconnect();
    }, []);

    const goTo = (id) => {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const handleSave = async () => {
        if (!profile.name.trim()) {
            setSaveMsg({ type: "error", text: "Nama lengkap wajib diisi" });
            goTo("profil");
            return;
        }
        const ok = await confirmDialog({
            title: "Simpan perubahan pengaturan?",
            message: "Profil, data keuangan, tema, dan notifikasi akan diperbarui.",
            confirmLabel: "Simpan",
            danger: false,
        });
        if (!ok) return;
        setSaving(true);
        setSaveMsg({ type: "", text: "" });
        try {
            const res = await updateProfileAPI({
                name: profile.name.trim(),
                dateOfBirth: profile.dateOfBirth || null,
                theme: profile.theme,
                notifications,
                monthlyIncome: profile.monthlyIncome ? parseNumberInput(profile.monthlyIncome) : 0,
                monthlyBudget: profile.monthlyBudget ? parseNumberInput(profile.monthlyBudget) : 0,
                payday: profile.payday ? Number(profile.payday) : null,
            });
            updateUser(res.data);
            setSaved({ profile, notifications });
            setSaveMsg({ type: "success", text: "Perubahan tersimpan" });
            setTimeout(() => setSaveMsg((m) => (m.type === "success" ? { type: "", text: "" } : m)), 2500);
        } catch (ex) {
            setSaveMsg({ type: "error", text: ex.message || "Gagal menyimpan perubahan" });
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        setProfile(saved.profile);
        setNotifications(saved.notifications);
        setSaveMsg({ type: "", text: "" });
    };

    const hasPassword = user?.hasPassword !== false;

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwMsg({ type: "", text: "" });
        if (hasPassword && !password.currentPassword)
            return setPwMsg({ type: "error", text: "Isi password lama kamu" });
        if (password.newPassword.length < 6)
            return setPwMsg({ type: "error", text: "Password baru minimal 6 karakter" });
        if (password.newPassword !== password.confirm)
            return setPwMsg({ type: "error", text: "Konfirmasi belum sama dengan password baru" });

        const okPw = await confirmDialog({
            title: hasPassword ? "Ganti password sekarang?" : "Buat password sekarang?",
            message: "Gunakan password baru ini saat masuk berikutnya.",
            confirmLabel: hasPassword ? "Ganti password" : "Buat password",
            danger: false,
        });
        if (!okPw) return;
        setPwSaving(true);
        try {
            await changePasswordAPI({
                currentPassword: password.currentPassword,
                newPassword: password.newPassword,
            });
            setPassword({ currentPassword: "", newPassword: "", confirm: "" });
            updateUser?.({ hasPassword: true });
            setPwMsg({ type: "success", text: hasPassword ? "Password berhasil diganti" : "Password berhasil dibuat" });
        } catch (ex) {
            setPwMsg({ type: "error", text: ex.message || "Gagal mengganti password" });
        } finally {
            setPwSaving(false);
        }
    };

    return (
        <div className="set-page">
            <PageHeader title="Pengaturan" subtitle="Kelola profil, preferensi, dan keamanan akunmu" />

            <div className="set-layout">
                <nav className="set-nav" aria-label="Bagian pengaturan">
                    {SECTIONS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            className={`set-nav-item ${activeSection === id ? "is-active" : ""}`}
                            onClick={() => goTo(id)}
                        >
                            <Icon aria-hidden />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="set-content">
                    {/* ── Profil ─────────────────────────────── */}
                    <section className="set-section" id="profil">
                        <header className="set-section-head">
                            <h2>Profil</h2>
                            <p>Informasi dasar yang tampil di akunmu.</p>
                        </header>

                        <Row
                            label="Foto profil"
                            hint="Maskot dipilih otomatis dari kebiasaan menabungmu 30 hari terakhir, jadi tidak bisa diganti manual."
                        >
                            <div className="persona-row">
                                {persona ? (
                                    <>
                                        <img src={persona.image} alt={persona.name} className="persona-row-img" />
                                        <div className="persona-row-text">
                                            <div className="persona-row-name">
                                                {persona.name}, {persona.title}
                                                <span className="persona-row-level">Level {gamification.level}</span>
                                            </div>
                                            <p>{persona.meaning}</p>
                                            <Link to="/pencapaian" className="persona-row-link">
                                                {gamification.nextPersona
                                                    ? `Lihat cara naik ke ${personaById(gamification.nextPersona).name}`
                                                    : "Lihat pencapaianmu"}
                                            </Link>
                                        </div>
                                    </>
                                ) : (
                                    <div className="persona-row-text">
                                        <p>Memuat maskotmu...</p>
                                    </div>
                                )}
                            </div>
                        </Row>
                        <Row label="Nama lengkap" htmlFor="set-name">
                            <input
                                id="set-name"
                                type="text"
                                value={profile.name}
                                onChange={(e) => setP("name")(e.target.value)}
                                autoComplete="name"
                            />
                        </Row>
                        <Row label="Username" hint="Dipakai untuk masuk. Tidak bisa diubah.">
                            <div className="set-readonly">@{user?.username}</div>
                        </Row>
                        <Row label="Email" hint="Tujuan reset password dan notifikasi.">
                            <div className="set-readonly">
                                {user?.email}
                                {user?.isVerified && <span className="set-badge">Terverifikasi</span>}
                            </div>
                        </Row>
                        <Row label="Tanggal lahir">
                            <DatePicker
                                value={profile.dateOfBirth}
                                onChange={setP("dateOfBirth")}
                                placeholder="Pilih tanggal lahir"
                                max={new Date().toISOString().slice(0, 10)}
                            />
                        </Row>
                    </section>

                    {/* ── Keuangan ───────────────────────────── */}
                    <section className="set-section" id="keuangan">
                        <header className="set-section-head">
                            <h2>Keuangan</h2>
                            <p>Dipakai untuk menghitung sisa budget dan ringkasan bulanan.</p>
                        </header>
                        <Row label="Pendapatan bulanan" hint="Perkiraan total pemasukan per bulan." htmlFor="set-income">
                            <div className="money-input">
                                <input
                                    id="set-income"
                                    type="text"
                                    inputMode="numeric"
                                    value={profile.monthlyIncome}
                                    onChange={(e) => setP("monthlyIncome")(formatNumberInput(e.target.value))}
                                    placeholder="5.000.000"
                                />
                            </div>
                        </Row>
                        <Row label="Budget bulanan" hint="Batas pengeluaran yang ingin kamu jaga." htmlFor="set-budget">
                            <div className="money-input">
                                <input
                                    id="set-budget"
                                    type="text"
                                    inputMode="numeric"
                                    value={profile.monthlyBudget}
                                    onChange={(e) => setP("monthlyBudget")(formatNumberInput(e.target.value))}
                                    placeholder="3.000.000"
                                />
                            </div>
                        </Row>
                        <Row
                            label="Tanggal gajian"
                            hint="Dipakai untuk menghitung jatah aman per hari sampai gajian berikutnya."
                        >
                            <DropdownMenu
                                value={profile.payday}
                                options={[
                                    { value: "", label: "Belum diatur" },
                                    ...Array.from({ length: 31 }, (_, i) => ({
                                        value: String(i + 1),
                                        label: i === 30 ? "Tanggal 31 (akhir bulan)" : `Tanggal ${i + 1}`,
                                    })),
                                ]}
                                onChange={setP("payday")}
                                minWidth="220px"
                            />
                        </Row>
                    </section>

                    {/* ── Tampilan ───────────────────────────── */}
                    <section className="set-section" id="tampilan">
                        <header className="set-section-head">
                            <h2>Tampilan</h2>
                            <p>Atur tema warna aplikasi.</p>
                        </header>
                        <Row label="Tema">
                            <div className="segmented" role="radiogroup" aria-label="Tema">
                                {THEMES.map(({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={profile.theme === value}
                                        className={`segmented-item ${profile.theme === value ? "is-active" : ""}`}
                                        onClick={() => setP("theme")(value)}
                                    >
                                        <Icon aria-hidden />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </Row>
                        <Row label="Panduan pengguna" hint="Lihat lagi sambutan, tur singkat, dan checklist langkah awal.">
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => window.dispatchEvent(new CustomEvent("dt:onboarding"))}
                            >
                                Tampilkan panduan lagi
                            </button>
                        </Row>
                    </section>

                    {/* ── Notifikasi ─────────────────────────── */}
                    <section className="set-section" id="notifikasi">
                        <header className="set-section-head">
                            <h2>Notifikasi</h2>
                            <p>Pengingat dikirim ke email kamu (waktu WIB) dan selalu tampil di lonceng notifikasi.</p>
                        </header>
                        <div className="set-switches">
                            {NOTIFS.map(([key, label, desc]) => (
                                <Switch
                                    key={key}
                                    id={`notif-${key}`}
                                    label={label}
                                    description={desc}
                                    checked={notifications[key]}
                                    onChange={(v) => setNotifications((n) => ({ ...n, [key]: v }))}
                                />
                            ))}
                        </div>
                        <Row label="Jam pengingat harian" hint="Waktu WIB. Pengingat hanya dikirim kalau belum ada catatan hari itu.">
                            <div style={{ maxWidth: 220 }}>
                                <TimePicker
                                    value={notifications.reminderTime}
                                    onChange={(v) => setNotifications((n) => ({ ...n, reminderTime: v }))}
                                />
                            </div>
                        </Row>
                        <NotificationExtras reminderTime={notifications.reminderTime} />
                    </section>

                    {/* ── Keamanan ───────────────────────────── */}
                    <section className="set-section" id="keamanan">
                        <header className="set-section-head">
                            <h2>{hasPassword ? "Ganti password" : "Buat password"}</h2>
                            <p>
                                {hasPassword
                                    ? "Gunakan minimal 6 karakter. Kamu tetap masuk di perangkat ini setelah mengganti."
                                    : "Akunmu terhubung dengan Google. Buat password supaya bisa juga masuk pakai username."}
                            </p>
                        </header>

                        <form onSubmit={handleChangePassword}>
                            {pwMsg.text && <Notice {...pwMsg} />}
                            {hasPassword && (
                                <Row label="Password lama" htmlFor="pw-current">
                                    <PasswordInput
                                        id="pw-current"
                                        value={password.currentPassword}
                                        onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })}
                                        autoComplete="current-password"
                                        disabled={pwSaving}
                                    />
                                </Row>
                            )}
                            <Row label="Password baru" htmlFor="pw-new">
                                <PasswordInput
                                    id="pw-new"
                                    value={password.newPassword}
                                    onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                                    autoComplete="new-password"
                                    placeholder="Min. 6 karakter"
                                    disabled={pwSaving}
                                />
                            </Row>
                            <Row label="Ulangi password baru" htmlFor="pw-confirm">
                                <PasswordInput
                                    id="pw-confirm"
                                    value={password.confirm}
                                    onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                                    autoComplete="new-password"
                                    disabled={pwSaving}
                                />
                            </Row>
                            <div className="set-section-foot">
                                <button type="submit" className="btn-primary" disabled={pwSaving} aria-busy={pwSaving}>
                                    {pwSaving && <span className="btn-spinner" aria-hidden />}
                                    {pwSaving ? "Menyimpan..." : hasPassword ? "Ganti password" : "Buat password"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>

            {/* Bilah simpan — muncul saat ada perubahan */}
            <div className={`save-bar ${dirty || saveMsg.text ? "is-visible" : ""}`} role="region" aria-label="Simpan perubahan">
                <div className={`save-bar-msg ${saveMsg.type ? `is-${saveMsg.type}` : ""}`}>
                    {saveMsg.type === "success" && <FiCheckCircle aria-hidden />}
                    {saveMsg.type === "error" && <FiAlertCircle aria-hidden />}
                    {saveMsg.text || "Ada perubahan yang belum disimpan"}
                </div>
                {dirty && (
                    <div className="save-bar-actions">
                        <button type="button" className="btn-ghost" onClick={handleDiscard} disabled={saving}>
                            Batalkan
                        </button>
                        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving} aria-busy={saving}>
                            {saving && <span className="btn-spinner" aria-hidden />}
                            {saving ? "Menyimpan..." : "Simpan perubahan"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Row({ label, hint, htmlFor, children }) {
    return (
        <div className="set-row">
            <div className="set-row-label">
                <label htmlFor={htmlFor}>{label}</label>
                {hint && <p>{hint}</p>}
            </div>
            <div className="set-row-control">{children}</div>
        </div>
    );
}

function Notice({ type, text }) {
    return (
        <div className={`set-notice is-${type}`} role={type === "error" ? "alert" : "status"}>
            {type === "success" ? <FiCheckCircle aria-hidden /> : <FiAlertCircle aria-hidden />}
            {text}
        </div>
    );
}
