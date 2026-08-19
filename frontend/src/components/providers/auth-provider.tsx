import { createClient } from "@supabase/supabase-js";
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  packageTier: string;
  isLocked?: boolean;
  termsAccepted?: boolean;
  [key: string]: any;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  lockMessage: string | null;
  login: (...args: any[]) => Promise<any>;
  register: (...args: any[]) => Promise<any>;
  loginWithGoogle: (...args: any[]) => Promise<any>;
  logout: (...args: any[]) => Promise<void>;
  signOut: (...args: any[]) => Promise<void>;
  acceptTerms: (...args: any[]) => Promise<any>;
  setupGoogleRecovery: (...args: any[]) => Promise<any>;
  updateUser: (data: Partial<UserProfile>) => void;
}

const defaultUser: UserProfile = {
  id: "usr_default",
  email: "",
  name: "",
  role: "USER",
  packageTier: "FREE",
  isLocked: false,
  termsAccepted: true,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  lockMessage: null,
  login: async () => {},
  register: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
  signOut: async () => {},
  acceptTerms: async () => {},
  setupGoogleRecovery: async () => {},
  updateUser: () => {},
});


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  useEffect(() => {
    // Bỏ qua hoàn toàn Auth check nếu đang ở domain adq-soc.click hoặc /admin
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || pathname?.startsWith("/admin")) {
        setLoading(false);
        return;
      }
    }

    if (typeof window !== "undefined") {
      try {
        const localUser = localStorage.getItem("adq_user_session");
        if (localUser) {
          const parsed = JSON.parse(localUser);
          setUser({ ...defaultUser, ...parsed });
          if (parsed.isLocked) {
            setLockMessage("Tài khoản tạm thời bị khóa do vi phạm chính sách.");
          }
        }
      } catch {}
      setLoading(false);
    }
  }, [pathname]);

  const login = async (email?: string, password?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        const fullUser = { ...defaultUser, ...data.user };
        setUser(fullUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("adq_user_session", JSON.stringify(fullUser));
        }
        return data;
      }
      return data;
    } catch (e) {
      return { ok: false, error: e };
    }
  };

  const register = async (payload?: any) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: e };
    }
  };

    const loginWithGoogle = async (...args: any[]) => {
    if (typeof window !== "undefined") {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) console.error("Google Auth Error:", error);
      } else {
        // Fallback sang API backend nếu có cấu hình
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL || ""}/api/auth/google/login`;
      }
    }
  };

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_user_session");
      setUser(null);
      window.location.href = "/login";
    }
  };

  const signOut = logout;

  const acceptTerms = async () => {
    if (user) {
      const updated = { ...user, termsAccepted: true };
      setUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("adq_user_session", JSON.stringify(updated));
      }
    }
  };

  const setupGoogleRecovery = async (...args: any[]) => {
    return { ok: true };
  };

  const updateUser = (data: Partial<UserProfile>) => {
    if (user) {
      const updated = { ...user, ...data };
      setUser(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("adq_user_session", JSON.stringify(updated));
      }
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
        signOut,
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
