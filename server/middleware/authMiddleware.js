const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    let token;

    // Cek apakah ada header Authorization dengan format "Bearer xxxxx"
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Ambil token — hapus kata "Bearer " (7 karakter pertama)
            token = req.headers.authorization.split(" ")[1];

            // Verifikasi token dengan secret key di .env
            // Kalau token palsu atau expired, jwt.verify akan throw error
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Ambil data user dari DB berdasarkan ID yang ada di token
            // .select('-password') = jangan ikutkan field password
            req.user = await User.findById(decoded.id).select("-password");

            if (!req.user) {
                return res
                    .status(401)
                    .json({ message: "User tidak ditemukan" });
            }

            if (!req.user.isActive) {
                return res.status(403).json({ message: "Akun dinonaktifkan" });
            }

            next(); // lanjut ke controller
        } catch (error) {
            // Token expired atau tidak valid
            return res
                .status(401)
                .json({ message: "Token tidak valid, silakan login ulang" });
        }
    }

    if (!token) {
        return res
            .status(401)
            .json({ message: "Tidak ada token, akses ditolak" });
    }
};

module.exports = { protect };
