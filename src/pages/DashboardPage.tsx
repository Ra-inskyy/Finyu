import { useQuery } from "convex/react";
import {
  ArrowRight,
  CalendarDays,
  MessageCircle,
  PiggyBank,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarHeatmap,
  CategoryChart,
  TrendChart,
} from "@/components/finyu/charts";
import { TransactionDialog } from "@/components/finyu/TransactionDialog";
import {
  DeltaBadge,
  EmptyBox,
  GoalProgressBar,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  StatCard,
} from "@/components/finyu/ui";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import {
  addMonths,
  formatDateShort,
  formatMoney,
  monthISO,
  monthLabel,
} from "@/lib/format";
import { api } from "../../convex/_generated/api";

export function DashboardPage() {
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const [month, setMonth] = useState(monthISO());
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();
  const data = useQuery(api.dashboard.summary, { ...scopeArgs, month });

  if (!data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Dashboard"
          description="Memuat ringkasan keuangan…"
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        title="Dashboard"
        description={`Ringkasan keuangan ${monthLabel(month)}`}
        actions={
          <>
            <div className="inline-flex items-center gap-1 rounded-lg border p-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                ←
              </Button>
              <span className="px-1 text-xs font-medium">
                {monthLabel(month)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                disabled={month >= monthISO()}
                onClick={() => setMonth(addMonths(month, 1))}
              >
                →
              </Button>
            </div>
            {canEdit && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Tambah pengeluaran
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pengeluaran bulan ini"
          value={formatMoney(data.expense.total)}
          icon={<TrendingDown className="size-4" />}
          accent="rose"
          footer={
            <div className="space-y-1">
              <DeltaBadge percent={data.expense.deltaPercent} />
              <p className="text-xs text-muted-foreground">
                {data.expense.count} transaksi · rata-rata{" "}
                {formatMoney(data.expense.dailyAverage)}/hari
              </p>
            </div>
          }
          onClick={() => navigate("/pengeluaran")}
        />
        <StatCard
          label="Pemasukan bulan ini"
          value={formatMoney(data.income.total)}
          icon={<TrendingUp className="size-4" />}
          accent="sky"
          footer={
            <div className="space-y-1">
              <DeltaBadge percent={data.income.deltaPercent} invert />
              <p className="text-xs text-muted-foreground">
                {data.income.count} transaksi
              </p>
            </div>
          }
          onClick={() => navigate("/pemasukan")}
        />
        <StatCard
          label="Sisa uang bulan ini"
          value={formatMoney(data.leftover.total)}
          icon={<Wallet className="size-4" />}
          accent={data.leftover.total >= 0 ? "primary" : "rose"}
          footer={
            <p className="text-xs text-muted-foreground">
              Bulan lalu {formatMoney(data.leftover.prevTotal)}
            </p>
          }
        />
        <StatCard
          label="Saldo tabungan"
          value={formatMoney(data.savings.total)}
          icon={<PiggyBank className="size-4" />}
          footer={
            <p className="text-xs text-muted-foreground">
              {data.savings.goalCount} goal aktif
            </p>
          }
          onClick={() => navigate("/tabungan")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Pengeluaran per kategori
            </CardTitle>
            <CardDescription>
              {monthLabel(month)} · total {formatMoney(data.expense.total)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={data.categoryBreakdown} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Goal tabungan</CardTitle>
              <CardDescription>Top 3 progres</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tabungan">
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.savings.topGoals.length === 0 ? (
              <EmptyBox
                icon={<Target className="size-5" />}
                title="Belum ada target tabungan"
                description="Buat target pertama supaya progresnya bisa dipantau."
                action={
                  <Button size="sm" asChild>
                    <Link to="/tabungan">Buat Target Tabungan</Link>
                  </Button>
                }
              />
            ) : (
              data.savings.topGoals.map(goal => (
                <Link
                  key={goal.id}
                  to={`/tabungan/${goal.id}`}
                  className="block space-y-1.5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {goal.percent.toFixed(0)}%
                    </span>
                  </div>
                  <GoalProgressBar percent={goal.percent} />
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(goal.currentAmount)} dari{" "}
                    {formatMoney(goal.targetAmount)} · sisa{" "}
                    {formatMoney(goal.remaining)}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tren pengeluaran</CardTitle>
            <CardDescription>
              Harian, mingguan, atau bulanan — dengan garis rata-rata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              daily={data.trend.daily}
              weekly={data.trend.weekly}
              monthly={data.trend.monthly}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Anggaran vs realisasi</CardTitle>
            <CardDescription>
              5 kategori dengan anggaran terbesar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.budgetComparison.length === 0 ? (
              <EmptyBox
                title="Belum ada anggaran"
                description="Tetapkan batas bulanan per kategori."
                action={
                  <Button size="sm" asChild>
                    <Link to="/anggaran">Atur anggaran</Link>
                  </Button>
                }
              />
            ) : (
              data.budgetComparison.map(item => (
                <div key={item.categoryId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {formatMoney(item.spent)} / {formatMoney(item.budget)} (
                      {(item.ratio * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <ProgressBar ratio={item.ratio} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            Heatmap pengeluaran harian
          </CardTitle>
          <CardDescription>
            365 hari terakhir — klik tanggal untuk lihat transaksinya
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CalendarHeatmap
            data={data.heatmap}
            onSelectDate={date => navigate(`/pengeluaran?tanggal=${date}`)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Transaksi terbaru</CardTitle>
              <CardDescription>6 catatan terakhir</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pengeluaran">
                Semua <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recent.length === 0 ? (
              <EmptyBox
                icon={<Plus className="size-5" />}
                title="Belum ada transaksi"
                description="Catat pengeluaran pertamamu, cuma butuh beberapa detik."
                action={
                  canEdit && (
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      Tambah Pengeluaran Pertama
                    </Button>
                  )
                }
              />
            ) : (
              data.recent.map(tx => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="size-8 shrink-0 rounded-lg"
                      style={{
                        backgroundColor: `${tx.categoryColor ?? "#10b981"}22`,
                        border: `1px solid ${tx.categoryColor ?? "#10b981"}55`,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tx.categoryName ?? "Transfer"}
                        {tx.source === "whatsapp" && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                            <MessageCircle className="size-2.5" /> WA
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateShort(tx.date)}
                        {tx.note ? ` · ${tx.note}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      tx.kind === "income"
                        ? "text-sm font-semibold tabular-nums text-emerald-600"
                        : "text-sm font-semibold tabular-nums text-rose-600"
                    }
                  >
                    {tx.kind === "income" ? "+" : "−"}
                    {formatMoney(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Saldo dompet</CardTitle>
            <CardDescription>Kas, bank & e-wallet</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.walletBalances.map(wallet => (
              <div
                key={wallet.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: wallet.color }}
                  />
                  {wallet.name}
                </span>
                <span className="text-sm tabular-nums">
                  {formatMoney(wallet.balance)}
                </span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/dompet">Kelola dompet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 lg:hidden"
          aria-label="Tambah pengeluaran"
        >
          <Plus className="size-6" />
        </button>
      )}

      <TransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        kind="expense"
      />
    </div>
  );
}
