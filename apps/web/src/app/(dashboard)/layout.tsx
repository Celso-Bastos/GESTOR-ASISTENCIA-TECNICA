import {
  Bell,
  LogOut,
  Menu
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { requireAuth } from "@/lib/auth/queries";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardNavigation } from "@/components/dashboard-navigation";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();
  const platformAdmin = await isPlatformAdmin();

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-y-auto border-r border-line bg-surface lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-line px-5">
          <div className="grid size-9 place-items-center rounded-md bg-teal-700 text-white">
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Assistencia Tecnica</p>
            <p className="text-xs text-subtle">MVP operacional</p>
          </div>
        </div>

        <DashboardNavigation platformAdmin={platformAdmin} />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                Painel de controle
              </p>
              <p className="truncate text-xs text-subtle">{user.email}</p>
            </div>

            <div className="relative flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <details className="lg:hidden">
                <summary className="inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-line-strong bg-surface text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus">
                  <span className="sr-only">Abrir menu</span>
                  <Menu className="size-5" aria-hidden="true" />
                </summary>

                <div className="absolute right-0 top-14 z-30 max-h-[calc(100vh-6rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-line bg-surface p-3 shadow-lg">
                  <DashboardNavigation mobile platformAdmin={platformAdmin} />
                </div>
              </details>

              <form action={logoutAction}>
                <button
                  className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-sm font-medium text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus sm:px-4"
                  aria-label="Sair do sistema"
                  type="submit"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
