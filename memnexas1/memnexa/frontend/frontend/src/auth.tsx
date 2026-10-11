import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type User } from "./api";
import { useTheme } from "./theme";

type AuthCtx = { user: User | null; loading: boolean; setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<AuthCtx>(null as never);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();

  const adopt = (u: User) => {
    // Server theme wins after sign-in, unless it is still the default and this device has a choice.
    if (u.theme === "system" && theme !== "system") api.patch("/auth/me", { theme }).catch(() => {});
    else setTheme(u.theme);
    setUser(u);
  };
  useEffect(() => {
    api.get<User>("/auth/me").then(adopt).catch(() => setUser(null)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AuthCtx = {
    user, loading, setUser,
    login: async (email, password) => adopt(await api.post<User>("/auth/login", { email, password })),
    signup: async (name, email, password) => adopt(await api.post<User>("/auth/signup", { name, email, password })),
    logout: async () => { try { await api.post("/auth/logout"); } finally { setUser(null); } },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
