import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatMoney, formatMoneyShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = [
  "#10b981",
  "#0d9488",
  "#34d399",
  "#84cc16",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#64748b",
];

type CategoryDatum = {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  percent: number;
  subs: Array<{ name: string; total: number }>;
};

/** Chart pengeluaran per kategori — bisa ditoggle donut / batang. */
export function CategoryChart({ data }: { data: CategoryDatum[] }) {
  const [mode, setMode] = useState<"donut" | "bar">("donut");
  const [hidden, setHidden] = useState<string[]>([]);
  const [showSubs, setShowSubs] = useState(false);

  const visible = data.filter(d => !hidden.includes(d.categoryId));
  const chartData = useMemo(() => {
    if (!showSubs)
      return visible.map(d => ({
        name: d.name,
        value: d.total,
        color: d.color,
      }));
    const rows: Array<{ name: string; value: number; color: string }> = [];
    for (const item of visible) {
      if (item.subs.length === 0) {
        rows.push({ name: item.name, value: item.total, color: item.color });
        continue;
      }
      for (const sub of item.subs)
        rows.push({
          name: `${item.name} › ${sub.name}`,
          value: sub.total,
          color: item.color,
        });
      const others =
        item.total - item.subs.reduce((sum, sub) => sum + sub.total, 0);
      if (others > 0)
        rows.push({
          name: `${item.name} (lain)`,
          value: others,
          color: item.color,
        });
    }
    return rows;
  }, [visible, showSubs]);

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Belum ada pengeluaran di periode ini
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {(["donut", "bar"] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                mode === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item === "donut" ? "Lingkaran" : "Batang"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant={showSubs ? "default" : "outline"}
          className="h-7 text-xs"
          onClick={() => setShowSubs(value => !value)}
        >
          Sub-kategori
        </Button>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {mode === "donut" ? (
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.color ||
                      FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatMoney(value),
                  name,
                ]}
              />
              <Legend
                formatter={value => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          ) : (
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 16 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={value => formatMoneyShort(Number(value))}
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                fontSize={11}
                tickLine={false}
              />
              <Tooltip formatter={(value: number) => formatMoney(value)} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.color ||
                      FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {data.map(item => (
          <button
            key={item.categoryId}
            type="button"
            onClick={() =>
              setHidden(prev =>
                prev.includes(item.categoryId)
                  ? prev.filter(id => id !== item.categoryId)
                  : [...prev, item.categoryId],
              )
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition",
              hidden.includes(item.categoryId)
                ? "opacity-40"
                : "hover:bg-muted/60",
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
            <span className="text-muted-foreground">
              {item.percent.toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

type TrendPoint = { label: string; total: number; income?: number };

/** Chart tren pengeluaran dengan toggle periode + garis rata-rata. */
export function TrendChart({
  daily,
  weekly,
  monthly,
}: {
  daily: TrendPoint[];
  weekly: TrendPoint[];
  monthly: TrendPoint[];
}) {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">(
    "weekly",
  );
  const data =
    period === "daily" ? daily : period === "weekly" ? weekly : monthly;
  const average =
    data.length > 0 ? data.reduce((s, d) => s + d.total, 0) / data.length : 0;

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border p-0.5">
        {(
          [
            ["daily", "Harian"],
            ["weekly", "Mingguan"],
            ["monthly", "Bulanan"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              period === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} />
            <YAxis
              fontSize={11}
              tickLine={false}
              tickFormatter={value => formatMoneyShort(Number(value))}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatMoney(value),
                name === "total" ? "Pengeluaran" : "Pemasukan",
              ]}
            />
            <ReferenceLine
              y={average}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: `rata-rata ${formatMoneyShort(average)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: "#64748b",
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
            {period === "monthly" && (
              <Line
                type="monotone"
                dataKey="income"
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Heatmap kalender 365 hari (mirip contribution graph GitHub). */
export function CalendarHeatmap({
  data,
  onSelectDate,
}: {
  data: Array<{ date: string; total: number; count: number }>;
  onSelectDate?: (date: string) => void;
}) {
  const max = Math.max(...data.map(d => d.total), 1);
  const level = (total: number) => {
    if (total <= 0) return 0;
    const ratio = total / max;
    if (ratio > 0.6) return 4;
    if (ratio > 0.35) return 3;
    if (ratio > 0.15) return 2;
    return 1;
  };
  const colors = ["#f1f5f9", "#d1fae5", "#6ee7b7", "#10b981", "#047857"];

  // Susun jadi kolom minggu (7 baris = hari Minggu..Sabtu).
  const weeks: Array<
    Array<{ date: string; total: number; count: number } | null>
  > = [];
  let current: Array<{ date: string; total: number; count: number } | null> =
    [];
  const firstDay = new Date(
    `${data[0]?.date ?? "2026-01-01"}T00:00:00Z`,
  ).getUTCDay();
  for (let i = 0; i < firstDay; i++) current.push(null);
  for (const day of data) {
    current.push(day);
    if (current.length === 7) {
      weeks.push(current);
      current = [];
    }
  }
  if (current.length) weeks.push(current);

  const monthLabels: Array<{ index: number; label: string }> = [];
  weeks.forEach((week, index) => {
    const first = week.find(Boolean);
    if (!first) return;
    const month = first.date.slice(5, 7);
    const prev = monthLabels[monthLabels.length - 1];
    const label = new Date(`${first.date}T00:00:00Z`).toLocaleDateString(
      "id-ID",
      {
        month: "short",
        timeZone: "UTC",
      },
    );
    if (!prev || prev.label !== label) {
      if (Number(month) && (!prev || index - prev.index >= 3))
        monthLabels.push({ index, label });
    }
  });

  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="relative mb-1 h-4 text-[10px] text-muted-foreground">
          {monthLabels.map(item => (
            <span
              key={`${item.label}-${item.index}`}
              className="absolute"
              style={{ left: `${item.index * 13}px` }}
            >
              {item.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-[3px]">
              {week.map((day, dayIndex) => (
                <button
                  key={day?.date ?? `empty-${weekIndex}-${dayIndex}`}
                  type="button"
                  disabled={!day}
                  onClick={() => day && onSelectDate?.(day.date)}
                  title={
                    day
                      ? `${day.date} — ${formatMoney(day.total)} (${day.count} transaksi)`
                      : ""
                  }
                  className="size-[10px] rounded-[2px] transition hover:ring-2 hover:ring-primary/40"
                  style={{
                    backgroundColor: day
                      ? colors[level(day.total)]
                      : "transparent",
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>Sedikit</span>
        {colors.map(color => (
          <span
            key={color}
            className="size-[10px] rounded-[2px]"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>Banyak</span>
      </div>
    </div>
  );
}

/** Bar perbandingan pemasukan vs pengeluaran (combo). */
export function CashflowChart({
  data,
}: {
  data: Array<{
    label: string;
    expense: number;
    income: number;
    leftover: number;
  }>;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={11} tickLine={false} />
          <YAxis
            fontSize={11}
            tickLine={false}
            tickFormatter={value => formatMoneyShort(Number(value))}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatMoney(value),
              name === "income"
                ? "Pemasukan"
                : name === "expense"
                  ? "Pengeluaran"
                  : "Sisa uang",
            ]}
          />
          <Legend
            formatter={value => (
              <span className="text-xs text-muted-foreground">
                {value === "income"
                  ? "Pemasukan"
                  : value === "expense"
                    ? "Pengeluaran"
                    : "Sisa uang"}
              </span>
            )}
          />
          <Bar dataKey="income" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          <Bar dataKey="expense" fill="#10b981" radius={[6, 6, 0, 0]} />
          <Line
            type="monotone"
            dataKey="leftover"
            stroke="#f59e0b"
            strokeWidth={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
