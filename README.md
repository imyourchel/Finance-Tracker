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

- 🔐 Autentikasi (register, login, ganti password, forgot password)
- 💳 Multi-wallet (dompet tunai, bank, e-wallet, dll)
- 📊 Transaksi (pemasukan, pengeluaran, transfer antar dompet)
- 🏷️ Kategori kustom dengan icon & warna
- 📅 Transaksi berulang (recurring) — harian, mingguan, bulanan, tahunan
- 📈 Budget bulanan per kategori + alert email saat hampir habis
- 🎯 Goals / tabungan target dengan deadline
- 📧 Notifikasi email otomatis:
  - Reminder harian
  - Alert budget
  - Alert goal tercapai / deadline mendekat
  - Rollover budget bulanan
- 🌙 Dark / Light / System theme
- 😄 Mood tracker per transaksi
- 🏷️ Tags & lokasi transaksi

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

---

## ⚙️ Environment Variables

### `server/.env`
```
PORT=5000
MONGO_URI=
JWT_SECRET=
EMAIL_USER=
EMAIL_PASS=
CLIENT_URL=
NODE_ENV=
```

### `client/.env`
```
VITE_API_URL=
```

---

## 👩‍💻 Author

**Rachel** — [@imyourchel](https://github.com/imyourchel)
