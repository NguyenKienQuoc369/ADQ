"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface AuthContextType {
  user: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Nếu đang ở domain admin hoặc route /admin -> Tắt hoàn toàn auth check của user
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.includes("adq-soc.click") || pathname?.startsWith("/admin")) {
        setLoading(false);
        return;
      }
    }

    // Đọc session user từ localStorage nếu có
    if (typeof window !== "undefined") {
      try {
        const localUser = localStorage.getItem("adq_user_session");
        if (localUser) {
          setUser(JSON.parse(localUser));
        }
      } catch {}
      setLoading(false);
    }
  }, [pathname]);

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adq_user_session");
      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
