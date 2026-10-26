const JobRun = require("../models/JobRun");
const NotificationState = require("../models/NotificationState");

// Klaim satu kali jalan untuk job+kunci. true = boleh jalan, false = sudah pernah.
async function claimJob(job, key) {
    try {
        const r = await JobRun.updateOne({ job, key }, { $setOnInsert: { ranAt: new Date() } }, { upsert: true });
        return (r.upsertedCount || 0) > 0;
    } catch (e) {
        if (e.code === 11000) return false;
        throw e;
    }
}

// Klaim kunci email per pengguna (mis. "daily:2026-10-26"). true = belum pernah dikirim.
async function claimSent(userId, key) {
    try {
        const r = await NotificationState.updateOne(
            { user: userId, sentKeys: { $ne: key } },
            { $push: { sentKeys: { $each: [key], $slice: -500 } } },
            { upsert: true },
        );
        return (r.modifiedCount || 0) + (r.upsertedCount || 0) > 0;
    } catch (e) {
        if (e.code === 11000) return false; // dokumen sudah ada & kunci sudah tercatat
        throw e;
    }
}

// Batalkan klaim kalau email gagal terkirim, supaya dicoba lagi nanti
async function releaseSent(userId, key) {
    await NotificationState.updateOne({ user: userId }, { $pull: { sentKeys: key } });
}

module.exports = { claimJob, claimSent, releaseSent };
