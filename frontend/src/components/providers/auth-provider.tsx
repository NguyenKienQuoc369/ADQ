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
  login: (email?: string, password?: string) => Promise<any>;
  register: (payload?: any) => Promise<any>;
  loginWithGoogle: (...args: any[]) => Promise<any>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  acceptTerms: () => Promise<any>;
  setupGoogleRecovery: (...args: any[]) => Promise<any>;
  updateUser: (data: Partial<UserProfile>) => void;
}

const defaultUser: UserProfile = {
  id: "usr_default",
  email: "quockien2006@gmail.com",
  name: "Nguyễn Kiến Quốc",
  role: "USER",
  packageTier: "PRO_MAX",
  isLocked: false,
  termsAccepted: true,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  lockMessage: null,
  login: async () => ({ ok: true }),
  register: async () => ({ ok: true }),
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
  const [loading, setLoading] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  // Chỉ đọc session từ localStorage 1 lần khi component mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || pathname?.startsWith("/admin")) {
        return;
      }
      try {
        const stored = localStorage.getItem("adq_user_session");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email) {
            setUser({ ...defaultUser, ...parsed });
          }
        }
      } catch {}
    }
  }, [pathname]);

  const login = async (email?: string, password?: string) => {
    const userObj: UserProfile = {
      ...defaultUser,
      id: "usr_" + Date.now(),
      email: email || "user@adq.io.vn",
      name: (email || "user").split("@")[0],
    };
    setUser(userObj);
    if (typeof window !== "undefined") {
      localStorage.setItem("adq_user_session", JSON.stringify(userObj));
    }
    return { ok: true, user: userObj };
  };

  const register = async (payload?: any) => {
    const userObj: UserProfile = {
      ...defaultUser,
      id: "usr_" + Date.now(),
      email: payload?.email || "user@adq.io.vn",
      name: payload?.name || "New User",
    };
    setUser(userObj);
    if (typeof window !== "undefined") {
      localStorage.setItem("adq_user_session", JSON.stringify(userObj));
    }
    return { ok: true, user: userObj };
  };

  const loginWithGoogle = async () => {
    const googleUser: UserProfile = {
      ...defaultUser,
      id: "usr_google_" + Date.now(),
      email: "google.account@adq.io.vn",
      name: "Google Account",
    };
    setUser(googleUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("adq_user_session", JSON.stringify(googleUser));
      window.location.href = "/dashboard";
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
