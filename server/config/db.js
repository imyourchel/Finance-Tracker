const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB terhubung!");
    } catch (error) {
        console.error("Gagal konek MongoDB:", error.message);
        process.exit(1); // hentikan server jika database tidak bisa konek
    }
};

module.exports = connectDB;
