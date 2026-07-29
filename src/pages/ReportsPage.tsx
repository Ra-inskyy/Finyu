import { useMutation, useQuery } from "convex/react";
import {
  Download,
  FileSpreadsheet,
  MessageCircle,
  Printer,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MultiSelect, PageHeader, StatCard } from "@/components/finyu/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useScopeArgs } from "@/contexts/ScopeContext";
import {
  addMonths,
  formatDateShort,
  formatMoney,
  monthEnd,
  monthISO,
  monthLabel,
  monthStart,
  todayISO,
} from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const KIND_LABEL: Record<string, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const scopeArgs = useScopeArgs();
  const [dateFrom, setDateFrom] = useState(monthStart(monthISO()));
  const [dateTo, setDateTo] = useState(todayISO());
  const [kind, setKind] = useState<string>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [walletIds, setWalletIds] = useState<string[]>([]);

  const categories = useQuery(api.categories.list, scopeArgs);
  const wallets = useQuery(api.wallets.list, scopeArgs);
  const requestSummary = useMutation(api.whatsapp.requestSummary);

  const report = useQuery(api.reports.report, {
    ...scopeArgs,
    dateFrom,
    dateTo,
    kind:
      kind === "all" ? undefined : (kind as "expense" | "income" | "transfer"),
    categoryIds: categoryIds.length
      ? (categoryIds as Array<Id<"categories">>)
      : undefined,
    walletIds: walletIds.length
      ? (walletIds as Array<Id<"wallets">>)
      : undefined,
  });

  const exportCsv = () => {
    if (!report) return;
    const header = [
      "Tanggal",
      "Jenis",
      "Kategori",
      "Sub-kategori",
      "Dompet",
      "Ke dompet",
      "Catatan",
      "Sumber input",
      "Nominal",
    ];
    const lines = report.rows.map(row =>
      [
        row.date,
        KIND_LABEL[row.kind],
        row.category,
        row.subCategory,
        row.wallet,
        row.toWallet,
        (row.note ?? "").replace(/"/g, "'"),
        row.source === "whatsapp" ? "WhatsApp" : "Web",
        String(row.amount),
      ]
        .map(value => `"${value}"`)
        .join(","),
    );
    downloadFile(
      `\uFEFF${[header.join(","), ...lines].join("\n")}`,
      `laporan-finyu-${dateFrom}-sd-${dateTo}.csv`,
      "text/csv;charset=utf-8",
    );
    toast.success("CSV diunduh");
  };

  const exportExcel = () => {
    if (!report) return;
    const rows = report.rows
      .map(
        row => `<tr>
        <td>${row.date}</td><td>${KIND_LABEL[row.kind]}</td><td>${row.category}</td>
        <td>${row.subCategory}</td><td>${row.wallet}</td><td>${row.note ?? ""}</td>
        <td>${row.amount}</td></tr>`,
      )
      .join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>
      <body><table border="1">
      <thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Sub-kategori</th><th>Dompet</th><th>Catatan</th><th>Nominal</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th colspan="6">Total pengeluaran</th><th>${report.totalExpense}</th></tr>
      <tr><th colspan="6">Total pemasukan</th><th>${report.totalIncome}</th></tr></tfoot>
      </table></body></html>`;
    downloadFile(
      html,
      `laporan-finyu-${dateFrom}-sd-${dateTo}.xls`,
      "application/vnd.ms-excel",
    );
    toast.success("Excel diunduh");
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Laporan & Ekspor Data"
        description="Laporan detail dengan filter periode, kategori, dan jenis transaksi"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="size-4" />
              Excel
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="size-4" />
              PDF / Cetak
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void requestSummary({ type: "monthly" }).then(() =>
                  toast.success(
                    "Ringkasan bulanan dikirim ke WhatsApp (cek log di halaman Bot WhatsApp)",
                  ),
                )
              }
            >
              <MessageCircle className="size-4" />
              Kirim ke WA
            </Button>
          </>
        }
      />

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Dari</Label>
            <Input
              type="date"
              className="h-9 w-40"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sampai</Label>
            <Input
              type="date"
              className="h-9 w-40"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Jenis transaksi</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="expense">Pengeluaran</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <MultiSelect
            label="Kategori"
            options={(categories ?? []).map(cat => ({
              value: cat.id,
              label: cat.parentId ? `↳ ${cat.name}` : cat.name,
              color: cat.color,
            }))}
            selected={categoryIds}
            onChange={setCategoryIds}
          />
          <MultiSelect
            label="Dompet"
            options={(wallets ?? []).map(w => ({ value: w.id, label: w.name }))}
            selected={walletIds}
            onChange={setWalletIds}
          />
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["Bulan ini", monthStart(monthISO()), todayISO()],
                [
                  "Bulan lalu",
                  monthStart(addMonths(monthISO(), -1)),
                  monthEnd(addMonths(monthISO(), -1)),
                ],
                ["3 bulan", monthStart(addMonths(monthISO(), -2)), todayISO()],
                ["Tahun ini", `${todayISO().slice(0, 4)}-01-01`, todayISO()],
              ] as Array<[string, string, string]>
            ).map(([label, from, to]) => (
              <Button
                key={label}
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={() => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Total pengeluaran"
          value={formatMoney(report?.totalExpense ?? 0)}
          accent="rose"
        />
        <StatCard
          label="Total pemasukan"
          value={formatMoney(report?.totalIncome ?? 0)}
          accent="sky"
        />
        <StatCard
          label="Selisih (sisa uang)"
          value={formatMoney(report?.leftover ?? 0)}
        />
        <StatCard
          label="Jumlah transaksi"
          value={String(report?.count ?? 0)}
          accent="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rekap per kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.byCategory ?? []).map(row => (
                  <TableRow key={row.name}>
                    <TableCell className="text-sm">{row.name}</TableCell>
                    <TableCell className="text-right text-sm">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(row.total)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {row.percent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rekap per bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bulan</TableHead>
                  <TableHead className="text-right">Pemasukan</TableHead>
                  <TableHead className="text-right">Pengeluaran</TableHead>
                  <TableHead className="text-right">Sisa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.byMonth ?? []).map(row => (
                  <TableRow key={row.month}>
                    <TableCell className="text-sm">
                      {monthLabel(row.month)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(row.income)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(row.expense)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(row.leftover)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Detail transaksi ({report?.count ?? 0} baris)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Dompet</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.rows ?? []).slice(0, 300).map(row => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateShort(row.date)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {KIND_LABEL[row.kind]}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.category}
                    {row.subCategory ? ` › ${row.subCategory}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.wallet}
                    {row.toWallet ? ` → ${row.toWallet}` : ""}
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-xs">
                    {row.note}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatMoney(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(report?.rows.length ?? 0) > 300 && (
            <p className="pt-3 text-xs text-muted-foreground">
              Ditampilkan 300 baris pertama — ekspor CSV/Excel untuk data
              lengkap.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
