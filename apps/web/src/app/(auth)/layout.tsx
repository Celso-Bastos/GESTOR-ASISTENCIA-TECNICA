import type { ReactNode } from "react";
import { PublicThemeShell } from "@/components/public-theme-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <PublicThemeShell>{children}</PublicThemeShell>;
}
