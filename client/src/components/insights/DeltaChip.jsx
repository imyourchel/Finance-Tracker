import { FiArrowDownRight, FiArrowUpRight, FiMinus } from "react-icons/fi";
import { pctLabel } from "./format";

/**
 * Chip perubahan persen. `goodWhen` = "up" (mis. pemasukan) atau "down" (pengeluaran).
 * Warna mengikuti baik/buruk, bukan naik/turun — dan selalu ada ikon + teks.
 */
export default function DeltaChip({ value, goodWhen = "down", suffix }) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return <span className="ins-delta is-flat">Belum ada pembanding</span>;
    }
    const flat = Math.abs(value) < 1;
    const up = value > 0;
    const good = flat ? null : goodWhen === "up" ? up : !up;
    const Icon = flat ? FiMinus : up ? FiArrowUpRight : FiArrowDownRight;
    return (
        <span className={`ins-delta ${flat ? "is-flat" : good ? "is-good" : "is-bad"}`}>
            <Icon aria-hidden />
            {flat ? "Stabil" : pctLabel(value)}
            {suffix && <em>{suffix}</em>}
        </span>
    );
}
