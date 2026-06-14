import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { useAuth } from "../context/AuthContext";
import { getWalletsAPI, updateWalletAPI } from "../services/api";
import { formatNumberInput, parseNumberInput } from "../utils/format";

export default function Register() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        username: "",
        password: "",
        confirm: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showInitialBalanceModal, setShowInitialBalanceModal] =
        useState(false);
    const [cashBalance, setCashBalance] = useState("");
    const [cashLoading, setCashLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (form.password !== form.confirm)
            return setError("Password dan konfirmasi tidak cocok");
        if (form.password.length < 6)
            return setError("Password minimal 6 karakter");

        setLoading(true);
        try {
            await register(form.name, form.email, form.username, form.password);
            setShowInitialBalanceModal(true);
        } catch (err) {
            setError(err.response?.data?.message || "Gagal mendaftar");
        } finally {
            setLoading(false);
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
            const cashWallet = walletsRes.data.wallets.find(
                (wallet) => wallet.type === "cash" && wallet.isDefault,
            );

            if (!cashWallet) {
                throw new Error("Wallet cash default tidak ditemukan");
            }

            await updateWalletAPI(cashWallet._id, {
                balance: parsedBalance,
                initialBalance: parsedBalance,
            });

            navigate("/wallets?onboarding=1");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    err.message ||
                    "Gagal menyimpan saldo awal",
            );
        } finally {
            setCashLoading(false);
        }
    };

    const inputSt = {
        width: "100%",
        padding: "11px 14px",
        border: "1.5px solid var(--app-border)",
        borderRadius: "10px",
        fontSize: "14px",
        boxSizing: "border-box",
        outline: "none",
        backgroundColor: "var(--app-surface-soft)",
        color: "var(--app-text-strong)",
    };

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
                padding: "24px",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "420px",
                    maxHeight: "calc(100vh - 48px)",
                    backgroundColor: "var(--app-surface)",
                    borderRadius: "20px",
                    padding: "40px",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        textAlign: "center",
                        marginBottom: "28px",
                        flexShrink: 0,
                    }}
                >
                    <div style={{ fontSize: "36px" }}>💰</div>
                    <h2
                        style={{
                            fontSize: "24px",
                            fontWeight: "800",
                            color: "var(--app-text-strong)",
                            margin: "8px 0 4px",
                        }}
                    >
                        Buat Akun
                    </h2>
                    <p
                        style={{
                            color: "var(--app-muted)",
                            fontSize: "14px",
                            margin: 0,
                        }}
                    >
                        Sudah punya akun?{" "}
                        <Link
                            to="/login"
                            style={{
                                color: "var(--accent)",
                                fontWeight: "600",
                            }}
                        >
                            Masuk
                        </Link>
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "10px 14px",
                            backgroundColor: "var(--app-surface-soft)",
                            color: "var(--app-button-danger-to)",
                            borderRadius: "8px",
                            fontSize: "13px",
                            marginBottom: "16px",
                            border: "1px solid var(--app-border)",
                            flexShrink: 0,
                        }}
                    >
                        ⚠️ {error}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    style={{ overflow: "auto", flex: 1, minHeight: 0 }}
                >
                    <div style={{ marginBottom: "14px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Nama Lengkap
                        </label>
                        <input
                            type="text"
                            value={form.name}
                            required
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            placeholder="Nama kamu..."
                            style={inputSt}
                        />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Email
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            required
                            onChange={(e) =>
                                setForm({ ...form, email: e.target.value })
                            }
                            placeholder="email@kamu.com"
                            style={inputSt}
                        />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Username
                        </label>
                        <input
                            type="text"
                            value={form.username}
                            required
                            onChange={(e) =>
                                setForm({ ...form, username: e.target.value })
                            }
                            placeholder="username kamu"
                            style={inputSt}
                        />
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={form.password}
                                required
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        password: e.target.value,
                                    })
                                }
                                placeholder="Min. 6 karakter"
                                style={{
                                    ...inputSt,
                                    paddingRight: "56px",
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    right: "10px",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    color: showPassword
                                        ? "var(--accent)"
                                        : "var(--app-muted)",
                                    cursor: "pointer",
                                    padding: "0px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "none",
                                    outline: "none",
                                }}
                                aria-label={
                                    showPassword
                                        ? "Sembunyikan password"
                                        : "Lihat password"
                                }
                                onMouseEnter={(e) => {
                                    e.target.style.background = "transparent";
                                    e.target.style.boxShadow = "none";
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = "transparent";
                                    e.target.style.boxShadow = "none";
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{ flexShrink: 0 }}
                                >
                                    <path
                                        style={{
                                            display: showPassword
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
                                    />
                                    <path
                                        style={{
                                            display: showPassword
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                                    />
                                    <path
                                        style={{
                                            display: showPassword
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                                    />
                                    <line
                                        style={{
                                            display: showPassword
                                                ? "none"
                                                : "block",
                                        }}
                                        x1="2"
                                        x2="22"
                                        y1="2"
                                        y2="22"
                                    />
                                    <path
                                        style={{
                                            display: showPassword
                                                ? "block"
                                                : "none",
                                        }}
                                        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
                                    />
                                    <circle
                                        style={{
                                            display: showPassword
                                                ? "block"
                                                : "none",
                                        }}
                                        cx="12"
                                        cy="12"
                                        r="3"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Konfirmasi Password
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showConfirm ? "text" : "password"}
                                value={form.confirm}
                                required
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        confirm: e.target.value,
                                    })
                                }
                                placeholder="Ulangi password"
                                style={{
                                    ...inputSt,
                                    paddingRight: "56px",
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm((prev) => !prev)}
                                style={{
                                    position: "absolute",
                                    top: "50%",
                                    right: "10px",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    color: showConfirm
                                        ? "var(--accent)"
                                        : "var(--app-muted)",
                                    cursor: "pointer",
                                    padding: "0px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "none",
                                    outline: "none",
                                }}
                                aria-label={
                                    showConfirm
                                        ? "Sembunyikan password"
                                        : "Lihat password"
                                }
                                onMouseEnter={(e) => {
                                    e.target.style.background = "transparent";
                                    e.target.style.boxShadow = "none";
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = "transparent";
                                    e.target.style.boxShadow = "none";
                                }}
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{ flexShrink: 0 }}
                                >
                                    <path
                                        style={{
                                            display: showConfirm
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M9.88 9.88a3 3 0 1 0 4.24 4.24"
                                    />
                                    <path
                                        style={{
                                            display: showConfirm
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"
                                    />
                                    <path
                                        style={{
                                            display: showConfirm
                                                ? "none"
                                                : "block",
                                        }}
                                        d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"
                                    />
                                    <line
                                        style={{
                                            display: showConfirm
                                                ? "none"
                                                : "block",
                                        }}
                                        x1="2"
                                        x2="22"
                                        y1="2"
                                        y2="22"
                                    />
                                    <path
                                        style={{
                                            display: showConfirm
                                                ? "block"
                                                : "none",
                                        }}
                                        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
                                    />
                                    <circle
                                        style={{
                                            display: showConfirm
                                                ? "block"
                                                : "none",
                                        }}
                                        cx="12"
                                        cy="12"
                                        r="3"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "13px",
                            marginTop: "8px",
                            background: loading
                                ? "var(--app-muted)"
                                : "linear-gradient(135deg, var(--accent), #7c3aed)",
                            color: "var(--app-button-primary-text)",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "15px",
                            fontWeight: "700",
                            cursor: loading ? "not-allowed" : "pointer",
                        }}
                    >
                        {loading ? "Mendaftar..." : "Daftar Sekarang →"}
                    </button>
                </form>
            </div>

            {showInitialBalanceModal && (
                <Modal
                    title="Isi Saldo Awal Cash"
                    onClose={() => setShowInitialBalanceModal(false)}
                    maxWidth="420px"
                >
                    <form onSubmit={handleCashBalanceSubmit}>
                        <p
                            style={{
                                margin: "0 0 18px",
                                color: "var(--app-muted)",
                                fontSize: "14px",
                                lineHeight: 1.6,
                            }}
                        >
                            Wallet default Cash sudah dibuat. Isi saldo awalnya
                            supaya nominal cash langsung sama dengan uang yang
                            kamu punya.
                        </p>
                        <div style={{ marginBottom: "18px" }}>
                            <label
                                style={{
                                    display: "block",
                                    fontWeight: "600",
                                    fontSize: "13px",
                                    color: "var(--app-text-strong)",
                                    marginBottom: "6px",
                                }}
                            >
                                Saldo Awal Cash (IDR)
                            </label>
                            <input
                                type="text"
                                value={cashBalance}
                                onChange={(e) =>
                                    setCashBalance(
                                        formatNumberInput(e.target.value),
                                    )
                                }
                                placeholder="1.000"
                                required
                                inputMode="numeric"
                                style={{
                                    width: "100%",
                                    padding: "11px 14px",
                                    border: "1.5px solid var(--app-border)",
                                    borderRadius: "10px",
                                    fontSize: "14px",
                                    boxSizing: "border-box",
                                    outline: "none",
                                    backgroundColor: "var(--app-surface-soft)",
                                    color: "var(--app-text-strong)",
                                }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={cashLoading}
                            style={{
                                width: "100%",
                                padding: "12px",
                                border: "none",
                                borderRadius: "10px",
                                background: cashLoading
                                    ? "var(--app-muted)"
                                    : "linear-gradient(135deg, var(--accent), #7c3aed)",
                                color: "var(--app-button-primary-text)",
                                fontWeight: "700",
                                cursor: cashLoading ? "not-allowed" : "pointer",
                            }}
                        >
                            {cashLoading ? "Menyimpan..." : "Simpan & Lanjut"}
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
}
