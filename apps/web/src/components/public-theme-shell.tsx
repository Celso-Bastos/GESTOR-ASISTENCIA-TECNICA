import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export function PublicThemeShell({ children }: { children: ReactNode }) {
  return <div className="public-theme-shell min-h-dvh">
    <header className="flex h-16 items-center justify-end px-4 sm:px-6" aria-label="Aparência">
      <ThemeToggle />
    </header>
    {children}
  </div>;
}
