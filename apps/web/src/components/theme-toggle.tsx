"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  const label = `Alternar para tema ${dark ? "claro" : "escuro"}`;
  const Icon = dark ? Moon : Sun;
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label} aria-pressed={dark} title={label}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface text-body transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <Icon className="size-5" aria-hidden="true" />
      <span className="sr-only">Tema {dark ? "escuro" : "claro"}</span>
    </button>
  );
}
