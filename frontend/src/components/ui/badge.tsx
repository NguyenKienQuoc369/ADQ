import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
  {
    variants: {
      variant: {
        default:
          "border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-200",
        danger: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-200",
        muted: "border-[color:var(--line)] bg-[color:var(--background-muted)] text-[color:var(--foreground-soft)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
