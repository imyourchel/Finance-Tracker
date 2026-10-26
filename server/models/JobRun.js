const mongoose = require("mongoose");

// Penanda job terjadwal yang sudah jalan, supaya tidak dobel walau server
// di-restart atau ada lebih dari satu proses. Otomatis terhapus setelah 3 hari.
const jobRunSchema = new mongoose.Schema({
    job: { type: String, required: true },
    key: { type: String, required: true },
    ranAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});

jobRunSchema.index({ job: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("JobRun", jobRunSchema);
