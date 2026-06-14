// Komponen card reusable — bisa dipakai di semua halaman
export default function Card({ children, style = {}, padding = "20px" }) {
    return (
        <div className="ui-card" style={{ padding, ...style }}>
            {children}
        </div>
    );
}
