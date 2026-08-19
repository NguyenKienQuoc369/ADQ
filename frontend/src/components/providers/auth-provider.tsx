"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { User } from "@/lib/api";

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  lockMessage: string | null;
  login: (email: string, pass: string) => Promise<any>;
  register: (payload: { name: string; email: string; password: string }) => Promise<any>;
  loginWithGoogle: (targetDestination?: string) => Promise<any>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  acceptTerms: () => Promise<any>;
  setupGoogleRecovery: (data: { name: string; username: string; password: string }) => Promise<any>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  lockMessage: null,
  login: async () => ({}),
  register: async () => ({}),
  loginWithGoogle: async () => {},
  logout: async () => {},
  signOut: async () => {},
  acceptTerms: async () => {},
  setupGoogleRecovery: async () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const fetchCurrentSession = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        setUser(null);
        return;
      }

      const metadata = session.user.user_metadata || {};
      const appMetadata = session.user.app_metadata || {};
      const isGoogle = appMetadata.provider === "google" || session.user.identities?.some(i => i.provider === "google");

      const currentUser: User = {
        id: session.user.id,
        name: metadata.name || metadata.full_name || session.user.email?.split("@")[0] || "User",
        email: session.user.email || "",
        avatar: metadata.avatar_url || metadata.picture || undefined,
        role: metadata.role === "ADMIN" ? "ADMIN" : "USER",
        packageTier: metadata.packageTier || "FREE",
        status: metadata.status || "ACTIVE",
        dailyLimit: (metadata?.packageTier === "PRO" || metadata?.packageTier === "PRO_MAX" || metadata?.packageTier === "ENTERPRISE") ? 999999 : 2,
        scansToday: metadata.scansToday || 0,
        telegramConnected: Boolean(metadata.telegramConnected),
        planExpiresAt: metadata.planExpiresAt || null,
        oauthProvider: isGoogle ? "google" : null,
        lastLoginAt: new Date().toISOString(),
        ...(metadata.termsAccepted ? { termsAccepted: true } : {}),
        ...(metadata.hasRecoveryPassword ? { hasRecoveryPassword: true } : {}),
      };

      setUser(currentUser);
      if (currentUser.status === "LOCKED") {
        setLockMessage("Tài khoản của bạn tạm thời bị khóa. Vui lòng liên hệ quản trị viên.");
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentSession();
    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchCurrentSession();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  const login = async (email: string, pass: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    await fetchCurrentSession();
    return { ok: true, user: data.user };
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          name: payload.name,
          full_name: payload.name,
        },
      },
    });
    if (error) throw error;
    await fetchCurrentSession();
    return { ok: true, user: data.user };
  };

  const loginWithGoogle = async (targetDestination?: string) => {
    const supabase = createSupabaseBrowserClient();
    const redirectUrl = targetDestination || `${window.location.origin}/auth/callback?next=/dashboard`;
    return await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
  };

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem("adq_user_session");
    setUser(null);
    window.location.href = "/login";
  };

  const acceptTerms = async () => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.updateUser({
      data: { termsAccepted: true },
    }).catch(() => {});
    localStorage.setItem(`adq_terms_accepted_${user.id}`, "true");
    setUser({ ...user, termsAccepted: true } as any);
  };

  const setupGoogleRecovery = async (data: { name: string; username: string; password: string }) => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.updateUser({
      password: data.password,
      data: {
        name: data.name,
        full_name: data.name,
        username: data.username,
        hasRecoveryPassword: true,
      },
    }).catch(() => {});
    localStorage.setItem(`adq_recovery_setup_${user.id}`, "true");
    setUser({ ...user, name: data.name, hasRecoveryPassword: true } as any);
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        lockMessage,
        login,
        register,
        loginWithGoogle,
        logout,
        signOut: logout,
        acceptTerms,
        setupGoogleRecovery,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
