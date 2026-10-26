import { useState } from "react";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiPromise = null;
function loadGsi() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = GSI_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
            gsiPromise = null;
            reject(new Error("Gagal memuat layanan Google. Cek koneksi internet."));
        };
        document.head.appendChild(script);
    });
    return gsiPromise;
}

function GoogleMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
                fill="#FF3D00"
                d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
            />
        </svg>
    );
}

/**
 * Tombol "Lanjutkan dengan Google".
 * onToken(accessToken) dipanggil setelah user memilih akun Google.
 */
export default function GoogleButton({
    onToken,
    onError,
    disabled,
    label = "Lanjutkan dengan Google",
}) {
    const [busy, setBusy] = useState(false);

    const handleClick = async () => {
        if (!CLIENT_ID) {
            onError?.(
                "Login Google belum dikonfigurasi. Isi VITE_GOOGLE_CLIENT_ID di client/.env.",
            );
            return;
        }
        setBusy(true);
        try {
            await loadGsi();
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: "openid email profile",
                callback: async (resp) => {
                    if (resp.error || !resp.access_token) {
                        setBusy(false);
                        onError?.("Login Google dibatalkan atau gagal.");
                        return;
                    }
                    try {
                        await onToken(resp.access_token);
                    } finally {
                        setBusy(false);
                    }
                },
                error_callback: (err) => {
                    setBusy(false);
                    if (err?.type === "popup_closed") return; // user menutup popup
                    onError?.(
                        err?.type === "popup_failed_to_open"
                            ? "Popup Google diblokir browser. Izinkan popup untuk situs ini lalu coba lagi."
                            : "Login Google gagal. Coba lagi.",
                    );
                },
            });
            client.requestAccessToken({ prompt: "select_account" });
        } catch (err) {
            setBusy(false);
            onError?.(err.message);
        }
    };

    return (
        <button
            type="button"
            className="auth-btn-google"
            onClick={handleClick}
            disabled={disabled || busy}
            aria-busy={busy}
        >
            {busy ? <span className="btn-spinner" aria-hidden /> : <GoogleMark />}
            {busy ? "Menghubungkan ke Google..." : label}
        </button>
    );
}
