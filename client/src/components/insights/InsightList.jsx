import { FiAlertTriangle, FiCheckCircle, FiInfo, FiZap } from "react-icons/fi";
import EmptyState from "../ui/EmptyState";
import { openQuickAdd } from "../../utils/quickAddBus";

const ICON = { warn: FiAlertTriangle, good: FiCheckCircle, info: FiInfo };

/** Kartu-kartu insight otomatis dari server. */
export default function InsightList({ items = [] }) {
    if (!items.length) {
        return (
            <EmptyState
                size="sm"
                icon={FiZap}
                title="Insight sedang menunggu catatanmu"
                description="Setelah beberapa transaksi tercatat, DailyTrack menunjukkan pola dan perubahan penting di sini."
                action={{ label: "Catat transaksi", onClick: openQuickAdd }}
            />
        );
    }
    return (
        <ul className="ins-insights">
            {items.map((i) => {
                const Icon = ICON[i.tone] || FiInfo;
                return (
                    <li key={i.id} className={`is-${i.tone}`}>
                        <span className="ins-insight-icon">
                            <Icon aria-hidden />
                        </span>
                        <div>
                            <strong>{i.title}</strong>
                            <p>{i.detail}</p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
