import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertCircle } from "react-icons/fi";
import { getWalletsAPI, updateWalletAPI } from "../services/api";
import { formatNumberInput, parseNumberInput } from "../utils/format";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/auth/AuthLayout";

export default function InitialBalance() {
    const [balance, setBalance] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { user } = useAuth();
    const firstName = user?.name?.split(" ")[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const parsedBalance = parseNumberInput(balance);
        if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
            setError("Saldo awal harus angka dan tidak boleh negatif");
            return;
        }

        setLoading(true);
        try {
            const walletsRes = await getWalletsAPI();
            const wallets = walletsRes.data?.wallets || [];
            const cashWallet = wallets.find(
                (w) => w.type === "cash" && w.isDefault,
            );
            if (!cashWallet)
                throw new Error("Wallet Cash default tidak ditemukan");

            await updateWalletAPI(cashWallet._id, {
                balance: parsedBalance,
                initialBalance: parsedBalance,
            });
            navigate("/wallets?onboarding=1");
        } catch (err) {
            setError(err.message || "Gagal menyimpan saldo awal");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout
            title="Satu langkah lagi."
            subtitle="Isi saldo awal supaya angka di aplikasi sama dengan uang yang kamu pegang sekarang."
        >
            <div className="auth-steps" aria-label="Langkah 2 dari 2">
                <span className="on" />
                <span className="on" />
            </div>
            <h2 className="auth-title">
                {firstName ? `Halo, ${firstName}` : "Saldo awal Cash"}
            </h2>
            <p className="auth-sub">
                Wallet Cash sudah kami buatkan. Berapa uang tunai yang kamu
                punya saat ini? Wallet lain (bank, e-wallet) bisa ditambah
                nanti.
            </p>

            {error && (
                <div className="auth-alert error" role="alert">
                    <FiAlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="auth-field" style={{ marginBottom: 24 }}>
                    <label className="auth-label" htmlFor="init-cash">
                        Jumlah uang tunai
                    </label>
                    <div className="auth-money">
                        <input
                            id="init-cash"
                            type="text"
                            value={balance}
                            onChange={(e) =>
                                setBalance(formatNumberInput(e.target.value))
                            }
                            placeholder="0"
                            inputMode="numeric"
                            autoFocus
                            required
                            disabled={loading}
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className="auth-btn"
                    disabled={loading}
                    aria-busy={loading}
                >
                    {loading && <span className="btn-spinner" aria-hidden />}
                    {loading ? "Menyimpan saldo..." : "Simpan dan mulai"}
                </button>
                <button
                    type="button"
                    className="auth-ghost"
                    disabled={loading}
                    onClick={() => navigate("/wallets?onboarding=1")}
                >
                    Lewati, isi nanti
                </button>
            </form>
        </AuthLayout>
    );
}
