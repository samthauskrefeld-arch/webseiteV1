"use client";
import type { RoleType } from "@myminijob/core";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

export interface Me {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  activeRole: RoleType;
  roles: RoleType[];
  isAdmin: boolean;
}
interface SessionCtx {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (m: Me | null) => void;
}
const Ctx = createContext<SessionCtx>({ me: null, loading: true, refresh: async () => {}, setMe: () => {} });
export const useSession = () => useContext(Ctx);

export function SessionProvider({ initial, children }: { initial: Me | null; children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(initial);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ user: Me | null }>("/me");
      setMe(r.user);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setMe(initial);
  }, [initial]);
  return <Ctx.Provider value={{ me, loading, refresh, setMe }}>{children}</Ctx.Provider>;
}
