"use client";

import React from "react";
import { useAuth } from "@/components/providers/auth-provider";

export default function LockBanner() {
  const { lockMessage } = useAuth();

  if (!lockMessage) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-600/95 p-3 text-white shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-sm font-medium">{lockMessage}</p>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  // allow user to dismiss banner locally; it will reappear if still locked on next refresh
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const w = window as any;
                    if (w && w.__ADQ__) {
                      w.__ADQ__.dismissedLockMessage = true;
                    }
                  } catch {}
                }}
                className="inline-flex rounded-md bg-white/10 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/20 focus:outline-none"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
