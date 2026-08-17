import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-[color:var(--background-muted)]", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all dark:from-cyan-400 dark:to-emerald-400"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
