import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import AuthLayout from "../components/auth/AuthLayout";
import { verifyEmailAPI } from "../services/api";

export default function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get("token");
    const [state, setState] = useState(token ? "loading" : "error");
    const [message, setMessage] = useState(
        token ? "" : "Link verifikasi tidak berisi token.",
    );

    useEffect(() => {
        if (!token) return;
        let cancelled = false;
        verifyEmailAPI(token)
            .then(() => !cancelled && setState("ok"))
            .catch((err) => {
                if (cancelled) return;
                setState("error");
                setMessage(err.message || "Link verifikasi tidak valid.");
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    return (
        <AuthLayout>
            {state === "loading" && (
                <div role="status" style={{ display: "grid", gap: 16 }}>
                    <span
                        className="btn-spinner"
                        style={{ width: 28, height: 28, color: "#1e6e55" }}
                    />
                    <h2 className="auth-title">Memverifikasi email...</h2>
                </div>
            )}
            {state === "ok" && (
                <>
                    <div className="auth-mail-icon">
                        <FiCheckCircle size={24} />
                    </div>
                    <h2 className="auth-title">Email terverifikasi</h2>
                    <p className="auth-sub">
                        Terima kasih. Pengingat dan notifikasi budget akan
                        dikirim ke email ini.
                    </p>
                    <Link
                        to="/"
                        className="auth-btn"
                        style={{ textDecoration: "none" }}
                    >
                        Buka DailyTrack
                    </Link>
                </>
            )}
            {state === "error" && (
                <>
                    <div
                        className="auth-mail-icon"
                        style={{ background: "#fbefed", color: "#c2453b" }}
                    >
                        <FiAlertCircle size={24} />
                    </div>
                    <h2 className="auth-title">Verifikasi gagal</h2>
                    <p className="auth-sub">
                        {message} Link mungkin sudah dipakai sebelumnya.
                    </p>
                    <Link
                        to="/login"
                        className="auth-btn"
                        style={{ textDecoration: "none" }}
                    >
                        Ke halaman masuk
                    </Link>
                </>
            )}
        </AuthLayout>
    );
}
