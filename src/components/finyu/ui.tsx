import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Minus,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DeltaBadge({
  percent,
  invert,
}: {
  percent: number | null;
  invert?: boolean;
}) {
  if (percent === null)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> belum ada pembanding
      </span>
    );
  const up = percent > 0;
  const good = invert ? up : !up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        good ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {up ? (
        <ArrowUpRight className="size-3.5" />
      ) : (
        <ArrowDownRight className="size-3.5" />
      )}
      {Math.abs(percent).toFixed(0)}% dari bulan lalu
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  footer,
  accent = "primary",
  onClick,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  footer?: ReactNode;
  accent?: "primary" | "sky" | "amber" | "rose";
  onClick?: () => void;
}) {
  const accents: Record<string, string> = {
    primary: "bg-emerald-500/10 text-emerald-600",
    sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };
  return (
    <Card
      className={cn(
        "border-border/70 shadow-sm transition",
        onClick && "cursor-pointer hover:border-primary/40 hover:shadow-md",
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {icon && (
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                accents[accent],
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
        {footer}
      </CardContent>
    </Card>
  );
}

export function ProgressBar({
  ratio,
  className,
}: {
  ratio: number;
  className?: string;
}) {
  const percent = Math.min(100, Math.max(0, ratio * 100));
  const color =
    ratio >= 1
      ? "bg-rose-500"
      : ratio >= 0.8
        ? "bg-amber-500"
        : ratio >= 0.5
          ? "bg-emerald-500"
          : "bg-emerald-400";
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function GoalProgressBar({ percent }: { percent: number }) {
  const color =
    percent >= 75
      ? "bg-emerald-500"
      : percent >= 50
        ? "bg-amber-400"
        : percent >= 25
          ? "bg-orange-400"
          : "bg-rose-400";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

export function EmptyBox({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          {icon}
        </span>
      )}
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-28 animate-pulse rounded-xl bg-muted/60", className)}
    />
  );
}

/** Multi-select ringan (popover + checkbox) untuk filter kategori/dompet. */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string; color?: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(item => item !== value)
        : [...selected, value],
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="justify-between gap-2">
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-72 w-60 overflow-y-auto p-2"
      >
        {options.length === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Tidak ada pilihan
          </p>
        )}
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded border",
                selected.includes(option.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input",
              )}
            >
              {selected.includes(option.value) && <Check className="size-3" />}
            </span>
            {option.color && (
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: option.color }}
              />
            )}
            <span className="truncate">{option.label}</span>
          </button>
        ))}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted"
          >
            Bersihkan pilihan
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
