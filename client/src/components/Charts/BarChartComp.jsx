import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { formatRupiah, MONTHS } from "../../utils/format";

export default function BarChartComp({ data = [], month, year }) {
    // Ubah format data dari MongoDB aggregation ke format Recharts
    const map = {};
    data.forEach(({ _id, total }) => {
        const d = _id.day;
        if (!map[d]) map[d] = { day: `${d}`, income: 0, expense: 0 };
        map[d][_id.type] = total;
    });
    const chartData = Object.values(map).sort(
        (a, b) => Number(a.day) - Number(b.day),
    );

    if (!chartData.length)
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "#94a3b8",
                    fontSize: "14px",
                }}
            >
                Belum ada data
            </div>
        );

    return (
        <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} barSize={6} barGap={2}>
                <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    vertical={false}
                />
                <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip
                    cursor={{
                        fill: "transparent",
                        stroke: "rgba(148, 163, 184, 0.45)",
                        strokeWidth: 1,
                    }}
                    formatter={(v, name) => [
                        formatRupiah(v),
                        name === "income" ? "Pemasukan" : "Pengeluaran",
                    ]}
                    contentStyle={{
                        backgroundColor: "var(--app-surface)",
                        borderRadius: "8px",
                        border: "1px solid var(--app-border)",
                        boxShadow: "0 8px 20px rgba(2,6,23,0.4)",
                        padding: "8px 10px",
                        color: "var(--app-text-strong)",
                    }}
                    itemStyle={{
                        color: "var(--app-text-strong)",
                        fontWeight: 700,
                    }}
                    labelStyle={{ color: "var(--app-muted)" }}
                    labelFormatter={(label) => {
                        // label is day number (string or number)
                        const day = Number(label);
                        const m = month || new Date().getMonth() + 1;
                        const y = year || new Date().getFullYear();
                        const monthName = MONTHS[(m || 1) - 1] || "";
                        return `${day} ${monthName} ${y}`;
                    }}
                />
                <Bar
                    dataKey="income"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    name="income"
                />
                <Bar
                    dataKey="expense"
                    fill="#f87171"
                    radius={[4, 4, 0, 0]}
                    name="expense"
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
