// Notifikasi browser (opsional). Hanya tampil selama aplikasi terbuka di tab mana pun.
export const BROWSER_NOTIF_KEY = "dt-browser-notif";
export const BROWSER_NOTIF_EVENT = "dt:browser-notif-changed";
const NOTIFIED_KEY = "dt-notified";

export const browserNotifSupported = () => typeof window !== "undefined" && "Notification" in window;

export function browserNotifEnabled() {
    try {
        return (
            browserNotifSupported() &&
            localStorage.getItem(BROWSER_NOTIF_KEY) === "on" &&
            Notification.permission === "granted"
        );
    } catch {
        return false;
    }
}

export function setBrowserNotif(on) {
    try {
        localStorage.setItem(BROWSER_NOTIF_KEY, on ? "on" : "off");
    } catch {
        /* abaikan */
    }
    window.dispatchEvent(new CustomEvent(BROWSER_NOTIF_EVENT));
}

function readNotified() {
    try {
        return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
    } catch {
        return new Set();
    }
}

/** Tampilkan notifikasi browser untuk item prioritas tinggi yang belum pernah ditampilkan. */
export function showBrowserNotifications(items, onClick) {
    if (!browserNotifEnabled()) return;
    const seen = readNotified();
    const fresh = items.filter((i) => !i.read && i.priority === "high" && !seen.has(i.id));
    for (const item of fresh.slice(0, 3)) {
        try {
            const n = new Notification(item.title, {
                body: item.body,
                icon: "/brand/logo-128.webp",
                tag: item.id,
            });
            n.onclick = () => {
                window.focus();
                onClick?.(item);
                n.close();
            };
        } catch {
            /* sebagian browser butuh service worker untuk new Notification */
        }
        seen.add(item.id);
    }
    try {
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...seen].slice(-100)));
    } catch {
        /* abaikan */
    }
}
