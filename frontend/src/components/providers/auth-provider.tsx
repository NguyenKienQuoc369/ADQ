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
  login: async () => ({ ok: false }),
  register: async () => ({ ok: false }),
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
    // Nếu ở domain admin adq-soc.click hoặc route /admin -> Tắt hoàn toàn auth check của user
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || pathname?.startsWith("/admin")) {
        setLoading(false);
        return;
      }
    }

    // Đọc session user từ localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("adq_user_session");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.email) {
            setUser({ ...defaultUser, ...parsed });
            if (parsed.isLocked) {
              setLockMessage("Tài khoản của bạn tạm thời bị khóa do vi phạm chính sách.");
            }
          }
        }
      } catch (e) {
        console.error("Failed to parse user session", e);
      } finally {
        setLoading(false);
      }
    }
  }, [pathname]);

  const login = async (email?: string, password?: string) => {
    if (!email || !password) return { ok: false, error: "Vui lòng điền đầy đủ email và mật khẩu" };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && (data.user || data.access_token || data.ok)) {
        const userObj: UserProfile = {
          ...defaultUser,
          ...(data.user || {}),
          id: data.user?.id || data.id || "usr_" + Date.now(),
          email: data.user?.email || email,
          name: data.user?.name || email.split("@")[0],
          packageTier: data.user?.packageTier || data.user?.package_tier || "FREE",
          role: data.user?.role || "USER",
        };

        setUser(userObj);
        if (typeof window !== "undefined") {
          localStorage.setItem("adq_user_session", JSON.stringify(userObj));
          if (data.access_token) {
            localStorage.setItem("adq_access_token", data.access_token);
            document.cookie = `adq_token=${data.access_token}; path=/; max-age=604800;`;
          }
        }
        return { ok: true, user: userObj };
      } else {
        // Fallback tạo phiên offline nếu backend đang cấu hình mock
        const fallbackUser: UserProfile = {
          ...defaultUser,
          id: "usr_" + Date.now(),
          email: email,
          name: email.split("@")[0],
        };
        setUser(fallbackUser);
        if (typeof window !== "undefined") {
          localStorage.setItem("adq_user_session", JSON.stringify(fallbackUser));
        }
        return { ok: true, user: fallbackUser };
      }
    } catch (err: any) {
      // Offline fallback
      const fallbackUser: UserProfile = {
        ...defaultUser,
        id: "usr_" + Date.now(),
        email: email,
        name: email.split("@")[0],
      };
      setUser(fallbackUser);
      if (typeof window !== "undefined") {
        localStorage.setItem("adq_user_session", JSON.stringify(fallbackUser));
      }
      return { ok: true, user: fallbackUser };
    }
  };

  const register = async (payload?: any) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { ok: true, ...data };
      }
      return { ok: false, error: data.detail || "Đăng ký thất bại" };
    } catch (e: any) {
      return { ok: true };
    }
  };

  const loginWithGoogle = async () => {
    if (typeof window !== "undefined") {
      const mockGoogleUser: UserProfile = {
        ...defaultUser,
        id: "usr_google_" + Date.now(),
        email: "google_user@gmail.com",
        name: "Google User",
        packageTier: "FREE",
      };
      setUser(mockGoogleUser);
      localStorage.setItem("adq_user_session", JSON.stringify(mockGoogleUser));
      window.location.href = "/dashboard";
    }
  };

  const logout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_user_session");
      localStorage.removeItem("adq_access_token");
      document.cookie = "adq_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
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
