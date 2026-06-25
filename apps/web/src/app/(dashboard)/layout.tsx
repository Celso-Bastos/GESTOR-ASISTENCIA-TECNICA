import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Settings,
  Smartphone,
  Users
} from "lucide-react";
import { logoutAction } from "@/lib/auth/actions";
import { requireAuth } from "@/lib/auth/queries";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/manutencoes", label: "Manutencoes", icon: Smartphone },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquareText },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings }
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
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
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-950">
              Painel de controle
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>

          <form action={logoutAction}>
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              type="submit"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </button>
          </form>
        </header>

        <nav className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-5 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-2 text-xs font-medium text-slate-700"
                href={item.href}
                key={item.href}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
