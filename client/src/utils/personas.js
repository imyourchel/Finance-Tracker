// Lima maskot DailyTrack. Maskot user ditentukan otomatis oleh kebiasaan
// keuangannya (lihat server/controllers/gamificationController.js).
export const PERSONAS = [
    {
        id: "semut",
        tier: 1,
        name: "Semut",
        title: "Si Pencatat Rajin",
        image: "/avatars/semut.webp",
        meaning:
            "Semut membawa remah kecil setiap hari tanpa pernah melewatkannya. Kecil, tapi konsisten. Begitulah kebiasaan keuangan dimulai: mencatat setiap pengeluaran, sekecil apa pun.",
        focus: "Biasakan mencatat transaksi setiap hari.",
    },
    {
        id: "tupai",
        tier: 2,
        name: "Tupai",
        title: "Si Penyimpan",
        image: "/avatars/tupai.webp",
        meaning:
            "Tupai menyimpan biji-bijian saat musim panen sebagai bekal musim sulit. Kamu mulai menyisihkan sebagian pemasukan untuk nanti, tidak menghabiskan semuanya sekarang.",
        focus: "Sisihkan minimal 20% pemasukan dan buat goal tabungan.",
    },
    {
        id: "celengan-ayam",
        tier: 3,
        name: "Celengan Ayam",
        title: "Si Rajin Menabung",
        image: "/avatars/celengan-ayam.webp",
        meaning:
            "Celengan ayam tanah liat adalah cara menabung khas Indonesia: diisi koin demi koin sampai penuh. Kamu menabung dengan rutin dan punya tujuan yang jelas.",
        focus: "Atur budget per kategori dan jaga supaya tidak jebol.",
    },
    {
        id: "burung-hantu",
        tier: 4,
        name: "Burung Hantu",
        title: "Si Bijak",
        image: "/avatars/burung-hantu.webp",
        meaning:
            "Burung hantu melambangkan kebijaksanaan: tenang mengamati sebelum bertindak. Kamu berpikir dulu sebelum belanja dan disiplin menjaga budget tiap kategori.",
        focus: "Pertahankan hemat 3 bulan beruntun dan selesaikan satu goal.",
    },
    {
        id: "koi",
        tier: 5,
        name: "Koi",
        title: "Si Pembawa Hoki",
        image: "/avatars/koi.webp",
        meaning:
            "Dalam legenda, ikan koi berenang melawan arus hingga menjadi naga. Ia lambang kemakmuran dan rezeki yang terus mengalir. Hoki ini bukan kebetulan, tapi hasil kebiasaan baik yang dijaga berbulan-bulan.",
        focus: "Kamu di puncak. Jaga kebiasaan ini supaya tetap di sini.",
    },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id) || PERSONAS[0];
