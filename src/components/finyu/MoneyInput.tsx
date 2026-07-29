import { Input } from "@/components/ui/input";
import { formatMoneyInput, parseMoneyInput } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  autoFocus?: boolean;
};

/** Input nominal dengan format ribuan otomatis (Rp 1.250.000). */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  className,
  autoFocus,
}: Props) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        className={cn("pl-9 font-medium tabular-nums", className)}
        placeholder={placeholder ?? "0"}
        value={formatMoneyInput(value)}
        onChange={event => onChange(parseMoneyInput(event.target.value))}
      />
    </div>
  );
}
