const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const connectDB = require("./config/db");
// require("./jobs/recurringJob");

connectDB();

const app = express();
app.use(helmet());
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
app.use(express.json());

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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server jalan di port ${PORT}`));