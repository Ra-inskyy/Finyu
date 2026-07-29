import { useMutation, useQuery } from "convex/react";
import {
  BellRing,
  Link2Off,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { formatDateTime, relativeTime } from "@/lib/format";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const STATUS_META: Record<string, { label: string; className: string }> = {
  disconnected: {
    label: "Belum terhubung",
    className: "bg-muted text-muted-foreground",
  },
  connected: {
    label: "Terhubung",
    className: "bg-emerald-500/15 text-emerald-700",
  },
  failed: { label: "Gagal", className: "bg-rose-500/15 text-rose-700" },
};

const SCHEDULE_LABEL: Record<string, string> = {
  daily: "Harian",
  weekly: "Mingguan",
  monthly: "Bulanan",
};

const DAY_NAMES = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export function WhatsAppPage() {
  const connection = useQuery(api.whatsapp.connection);
  const schedules = useQuery(api.whatsapp.schedules);
  const logs = useQuery(api.whatsapp.logs, { limit: 50 });
  const categories = useQuery(api.categories.list, { kind: "expense" });

  const connect = useMutation(api.whatsapp.connect);
  const disconnect = useMutation(api.whatsapp.disconnect);
  const updatePrefs = useMutation(api.whatsapp.updatePrefs);
  const upsertSchedule = useMutation(api.whatsapp.upsertSchedule);
  const removeSchedule = useMutation(api.whatsapp.removeSchedule);
  const requestSummary = useMutation(api.whatsapp.requestSummary);
  const simulate = useMutation(api.whatsapp.simulateIncoming);

  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<
    Array<{ from: "me" | "bot"; text: string; at: number }>
  >([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<
    "daily" | "weekly" | "monthly"
  >("daily");
  const [sendTime, setSendTime] = useState("20:00");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (connection?.phone && !phone) setPhone(connection.phone);
  }, [connection?.phone, phone]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const status = connection?.status ?? "disconnected";

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connect({ phone });
      toast.success("Nomor WhatsApp berhasil dihubungkan!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghubungkan",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    setChat(prev => [...prev, { from: "me", text, at: Date.now() }]);
    try {
      const result = await simulate({ text });
      setChat(prev => [
        ...prev,
        { from: "bot", text: result.reply, at: Date.now() },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal";
      setChat(prev => [
        ...prev,
        { from: "bot", text: `⚠️ ${message}`, at: Date.now() },
      ]);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Bot WhatsApp"
        description="Catat keuangan lewat chat, terima notifikasi & ringkasan otomatis"
        actions={
          status === "connected" && (
            <Button
              variant="outline"
              onClick={() =>
                void disconnect({}).then(() =>
                  toast.success("Koneksi diputuskan"),
                )
              }
            >
              <Link2Off className="size-4" />
              Putuskan koneksi
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Koneksi WhatsApp</CardTitle>
                <CardDescription>
                  {connection?.phone
                    ? `Nomor kamu: +${connection.phone}`
                    : "Kaitkan nomor WhatsApp pribadi kamu"}
                </CardDescription>
              </div>
              <Badge className={STATUS_META[status]?.className ?? STATUS_META.disconnected.className}>
                {STATUS_META[status]?.label ?? "Tidak diketahui"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {status !== "connected" && (
              <>
                {connection?.botPhone && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                    <p className="font-medium">Nomor Bot Finyu:</p>
                    <p className="mt-1 font-mono text-lg">+{connection.botPhone}</p>
                    <p className="mt-2 text-xs text-emerald-700">
                      Setelah menghubungkan nomor, kirim pesan ke nomor bot di atas untuk mulai mencatat keuangan via WhatsApp.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="wa-phone">Nomor WhatsApp pribadi kamu</Label>
                  <Input
                    id="wa-phone"
                    placeholder="08123456789"
                    value={phone}
                    onChange={event => setPhone(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Masukkan nomor WA yang akan kamu pakai untuk chat ke bot Finyu. Format: 08xx atau +62xx.
                  </p>
                </div>
                {!connection?.gatewayConfigured && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
                    Gateway belum dikonfigurasi oleh admin. Bot belum bisa membalas pesan secara langsung via WhatsApp.
                  </p>
                )}
                <Button onClick={() => void handleConnect()} disabled={busy || !phone.trim()}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Phone className="size-4" />
                  )}
                  Hubungkan Nomor
                </Button>
              </>
            )}

            {status === "connected" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                  <p>
                    Tersambung sejak{" "}
                    {connection?.connectedAt
                      ? formatDateTime(connection.connectedAt)
                      : "-"}
                  </p>
                  {connection?.botPhone && (
                    <p className="mt-1 text-xs">
                      Kirim pesan ke <span className="font-mono font-medium">+{connection.botPhone}</span> untuk mencatat keuangan.
                    </p>
                  )}
                </div>
                {[
                  ["alertRealtime", "Alert real-time setiap transaksi baru"],
                  ["alertBudget", "Peringatan anggaran 80% & 100%"],
                  ["alertGoal", "Notifikasi goal tabungan tercapai"],
                ].map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={Boolean(
                        connection?.[
                          key as "alertRealtime" | "alertBudget" | "alertGoal"
                        ],
                      )}
                      onCheckedChange={checked =>
                        void updatePrefs({ [key]: checked })
                      }
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <Label className="text-xs">
                    Kategori yang di-mute (tidak dikirim alert)
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(categories ?? [])
                      .filter(cat => !cat.parentId)
                      .map(cat => {
                        const muted = (
                          connection?.mutedCategoryIds ?? []
                        ).includes(cat.id as Id<"categories">);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
                              void updatePrefs({
                                mutedCategoryIds: muted
                                  ? (connection?.mutedCategoryIds ?? []).filter(
                                      id => id !== cat.id,
                                    )
                                  : [
                                      ...(connection?.mutedCategoryIds ?? []),
                                      cat.id as Id<"categories">,
                                    ],
                              })
                            }
                            className={
                              muted
                                ? "rounded-full border border-rose-300 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700"
                                : "rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                            }
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
                {connection?.lastError && (
                  <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-700">
                    Error terakhir: {connection.lastError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-primary" />
              Simulator chat bot
            </CardTitle>
            <CardDescription>
              Coba perintah bot langsung dari sini — logikanya identik dengan
              bot WhatsApp sungguhan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                "saldo",
                "pengeluaran bulan",
                "makan siang 25000",
                "bantu",
              ].map(cmd => (
                <Button
                  key={cmd}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setChatInput(cmd)}
                >
                  {cmd}
                </Button>
              ))}
            </div>
            <div className="min-h-64 flex-1 space-y-2 overflow-y-auto rounded-xl border bg-[#e7f5ec] p-3 dark:bg-muted/30">
              {chat.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  Belum ada pesan. Coba kirim <code>bantu</code>.
                </p>
              )}
              {chat.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.from === "me"
                      ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-500 px-3 py-2 text-sm text-white"
                      : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm shadow-sm dark:bg-card"
                  }
                >
                  {message.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Tulis pesan seperti di WhatsApp…"
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Enter") void sendChat();
                }}
              />
              <Button onClick={() => void sendChat()}>
                <Send className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">
              Jadwal ringkasan otomatis
            </CardTitle>
            <CardDescription>
              Ringkasan harian / mingguan / bulanan dikirim ke WhatsApp sesuai
              jam pilihanmu (zona Asia/Jakarta)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Select
              onValueChange={value =>
                void requestSummary({
                  type: value as "daily" | "weekly" | "monthly",
                }).then(() => toast.success("Ringkasan dikirim sekarang"))
              }
            >
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Kirim sekarang…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Ringkasan harian</SelectItem>
                <SelectItem value="weekly">Ringkasan mingguan</SelectItem>
                <SelectItem value="monthly">Ringkasan bulanan</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setScheduleOpen(true)}>
              <Plus className="size-4" />
              Tambah jadwal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(schedules ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada jadwal. Tambahkan supaya ringkasan keuangan masuk
              otomatis ke WhatsApp.
            </p>
          ) : (
            (schedules ?? []).map(schedule => (
              <div
                key={schedule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <BellRing className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">
                      {SCHEDULE_LABEL[schedule.type]} · {schedule.sendTime}
                      {schedule.type === "weekly" &&
                        schedule.dayOfWeek !== null &&
                        ` · ${DAY_NAMES[schedule.dayOfWeek]}`}
                      {schedule.type === "monthly" &&
                        schedule.dayOfMonth !== null &&
                        ` · tanggal ${schedule.dayOfMonth}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.lastSentAt
                        ? `Terakhir dikirim ${relativeTime(schedule.lastSentAt)}`
                        : "Belum pernah dikirim"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={schedule.isActive}
                    onCheckedChange={checked =>
                      void upsertSchedule({
                        id: schedule.id,
                        type: schedule.type,
                        sendTime: schedule.sendTime,
                        dayOfWeek: schedule.dayOfWeek ?? undefined,
                        dayOfMonth: schedule.dayOfMonth ?? undefined,
                        isActive: checked,
                      })
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() =>
                      void removeSchedule({ id: schedule.id }).then(() =>
                        toast.success("Jadwal dihapus"),
                      )
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log pesan</CardTitle>
          <CardDescription>
            Semua pesan masuk & keluar tersimpan untuk audit (50 terakhir)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {(logs ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada pesan
            </p>
          ) : (
            (logs ?? []).map(log => (
              <div
                key={log.id}
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <Badge
                  variant={log.direction === "in" ? "secondary" : "default"}
                  className="mt-0.5 shrink-0"
                >
                  {log.direction === "in" ? "Masuk" : "Keluar"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-foreground">
                    {log.message.length > 220
                      ? `${log.message.slice(0, 220)}…`
                      : log.message}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {log.intent ?? "-"} · {log.status} · {relativeTime(log.at)}
                    {log.error ? ` · ${log.error}` : ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah jadwal ringkasan</DialogTitle>
            <DialogDescription>
              Ringkasan dikirim ke WhatsApp yang terhubung.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipe ringkasan</Label>
              <Select
                value={scheduleType}
                onValueChange={value =>
                  setScheduleType(value as "daily" | "weekly" | "monthly")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Harian</SelectItem>
                  <SelectItem value="weekly">Mingguan</SelectItem>
                  <SelectItem value="monthly">Bulanan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Jam kirim (WIB)</Label>
              <Input
                type="time"
                value={sendTime}
                onChange={event => setSendTime(event.target.value)}
              />
            </div>
            {scheduleType === "weekly" && (
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select
                  value={String(dayOfWeek)}
                  onValueChange={value => setDayOfWeek(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((day, index) => (
                      <SelectItem key={day} value={String(index)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scheduleType === "monthly" && (
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={event => setDayOfMonth(Number(event.target.value))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() =>
                void upsertSchedule({
                  type: scheduleType,
                  sendTime,
                  dayOfWeek: scheduleType === "weekly" ? dayOfWeek : undefined,
                  dayOfMonth:
                    scheduleType === "monthly" ? dayOfMonth : undefined,
                  isActive: true,
                })
                  .then(() => {
                    toast.success("Jadwal ditambahkan");
                    setScheduleOpen(false);
                  })
                  .catch(error =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Gagal menyimpan",
                    ),
                  )
              }
            >
              Simpan jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
