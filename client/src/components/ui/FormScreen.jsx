import { useEffect } from "react";
import { FiArrowLeft } from "react-icons/fi";

/** Tampilan form satu halaman penuh (pengganti modal pop-up). */
export default function FormScreen({ title, subtitle, backLabel = "Kembali", onClose, aside, children, width = 720 }) {
    useEffect(() => {
        document.querySelector("main")?.scrollTo({ top: 0 });
    }, []);

    return (
        <div className="fs-page" style={{ "--fs-width": `${width}px` }}>
            <button type="button" className="tx-back fs-back" onClick={onClose}>
                <FiArrowLeft aria-hidden /> {backLabel}
            </button>
            <h1 className="tx-title">{title}</h1>
            {subtitle && <p className="fs-sub">{subtitle}</p>}
            <div className={`fs-layout ${aside ? "has-aside" : ""}`}>
                <div className="fs-card">{children}</div>
                {aside && <aside className="fs-aside">{aside}</aside>}
            </div>
        </div>
    );
}
