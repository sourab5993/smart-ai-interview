import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { safeStorage } from "@/lib/safeStorage";

type Theme = "light" | "dark" | "system";
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (!switchable) return defaultTheme;
    const stored = safeStorage.getItem("theme");
    return stored === "system" || stored === "dark" || stored === "light"
      ? stored
      : defaultTheme;
  });
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "light" : "dark") : theme;
      root.dataset.theme = resolved;
      root.dataset.themePreference = theme;
      root.classList.toggle("dark", resolved === "dark");
      root.style.colorScheme = resolved;
    };
    apply();
    if (theme === "system") media.addEventListener("change", apply);
    if (switchable) safeStorage.setItem("theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme, switchable]);
  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      switchable,
      toggleTheme: switchable
        ? () => setTheme(prev => (prev === "dark" ? "light" : "dark"))
        : undefined,
    }),
    [theme, switchable]
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
