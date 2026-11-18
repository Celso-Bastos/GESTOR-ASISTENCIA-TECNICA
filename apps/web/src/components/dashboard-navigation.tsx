"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, LayoutDashboard, MessageSquareText, PackageSearch, Settings,
  Smartphone, TabletSmartphone, Users, Zap
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/manutencoes", label: "Manutencoes", icon: Smartphone },
  { href: "/manutencoes/rapida", label: "Manutencao rapida", icon: Zap },
  { href: "/saidas", label: "Saidas/Vendas", icon: PackageSearch },
  { href: "/relatorios/reposicao", label: "Reposicao", icon: BarChart3 },
  { href: "/mensagens", label: "Mensagens", icon: MessageSquareText },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings },
  { href: "/configuracoes/quiosque", label: "Quiosque", icon: TabletSmartphone }
];

export function DashboardNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  // A rota mais específica evita destacar dois itens nos submenus.
  const activeHref = navItems
    .filter(({ href }) => pathname === href || pathname?.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return <nav className={mobile ? "grid gap-1" : "grid gap-1 px-3 py-4"} aria-label="Menu principal">
    {navItems.map(({ href, label, icon: Icon }) => {
      const active = activeHref === href;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${active
          ? "bg-accent-soft text-accent-strong"
          : "text-body hover:bg-canvas hover:text-foreground"}`}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </Link>;
    })}
  </nav>;
}
