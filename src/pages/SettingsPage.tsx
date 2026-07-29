import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  ChevronRight,
  Loader2,
  Moon,
  Plus,
  Shield,
  Sun,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/finyu/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import { CURRENCIES, formatDateTime } from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const EVENT_LABEL: Record<string, string> = {
  account_bootstrap: "Akun disiapkan",
  profile_update: "Profil diperbarui",
  login_success: "Login berhasil",
  logout_idle: "Auto logout (idle)",
  wa_connect_start: "Mulai koneksi WhatsApp",
  wa_connected: "WhatsApp tersambung",
  wa_disconnect: "WhatsApp diputuskan",
  collab_invite: "Undang anggota",
  collab_revoke: "Cabut akses anggota",
};

export function SettingsPage() {
  const me = useQuery(api.profiles.me);
  const audit = useQuery(api.profiles.auditLog, { limit: 25 });
  const notifications = useQuery(api.notifications.list, { limit: 20 });
  const categories = useQuery(api.categories.list, {});
  const updateProfile = useMutation(api.profiles.updateProfile);
  const createCategory = useMutation(api.categories.create);
  const removeCategory = useMutation(api.categories.remove);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const { theme, toggleTheme, switchable } = useTheme();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [idleTimeout, setIdleTimeout] = useState(15);
  const [saving, setSaving] = useState(false);

  const [newCategory, setNewCategory] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<"expense" | "income">(
    "expense",
  );
  const [newSubParent, setNewSubParent] = useState<string>("");
  const [newSubName, setNewSubName] = useState("");

  useEffect(() => {
    if (!me) return;
    setFullName(me.name);
    setPhone(me.phone ?? "");
    setCurrency(me.defaultCurrency);
    setIdleTimeout(me.idleTimeoutMinutes);
  }, [me]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        fullName,
        phone,
        defaultCurrency: currency,
        idleTimeoutMinutes: idleTimeout,
      });
      toast.success("Profil disimpan");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const parents = (categories ?? []).filter(cat => !cat.parentId);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Pengaturan"
        description="Profil, kategori, notifikasi, dan keamanan akun"
      />

      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">
            <User className="size-3.5" /> Profil
          </TabsTrigger>
          <TabsTrigger value="kategori">
            <Tag className="size-3.5" /> Kategori
          </TabsTrigger>
          <TabsTrigger value="notifikasi">
            <Bell className="size-3.5" /> Notifikasi
          </TabsTrigger>
          <TabsTrigger value="keamanan">
            <Shield className="size-3.5" /> Keamanan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profil pengguna</CardTitle>
              <CardDescription>{me?.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nama lengkap</Label>
                  <Input
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor WhatsApp</Label>
                  <Input
                    placeholder="08123456789"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mata uang default</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(item => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Auto logout setelah (menit)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={idleTimeout}
                    onChange={event =>
                      setIdleTimeout(Number(event.target.value))
                    }
                  />
                </div>
              </div>
              <Button onClick={() => void saveProfile()} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                Simpan profil
              </Button>
            </CardContent>
          </Card>

          {switchable && (
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">Tampilan</p>
                  <p className="text-xs text-muted-foreground">
                    Mode {theme === "light" ? "terang" : "gelap"}
                  </p>
                </div>
                <Button variant="outline" onClick={toggleTheme}>
                  {theme === "light" ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                  Ganti mode
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="kategori" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tambah kategori</CardTitle>
              <CardDescription>
                Kategori default sudah tersedia; kamu bisa menambah kategori dan
                sub-kategori sendiri (maks 2 tingkat).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Nama kategori baru</Label>
                  <Input
                    className="w-56"
                    value={newCategory}
                    onChange={event => setNewCategory(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Jenis</Label>
                  <Select
                    value={newCategoryKind}
                    onValueChange={value =>
                      setNewCategoryKind(value as "expense" | "income")
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Pengeluaran</SelectItem>
                      <SelectItem value="income">Pemasukan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() =>
                    void createCategory({
                      name: newCategory,
                      kind: newCategoryKind,
                    })
                      .then(() => {
                        toast.success("Kategori dibuat");
                        setNewCategory("");
                      })
                      .catch(error =>
                        toast.error(
                          error instanceof Error ? error.message : "Gagal",
                        ),
                      )
                  }
                >
                  <Plus className="size-4" />
                  Tambah
                </Button>
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t pt-4">
                <div className="space-y-2">
                  <Label className="text-xs">Sub-kategori untuk</Label>
                  <Select value={newSubParent} onValueChange={setNewSubParent}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Pilih kategori induk" />
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
                  <Label className="text-xs">Nama sub-kategori</Label>
                  <Input
                    className="w-56"
                    value={newSubName}
                    onChange={event => setNewSubName(event.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const parent = parents.find(cat => cat.id === newSubParent);
                    if (!parent) {
                      toast.error("Pilih kategori induk");
                      return;
                    }
                    void createCategory({
                      name: newSubName,
                      kind: parent.kind,
                      parentId: parent.id as Id<"categories">,
                    })
                      .then(() => {
                        toast.success("Sub-kategori dibuat");
                        setNewSubName("");
                      })
                      .catch(error =>
                        toast.error(
                          error instanceof Error ? error.message : "Gagal",
                        ),
                      );
                  }}
                >
                  <Plus className="size-4" />
                  Tambah sub
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            {(["expense", "income"] as const).map(kind => (
              <Card key={kind}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {kind === "expense"
                      ? "Kategori pengeluaran"
                      : "Sumber pemasukan"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {parents
                    .filter(cat => cat.kind === kind)
                    .map(cat => {
                      const subs = (categories ?? []).filter(
                        item => item.parentId === cat.id,
                      );
                      return (
                        <div
                          key={cat.id}
                          className="rounded-lg border px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name}
                              {cat.isDefault && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  default
                                </Badge>
                              )}
                              {cat.isArchived && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  diarsipkan
                                </Badge>
                              )}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 text-muted-foreground"
                              onClick={() =>
                                void removeCategory({
                                  id: cat.id as Id<"categories">,
                                }).then(result =>
                                  toast.success(
                                    result.archived
                                      ? "Kategori diarsipkan (masih dipakai transaksi)"
                                      : "Kategori dihapus",
                                  ),
                                )
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                          {subs.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {subs.map(sub => (
                                <span
                                  key={sub.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                                >
                                  <ChevronRight className="size-3" />
                                  {sub.name}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void removeCategory({
                                        id: sub.id as Id<"categories">,
                                      }).then(() =>
                                        toast.success("Sub dihapus"),
                                      )
                                    }
                                    aria-label="Hapus sub-kategori"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifikasi" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Notifikasi</CardTitle>
                <CardDescription>
                  Peringatan anggaran, goal tabungan, dan status WhatsApp
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => void markAllRead({})}>
                Tandai semua terbaca
              </Button>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(notifications ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada notifikasi
                </p>
              ) : (
                (notifications ?? []).map(item => (
                  <div
                    key={item.id}
                    className={
                      item.readAt
                        ? "rounded-lg border px-3 py-2"
                        : "rounded-lg border border-primary/40 bg-primary/5 px-3 py-2"
                    }
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDateTime(item.at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keamanan" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Log aktivitas</CardTitle>
              <CardDescription>
                Riwayat aktivitas akun untuk audit keamanan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {(audit ?? []).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs"
                >
                  <span className="font-medium">
                    {EVENT_LABEL[item.event] ?? item.event}
                    {item.detail && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {item.detail}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDateTime(item.at)}
                  </span>
                </div>
              ))}
              {(audit ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Belum ada aktivitas
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
