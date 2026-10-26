import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./App.css";
import "./styles/controls.css";
import "./styles/settings.css";
import "./styles/transaction.css";
import "./styles/gamification.css";
import App from "./App.jsx";

// Simpan prompt "pasang aplikasi" supaya bisa ditampilkan dari menu Lainnya
window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__dtInstallPrompt = e;
    window.dispatchEvent(new Event("dt:installable"));
});

// Service worker hanya di build produksi (di mode dev bisa mengganggu hot reload)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
}

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
