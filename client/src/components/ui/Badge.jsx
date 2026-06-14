export default function Badge({
    children,
    color = "#4f46e5",
    bg,
    size = "sm",
}) {
    const bg_ = bg || color + "18";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: size === "sm" ? "3px 8px" : "5px 12px",
                backgroundColor: bg_,
                color,
                borderRadius: "20px",
                fontSize: size === "sm" ? "11px" : "13px",
                fontWeight: "600",
            }}
        >
            {children}
        </span>
    );
}
