import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { getWalletsAPI, updateWalletAPI } from "../../services/api";
import { formatNumberInput, parseNumberInput } from "../../utils/format";
import PasswordInput, { PasswordMeter } from "./PasswordInput";
import GoogleButton from "./GoogleButton";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function validate(form) {
    const errors = {};
    if (!form.name.trim()) errors.name = "Nama wajib diisi";
    else if (form.name.trim().length > 100)
        errors.name = "Nama maksimal 100 karakter";

    if (!form.email.trim()) errors.email = "Email wajib diisi";
    else if (!EMAIL_RE.test(form.email.trim()))
        errors.email = "Format email belum benar, contoh: nama@gmail.com";

    if (!form.username.trim()) errors.username = "Username wajib diisi";
    else if (!USERNAME_RE.test(form.username.trim()))
        errors.username =
            "3–30 karakter, hanya huruf, angka, dan garis bawah (_)";

    if (form.password.length < 6)
        errors.password = "Password minimal 6 karakter";

    if (!form.confirm) errors.confirm = "Ulangi password kamu";
    else if (form.confirm !== form.password)
        errors.confirm = "Belum sama dengan password di atas";

    return errors;
}

/**
 * Form daftar (2 langkah: data akun → saldo awal Cash).
 * holdRedirect(true) menahan halaman auth supaya tidak langsung
 * melempar ke dashboard begitu akun jadi.
 */
