const mongoose = require("mongoose");

// Status notifikasi per pengguna: id yang sudah dibaca (lonceng di aplikasi)
// dan kunci email yang sudah terkirim (supaya pengingat tidak dobel).
const notificationStateSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        readIds: { type: [String], default: [] },
        sentKeys: { type: [String], default: [] },
    },
    { timestamps: true },
);

module.exports = mongoose.model("NotificationState", notificationStateSchema);
