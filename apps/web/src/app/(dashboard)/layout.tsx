import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Smartphone,
  TabletSmartphone,
  Users,
  Zap
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { requireAuth } from "@/lib/auth/queries";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/manutencoes", label: "Manutencoes", icon: Smartphone },
  { href: "/manutencoes/rapida", label: "Manutencao rapida", icon: Zap },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquareText },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/configuracoes/quiosque", label: "Quiosque", icon: TabletSmartphone }
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="grid size-9 place-items-center rounded-md bg-teal-700 text-white">
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Assistencia Tecnica</p>
            <p className="text-xs text-slate-500">MVP operacional</p>
          </div>
        </div>

        <nav className="grid gap-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                href={item.href}
                key={item.href}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex min-h-12 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">
                Painel de controle
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>

            <div className="flex items-center gap-2">
              <details className="relative lg:hidden">
                <summary className="inline-flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200">
                  <span className="sr-only">Abrir menu</span>
                  <Menu className="size-5" aria-hidden="true" />
                </summary>

                <div className="absolute right-0 top-14 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                  <nav className="grid gap-1" aria-label="Menu principal">
                    {navItems.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link
                          className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-200"
                          href={item.href}
                          key={item.href}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </details>

              <form action={logoutAction}>
                <button
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 sm:px-4"
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
