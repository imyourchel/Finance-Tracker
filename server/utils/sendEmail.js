const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",     // atau SMTP lain
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,   // gunakan App Password, bukan password biasa
    },
});

const sendEmail = async ({ to, subject, html }) => {
    await transporter.sendMail({
        from: `"Finance Tracker" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};

module.exports = sendEmail;