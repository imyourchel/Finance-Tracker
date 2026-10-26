/** Simpan Blob sebagai file di perangkat pengguna. */
export function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Pesan error dari respons axios, termasuk yang berbentuk Blob (unduhan). */
export async function errorMessage(err, fallback = "Terjadi kesalahan. Coba lagi.") {
    const data = err?.response?.data;
    if (data instanceof Blob) {
        try {
            const json = JSON.parse(await data.text());
            return json.message || fallback;
        } catch {
            return fallback;
        }
    }
    return data?.message || fallback;
}

const pad = (n) => String(n).padStart(2, "0");
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const compactKey = (k) => (k ? k.replace(/-/g, "") : "");
