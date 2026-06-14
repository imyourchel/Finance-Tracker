export default function ProgressBar({
    percentage = 0,
    color = "#4f46e5",
    height = 8,
    showLabel = false,
}) {
    const clamped = Math.min(percentage, 100);
    const barColor =
        percentage > 100 ? "#ef4444" : percentage >= 80 ? "#f59e0b" : color;

    return (
        <div>
            {showLabel && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "4px",
                    }}
                >
                    <span>Progress</span>
                    <span style={{ fontWeight: "600", color: barColor }}>
                        {percentage}%
                    </span>
                </div>
            )}
            <div
                style={{
                    height,
                    backgroundColor: "#f1f5f9",
                    borderRadius: height,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        borderRadius: height,
                        width: `${clamped}%`,
                        backgroundColor: barColor,
                        transition: "width 0.6s ease",
                    }}
                />
            </div>
        </div>
    );
}
