import { formatRupiah } from "../../utils/format";
import { CATEGORY_ICONS } from "../../utils/categoryIcons";
import { FiTag, FiPieChart } from "react-icons/fi";
import DeltaChip from "./DeltaChip";
import EmptyState from "../ui/EmptyState";

/** Daftar kategori pengeluaran: porsi, nominal, dan perubahan vs periode pembanding. */
export default function CategoryList({ items = [], compareLabel = "bulan lalu", limit = 6 }) {
    const list = items.filter((c) => c.total > 0).slice(0, limit);
    if (!list.length)
        return (
            <EmptyState
                size="sm"
                icon={FiPieChart}
                title="Belum ada pengeluaran"
                description="Kategori terbesar dan perubahannya muncul setelah kamu mencatat pengeluaran."
            />
        );
    const max = Math.max(...list.map((c) => c.total));
    return (
        <ul className="ins-cats">
            {list.map((c) => {
                const Icon = CATEGORY_ICONS[c.icon] || FiTag;
                return (
                    <li key={c.id}>
                        <span className="ins-cat-icon" style={{ "--cat": c.color }}>
                            <Icon aria-hidden />
                        </span>
                        <div className="ins-cat-body">
                            <div className="ins-cat-top">
                                <span className="ins-cat-name">{c.name}</span>
                                <strong>{formatRupiah(c.total)}</strong>
                            </div>
                            <div className="ins-cat-bar" aria-hidden>
                                <span style={{ width: `${Math.max(3, (c.total / max) * 100)}%`, background: c.color }} />
                            </div>
                            <div className="ins-cat-meta">
                                <span>{Math.round(c.share)}% dari pengeluaran</span>
                                <DeltaChip value={c.changePct} goodWhen="down" suffix={`vs ${compareLabel}`} />
                            </div>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
