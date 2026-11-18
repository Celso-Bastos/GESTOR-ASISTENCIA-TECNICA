"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { getServerThemeSnapshot, getThemeSnapshot, setThemePreference, subscribeToTheme, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  return <ThemeContext.Provider value={{ theme, setTheme: setThemePreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("O controle de tema requer ThemeProvider.");
  return context;
}
