"use client";

import { cn } from "@/components/ui/utils";

type NoiseBackgroundProps = {
  className?: string;
};

export function NoiseBackground({ className }: NoiseBackgroundProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.11] mix-blend-soft-light",
        "[background-image:radial-gradient(rgba(255,255,255,0.25)_1px,transparent_1px)]",
        "[background-size:3px_3px]",
        className,
      )}
    />
  );
}
