import { useMutation, useQuery } from "convex/react";
import { Archive, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { MoneyInput } from "@/components/finyu/MoneyInput";
import { GoalProgressBar, PageHeader, StatCard } from "@/components/finyu/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import { formatDateShort, formatMoney, formatMoneyShort } from "@/lib/format";
import { STATUS_LABEL } from "@/pages/SavingsPage";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const TYPE_LABEL: Record<string, string> = {
  deposit: "Setoran",
  withdrawal: "Penarikan",
  auto_allocate: "Auto-alokasi",
};

export function SavingsGoalPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const navigate = useNavigate();
  const goals = useQuery(api.savings.listGoals, {
    ...scopeArgs,
    includeArchived: true,
  });
  const goal = goals?.find(item => item.id === goalId);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState(0);
  const [deadline, setDeadline] = useState("");

  const transactions = useQuery(
    api.savings.goalTransactions,
    goalId
      ? {
          goalId: goalId as Id<"savingsGoals">,
          type:
            typeFilter === "all"
              ? undefined
              : (typeFilter as "deposit" | "withdrawal" | "auto_allocate"),
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }
      : "skip",
  );
  const updateGoal = useMutation(api.savings.updateGoal);
  const removeGoal = useMutation(api.savings.removeGoal);

  if (goals === undefined) {
    return <div className="h-40 animate-pulse rounded-xl bg-muted/60" />;
  }
  if (!goal) {
    return (
      <div className="space-y-4">
        <PageHeader title="Goal tidak ditemukan" />
        <Button asChild variant="outline">
          <Link to="/tabungan">
            <ArrowLeft className="size-4" />
            Kembali ke Tabungan
          </Link>
        </Button>
      </div>
    );
  }

  const monthly = new Map<string, number>();
  for (const tx of transactions ?? []) {
    if (tx.type === "withdrawal") continue;
    const key = tx.date.slice(0, 7);
    monthly.set(key, (monthly.get(key) ?? 0) + tx.amount);
  }
  const chartData = [...monthly.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total]) => ({ label: month.slice(5), total }));

  const openEdit = () => {
    setName(goal.name);
    setTargetAmount(goal.targetAmount);
    setDeadline(goal.deadline ?? "");
    setEditOpen(true);
  };

  const submitEdit = async () => {
    setSaving(true);
    try {
      await updateGoal({
        id: goal.id,
        name,
        targetAmount,
        deadline: deadline || null,
      });
      toast.success("Goal diperbarui");
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/tabungan">
            <ArrowLeft className="size-4" />
            Tabungan
          </Link>
        </Button>
        <PageHeader
          title={`${goal.icon} ${goal.name}`}
          description={goal.description || "Detail progres & riwayat mutasi"}
          actions={
            canEdit && (
              <>
                <Button variant="outline" onClick={openEdit}>
                  Edit goal
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void updateGoal({
                      id: goal.id,
                      isArchived: !goal.isArchived,
                    }).then(() =>
                      toast.success(
                        goal.isArchived ? "Goal diaktifkan" : "Goal diarsipkan",
                      ),
                    )
                  }
                >
                  <Archive className="size-4" />
                  {goal.isArchived ? "Aktifkan" : "Arsipkan"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Hapus permanen goal ini beserta seluruh riwayat mutasinya?",
                      )
                    ) {
                      void removeGoal({ id: goal.id }).then(() => {
                        toast.success("Goal dihapus");
                        navigate("/tabungan");
                      });
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  Hapus
                </Button>
              </>
            )
          }
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums">
                {formatMoney(goal.currentAmount)}
              </p>
              <p className="text-sm text-muted-foreground">
                dari target {formatMoney(goal.targetAmount)}
              </p>
            </div>
            <Badge className={STATUS_LABEL[goal.status]?.className}>
              {STATUS_LABEL[goal.status]?.label}
            </Badge>
          </div>
          <GoalProgressBar percent={goal.percent} />
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Progres" value={`${goal.percent.toFixed(0)}%`} />
            <StatCard
              label="Sisa"
              value={formatMoney(goal.remaining)}
              accent="amber"
            />
            <StatCard
              label="Deadline"
              value={goal.deadline ? formatDateShort(goal.deadline) : "—"}
              accent="sky"
              footer={
                goal.daysLeft !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {goal.daysLeft >= 0
                      ? `${goal.daysLeft} hari lagi`
                      : `terlambat ${Math.abs(goal.daysLeft)} hari`}
                  </p>
                ) : undefined
              }
            />
            <StatCard
              label="Rata-rata setoran"
              value={formatMoney(goal.avgDeposit)}
              footer={
                <p className="text-xs text-muted-foreground">
                  {goal.txCount} mutasi tercatat
                </p>
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tren setoran bulanan</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada setoran
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={value => formatMoneyShort(Number(value))}
                  />
                  <Tooltip formatter={(value: number) => formatMoney(value)} />
                  <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Riwayat mutasi</CardTitle>
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua jenis</SelectItem>
                <SelectItem value="deposit">Setoran</SelectItem>
                <SelectItem value="withdrawal">Penarikan</SelectItem>
                <SelectItem value="auto_allocate">Auto-alokasi</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
            />
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {(transactions ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada mutasi
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(transactions ?? []).map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateShort(tx.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABEL[tx.type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {tx.source || "-"}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-xs">
                      {tx.note || "-"}
                    </TableCell>
                    <TableCell
                      className={
                        tx.type === "withdrawal"
                          ? "text-right tabular-nums text-rose-600"
                          : "text-right tabular-nums text-emerald-600"
                      }
                    >
                      {tx.type === "withdrawal" ? "−" : "+"}
                      {formatMoney(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama goal</Label>
              <Input
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Target nominal</Label>
              <MoneyInput value={targetAmount} onChange={setTargetAmount} />
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <Input
                type="date"
                value={deadline}
                onChange={event => setDeadline(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitEdit()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
