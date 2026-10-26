import { FiEdit3, FiTarget, FiFlag, FiStar, FiAward, FiPieChart } from "react-icons/fi";
import { PERSONAS } from "../../utils/personas";

// Contoh catatan harian — menggambarkan apa yang dilakukan app ini.
const LEDGER = [
    { label: "Kopi susu gula aren", amount: "−Rp18.000" },
    { label: "Ojek ke kantor", amount: "−Rp14.500" },
    { label: "Gaji Oktober", amount: "+Rp6.500.000", in: true },
    { label: "Makan siang warteg", amount: "−Rp22.000" },
];

function Ledger() {
    return (
        <div className="ledger" aria-hidden>
            <div className="ledger-head">
                <strong>Hari ini</strong>
                <span>Wallet Cash</span>
            </div>
            {LEDGER.map((row) => (
                <div
                    key={row.label}
                    className={`ledger-row ${row.in ? "in" : ""}`}
                >
                    <span>{row.label}</span>
                    <span>{row.amount}</span>
                </div>
            ))}
            <div className="ledger-total">
                <span>Sisa budget makan</span>
                <strong>Rp460.000</strong>
            </div>
        </div>
    );
}

const FEATURES = [
    { icon: FiEdit3, label: "Catat harian dalam hitungan detik" },
    { icon: FiTarget, label: "Budget per kategori" },
    { icon: FiFlag, label: "Goals tabungan" },
    { icon: FiStar, label: "Wallet emas" },
    { icon: FiPieChart, label: "Analitik bulanan" },
    { icon: FiAward, label: "Maskot naik level sesuai kebiasaanmu" },
];

/** Isi panel hijau halaman masuk/daftar: struk, maskot, dan daftar fitur. */
export default function AuthShowcase() {
    return (
        <div className="auth-showcase">
            <div className="auth-stage">
                <Ledger />
                <div className="auth-mascots" aria-hidden>
                    {PERSONAS.map((p, i) => (
                        <img
                            key={p.id}
                            src={p.image}
                            alt=""
                            className={`auth-mascot m${i + 1}`}
                            title={`${p.name}, ${p.title}`}
                        />
                    ))}
                </div>
            </div>
            <ul className="auth-features">
                {FEATURES.map(({ icon: Icon, label }) => (
                    <li key={label}>
                        <span>
                            <Icon aria-hidden />
                        </span>
                        {label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
