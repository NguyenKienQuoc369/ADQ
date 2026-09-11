"use client";

import React, { useState, useEffect } from "react";
import type { User } from "@/lib/api";

export function getCanonicalDisplayName(user: Partial<User> | null | undefined): string {
  if (!user) return "Người dùng";
  const name =
    user.name?.trim() ||
    (user as any).displayName?.trim() ||
    (user as any).display_name?.trim() ||
    (user as any).full_name?.trim() ||
    (user as any).user_metadata?.name?.trim() ||
    (user as any).user_metadata?.full_name?.trim();

  if (name) return name;
  if (user.email) {
    const local = user.email.split("@")[0];
    if (local) return local;
  }
  return "Người dùng";
}

export function getCanonicalAvatarUrl(user: Partial<User> | null | undefined): string | null {
  if (!user) return null;
  const raw =
    user.avatar ||
    (user as any).avatarUrl ||
    (user as any).avatar_url ||
    (user as any).user_metadata?.avatar_url ||
    (user as any).user_metadata?.picture ||
    (user as any).user_metadata?.avatar ||
    (user as any).picture ||
    null;

  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return null;
}

export function getCanonicalInitials(nameOrEmail?: string | null): string {
  const clean = (nameOrEmail || "").trim();
  if (!clean) return "U";

  // If email, take first letter of local-part
  if (clean.includes("@")) {
    const local = clean.split("@")[0];
    return (local[0] || "U").toUpperCase();
  }

  // If Vietnamese/multi-word name, e.g. "Nguyễn Kiến Quốc" -> "NQ"
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0][0] || "";
    const last = words[words.length - 1][0] || "";
    return `${first}${last}`.toUpperCase();
  }

  return clean.slice(0, 1).toUpperCase();
}

export function getCanonicalPackageTier(user: Partial<User> | null | undefined): "FREE" | "PRO" | "PRO_MAX" {
  if (!user) return "FREE";
  if (user.planExpiresAt) {
    const expiryTime = new Date(user.planExpiresAt).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime <= Date.now()) {
      return "FREE";
    }
  }

  const raw = String(user.packageTier || "").trim().toUpperCase();
  if (raw === "PRO_MAX") return "PRO_MAX";
  if (raw === "PRO") return "PRO";
  return "FREE";
}

interface UserAvatarProps {
  user?: Partial<User> | null;
  avatarUrl?: string | null;
  displayName?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  imgClassName?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
  xl: "h-14 w-14 text-base",
};

export function UserAvatar({
  user,
  avatarUrl,
  displayName,
  size = "sm",
  className = "",
  imgClassName = "",
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const effectiveAvatarUrl = avatarUrl !== undefined ? avatarUrl : getCanonicalAvatarUrl(user);
  const effectiveDisplayName = displayName !== undefined ? displayName : getCanonicalDisplayName(user);
  const initials = getCanonicalInitials(effectiveDisplayName || user?.email);

  // Reset error when url changes
  useEffect(() => {
    setImageError(false);
  }, [effectiveAvatarUrl]);

  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-bold text-neutral-200 overflow-hidden border border-neutral-700 select-none ${sizeClass} ${className}`}
    >
      {effectiveAvatarUrl && !imageError ? (
        <img
          src={effectiveAvatarUrl}
          alt={effectiveDisplayName || "User Avatar"}
          onError={() => setImageError(true)}
          className={`h-full w-full object-cover rounded-full ${imgClassName}`}
        />
      ) : (
        <span className="font-mono">{initials}</span>
      )}
    </div>
  );
}
