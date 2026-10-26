# 💰 DailyTrack — Finance Tracker

Aplikasi manajemen keuangan pribadi berbasis web untuk mencatat pemasukan, pengeluaran, transfer antar dompet, budget, goals, dan transaksi berulang — dilengkapi notifikasi email otomatis.

---

## 🖥️ Tech Stack

**Frontend**
- React 19 + Vite
- React Router DOM
- Recharts (grafik & visualisasi)
- Axios

**Backend**
- Node.js + Express 5
- MongoDB + Mongoose
- Nodemailer (email notification)
- JWT Authentication
- Vercel Cron Jobs

---

## ✨ Fitur

**Mencatat**
- ⚡ Catat cepat dengan bahasa sehari-hari (Ctrl/⌘+K): `kopi 18rb gopay kemarin`, `gaji 6,5jt bca`, beberapa sekaligus dengan `;`
- 💳 Multi-wallet (cash, bank, e-wallet, investasi, **emas** dengan berat & harga beli) + histori per wallet
- 📊 Pemasukan, pengeluaran, transfer (dengan biaya), tag, mood, lokasi, struk
- 📅 Tagihan rutin harian/mingguan/bulanan/tahunan (dijalankan otomatis)
- 📥 Impor mutasi rekening (BCA, Mandiri, BNI, BRI, Jago, template) dengan deteksi duplikat
- 📤 Ekspor CSV untuk Excel, laporan bulanan siap cetak/PDF, cadangan JSON

**Merencanakan**
- 💰 Sisa aman per hari sampai gajian
- 📈 Budget per kategori: sisa per hari, proyeksi akhir bulan, peringatan 80%, rollover, saran dari 3 bulan terakhir
- 🎯 Goals: milestone, setoran yang disarankan per minggu/bulan, proyeksi kapan tercapai
- 🤝 Utang-piutang & patungan (split bill) dengan pesan tagihan siap kirim ke WhatsApp
- 🩺 Kesehatan finansial: skor 0–100, dana darurat, deteksi langganan otomatis

**Memahami**
- 🧠 Dashboard dengan insight otomatis, perbandingan bulan lalu, proyeksi
- 📉 Analitik 3/6/12 bulan, heatmap pengeluaran, kategori paling boros
- 😊 Mood vs belanja: kapan kamu belanja karena emosi
- 🎬 DailyTrack Wrapped: rekap bulanan/tahunan bergaya story, bisa diunduh untuk Instagram Story

**Kebiasaan & gamifikasi**
- 🐔 Maskot profil berubah sesuai kebiasaan menabung (5 tingkat)
- 🔥 Streak harian dengan perisai, XP & level, 14 lencana
- 🎯 Misi harian & mingguan, 5 tantangan menabung (termasuk tantangan 52 minggu)
- 🔔 Pusat notifikasi, notifikasi browser, email pengingat (pukul berapa pun, WIB)

**Lainnya**
- 📱 Responsif untuk HP + bisa dipasang sebagai aplikasi (PWA)
- 🧭 Panduan untuk pengguna baru & checklist "Langkah awal"
- 🔐 Login email/password & Google, lupa password, verifikasi email
- 🌙 Tema terang / gelap / ikuti sistem

---

## 📁 Struktur Folder

```
finance-tracker/
├── client/          # React + Vite (frontend)
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── utils/
│   └── .env.example
└── server/          # Express + MongoDB (backend)
    ├── config/
    ├── controllers/
    ├── jobs/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── utils/
    ├── validators/
    ├── vercel.json
    └── .env.example
```

---

## 🚀 Cara Menjalankan Lokal

### Prerequisites
- Node.js >= 18
- MongoDB Atlas (atau lokal)

### 1. Clone repo
```bash
git clone https://github.com/imyourchel/Finance-Tracker.git
cd Finance-Tracker
```

### 2. Setup Backend
```bash
cd server
npm install
cp .env.example .env
# isi .env dengan nilai yang sesuai
npm run dev
```

### 3. Setup Frontend
```bash
cd client
npm install
cp .env.example .env
# isi VITE_API_URL dengan URL backend
npm run dev
```

### 4. Uji otomatis

```bash
# di folder server: tes logika (tanpa database)
npm test

# di folder client: tes pembaca catat cepat & CSV
npm test

# di folder server, saat backend sedang jalan: uji semua fitur ke MongoDB sungguhan.
# Membuat akun uji sementara lalu menghapusnya lagi. Hasil di server/smoke-report.txt
npm run smoke
```

### Pengingat & tagihan rutin

Saat dijalankan di laptop/server biasa, backend menjalankan penjadwal sendiri setiap menit (tagihan rutin, pengingat harian, peringatan budget & goal). Di Vercel, penjadwal dimatikan dan diganti Vercel Cron (`server/vercel.json`). Matikan penjadwal lokal dengan `DISABLE_SCHEDULER=true`. Email hanya terkirim kalau `EMAIL_USER` dan `EMAIL_PASS` diisi.

---

## ⚙️ Environment Variables

### `server/.env`
```
PORT=5000
MONGO_URI=
JWT_SECRET=
EMAIL_USER=
EMAIL_PASS=
CLIENT_URL=http://localhost:5173
NODE_ENV=development
GOOGLE_CLIENT_ID=      # OAuth Client ID untuk Login with Google
API_RATE_LIMIT=300     # opsional: batas permintaan API per menit per IP
DISABLE_SCHEDULER=     # opsional: true untuk mematikan penjadwal lokal
CRON_SECRET=           # opsional: rahasia untuk /api/cron/* di production
```

### `client/.env`
```
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID= # sama dengan GOOGLE_CLIENT_ID di server
```

### Setup Login with Google

1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → tipe **Web application**.
2. Di **Authorized JavaScript origins** tambahkan `http://localhost:5173` (dan URL Vercel client untuk production).
3. Salin Client ID ke `GOOGLE_CLIENT_ID` (server) dan `VITE_GOOGLE_CLIENT_ID` (client), lalu restart keduanya.

### Lupa password

Link reset dikirim lewat email (Nodemailer + Gmail App Password di `EMAIL_USER` / `EMAIL_PASS`). Saat development dan email belum diatur, link reset dicetak di terminal server.

---

## 👩‍💻 Author

**Rachel** — [@imyourchel](https://github.com/imyourchel)
