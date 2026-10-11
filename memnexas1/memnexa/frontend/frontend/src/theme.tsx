import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "system";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; dark: boolean }>(null as never);
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");
  const [sysDark, setSysDark] = useState(() => matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const h = (e: MediaQueryListEvent) => setSysDark(e.matches);
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  const dark = theme === "dark" || (theme === "system" && sysDark);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const setTheme = (t: Theme) => { localStorage.setItem("theme", t); setThemeState(t); };
  return <Ctx.Provider value={{ theme, setTheme, dark }}>{children}</Ctx.Provider>;
}
