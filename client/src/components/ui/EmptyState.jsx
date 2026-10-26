import { Link } from "react-router-dom";
import { personaById } from "../../utils/personas";
import "../../styles/empty.css";

/**
 * Tampilan kosong yang ramah: ikon atau maskot, satu kalimat penjelasan, dan aksi utama.
 * action / secondary: { label, to } atau { label, onClick }, opsional { icon }.
 */
export default function EmptyState({
    icon: Icon,
    mascot,
    title,
    description,
    action,
    secondary,
    size = "md",
    framed = false,
    className = "",
}) {
    const persona = mascot ? personaById(mascot) : null;
    return (
        <div className={`es es-${size} ${framed ? "is-framed" : ""} ${className}`}>
            {persona ? (
                <img className="es-mascot" src={persona.image} alt="" />
            ) : Icon ? (
                <span className="es-icon" aria-hidden>
                    <Icon />
                </span>
            ) : null}
            {title && <strong className="es-title">{title}</strong>}
            {description && <p className="es-desc">{description}</p>}
            {(action || secondary) && (
                <div className="es-actions">
                    {secondary && <EsButton a={secondary} variant="ghost" />}
                    {action && <EsButton a={action} variant="primary" />}
                </div>
            )}
        </div>
    );
}

function EsButton({ a, variant }) {
    const Icon = a.icon;
    const body = (
        <>
            {Icon && <Icon aria-hidden />}
            {a.label}
        </>
    );
    if (a.to) {
        return (
            <Link to={a.to} className={`es-btn is-${variant}`} state={a.state}>
                {body}
            </Link>
        );
    }
    return (
        <button type="button" className={`es-btn is-${variant}`} onClick={a.onClick}>
            {body}
        </button>
    );
}
