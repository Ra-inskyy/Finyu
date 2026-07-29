import { useMutation, useQuery } from "convex/react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/finyu/MoneyInput";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import { compressImage, todayISO } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type TransactionDraft = {
  id: Id<"transactions">;
  amount: number;
  date: string;
  note: string;
  categoryId: Id<"categories"> | null;
  subCategoryId: Id<"categories"> | null;
  walletId: Id<"wallets"> | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "expense" | "income";
  draft?: TransactionDraft | null;
};

export function TransactionDialog({ open, onOpenChange, kind, draft }: Props) {
  const scopeArgs = useScopeArgs();
  const { canEdit } = useScope();
  const categories = useQuery(api.categories.list, { ...scopeArgs, kind });
  const wallets = useQuery(api.wallets.list, scopeArgs);
  const createTx = useMutation(api.transactions.create);
  const updateTx = useMutation(api.transactions.update);
  const generateUploadUrl = useMutation(api.transactions.generateUploadUrl);

  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [categoryId, setCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const parents = useMemo(
    () => (categories ?? []).filter(c => !c.parentId && !c.isArchived),
    [categories],
  );
  const subs = useMemo(
    () => (categories ?? []).filter(c => c.parentId === categoryId),
    [categories, categoryId],
  );
  const activeWallets = useMemo(
    () => (wallets ?? []).filter(w => !w.isArchived),
    [wallets],
  );

  useEffect(() => {
    if (!open) return;
    if (draft) {
      setAmount(draft.amount);
      setDate(draft.date);
      setCategoryId(draft.categoryId ?? "");
      setSubCategoryId(draft.subCategoryId ?? "");
      setWalletId(draft.walletId ?? "");
      setNote(draft.note);
    } else {
      setAmount(0);
      setDate(todayISO());
      setCategoryId("");
      setSubCategoryId("");
      setWalletId(activeWallets[0]?.id ?? "");
      setNote("");
    }
    setFiles([]);
  }, [open, draft, activeWallets]);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).slice(0, 3 - files.length);
    const tooBig = picked.find(f => f.size > 5 * 1024 * 1024);
    if (tooBig) {
      toast.error("Ukuran foto maksimal 5MB per file");
      return;
    }
    setFiles(prev => [...prev, ...picked].slice(0, 3));
  };

  const uploadReceipts = async () => {
    const ids: Array<Id<"_storage">> = [];
    for (const file of files) {
      const blob = await compressImage(file);
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type || file.type },
        body: blob,
      });
      if (!response.ok) throw new Error("Upload foto gagal");
      const json = (await response.json()) as { storageId: Id<"_storage"> };
      ids.push(json.storageId);
    }
    return ids;
  };

  const submit = async () => {
    if (!canEdit) {
      toast.error("Akses kamu hanya bisa melihat data ini");
      return;
    }
    if (amount <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    if (!categoryId) {
      toast.error("Kategori wajib dipilih");
      return;
    }
    if (date > todayISO()) {
      toast.error("Tanggal tidak boleh di masa depan");
      return;
    }
    setSaving(true);
    try {
      const receipts = await uploadReceipts();
      if (draft) {
        await updateTx({
          id: draft.id,
          amount,
          date,
          categoryId: categoryId as Id<"categories">,
          subCategoryId: subCategoryId
            ? (subCategoryId as Id<"categories">)
            : null,
          walletId: walletId ? (walletId as Id<"wallets">) : undefined,
          note,
          ...(receipts.length ? { receipts } : {}),
        });
        toast.success("Transaksi diperbarui");
      } else {
        await createTx({
          ...scopeArgs,
          kind,
          amount,
          date,
          categoryId: categoryId as Id<"categories">,
          subCategoryId: subCategoryId
            ? (subCategoryId as Id<"categories">)
            : undefined,
          walletId: walletId ? (walletId as Id<"wallets">) : undefined,
          note: note || undefined,
          receipts,
        });
        toast.success(
          kind === "expense" ? "Pengeluaran dicatat" : "Pemasukan dicatat",
        );
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const title = draft
    ? "Edit transaksi"
    : kind === "expense"
      ? "Tambah pengeluaran"
      : "Tambah pemasukan";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "expense"
              ? "Catat pengeluaran harianmu — target input di bawah 15 detik."
              : "Catat pemasukan supaya sisa uang otomatis terhitung."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Jumlah *</Label>
            <MoneyInput
              id="amount"
              value={amount}
              onChange={setAmount}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                {kind === "expense" ? "Kategori *" : "Sumber pemasukan *"}
              </Label>
              <Select
                value={categoryId}
                onValueChange={value => {
                  setCategoryId(value);
                  setSubCategoryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sub-kategori</Label>
              <Select
                value={subCategoryId}
                onValueChange={setSubCategoryId}
                disabled={subs.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      subs.length ? "Opsional" : "Tidak ada sub-kategori"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subs.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Tanggal *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                max={todayISO()}
                onChange={event => setDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Dompet</Label>
              <Select value={walletId} onValueChange={setWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                  {activeWallets.map(wallet => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              maxLength={500}
              rows={2}
              placeholder="Contoh: makan siang bareng klien"
              value={note}
              onChange={event => setNote(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {note.length}/500 karakter
            </p>
          </div>

          <div className="space-y-2">
            <Label>Lampiran foto struk (maks 3, 5MB/foto)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1 text-xs"
                >
                  <span className="max-w-32 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles(prev => prev.filter((_, i) => i !== index))
                    }
                    aria-label="Hapus lampiran"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {files.length < 3 && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-xs hover:bg-muted/60">
                  <ImagePlus className="size-4" />
                  Tambah foto
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={event => handleFiles(event.target.files)}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {draft ? "Simpan perubahan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
