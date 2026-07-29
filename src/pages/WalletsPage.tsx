import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeftRight,
  Banknote,
  Landmark,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/finyu/MoneyInput";
import { PageHeader, StatCard } from "@/components/finyu/ui";
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
import { useScope, useScopeArgs } from "@/contexts/ScopeContext";
import { formatMoney, todayISO, WALLET_TYPE_LABEL } from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const TYPE_ICON: Record<string, typeof Wallet> = {
  cash: Banknote,
  bank: Landmark,
  ewallet: Smartphone,
  other: Wallet,
};

export function WalletsPage() {
  const scopeArgs = useScopeArgs();
  const { canEdit, isOwner } = useScope();
  const wallets = useQuery(api.wallets.list, scopeArgs);
  const collab = useQuery(api.collaborators.list);
  const create = useMutation(api.wallets.create);
  const remove = useMutation(api.wallets.remove);
  const transfer = useMutation(api.wallets.transfer);
  const invite = useMutation(api.collaborators.invite);
  const updateRole = useMutation(api.collaborators.updateRole);
  const revoke = useMutation(api.collaborators.revoke);

  const [walletOpen, setWalletOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"cash" | "bank" | "ewallet" | "other">(
    "cash",
  );
  const [initialBalance, setInitialBalance] = useState(0);

  const [fromWallet, setFromWallet] = useState("");
  const [toWallet, setToWallet] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferDate, setTransferDate] = useState(todayISO());
  const [transferNote, setTransferNote] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");

  const activeWallets = (wallets ?? []).filter(w => !w.isArchived);
  const totalBalance = activeWallets.reduce((s, w) => s + w.balance, 0);

  const submitWallet = async () => {
    if (!name.trim()) {
      toast.error("Nama dompet wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await create({ ...scopeArgs, name, type, initialBalance });
      toast.success("Dompet dibuat");
      setWalletOpen(false);
      setName("");
      setInitialBalance(0);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat dompet",
      );
    } finally {
      setSaving(false);
    }
  };

  const submitTransfer = async () => {
    setSaving(true);
    try {
      await transfer({
        ...scopeArgs,
        fromWalletId: fromWallet as Id<"wallets">,
        toWalletId: toWallet as Id<"wallets">,
        amount: transferAmount,
        date: transferDate,
        note: transferNote || undefined,
      });
      toast.success("Transfer dicatat");
      setTransferOpen(false);
      setTransferAmount(0);
      setTransferNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transfer gagal");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Dompet & Kolaborasi"
        description="Kelola kas, rekening bank, e-wallet, transfer antar dompet, dan anggota"
        actions={
          canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFromWallet(activeWallets[0]?.id ?? "");
                  setToWallet(activeWallets[1]?.id ?? "");
                  setTransferOpen(true);
                }}
                disabled={activeWallets.length < 2}
              >
                <ArrowLeftRight className="size-4" />
                Transfer
              </Button>
              <Button onClick={() => setWalletOpen(true)}>
                <Plus className="size-4" />
                Tambah dompet
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total saldo semua dompet"
          value={formatMoney(totalBalance)}
          icon={<Wallet className="size-4" />}
        />
        <StatCard
          label="Jumlah dompet aktif"
          value={String(activeWallets.length)}
          accent="sky"
        />
        <StatCard
          label="Anggota kolaborasi"
          value={String((collab?.members ?? []).length)}
          accent="amber"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {activeWallets.map(wallet => {
          const Icon = TYPE_ICON[wallet.type] ?? Wallet;
          return (
            <Card key={wallet.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex size-10 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${wallet.color}1f`,
                        color: wallet.color,
                      }}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">{wallet.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {WALLET_TYPE_LABEL[wallet.type]}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground"
                      onClick={() =>
                        void remove({ id: wallet.id }).then(result =>
                          toast.success(
                            result.archived
                              ? "Dompet diarsipkan (masih punya transaksi)"
                              : "Dompet dihapus",
                          ),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatMoney(wallet.balance)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Saldo awal {formatMoney(wallet.initialBalance)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isOwner && (
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Kolaborasi</CardTitle>
              <p className="text-sm text-muted-foreground">
                Undang pasangan, keluarga, atau kolega untuk melihat / mengedit
                catatan keuanganmu
              </p>
            </div>
            <Button variant="outline" onClick={() => setInviteOpen(true)}>
              <UserPlus className="size-4" />
              Undang anggota
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(collab?.members ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Belum ada anggota. Undangan akan aktif otomatis begitu orangnya
                mendaftar dengan email tersebut.
              </p>
            ) : (
              (collab?.members ?? []).map(member => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {member.name ?? member.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        member.status === "accepted" ? "default" : "secondary"
                      }
                    >
                      {member.status === "accepted"
                        ? "Aktif"
                        : "Menunggu daftar"}
                    </Badge>
                    <Select
                      value={member.role}
                      onValueChange={value =>
                        void updateRole({
                          id: member.id,
                          role: value as "viewer" | "editor",
                        }).then(() => toast.success("Hak akses diperbarui"))
                      }
                    >
                      <SelectTrigger className="h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Lihat saja</SelectItem>
                        <SelectItem value="editor">Bisa edit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive"
                      onClick={() =>
                        void revoke({ id: member.id }).then(() =>
                          toast.success("Akses dicabut"),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {(collab?.shares ?? []).length > 0 && (
              <div className="pt-3">
                <p className="mb-2 text-sm font-medium">Dibagikan ke saya</p>
                {(collab?.shares ?? []).map(share => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{share.ownerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {share.ownerEmail}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {share.role === "editor" ? "Bisa edit" : "Lihat saja"}
                    </Badge>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">
                  Ganti data yang ditampilkan lewat pemilih akun di pojok kanan
                  atas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah dompet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama dompet *</Label>
              <Input
                placeholder="GoPay, BCA, Kas Toko…"
                value={name}
                onChange={event => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Select
                value={type}
                onValueChange={value =>
                  setType(value as "cash" | "bank" | "ewallet" | "other")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WALLET_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Saldo awal</Label>
              <MoneyInput value={initialBalance} onChange={setInitialBalance} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitWallet()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer antar dompet</DialogTitle>
            <DialogDescription>
              Saldo dompet asal berkurang dan dompet tujuan bertambah otomatis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Dari</Label>
                <Select value={fromWallet} onValueChange={setFromWallet}>
                  <SelectTrigger>
                    <SelectValue />
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
              <div className="space-y-2">
                <Label>Ke</Label>
                <Select value={toWallet} onValueChange={setToWallet}>
                  <SelectTrigger>
                    <SelectValue />
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
              <Label>Nominal</Label>
              <MoneyInput value={transferAmount} onChange={setTransferAmount} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="date"
                  value={transferDate}
                  max={todayISO()}
                  onChange={event => setTransferDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Catatan</Label>
                <Input
                  value={transferNote}
                  onChange={event => setTransferNote(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitTransfer()} disabled={saving}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Undang anggota</DialogTitle>
            <DialogDescription>
              Masukkan email akun Finyu mereka. Kalau belum punya akun, undangan
              otomatis aktif setelah mereka mendaftar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={event => setInviteEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hak akses</Label>
              <Select
                value={inviteRole}
                onValueChange={value =>
                  setInviteRole(value as "viewer" | "editor")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Lihat saja</SelectItem>
                  <SelectItem value="editor">Bisa edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() =>
                void invite({ email: inviteEmail, role: inviteRole })
                  .then(() => {
                    toast.success("Undangan dibuat");
                    setInviteOpen(false);
                    setInviteEmail("");
                  })
                  .catch(error =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Gagal mengundang",
                    ),
                  )
              }
            >
              Undang
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
