"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
  {
    variants: {
      variant: {
        default:
          "border-[color:color-mix(in_srgb,var(--accent)_28%,transparent)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)] hover:bg-[color:color-mix(in_srgb,var(--accent)_18%,transparent)]",
        secondary:
          "border-[color:var(--line)] bg-[color:var(--background-muted)] text-[color:var(--foreground)] hover:bg-[color:var(--background-strong)]",
        outline:
          "border-[color:var(--line-strong)] bg-transparent text-[color:var(--foreground)] hover:bg-[color:var(--background-muted)]",
        ghost:
          "border-transparent bg-transparent text-[color:var(--foreground-soft)] hover:bg-[color:var(--background-muted)] hover:text-[color:var(--foreground)]",
        destructive:
          "border-[color:rgba(225,29,72,0.28)] bg-[color:rgba(225,29,72,0.12)] text-rose-600 hover:bg-[color:rgba(225,29,72,0.18)] dark:text-rose-100",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-lg px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
