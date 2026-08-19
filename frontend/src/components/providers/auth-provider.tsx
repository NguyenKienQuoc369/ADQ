"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import type { AuthResponse, User } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  lockMessage: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (payload: { name: string; email: string; password: string; company?: string; phone?: string }) => Promise<AuthResponse>;
  completeGoogleProfile: (payload: { name: string; company?: string; phone?: string; password?: string }) => Promise<User>;
  loginWithGoogle: (redirectTo?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: (showLoader?: boolean) => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeRole(rawRole: unknown): User["role"] {
  if (!rawRole) return "USER";
  const value = String(rawRole).trim().toUpperCase();
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function mapSupabaseUserToAppUser(user: SupabaseUser): User {
  const metadata = user.user_metadata ?? {};
  const role = normalizeRole(metadata.role ?? (user.app_metadata as Record<string, unknown> | undefined)?.role);
  const packageTier = (metadata.packageTier === "PRO_MAX"
    ? "PRO_MAX"
    : metadata.packageTier === "PRO"
      ? "PRO"
      : "FREE") as User["packageTier"];

  return {
    id: user.id,
    name: metadata.name || metadata.full_name || user.email?.split("@")[0] || "Chuyên gia An ninh",
    email: user.email ?? "",
    avatar: metadata.avatar_url || metadata.picture || undefined,
    role,
    packageTier,
    status: "ACTIVE",
    dailyLimit: packageTier === "FREE" ? 5 : 999,
    scansToday: 0,
    telegramConnected: false,
    planExpiresAt: null,
    oauthProvider: metadata.provider === "google" || user.app_metadata?.provider === "google" ? "google" : null,
    lastLoginAt: new Date().toISOString(),
  };
}

function mapSessionToAuthResponse(user: User, session: Session | null): AuthResponse {
  return {
    accessToken: session?.access_token ?? "",
    refreshToken: session?.refresh_token ?? "",
    user,
  };
}

function getFriendlyAuthError(error: unknown, fallback = "Đăng nhập thất bại.") {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (normalized.includes("error sending confirmation email") || normalized.includes("smtp") || normalized.includes("email provider") || normalized.includes("unable to send confirmation email")) {
    return "Email xác nhận chưa được cấu hình. Vui lòng kiểm tra cài đặt xác nhận email trong Supabase Dashboard.";
  }

  if (normalized.includes("user not found") || normalized.includes("no user found") || normalized.includes("email not found")) {
    return "Tài khoản chưa tồn tại";
  }

  if (normalized.includes("invalid login credentials") || normalized.includes("invalid email or password")) {
    return "Mật khẩu không đúng";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("confirm your email") || normalized.includes("not confirmed")) {
    return "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư email.";
  }

  if (normalized.includes("already registered") || normalized.includes("user already registered") || normalized.includes("already exists")) {
    return "Tài khoản đã tồn tại";
  }

  return fallback;
}

function getPendingOAuthUser(): User {
  return {
    id: "oauth_pending",
    name: "Đang đồng bộ SOC...",
    email: "",
    role: "USER",
    packageTier: "FREE",
    status: "PENDING",
    dailyLimit: 5,
    scansToday: 0,
    telegramConnected: false,
    planExpiresAt: null,
    oauthProvider: "google",
    lastLoginAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const getSupabaseClient = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseBrowserClient();
    }
    return supabaseRef.current;
  }, []);

  const refreshUser = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const res = await fetch('/api/account/me', { credentials: 'include', headers });
        if (res.status === 200) {
          const payload = await res.json();
          if (payload?.user) {
            setUser({
              id: payload.user.id,
              name: payload.user.name,
              email: payload.user.email,
              avatar: payload.user.avatar,
              role: payload.user.role,
              packageTier: payload.user.packageTier,
              status: payload.user.status,
              dailyLimit: payload.user.dailyLimit,
              scansToday: payload.user.scansToday,
              telegramConnected: payload.user.telegramConnected,
              planExpiresAt: payload.user.planExpiresAt,
              oauthProvider: payload.user.oauthProvider,
              lastLoginAt: payload.user.lastLoginAt,
            });
            setLockMessage(null);
            return;
          }
        }

        if (res.status === 403) {
          try {
            await supabase.auth.signOut();
          } catch {}
          setUser(null);
          setLockMessage('Tài khoản của bạn đã bị khóa');
          return;
        }
      } catch {
        // Fallback đọc trực tiếp từ Supabase Session
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setUser(null);
          return;
        }
        setUser(data.user ? mapSupabaseUserToAppUser(data.user) : null);
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getSupabaseClient]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let active = true;
    const frameHandle = window.requestAnimationFrame(() => {
      void refreshUser(true).finally(() => {
        if (!active) return;
        setLoading(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, _session) => {
      refreshUser().catch(() => {});
    });

    return () => {
      active = false;
      window.cancelAnimationFrame(frameHandle);
      subscription.subscription.unsubscribe();
    };
  }, [getSupabaseClient, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(getFriendlyAuthError(error, 'Mật khẩu không đúng'));
    }

    const nextUser = data.user ? mapSupabaseUserToAppUser(data.user) : null;
    if (!nextUser) throw new Error("Không thể lấy thông tin người dùng sau khi đăng nhập.");

    setUser(nextUser);
    setLockMessage(null);
    return mapSessionToAuthResponse(nextUser, data.session);
  }, [getSupabaseClient]);

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; company?: string; phone?: string }) => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            name: payload.name,
            company: payload.company ?? null,
            phone: payload.phone ?? null,
            role: 'USER',
            packageTier: 'FREE',
          },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined,
        },
      });

      if (error) {
        throw new Error(getFriendlyAuthError(error, 'Không thể tạo tài khoản.'));
      }

      if (!data.session) {
        throw new Error('EMAIL_CONFIRM_SENT: Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.');
      }

      const nextUser = data.user ? mapSupabaseUserToAppUser(data.user) : null;
      if (!nextUser) {
        throw new Error('EMAIL_CONFIRM_SENT: Đã gửi email xác nhận. Vui lòng kiểm tra hộp thư để kích hoạt tài khoản.');
      }

      setUser(nextUser);
      return mapSessionToAuthResponse(nextUser, data.session);
    },
    [getSupabaseClient],
  );

  const completeGoogleProfile = useCallback(async (payload: { name: string; company?: string; phone?: string; password?: string }) => {
    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw new Error("Phiên đăng nhập Google chưa sẵn sàng. Vui lòng thử lại.");
    }

    const nextName = payload.name.trim();
    if (!nextName) {
      throw new Error("Vui lòng nhập họ và tên.");
    }

    let updateArgs: {
      data: {
        name: string;
        company: string | null;
        phone: string | null;
        role: string;
        packageTier: string;
        onboarding_complete: boolean;
      };
      password?: string;
    } = {
      data: {
        name: nextName,
        company: payload.company?.trim() || null,
        phone: payload.phone?.trim() || null,
        role: "USER",
        packageTier: "FREE",
        onboarding_complete: true,
      },
    };

    if (payload.password && payload.password.trim().length >= 8) {
      updateArgs = { ...updateArgs, password: payload.password };
    }

    const { data, error } = await supabase.auth.updateUser(updateArgs);
    if (error) {
      throw new Error(getFriendlyAuthError(error, "Không thể cập nhật hồ sơ Google."));
    }

    const nextUser = data.user ? mapSupabaseUserToAppUser(data.user) : null;
    if (!nextUser) {
      throw new Error("Không thể cập nhật thông tin người dùng Google.");
    }

    setUser(nextUser);
    return nextUser;
  }, [getSupabaseClient]);

  // ĐĂNG NHẬP GOOGLE: CHUYỂN THẲNG VÀO CONSOLE (/dashboard HOẶC URL ĐÍCH)
  const loginWithGoogle = useCallback(async (targetRedirect?: string) => {
    const supabase = getSupabaseClient();
    const destination = targetRedirect || `${window.location.origin}/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: destination,
      },
    });

    if (error) throw error;

    return {
      accessToken: "",
      refreshToken: "",
      user: user ?? getPendingOAuthUser(),
    };
  }, [getSupabaseClient, user]);

  const logout = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setLockMessage(null);
  }, [getSupabaseClient]);

  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      lockMessage,
      login,
      register,
      completeGoogleProfile,
      loginWithGoogle,
      logout,
      refreshUser,
      updateUser,
    }),
    [user, loading, lockMessage, login, register, completeGoogleProfile, loginWithGoogle, logout, refreshUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
