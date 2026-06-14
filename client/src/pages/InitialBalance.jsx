import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getWalletsAPI, updateWalletAPI } from "../services/api";
import { formatNumberInput, parseNumberInput } from "../utils/format";

export default function InitialBalance() {
    const [balance, setBalance] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

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
            // Fetch wallets yang sudah ada
            const walletsRes = await getWalletsAPI();
            const wallets = walletsRes.data;

            // Cari wallet Cash yang default
            const cashWallet = wallets.find(
                (w) => w.type === "cash" && w.isDefault,
            );

            if (cashWallet) {
                // Update wallet yang sudah ada
                await updateWalletAPI(cashWallet._id, {
                    balance: parsedBalance,
                    initialBalance: parsedBalance,
                });
            }

            navigate("/wallets?onboarding=1");
        } catch (err) {
            setError(
                err.response?.data?.message || "Gagal menyimpan saldo awal",
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
                padding: "24px",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: "460px",
                    backgroundColor: "var(--app-surface)",
                    borderRadius: "20px",
                    padding: "36px",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
                }}
            >
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{ fontSize: "38px", marginBottom: "10px" }}>
                        👛
                    </div>
                    <h1
                        style={{
                            fontSize: "24px",
                            fontWeight: "800",
                            color: "var(--app-text-strong)",
                            margin: "0 0 8px",
                        }}
                    >
                        Isi Saldo Awal
                    </h1>
                    <p
                        style={{
                            color: "var(--app-muted)",
                            margin: 0,
                            fontSize: "14px",
                        }}
                    >
                        Isi saldo awal cash terlebih dahulu, lalu tambahkan
                        wallet lainnya.
                    </p>
                </div>

                {error && (
                    <div
                        style={{
                            padding: "10px 14px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                            borderRadius: "10px",
                            fontSize: "13px",
                            marginBottom: "16px",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                    >
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: "22px" }}>
                        <label
                            style={{
                                display: "block",
                                fontWeight: "600",
                                fontSize: "13px",
                                color: "var(--app-text)",
                                marginBottom: "6px",
                            }}
                        >
                            Saldo Awal (IDR)
                        </label>
                        <input
                            type="text"
                            value={balance}
                            onChange={(e) =>
                                setBalance(formatNumberInput(e.target.value))
                            }
                            placeholder="0"
                            inputMode="numeric"
                            required
                            style={{
                                width: "100%",
                                padding: "11px 14px",
                                border: "1.5px solid var(--app-border)",
                                borderRadius: "10px",
                                fontSize: "14px",
                                boxSizing: "border-box",
                                outline: "none",
                                backgroundColor: "var(--app-surface)",
                                color: "var(--app-text-strong)",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            style={{
                                flex: 1,
                                padding: "12px",
                                borderRadius: "10px",
                                border: "1px solid #d1d5db",
                                backgroundColor: "white",
                                color: "#334155",
                                fontWeight: "600",
                                cursor: "pointer",
                            }}
                        >
                            Lewati
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                flex: 1.4,
                                padding: "12px",
                                border: "none",
                                borderRadius: "10px",
                                background: loading
                                    ? "var(--app-muted)"
                                    : "linear-gradient(135deg, var(--app-button-primary-from), var(--app-button-primary-to))",
                                color: "white",
                                fontWeight: "700",
                                cursor: loading ? "not-allowed" : "pointer",
                            }}
                        >
                            {loading ? "Menyimpan..." : "Simpan & Lanjut"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
