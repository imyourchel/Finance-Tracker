import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { formatRupiah } from "../../utils/format";

export default function PieChartComp({ data = [] }) {
    if (!data.length)
        return (
            <div
                style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "#94a3b8",
                    fontSize: "14px",
                }}
            >
                Belum ada data pengeluaran
            </div>
        );

    const chartData = data.map((item) => ({
        name: item.category?.name || "Lainnya",
        value: item.total,
        color: item.category?.color || "#94a3b8",
    }));

    return (
        <ResponsiveContainer width="100%" height={260}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    dataKey="value"
                    paddingAngle={3}
                >
                    {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(v) => [formatRupiah(v), "Total"]}
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
                />
                <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
