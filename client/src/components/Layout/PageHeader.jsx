// Header standar tiap halaman
export default function PageHeader({ title, subtitle, action }) {
    return (
        <div className="page-header">
            <div>
                <h1 className="title">{title}</h1>
                {subtitle && <p className="subtitle">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}
