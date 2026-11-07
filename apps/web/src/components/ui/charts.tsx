import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact } from "@/lib/money";

export const CHART_COLORS = ["#0d7a6f", "#9a6300", "#1f5f8b", "#6b7470", "#b42318", "#c9b458"];

const axisProps = {
  stroke: "#d6d2c8",
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 13, fill: "#6b7470" },
} as const;

export function VolumeChart({
  data,
  height = 280,
}: {
  data: { label: string; volume: string; count: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d7a6f" stopOpacity={0.16} />
            <stop offset="100%" stopColor="#0d7a6f" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eceae4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} tickMargin={8} minTickGap={24} />
        {/* Axis ticks are unit-free — the USDT unit lives in the tooltip + card title */}
        <YAxis {...axisProps} width={52} tickFormatter={(v: number) => fmtCompact(String(v), "")} />
        <Tooltip
          formatter={((v: unknown, name: unknown) =>
            name === "volume"
              ? [fmtCompact(String(v ?? "0")), "Volume"]
              : [String(v ?? "0"), "Payments"]) as never}
          contentStyle={{ fontSize: 16, borderRadius: 10, border: "1px solid #e7e4dd", boxShadow: "0 8px 24px rgba(27,31,30,0.08)" }}
        />
        <Area
          type="monotone"
          dataKey="volume"
          stroke="#0d7a6f"
          strokeWidth={2}
          fill="url(#volumeFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StackedBarChart({
  data,
  keys,
  height = 250,
  labels,
}: {
  data: Record<string, string | number>[];
  keys: string[];
  height?: number;
  labels: Record<string, string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke="#eceae4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 16, borderRadius: 10, border: "1px solid #e7e4dd", boxShadow: "0 8px 24px rgba(27,31,30,0.08)" }} />
        <Legend wrapperStyle={{ fontSize: 16 }} iconType="circle" iconSize={7} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} name={labels[k] ?? k} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 250,
}: {
  data: { name: string; value: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 16, borderRadius: 10, border: "1px solid #e7e4dd", boxShadow: "0 8px 24px rgba(27,31,30,0.08)" }} />
        <Legend wrapperStyle={{ fontSize: 16 }} iconType="circle" iconSize={7} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendLineChart({
  data,
  dataKey,
  label,
  height = 250,
  color = "#0d7a6f",
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  label: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eceae4" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 16, borderRadius: 10, border: "1px solid #e7e4dd", boxShadow: "0 8px 24px rgba(27,31,30,0.08)" }} />
        <Line
          type="monotone"
          dataKey={dataKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          dot={{ r: 2.5, fill: color }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBars({
  data,
  height = 250,
}: {
  data: { name: string; value: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#eceae4" horizontal={false} />
        <XAxis type="number" {...axisProps} tickFormatter={(v: number) => fmtCompact(String(v), "")} tickMargin={8} />
        <YAxis type="category" dataKey="name" {...axisProps} width={110} />
        <Tooltip
          formatter={((v: unknown) => [`${fmtCompact(String(v ?? "0"))}`, "Collected"]) as never}
          contentStyle={{ fontSize: 16, borderRadius: 10, border: "1px solid #e7e4dd", boxShadow: "0 8px 24px rgba(27,31,30,0.08)" }}
        />
        <Bar dataKey="value" fill="#0d7a6f" radius={[0, 3, 3, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
