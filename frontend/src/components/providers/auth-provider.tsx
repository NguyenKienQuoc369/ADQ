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
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("adq_cached_user");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const fetchAccountData = async (accessToken?: string) => {
    try {
      const supabase = createSupabaseBrowserClient();
      let token = accessToken;
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      }

      if (!token) {
        setUser(null);
        localStorage.removeItem("adq_cached_user");
        return;
      }

      const res = await fetch("/api/account", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.user) {
          setUser(json.user);
          localStorage.setItem("adq_cached_user", JSON.stringify(json.user));
          if (json.user.status === "LOCKED") {
            setLockMessage("Tài khoản của bạn tạm thời bị khóa. Vui lòng liên hệ quản trị viên.");
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    const initAuth = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchAccountData(session.access_token);
      } else {
        setUser(null);
        localStorage.removeItem("adq_cached_user");
      }
      setLoading(false);
    };

    initAuth();

    const supabase = createSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchAccountData(session.access_token);
      } else {
        setUser(null);
        localStorage.removeItem("adq_cached_user");
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Khi chuyển trang, đồng bộ nhẹ nhàng trong nền
  useEffect(() => {
    fetchAccountData();
  }, [pathname]);

  const login = async (email: string, pass: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
    if (data.session) await fetchAccountData(data.session.access_token);
    return { ok: true, user: data.user };
  };

  const register = async (payload: { name: string; email: string; password: string }) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: { data: { name: payload.name, full_name: payload.name } },
    });
    if (error) throw error;
    if (data.session) await fetchAccountData(data.session.access_token);
    return { ok: true, user: data.user };
  };

  const loginWithGoogle = async (targetDestination?: string) => {
    const supabase = createSupabaseBrowserClient();
    const redirectUrl = targetDestination || `${window.location.origin}/auth/callback?next=/dashboard`;
    return await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
  };

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    localStorage.removeItem("adq_cached_user");
    setUser(null);
    window.location.href = "/login";
  };

  const acceptTerms = async () => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.updateUser({ data: { termsAccepted: true } }).catch(() => {});
    const updated = { ...user, termsAccepted: true } as any;
    setUser(updated);
    localStorage.setItem("adq_cached_user", JSON.stringify(updated));
  };

  const setupGoogleRecovery = async (data: { name: string; username: string; password: string }) => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.updateUser({
      password: data.password,
      data: { name: data.name, full_name: data.name, username: data.username, hasRecoveryPassword: true },
    }).catch(() => {});
    const updated = { ...user, name: data.name, hasRecoveryPassword: true } as any;
    setUser(updated);
    localStorage.setItem("adq_cached_user", JSON.stringify(updated));
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("adq_cached_user", JSON.stringify(updated));
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
