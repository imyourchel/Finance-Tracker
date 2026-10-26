// Status onboarding per pengguna, disimpan di localStorage (aman kalau tidak tersedia)
const keyFor = (uid) => `dt-onb:${uid || "anon"}`;

export function readOnb(uid) {
    try {
        return JSON.parse(localStorage.getItem(keyFor(uid)) || "{}") || {};
    } catch {
        return {};
    }
}

export function writeOnb(uid, patch) {
    const next = { ...readOnb(uid), ...patch };
    try {
        localStorage.setItem(keyFor(uid), JSON.stringify(next));
    } catch {
        /* abaikan: mode privat / storage diblokir */
    }
    return next;
}

export function resetOnb(uid) {
    try {
        localStorage.removeItem(keyFor(uid));
    } catch {
        /* abaikan */
    }
}
