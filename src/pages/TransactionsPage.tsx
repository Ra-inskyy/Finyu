import { useMutation, useQuery } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CashflowChart, CategoryChart } from "@/components/finyu/charts";
import {
  TransactionDialog,
  type TransactionDraft,
} from "@/components/finyu/TransactionDialog";
import {
  EmptyBox,
  MultiSelect,
  PageHeader,
  StatCard,
} from "@/components/finyu/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import {
  addDays,
  formatDateLong,
  formatMoney,
  monthISO,
  monthStart,
  todayISO,
} from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Props = { kind: "expense" | "income" };

function TransactionsView({ kind }: Props) {
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const [params] = useSearchParams();
  const dateParam = params.get("tanggal");

  const [dateFrom, setDateFrom] = useState(dateParam ?? monthStart(monthISO()));
  const [dateTo, setDateTo] = useState(dateParam ?? todayISO());
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [walletIds, setWalletIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [showTrash, setShowTrash] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<TransactionDraft | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"transactions"> | null>(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const categories = useQuery(api.categories.list, { ...scopeArgs, kind });
  const wallets = useQuery(api.wallets.list, scopeArgs);
  const softDelete = useMutation(api.transactions.softDelete);
  const restore = useMutation(api.transactions.restore);

  const result = useQuery(api.transactions.list, {
    ...scopeArgs,
    kind,
    dateFrom,
    dateTo,
    categoryIds: categoryIds.length
      ? (categoryIds as Array<Id<"categories">>)
      : undefined,
    walletIds: walletIds.length
      ? (walletIds as Array<Id<"wallets">>)
      : undefined,
    search: search || undefined,
    includeDeleted: showTrash,
    page,
    pageSize,
    sort,
  });

  const cashflow = useQuery(
    api.dashboard.summary,
    kind === "income" ? { ...scopeArgs, month: monthISO() } : "skip",
  );

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map(cat => ({
        value: cat.id,
        label: cat.parentId ? `↳ ${cat.name}` : cat.name,
        color: cat.color,
      })),
    [categories],
  );
  const walletOptions = useMemo(
    () =>
      (wallets ?? []).map(w => ({
        value: w.id,
        label: w.name,
        color: w.color,
      })),
    [wallets],
  );

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const detail = items.find(item => item.id === detailId);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const isFiltered =
    categoryIds.length > 0 ||
    walletIds.length > 0 ||
    search.length > 0 ||
    dateFrom !== monthStart(monthISO()) ||
    dateTo !== todayISO();

  const resetFilters = () => {
    setCategoryIds([]);
    setWalletIds([]);
    setSearch("");
    setDateFrom(monthStart(monthISO()));
    setDateTo(todayISO());
    setPage(0);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    await softDelete({ id });
    setDeleteId(null);
    setDeleteStep(1);
    setDetailId(null);
    toast.success("Transaksi dihapus", {
      description: "Bisa dipulihkan dalam 30 hari.",
      action: {
        label: "Urungkan",
        onClick: () => {
          void restore({ id }).then(() =>
            toast.success("Transaksi dipulihkan"),
          );
        },
      },
      duration: 6000,
    });
  };

  const quickRanges: Array<[string, () => void]> = [
    [
      "Bulan ini",
      () => {
        setDateFrom(monthStart(monthISO()));
        setDateTo(todayISO());
      },
    ],
    [
      "7 hari",
      () => {
        setDateFrom(addDays(todayISO(), -6));
        setDateTo(todayISO());
      },
    ],
    [
      "30 hari",
      () => {
        setDateFrom(addDays(todayISO(), -29));
        setDateTo(todayISO());
      },
    ],
    [
      "Tahun ini",
      () => {
        setDateFrom(`${todayISO().slice(0, 4)}-01-01`);
        setDateTo(todayISO());
      },
    ],
  ];

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        title={kind === "expense" ? "Pengeluaran" : "Pemasukan"}
        description={
          kind === "expense"
            ? "Catat, filter, dan kelola semua pengeluaranmu"
            : "Catat pemasukan & pantau arus kas masuk"
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowTrash(value => !value);
                setPage(0);
              }}
            >
              {showTrash ? "Lihat aktif" : "Sampah (30 hari)"}
            </Button>
            {canEdit && (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                {kind === "expense" ? "Tambah pengeluaran" : "Tambah pemasukan"}
              </Button>
            )}
          </>
        }
      />

      {kind === "income" && cashflow && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total pemasukan (bulan ini)"
              value={formatMoney(cashflow.income.total)}
              icon={<TrendingUp className="size-4" />}
              accent="sky"
            />
            <StatCard
              label="Total pengeluaran (bulan ini)"
              value={formatMoney(cashflow.expense.total)}
              icon={<TrendingDown className="size-4" />}
              accent="rose"
            />
            <StatCard
              label="Sisa uang"
              value={formatMoney(cashflow.leftover.total)}
              icon={<Wallet className="size-4" />}
              accent={cashflow.leftover.total >= 0 ? "primary" : "rose"}
            />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Pemasukan vs pengeluaran (12 bulan)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CashflowChart
                data={cashflow.trend.monthly.map(row => ({
                  label: row.label,
                  expense: row.total,
                  income: row.income ?? 0,
                  leftover: (row.income ?? 0) - row.total,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Cari di catatan…"
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <MultiSelect
              label={kind === "expense" ? "Kategori" : "Sumber"}
              options={categoryOptions}
              selected={categoryIds}
              onChange={values => {
                setCategoryIds(values);
                setPage(0);
              }}
            />
            <MultiSelect
              label="Dompet"
              options={walletOptions}
              selected={walletIds}
              onChange={values => {
                setWalletIds(values);
                setPage(0);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(value => !value)}
            >
              <Filter className="size-3.5" />
              Tanggal
            </Button>
            <Select
              value={sort}
              onValueChange={value => {
                setSort(value);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Terbaru dulu</SelectItem>
                <SelectItem value="date_asc">Terlama dulu</SelectItem>
                <SelectItem value="amount_desc">Nominal terbesar</SelectItem>
                <SelectItem value="amount_asc">Nominal terkecil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="space-y-1">
                <Label className="text-xs">Dari tanggal</Label>
                <Input
                  type="date"
                  className="h-8"
                  value={dateFrom}
                  onChange={event => {
                    setDateFrom(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sampai tanggal</Label>
                <Input
                  type="date"
                  className="h-8"
                  value={dateTo}
                  onChange={event => {
                    setDateTo(event.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickRanges.map(([label, apply]) => (
                  <Button
                    key={label}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      apply();
                      setPage(0);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {total} transaksi · total{" "}
              <span className="font-semibold text-foreground">
                {formatMoney(result?.totalAmount ?? 0)}
              </span>
            </p>
            {isFiltered && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!result ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        isFiltered || showTrash ? (
          <EmptyBox
            title={
              showTrash
                ? "Tidak ada transaksi di sampah"
                : "Tidak ada transaksi dengan filter ini"
            }
            description={
              showTrash
                ? "Transaksi yang dihapus akan muncul di sini selama 30 hari."
                : "Coba ubah rentang tanggal atau hapus filternya."
            }
            action={
              !showTrash && (
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  Reset Filter
                </Button>
              )
            }
          />
        ) : (
          <EmptyBox
            icon={<Plus className="size-5" />}
            title={
              kind === "expense"
                ? "Belum ada catatan pengeluaran"
                : "Belum ada catatan pemasukan"
            }
            description={
              kind === "expense"
                ? "Yuk mulai catat pengeluaran pertamamu!"
                : "Yuk mulai catat pendapatan pertama kamu!"
            }
            action={
              canEdit && (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  {kind === "expense"
                    ? "Tambah Pengeluaran Pertama"
                    : "Tambah Pemasukan"}
                </Button>
              )
            }
          />
        )
      ) : (
        <div className="space-y-2">
          {items.map(tx => (
            <div
              key={tx.id}
              className="group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition hover:border-primary/40"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setDetailId(tx.id)}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                  style={{
                    backgroundColor: `${tx.categoryColor ?? "#10b981"}1f`,
                    color: tx.categoryColor ?? "#10b981",
                  }}
                >
                  {(tx.categoryName ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {tx.categoryName ?? "-"}
                    {tx.subCategoryName && (
                      <span className="text-xs text-muted-foreground">
                        › {tx.subCategoryName}
                      </span>
                    )}
                    {tx.source === "whatsapp" && (
                      <MessageCircle className="size-3 text-emerald-600" />
                    )}
                    {tx.receiptUrls.length > 0 && (
                      <Paperclip className="size-3 text-muted-foreground" />
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateLong(tx.date)}
                    {tx.walletName ? ` · ${tx.walletName}` : ""}
                    {tx.note ? ` · ${tx.note.slice(0, 50)}` : ""}
                  </p>
                </div>
              </button>
              {tx.receiptUrls[0] && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(tx.receiptUrls[0])}
                >
                  <img
                    src={tx.receiptUrls[0]}
                    alt="struk"
                    className="size-9 rounded-lg object-cover"
                  />
                </button>
              )}
              <span
                className={
                  kind === "income"
                    ? "text-sm font-semibold tabular-nums text-emerald-600"
                    : "text-sm font-semibold tabular-nums text-rose-600"
                }
              >
                {kind === "income" ? "+" : "−"}
                {formatMoney(tx.amount)}
              </span>
              {canEdit && !showTrash && (
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() =>
                      setEditDraft({
                        id: tx.id,
                        amount: tx.amount,
                        date: tx.date,
                        note: tx.note,
                        categoryId: tx.categoryId,
                        subCategoryId: tx.subCategoryId,
                        walletId: tx.walletId,
                      })
                    }
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    onClick={() => {
                      setDeleteId(tx.id);
                      setDeleteStep(1);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
              {showTrash && canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void restore({ id: tx.id }).then(() =>
                      toast.success("Transaksi dipulihkan"),
                    )
                  }
                >
                  <RotateCcw className="size-3.5" />
                  Pulihkan
                </Button>
              )}
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Baris per halaman
              <Select
                value={String(pageSize)}
                onValueChange={value => {
                  setPageSize(Number(value));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 50, 100].map(size => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage(value => Math.max(0, value - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Halaman {page + 1} dari {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(value => value + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {kind === "expense" && result && items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Komposisi kategori (periode filter)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart
              data={Object.values(
                items.reduce<
                  Record<
                    string,
                    {
                      categoryId: string;
                      name: string;
                      color: string;
                      total: number;
                      percent: number;
                      subs: Array<{ name: string; total: number }>;
                    }
                  >
                >((acc, tx) => {
                  const key = tx.categoryId ?? "lain";
                  acc[key] = acc[key] ?? {
                    categoryId: key,
                    name: tx.categoryName ?? "Lainnya",
                    color: tx.categoryColor ?? "#10b981",
                    total: 0,
                    percent: 0,
                    subs: [],
                  };
                  acc[key].total += tx.amount;
                  return acc;
                }, {}),
              ).map(item => ({
                ...item,
                percent:
                  result.totalAmount > 0
                    ? (item.total / result.totalAmount) * 100
                    : 0,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <TransactionDialog open={addOpen} onOpenChange={setAddOpen} kind={kind} />
      <TransactionDialog
        open={Boolean(editDraft)}
        onOpenChange={open => !open && setEditDraft(null)}
        kind={kind}
        draft={editDraft}
      />

      <Dialog
        open={Boolean(detail)}
        onOpenChange={open => !open && setDetailId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detail transaksi</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <p className="text-2xl font-semibold tabular-nums">
                {formatMoney(detail.amount)}
              </p>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  ["Tanggal", formatDateLong(detail.date)],
                  ["Kategori", detail.categoryName ?? "-"],
                  ["Sub-kategori", detail.subCategoryName ?? "-"],
                  ["Dompet", detail.walletName ?? "-"],
                  [
                    "Sumber input",
                    detail.source === "whatsapp" ? "Bot WhatsApp" : "Web",
                  ],
                  ["Catatan", detail.note || "-"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="col-span-3 grid grid-cols-3 gap-2"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="col-span-2">{value}</dd>
                  </div>
                ))}
              </dl>
              {detail.receiptUrls.length > 0 && (
                <div className="flex gap-2">
                  {detail.receiptUrls.map(url => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setPhotoUrl(url)}
                    >
                      <img
                        src={url}
                        alt="struk"
                        className="size-20 rounded-lg object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditDraft({
                        id: detail.id,
                        amount: detail.amount,
                        date: detail.date,
                        note: detail.note,
                        categoryId: detail.categoryId,
                        subCategoryId: detail.subCategoryId,
                        walletId: detail.walletId,
                      });
                      setDetailId(null);
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setDeleteId(detail.id);
                      setDeleteStep(1);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Hapus
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(photoUrl)}
        onOpenChange={open => !open && setPhotoUrl(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto struk</DialogTitle>
          </DialogHeader>
          {photoUrl && (
            <img
              src={photoUrl}
              alt="struk"
              className="max-h-[75vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={open => {
          if (!open) {
            setDeleteId(null);
            setDeleteStep(1);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteStep === 1 ? "Yakin hapus?" : "Konfirmasi terakhir"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteStep === 1
                ? "Transaksi akan dipindahkan ke sampah dan bisa dipulihkan dalam 30 hari."
                : 'Klik "Ya, hapus permanen" untuk memindahkan transaksi ini ke sampah.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            {deleteStep === 1 ? (
              <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                Lanjut
              </Button>
            ) : (
              <AlertDialogAction
                onClick={() => void confirmDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Ya, hapus permanen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ExpensesPage() {
  return <TransactionsView kind="expense" />;
}

export function IncomePage() {
  return <TransactionsView kind="income" />;
}
