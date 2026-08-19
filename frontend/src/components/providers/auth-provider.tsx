"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  useEffect(() => {
    // Tách biệt hoàn toàn: Không kiểm tra auth nếu đang ở adq-soc.click hoặc route admin
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || pathname?.startsWith("/admin")) {
        setLoading(false);
        return;
      }
    }

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const profile: UserProfile = {
            ...defaultUser,
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User",
          };
          setUser(profile);
        }
        setLoading(false);
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            ...defaultUser,
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "User",
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        authListener?.subscription.unsubscribe();
      };
    } else {
      if (typeof window !== "undefined") {
        try {
          const localUser = localStorage.getItem("adq_user_session");
          if (localUser) setUser({ ...defaultUser, ...JSON.parse(localUser) });
        } catch {}
      }
      setLoading(false);
    }
  }, [pathname]);

  const login = async (email?: string, password?: string) => {
    if (supabase && email && password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: error.message };
      return { ok: true, user: data.user };
    }
    return { ok: false, error: "Supabase not initialized" };
  };

  const register = async (payload?: any) => {
    if (supabase && payload?.email && payload?.password) {
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: { data: { full_name: payload.name } },
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, user: data.user };
    }
    return { ok: false, error: "Supabase not initialized" };
  };

  const loginWithGoogle = async () => {
    if (typeof window !== "undefined") {
      if (supabase) {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
          },
        });
      }
    }
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
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

  const setupGoogleRecovery = async () => ({ ok: true });

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
