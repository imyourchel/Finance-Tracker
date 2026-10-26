const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const connectDB = require("./config/db");
// require("./jobs/recurringJob");

connectDB();

const rateLimit = require("express-rate-limit");

const app = express();
// Di belakang proxy (Vercel/Nginx) supaya rate limit membaca IP asli
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
// app.use(cors());
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",")
    : ["http://localhost:5173"];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: "5mb" }));

// Batas umum untuk semua API: cukup longgar untuk pemakaian normal,
// tapi menahan skrip yang membanjiri server.
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.API_RATE_LIMIT) || 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.path.startsWith("/cron"),
    message: { message: "Terlalu banyak permintaan. Coba lagi sebentar." },
});
app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => {
    const mongoose = require("mongoose");
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected", time: new Date().toISOString() });
});

// make uploads folder and serve static files
const path = require("path");
const fs = require("fs");
const uploadsDir = path.join(__dirname, "uploads");
const avatarsDir = path.join(uploadsDir, "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);
app.use("/uploads", express.static(uploadsDir));

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/wallets", require("./routes/walletRoutes"));
app.use("/api/budgets", require("./routes/budgetRoutes"));
app.use("/api/goals", require("./routes/goalRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/recurring", require("./routes/recurringRoutes")); // tambahan
app.use("/api/cron", require("./routes/cronRoutes"));
app.use("/api/gamification", require("./routes/gamificationRoutes"));
app.use("/api/insights", require("./routes/insightsRoutes"));
app.use("/api/debts", require("./routes/debtRoutes"));
app.use("/api/wrapped", require("./routes/wrappedRoutes"));
app.use("/api/wellness", require("./routes/wellnessRoutes"));
app.use("/api/payday", require("./routes/paydayRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/data", require("./routes/dataRoutes"));


// Route API yang tidak ada → JSON 404 (bukan halaman HTML)
app.use("/api", (req, res) => res.status(404).json({ message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` }));

// Penangan error terakhir: selalu balas JSON dengan pesan yang bisa dibaca
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err?.message === "Not allowed by CORS") return res.status(403).json({ message: "Origin tidak diizinkan (cek CLIENT_URL di .env)." });
    if (err?.type === "entity.too.large") return res.status(413).json({ message: "Data yang dikirim terlalu besar." });
    if (err?.name === "MulterError") return res.status(400).json({ message: `Upload gagal: ${err.message}` });
    console.error(err);
    res.status(err.status || 500).json({ message: err.message || "Terjadi kesalahan di server." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));

// Penjadwal lokal: transaksi rutin & pengingat. Di Vercel, job dipicu oleh vercel.json (cron).
if (!process.env.VERCEL && process.env.DISABLE_SCHEDULER !== "true") {
    require("./utils/scheduler").start();
}