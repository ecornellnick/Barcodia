import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { api, User } from "@/src/lib/api";
import { exchangeSessionId, parseSessionId } from "@/src/lib/googleAuth";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  googleLoginWeb: () => Promise<void>;
  setAuthFromGoogle: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      setUser(null);
      await storage.secureRemove("bq_token");
    }
  }, []);

  // On mount: process ?session_id / #session_id on web first; then try existing token
  useEffect(() => {
    (async () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const url = window.location.href;
        const sid = parseSessionId(url);
        if (sid) {
          // Clean URL fragment/query before any await to avoid double-processing
          window.history.replaceState(null, "", window.location.pathname);
          const r = await exchangeSessionId(sid);
          if (r) {
            setUser(r.user);
            setLoading(false);
            return;
          }
        }
      }
      const token = await storage.secureGet<string>("bq_token", "");
      if (token) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const r = await api.login(email, password);
    await storage.secureSet("bq_token", r.token);
    setUser(r.user);
  };

  const register = async (email: string, password: string, username: string) => {
    const r = await api.register(email, password, username);
    await storage.secureSet("bq_token", r.token);
    setUser(r.user);
  };

  const googleLoginWeb = async () => {
    // Importing only on call to avoid loading WebBrowser eagerly on web
    const { signInWithGoogle } = await import("@/src/lib/googleAuth");
    await signInWithGoogle(); // navigates the browser; resolution on mount
  };

  const setAuthFromGoogle = async (token: string, u: User) => {
    await storage.secureSet("bq_token", token);
    setUser(u);
  };

  const logout = async () => {
    await storage.secureRemove("bq_token");
    setUser(null);
  };

  return (
    <Ctx.Provider
      value={{ user, loading, login, register, googleLoginWeb, setAuthFromGoogle, logout, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
