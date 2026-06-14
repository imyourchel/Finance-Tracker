// Overlay modal reusable
export default function Modal({
    children,
    onClose,
    title,
    maxWidth = "480px",
}) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(15,23,42,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 100,
                padding: "16px",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    backgroundColor: "var(--app-surface)",
                    borderRadius: "16px",
                    width: "100%",
                    maxWidth,
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                    border: "1px solid var(--app-border)",
                }}
            >
                {/* Header modal */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "20px 24px",
                        borderBottom: "1px solid var(--app-border)",
                        position: "sticky",
                        top: 0,
                        backgroundColor: "var(--app-surface)",
                        zIndex: 1,
                    }}
                >
                    <h2
                        style={{
                            margin: 0,
                            fontSize: "18px",
                            fontWeight: "700",
                            color: "var(--app-text-strong)",
                        }}
                    >
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            border: "none",
                            backgroundColor: "var(--app-surface-soft)",
                            cursor: "pointer",
                            fontSize: "18px",
                            color: "var(--app-muted)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ×
                    </button>
                </div>
                <div style={{ padding: "24px" }}>{children}</div>
            </div>
        </div>
    );
}
