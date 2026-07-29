import { useMutation, useQuery } from "convex/react";
import { Bell, Check, ChevronDown, Eye, Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useScope } from "@/contexts/ScopeContext";
import { formatDateTime } from "@/lib/format";
import { api } from "../../../convex/_generated/api";

/** Menyiapkan profil + kategori default saat pertama kali login. */
function useBootstrap() {
  const me = useQuery(api.profiles.me);
  const bootstrap = useMutation(api.profiles.bootstrap);
  const fired = useRef(false);
  useEffect(() => {
    if (!me || me.hasProfile || fired.current) return;
    fired.current = true;
    void bootstrap({});
  }, [me, bootstrap]);
}

export function AppTopBar() {
  useBootstrap();
  const { ownerId, setOwnerId, shares, activeLabel, canEdit } = useScope();
  const notifications = useQuery(api.notifications.list, { limit: 15 });
  const unread = useQuery(api.notifications.unreadCount);
  const markAllRead = useMutation(api.notifications.markAllRead);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
      <SidebarTrigger className="md:hidden" />

      {shares.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Users className="size-3.5" />
              {activeLabel}
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Data yang ditampilkan</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setOwnerId(undefined)}>
              {!ownerId && <Check className="size-3.5" />}
              Data saya
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {shares.map(share => (
              <DropdownMenuItem
                key={share.ownerId}
                onClick={() => setOwnerId(share.ownerId)}
              >
                {ownerId === share.ownerId && <Check className="size-3.5" />}
                <span className="flex-1 truncate">{share.ownerName}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {share.role === "editor" ? "edit" : "lihat"}
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {!canEdit && (
        <Badge variant="secondary" className="gap-1">
          <Eye className="size-3" />
          Mode lihat saja
        </Badge>
      )}

      <div className="flex-1" />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="size-4" />
            {(unread ?? 0) > 0 && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-medium">Notifikasi</p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void markAllRead({})}
            >
              Tandai terbaca
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(notifications ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Belum ada notifikasi
              </p>
            ) : (
              (notifications ?? []).map(item => (
                <div
                  key={item.id}
                  className={
                    item.readAt
                      ? "border-b px-3 py-2 last:border-0"
                      : "border-b bg-primary/5 px-3 py-2 last:border-0"
                  }
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.body}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatDateTime(item.at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
}
