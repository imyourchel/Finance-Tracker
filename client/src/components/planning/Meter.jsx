/**
 * Bar progres bertema untuk Budget & Goals.
 * - value: persen terisi (boleh > 100, akan dipotong)
 * - ghost: persen bayangan (mis. proyeksi akhir bulan)
 * - marker: posisi garis penanda (mis. "seharusnya sampai sini hari ini")
 * - ticks: daftar { at, done, label } untuk milestone
 */
export default function Meter({ value = 0, ghost, marker, markerLabel, ticks, tone = "accent", color, height = 10, label }) {
    const clamp = (n) => Math.max(0, Math.min(100, n || 0));
    return (
        <div
            className={`pl-meter tone-${tone}`}
            style={{ "--h": `${height}px`, ...(color ? { "--fill": color } : null) }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamp(value))}
            aria-label={label}
        >
            <div className="pl-meter-track">
                {ghost > value && <span className="pl-meter-ghost" style={{ width: `${clamp(ghost)}%` }} />}
                <span className="pl-meter-fill" style={{ width: `${clamp(value)}%` }} />
                {marker != null && marker > 0 && marker < 100 && (
                    <span className="pl-meter-marker" style={{ left: `${marker}%` }} title={markerLabel} />
                )}
                {ticks?.map((t) => (
                    <span
                        key={t.at}
                        className={`pl-meter-tick ${t.done ? "is-done" : ""}`}
                        style={{ left: `${t.at}%` }}
                        title={t.label}
                    />
                ))}
            </div>
        </div>
    );
}
