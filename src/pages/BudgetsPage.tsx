import { useMutation, useQuery } from "convex/react";
import { Copy, PieChart, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MoneyInput } from "@/components/finyu/MoneyInput";
import {
  EmptyBox,
  PageHeader,
  ProgressBar,
  StatCard,
} from "@/components/finyu/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import {
  addMonths,
  formatMoney,
  formatMoneyShort,
  monthISO,
  monthLabel,
} from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  safe: { label: "Aman", className: "bg-emerald-500/15 text-emerald-700" },
  warning: {
    label: "Hampir habis",
    className: "bg-amber-500/15 text-amber-700",
  },
  over: { label: "Terlampaui", className: "bg-rose-500/15 text-rose-700" },
};

export function BudgetsPage() {
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const [month, setMonth] = useState(monthISO());
  const [formOpen, setFormOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState(0);

  const data = useQuery(api.budgets.listByMonth, { ...scopeArgs, month });
  const history = useQuery(api.budgets.history, { ...scopeArgs, month });
  const categories = useQuery(api.categories.list, {
    ...scopeArgs,
    kind: "expense",
  });
  const upsert = useMutation(api.budgets.upsert);
  const remove = useMutation(api.budgets.remove);
  const copyPrev = useMutation(api.budgets.copyFromPreviousMonth);

  const availableCategories = (categories ?? []).filter(
    cat =>
      !cat.parentId &&
      !cat.isArchived &&
      !(data?.rows ?? []).some(row => row.categoryId === cat.id),
  );

  const submit = async () => {
    if (!categoryId) {
      toast.error("Pilih kategori dulu");
      return;
    }
    if (amount <= 0) {
      toast.error("Nominal anggaran harus lebih dari 0");
      return;
    }
    await upsert({
      ...scopeArgs,
      categoryId: categoryId as Id<"categories">,
      month,
      amount,
    });
    toast.success("Anggaran disimpan");
    setFormOpen(false);
    setCategoryId("");
    setAmount(0);
  };

  const ratio =
    data && data.totalBudget > 0 ? data.totalSpent / data.totalBudget : 0;

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Anggaran & Perencanaan"
        description="Tetapkan batas pengeluaran bulanan per kategori"
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
                onClick={() => setMonth(addMonths(month, 1))}
              >
                →
              </Button>
            </div>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyPrev({ ...scopeArgs, month }).then(result =>
                      toast.success(
                        result.copied > 0
                          ? `${result.copied} anggaran disalin dari bulan lalu`
                          : "Tidak ada anggaran baru untuk disalin",
                      ),
                    )
                  }
                >
                  <Copy className="size-4" />
                  Salin bulan lalu
                </Button>
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="size-4" />
                  Tetapkan anggaran
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total anggaran"
          value={formatMoney(data?.totalBudget ?? 0)}
          icon={<PieChart className="size-4" />}
        />
        <StatCard
          label="Realisasi"
          value={formatMoney(data?.totalSpent ?? 0)}
          accent={ratio >= 1 ? "rose" : ratio >= 0.8 ? "amber" : "primary"}
          footer={
            <p className="text-xs text-muted-foreground">
              {(ratio * 100).toFixed(0)}% dari total anggaran
            </p>
          }
        />
        <StatCard
          label="Sisa anggaran"
          value={formatMoney(
            (data?.totalBudget ?? 0) - (data?.totalSpent ?? 0),
          )}
          accent="sky"
        />
      </div>

      {data && data.rows.length === 0 ? (
        <EmptyBox
          icon={<PieChart className="size-5" />}
          title={`Belum ada anggaran untuk ${monthLabel(month)}`}
          description="Tetapkan batas bulanan per kategori supaya pengeluaranmu lebih terkontrol. Sistem akan memberi peringatan di 80% dan 100%."
          action={
            canEdit && (
              <Button onClick={() => setFormOpen(true)}>
                Tetapkan anggaran
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(data?.rows ?? []).map(row => (
            <Card key={row.id}>
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-8 rounded-lg"
                      style={{ backgroundColor: `${row.categoryColor}22` }}
                    />
                    <div>
                      <p className="text-sm font-medium">{row.categoryName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(row.spent)} / {formatMoney(row.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={STATUS_BADGE[row.status].className}>
                      {STATUS_BADGE[row.status].label}
                    </Badge>
                    {canEdit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground"
                        onClick={() =>
                          void remove({ id: row.id }).then(() =>
                            toast.success("Anggaran dihapus"),
                          )
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <ProgressBar ratio={row.ratio} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{(row.ratio * 100).toFixed(0)}% terpakai</span>
                  <span>
                    {row.remaining >= 0
                      ? `sisa ${formatMoney(row.remaining)}`
                      : `lewat ${formatMoney(Math.abs(row.remaining))}`}
                  </span>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setCategoryId(row.categoryId);
                      setAmount(row.amount);
                      setFormOpen(true);
                    }}
                  >
                    Ubah nominal
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Rencana vs realisasi (6 bulan)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={11} tickLine={false} />
                <YAxis
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={value => formatMoneyShort(Number(value))}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatMoney(value),
                    name === "budget" ? "Anggaran" : "Realisasi",
                  ]}
                />
                <Legend
                  formatter={value => (
                    <span className="text-xs text-muted-foreground">
                      {value === "budget" ? "Anggaran" : "Realisasi"}
                    </span>
                  )}
                />
                <Bar dataKey="budget" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="actual" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tetapkan anggaran</DialogTitle>
            <DialogDescription>
              Anggaran berlaku untuk {monthLabel(month)}. Peringatan otomatis
              dikirim saat pemakaian 80% dan 100%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ...availableCategories,
                    ...(categoryId &&
                    !availableCategories.some(c => c.id === categoryId)
                      ? (categories ?? []).filter(c => c.id === categoryId)
                      : []),
                  ].map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nominal anggaran per bulan</Label>
              <MoneyInput value={amount} onChange={setAmount} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submit()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
