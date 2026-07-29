import { useMutation, useQuery } from "convex/react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Loader2,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MoneyInput } from "@/components/finyu/MoneyInput";
import {
  EmptyBox,
  GoalProgressBar,
  PageHeader,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import { formatMoney, todayISO } from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const GOAL_ICONS = ["🏖️", "🚨", "📱", "🏠", "🚗", "🎓", "💍", "💼", "🐷", "🎁"];
const GOAL_COLORS = [
  "#10b981",
  "#0d9488",
  "#0ea5e9",
  "#84cc16",
  "#f59e0b",
  "#8b5cf6",
];

export const STATUS_LABEL: Record<
  string,
  { label: string; className: string }
> = {
  achieved: {
    label: "Tercapai",
    className: "bg-emerald-500/15 text-emerald-700",
  },
  on_track: { label: "On Track", className: "bg-sky-500/15 text-sky-700" },
  behind: { label: "Behind", className: "bg-amber-500/15 text-amber-700" },
  overdue: { label: "Overdue", className: "bg-rose-500/15 text-rose-700" },
};

export function SavingsPage() {
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const goals = useQuery(api.savings.listGoals, scopeArgs);
  const createGoal = useMutation(api.savings.createGoal);
  const deposit = useMutation(api.savings.deposit);
  const withdraw = useMutation(api.savings.withdraw);
  const runAuto = useMutation(api.savings.runAutoAllocation);

  const [formOpen, setFormOpen] = useState(false);
  const [mutationTarget, setMutationTarget] = useState<{
    goalId: Id<"savingsGoals">;
    name: string;
    type: "deposit" | "withdraw";
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Form goal baru
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState(0);
  const [initialAmount, setInitialAmount] = useState(0);
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [autoType, setAutoType] = useState<"none" | "percent" | "fixed">(
    "none",
  );
  const [autoValue, setAutoValue] = useState(0);
  const [reminder, setReminder] = useState<
    "none" | "daily" | "weekly" | "monthly"
  >("none");
  const [reminderTime, setReminderTime] = useState("08:00");
  const [reminderWa, setReminderWa] = useState(false);

  // Form setor/tarik
  const [mutationAmount, setMutationAmount] = useState(0);
  const [mutationDate, setMutationDate] = useState(todayISO());
  const [mutationSource, setMutationSource] = useState("kas");
  const [mutationNote, setMutationNote] = useState("");

  const totalSaved = (goals ?? []).reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = (goals ?? []).reduce((s, g) => s + g.targetAmount, 0);
  const achieved = (goals ?? []).filter(g => g.status === "achieved").length;

  const submitGoal = async () => {
    setSaving(true);
    try {
      await createGoal({
        ...scopeArgs,
        name,
        targetAmount,
        deadline: deadline || undefined,
        description: description || undefined,
        icon,
        color,
        autoAllocateType: autoType,
        autoAllocateValue: autoValue,
        autoAllocateActive: autoType !== "none",
        reminderFrequency: reminder,
        reminderTime,
        reminderViaWa: reminderWa,
        initialAmount: initialAmount || undefined,
      });
      toast.success("Goal tabungan dibuat");
      setFormOpen(false);
      setName("");
      setTargetAmount(0);
      setInitialAmount(0);
      setDeadline("");
      setDescription("");
      setAutoType("none");
      setAutoValue(0);
      setReminder("none");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat goal",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitMutation = async () => {
    if (!mutationTarget) return;
    setSaving(true);
    try {
      if (mutationTarget.type === "deposit") {
        await deposit({
          goalId: mutationTarget.goalId,
          amount: mutationAmount,
          date: mutationDate,
          source: mutationSource,
          note: mutationNote || undefined,
        });
        toast.success("Setoran dicatat");
      } else {
        if (!mutationNote.trim()) {
          toast.error("Alasan penarikan wajib diisi");
          setSaving(false);
          return;
        }
        await withdraw({
          goalId: mutationTarget.goalId,
          amount: mutationAmount,
          date: mutationDate,
          source: mutationSource,
          note: mutationNote,
        });
        toast.success("Penarikan dicatat");
      }
      setMutationTarget(null);
      setMutationAmount(0);
      setMutationNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const triggerAutoAllocation = async () => {
    try {
      const result = await runAuto(scopeArgs);
      if (result.allocated <= 0) {
        toast.info(
          `Tidak ada dana untuk dialokasikan (${result.basis}: ${formatMoney(result.surplus)}).`,
        );
      } else {
        toast.success(
          `${formatMoney(result.allocated)} dialokasikan ke ${result.results.length} goal dari ${result.basis}.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menjalankan");
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Tabungan"
        description="Kelola target tabungan, setoran, dan auto-alokasi"
        actions={
          canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => void triggerAutoAllocation()}
              >
                <Wand2 className="size-4" />
                Jalankan auto-alokasi
              </Button>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="size-4" />
                Buat goal
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total saldo tabungan"
          value={formatMoney(totalSaved)}
          icon={<PiggyBank className="size-4" />}
        />
        <StatCard
          label="Total target"
          value={formatMoney(totalTarget)}
          icon={<Target className="size-4" />}
          accent="sky"
          footer={
            <p className="text-xs text-muted-foreground">
              {totalTarget > 0
                ? `${((totalSaved / totalTarget) * 100).toFixed(0)}% dari semua target`
                : "Belum ada target"}
            </p>
          }
        />
        <StatCard
          label="Goal tercapai"
          value={`${achieved} / ${(goals ?? []).length}`}
          icon={<Sparkles className="size-4" />}
          accent="amber"
        />
      </div>

      {goals === undefined ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyBox
          icon={<Target className="size-5" />}
          title="Belum ada goal tabungan"
          description="Buat target pertamamu — misalnya Dana Darurat, Liburan, atau Modal Usaha."
          action={
            canEdit && (
              <Button onClick={() => setFormOpen(true)}>
                Buat Goal Pertama
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {goals.map(goal => (
            <Card key={goal.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-10 items-center justify-center rounded-xl text-lg"
                      style={{ backgroundColor: `${goal.color}1f` }}
                    >
                      {goal.icon}
                    </span>
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          to={`/tabungan/${goal.id}`}
                          className="hover:underline"
                        >
                          {goal.name}
                        </Link>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {goal.deadline
                          ? `Deadline ${goal.deadline} · ${goal.daysLeft ?? 0} hari`
                          : "Tanpa deadline"}
                      </p>
                    </div>
                  </div>
                  <Badge className={STATUS_LABEL[goal.status]?.className}>
                    {STATUS_LABEL[goal.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <GoalProgressBar percent={goal.percent} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatMoney(goal.currentAmount)}</span>
                    <span>{goal.percent.toFixed(0)}%</span>
                    <span>{formatMoney(goal.targetAmount)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sisa {formatMoney(goal.remaining)}
                  {goal.avgDeposit > 0 &&
                    ` · rata-rata setoran ${formatMoney(goal.avgDeposit)}`}
                </p>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {goal.autoAllocateActive &&
                    goal.autoAllocateType !== "none" && (
                      <Badge variant="secondary">
                        <Wand2 className="mr-1 size-2.5" />
                        Auto{" "}
                        {goal.autoAllocateType === "percent"
                          ? `${goal.autoAllocateValue}%`
                          : formatMoney(goal.autoAllocateValue)}
                      </Badge>
                    )}
                  {goal.reminderFrequency !== "none" && (
                    <Badge variant="secondary">
                      <Bell className="mr-1 size-2.5" />
                      Reminder {goal.reminderFrequency}
                      {goal.reminderViaWa ? " + WA" : ""}
                    </Badge>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setMutationTarget({
                          goalId: goal.id,
                          name: goal.name,
                          type: "deposit",
                        });
                        setMutationAmount(0);
                        setMutationNote("");
                      }}
                    >
                      <ArrowUpRight className="size-3.5" />
                      Setor
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setMutationTarget({
                          goalId: goal.id,
                          name: goal.name,
                          type: "withdraw",
                        });
                        setMutationAmount(0);
                        setMutationNote("");
                      }}
                    >
                      <ArrowDownLeft className="size-3.5" />
                      Tarik
                    </Button>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <Link to={`/tabungan/${goal.id}`}>
                    Lihat detail & riwayat
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog goal baru */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat goal tabungan</DialogTitle>
            <DialogDescription>
              Tentukan target, deadline, dan (opsional) auto-alokasi dari sisa
              uang bulanan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Nama goal *</Label>
              <Input
                id="goal-name"
                placeholder="Dana Darurat"
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target nominal *</Label>
                <MoneyInput value={targetAmount} onChange={setTargetAmount} />
              </div>
              <div className="space-y-2">
                <Label>Saldo awal (opsional)</Label>
                <MoneyInput value={initialAmount} onChange={setInitialAmount} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-deadline">Deadline</Label>
                <Input
                  id="goal-deadline"
                  type="date"
                  min={todayISO()}
                  value={deadline}
                  onChange={event => setDeadline(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ikon & warna</Label>
                <div className="flex flex-wrap gap-1">
                  {GOAL_ICONS.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setIcon(item)}
                      className={
                        icon === item
                          ? "rounded-md border-2 border-primary px-1.5 py-0.5"
                          : "rounded-md border px-1.5 py-0.5"
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 pt-1">
                  {GOAL_COLORS.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setColor(item)}
                      aria-label={`Warna ${item}`}
                      className={
                        color === item
                          ? "size-5 rounded-full ring-2 ring-offset-2 ring-primary"
                          : "size-5 rounded-full"
                      }
                      style={{ backgroundColor: item }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-desc">Deskripsi</Label>
              <Textarea
                id="goal-desc"
                rows={2}
                value={description}
                onChange={event => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto-alokasi</p>
                  <p className="text-xs text-muted-foreground">
                    Ambil otomatis dari sisa uang bulan sebelumnya
                  </p>
                </div>
                <Switch
                  checked={autoType !== "none"}
                  onCheckedChange={checked =>
                    setAutoType(checked ? "percent" : "none")
                  }
                />
              </div>
              {autoType !== "none" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipe</Label>
                    <Select
                      value={autoType}
                      onValueChange={value =>
                        setAutoType(value as "percent" | "fixed")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">
                          Persen dari sisa
                        </SelectItem>
                        <SelectItem value="fixed">Nominal tetap</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {autoType === "percent" ? "Persen (%)" : "Nominal"}
                    </Label>
                    {autoType === "percent" ? (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={autoValue}
                        onChange={event =>
                          setAutoValue(Number(event.target.value))
                        }
                      />
                    ) : (
                      <MoneyInput value={autoValue} onChange={setAutoValue} />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pengingat menabung</Label>
                  <Select
                    value={reminder}
                    onValueChange={value =>
                      setReminder(
                        value as "none" | "daily" | "weekly" | "monthly",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      <SelectItem value="daily">Harian</SelectItem>
                      <SelectItem value="weekly">Mingguan (Senin)</SelectItem>
                      <SelectItem value="monthly">Bulanan (tgl 1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jam pengingat</Label>
                  <Input
                    type="time"
                    value={reminderTime}
                    onChange={event => setReminderTime(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm">Kirim juga ke WhatsApp</p>
                <Switch checked={reminderWa} onCheckedChange={setReminderWa} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitGoal()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Simpan goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog setor / tarik */}
      <Dialog
        open={Boolean(mutationTarget)}
        onOpenChange={open => !open && setMutationTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mutationTarget?.type === "deposit" ? "Setor dana" : "Tarik dana"}{" "}
              — {mutationTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nominal *</Label>
              <MoneyInput
                value={mutationAmount}
                onChange={setMutationAmount}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={mutationDate}
                  max={todayISO()}
                  onChange={event => setMutationDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {mutationTarget?.type === "deposit"
                    ? "Sumber dana"
                    : "Tujuan dana"}
                </Label>
                <Select
                  value={mutationSource}
                  onValueChange={setMutationSource}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kas">Kas tunai</SelectItem>
                    <SelectItem value="bank">Rekening bank</SelectItem>
                    <SelectItem value="e-wallet">E-wallet</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Catatan{mutationTarget?.type === "withdraw" ? " (wajib)" : ""}
              </Label>
              <Textarea
                rows={2}
                value={mutationNote}
                onChange={event => setMutationNote(event.target.value)}
                placeholder={
                  mutationTarget?.type === "withdraw"
                    ? "Alasan penarikan"
                    : "Opsional"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMutationTarget(null)}>
              Batal
            </Button>
            <Button onClick={() => void submitMutation()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
