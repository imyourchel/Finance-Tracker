/** Toggle on/off bertema — pengganti checkbox untuk pengaturan. */
export default function Switch({ checked, onChange, label, description, id }) {
    return (
        <label className="switch-row" htmlFor={id}>
            <span className="switch-text">
                <span className="switch-label">{label}</span>
                {description && (
                    <span className="switch-desc">{description}</span>
                )}
            </span>
            <span className="switch">
                <input
                    id={id}
                    type="checkbox"
                    role="switch"
                    checked={Boolean(checked)}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <span className="switch-track" aria-hidden>
                    <span className="switch-thumb" />
                </span>
            </span>
        </label>
    );
}