export default function RegisterForm({ onSwitch, holdRedirect }) {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name: "",
        email: "",
        username: "",
        password: "",
        confirm: "",
    });
    const [touched, setTouched] = useState({});
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [cashBalance, setCashBalance] = useState("");
    const [cashLoading, setCashLoading] = useState(false);
    const { register, loginWithGoogle } = useAuth();
    const navigate = useNavigate();

    const errors = validate(form);
    const busy = loading || googleLoading;
    const show = (field) => touched[field] && errors[field];

    const set = (field) => (e) => {
        const value =
            field === "username"
                ? e.target.value.replace(/\s/g, "")
                : e.target.value;
        setForm((f) => ({ ...f, [field]: value }));
    };
    const blur = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setError("");
        setTouched({
            name: true,
            email: true,
            username: true,
            password: true,
            confirm: true,
        });
        if (Object.keys(errors).length) return;

        setLoading(true);
        holdRedirect(true);
        try {
            await register(
                form.name.trim(),
                form.email.trim(),
                form.username.trim(),
                form.password,
            );
            setStep(2);
        } catch (err) {
            holdRedirect(false);
            setError(err.message || "Gagal mendaftar. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async (accessToken) => {
        setGoogleLoading(true);
        setError("");
        holdRedirect(true);
        try {
            const isNew = await loginWithGoogle(accessToken);
            if (isNew) setStep(2);
            else navigate("/", { replace: true });
        } catch (err) {
            holdRedirect(false);
            setError(err.message || "Daftar dengan Google gagal.");
        } finally {
            setGoogleLoading(false);
        }
    };

    const handleCashBalanceSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const parsedBalance = parseNumberInput(cashBalance);
        if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
            setError("Saldo awal harus angka dan tidak boleh negatif");
            return;
        }

        setCashLoading(true);
        try {
            const walletsRes = await getWalletsAPI();
            const cashWallet = (walletsRes.data?.wallets || []).find(
                (wallet) => wallet.type === "cash" && wallet.isDefault,
            );
            if (!cashWallet)
                throw new Error("Wallet Cash default tidak ditemukan");

            await updateWalletAPI(cashWallet._id, {
                balance: parsedBalance,
                initialBalance: parsedBalance,
            });
            navigate("/wallets?onboarding=1", { replace: true });
        } catch (err) {
            setError(err.message || "Gagal menyimpan saldo awal");
        } finally {
            setCashLoading(false);
        }
    };

    const fieldProps = (field) => ({
        id: `reg-${field}`,
        value: form[field],
        onChange: set(field),
        onBlur: blur(field),
        disabled: busy,
        "aria-invalid": show(field) ? "true" : undefined,
        "aria-describedby": show(field) ? `reg-${field}-err` : undefined,
    });

    const fieldError = (field) =>
        show(field) ? (
            <div id={`reg-${field}-err`} className="auth-hint is-error">
                {errors[field]}
            </div>
        ) : null;

    const errorBox = error && (
        <div className="auth-alert error" role="alert">
            <FiAlertCircle size={16} />
            <span>{error}</span>
        </div>
    );

    if (step === 2) {
        return (
            <>
                <div className="auth-steps" aria-label="Langkah 2 dari 2">
                    <span className="on" />
                    <span className="on" />
                </div>
                <h2 className="auth-title">Saldo awal Cash</h2>
                <p className="auth-sub">
                    Akunmu sudah jadi. Wallet Cash sudah kami buatkan — berapa
                    uang tunai yang kamu punya saat ini? Wallet lain (bank,
                    e-wallet) bisa ditambah nanti.
                </p>

                {errorBox}

                <form onSubmit={handleCashBalanceSubmit}>
                    <div className="auth-field" style={{ marginBottom: 24 }}>
                        <label className="auth-label" htmlFor="reg-cash">
                            Jumlah uang tunai
                        </label>
                        <div className="auth-money">
                            <input
                                id="reg-cash"
                                type="text"
                                value={cashBalance}
                                onChange={(e) =>
                                    setCashBalance(
                                        formatNumberInput(e.target.value),
                                    )
                                }
                                placeholder="0"
                                inputMode="numeric"
                                autoFocus
                                required
                                disabled={cashLoading}
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="auth-btn"
                        disabled={cashLoading}
                        aria-busy={cashLoading}
                    >
                        {cashLoading && (
                            <span className="btn-spinner" aria-hidden />
                        )}
                        {cashLoading ? "Menyimpan saldo..." : "Simpan dan mulai"}
                    </button>
                    <button
                        type="button"
                        className="auth-ghost"
                        disabled={cashLoading}
                        onClick={() =>
                            navigate("/wallets?onboarding=1", { replace: true })
                        }
                    >
                        Lewati, isi nanti
                    </button>
                </form>
            </>
        );
    }

    return (
        <>
            <div className="auth-steps" aria-label="Langkah 1 dari 2">
                <span className="on" />
                <span />
            </div>
            <h2 className="auth-title">Buat akun</h2>
            <p className="auth-sub">
                Gratis, dan butuh kurang dari satu menit.
            </p>

            {errorBox}

            <GoogleButton
                onToken={handleGoogle}
                onError={setError}
                disabled={loading}
                label="Daftar dengan Google"
            />

            <div className="auth-divider">atau isi data di bawah</div>

            <form onSubmit={handleSubmit} noValidate>
                <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-name">
                        Nama lengkap
                    </label>
                    <input
                        type="text"
                        autoComplete="name"
                        placeholder="Nama kamu"
                        {...fieldProps("name")}
                    />
                    {fieldError("name")}
                </div>

                <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-email">
                        Email
                    </label>
                    <input
                        type="email"
                        autoComplete="email"
                        placeholder="nama@gmail.com"
                        {...fieldProps("email")}
                    />
                    {show("email") ? (
                        fieldError("email")
                    ) : (
                        <div className="auth-hint">
                            Dipakai untuk reset password dan pengingat budget.
                        </div>
                    )}
                </div>

                <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-username">
                        Username
                    </label>
                    <input
                        type="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="Buat username, misal: tabungan_ku"
                        {...fieldProps("username")}
                    />
                    {fieldError("username")}
                </div>

                <div className="auth-grid-2">
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-password">
                            Password
                        </label>
                        <PasswordInput
                            autoComplete="new-password"
                            placeholder="Min. 6 karakter"
                            invalid={Boolean(show("password"))}
                            {...fieldProps("password")}
                        />
                    </div>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-confirm">
                            Ulangi password
                        </label>
                        <PasswordInput
                            autoComplete="new-password"
                            placeholder="Ketik ulang"
                            invalid={Boolean(show("confirm"))}
                            {...fieldProps("confirm")}
                        />
                    </div>
                </div>
                <div style={{ marginTop: -8, marginBottom: 22 }}>
                    <PasswordMeter value={form.password} />
                    {!form.password && fieldError("password")}
                    {fieldError("confirm")}
                </div>

                <button
                    type="submit"
                    className="auth-btn"
                    disabled={busy}
                    aria-busy={loading}
                >
                    {loading && <span className="btn-spinner" aria-hidden />}
                    {loading ? "Membuat akun..." : "Buat akun"}
                </button>
            </form>

            <p className="auth-switch auth-switch-inline">
                Sudah punya akun?{" "}
                <button type="button" className="auth-text-btn" onClick={onSwitch}>
                    Masuk
                </button>
            </p>
        </>
    );
}
