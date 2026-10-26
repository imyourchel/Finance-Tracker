const sendEmail = require("../utils/sendEmail");

const appUrl = () => (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].replace(/\/$/, "");
const rupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

// Kerangka email bertema DailyTrack (hijau tua + kuningan)
function layout({ kicker, title, intro, rows = [], note, cta }) {
    const rowsHtml = rows
        .map(
            ([label, value, color], i) => `
            <tr style="background:${i % 2 ? "#ffffff" : "#f4f6f3"}">
                <td style="padding:11px 14px;color:#66756f;font-size:13px">${esc(label)}</td>
                <td style="padding:11px 14px;font-weight:700;color:${color || "#13221e"};text-align:right;font-size:14px">${value}</td>
            </tr>`,
        )
        .join("");
    return `
    <div style="background:#f4f6f3;padding:24px 12px;font-family:'Plus Jakarta Sans',Segoe UI,Arial,sans-serif">
      <div style="max-width:520px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe5e1">
        <div style="background:#0e2a23;padding:24px 26px">
          <div style="color:#b8923f;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${esc(kicker || "DailyTrack")}</div>
          <div style="color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.2;margin-top:6px">${esc(title)}</div>
        </div>
        <div style="padding:24px 26px;color:#34443f;font-size:14.5px;line-height:1.6">
          ${intro ? `<p style="margin:0 0 18px">${intro}</p>` : ""}
          ${rows.length ? `<table style="width:100%;border-collapse:collapse;border:1px solid #dfe5e1;border-radius:10px;overflow:hidden">${rowsHtml}</table>` : ""}
          ${note ? `<p style="margin:18px 0 0;color:#66756f;font-size:13px">${note}</p>` : ""}
          ${
              cta
                  ? `<p style="margin:22px 0 0"><a href="${appUrl()}${cta.path}" style="display:inline-block;background:#1e6e55;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px">${esc(cta.label)}</a></p>`
                  : ""
          }
        </div>
        <div style="padding:14px 26px;background:#f7f9f7;color:#8a9a93;font-size:12px">
          DailyTrack · Atur email ini di Pengaturan → Notifikasi.
        </div>
      </div>
    </div>`;
}

async function send(to, subject, html) {
    if (!emailConfigured()) throw new Error("Email belum dikonfigurasi (isi EMAIL_USER dan EMAIL_PASS di server/.env)");
    await sendEmail({ to, subject, html });
}

module.exports = { layout, send, rupiah, esc, emailConfigured, appUrl };
