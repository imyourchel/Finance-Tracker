import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

import { registerConfirmHost } from "../../utils/confirm";

/** Tempat dialog konfirmasi dirender (dipasang sekali di App). */
export default function ConfirmHost() {
    const [req, setReq] = useState(null);
    const confirmRef = useRef(null);

    useEffect(() => registerConfirmHost(setReq), []);

    const answer = (ok) => {
        req?.resolve(ok);
        setReq(null);
    };

    useEffect(() => {
        if (!req) return;
        confirmRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") answer(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [req]);

    if (!req) return null;
    const danger = req.danger !== false;

    return createPortal(
        <div className="cd-overlay" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
            <div className="cd-box" role="alertdialog" aria-modal="true" aria-labelledby="cd-title">
                <div className={`cd-icon ${danger ? "is-danger" : ""}`}>
                    {danger ? <FiAlertTriangle aria-hidden /> : <FiInfo aria-hidden />}
                </div>
                <h2 id="cd-title">{req.title}</h2>
                {req.message && <p>{req.message}</p>}
                <div className="cd-actions">
                    {!req.alertOnly && (
                        <button type="button" className="btn-ghost" onClick={() => answer(false)}>
                            {req.cancelLabel || "Batal"}
                        </button>
                    )}
                    <button
                        ref={confirmRef}
                        type="button"
                        className={`btn-primary ${danger ? "is-danger" : ""}`}
                        onClick={() => answer(true)}
                    >
                        {req.confirmLabel || "Ya, lanjutkan"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
