import { formatRupiah } from "../../utils/format";

/**
 * Tooltip grafik bertema. `rows` = fungsi (payload) → [{label, value, color?, muted?}]
 */
export default function ChartTooltip({ active, payload, label, title, rows }) {
    if (!active || !payload?.length) return null;
    const items = rows
        ? rows(payload[0].payload, payload)
        : payload.map((p) => ({ label: p.name, value: formatRupiah(p.value), color: p.color }));
    return (
        <div className="ins-tip">
            <div className="ins-tip-title">{title ? title(payload[0].payload, label) : label}</div>
            {items.filter(Boolean).map((it) => (
                <div key={it.label} className={`ins-tip-row ${it.muted ? "is-muted" : ""}`}>
                    <span>
                        {it.color && <i style={{ background: it.color }} />}
                        {it.label}
                    </span>
                    <strong>{it.value}</strong>
                </div>
            ))}
        </div>
    );
}
