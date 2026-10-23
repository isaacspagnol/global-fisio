"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  House,
  UserCog,
  Users,
} from "lucide-react";

const links = [
  { href: "/", label: "Início", icon: House },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/perfil", label: "Perfil", icon: UserCog },
];

/** O catálogo de exercícios é configuração rara: fica no desktop e dentro de Perfil no mobile. */
const desktopOnly = [{ href: "/exercicios", label: "Exercícios", icon: Dumbbell }];

/** Rotas de "tarefa em tela cheia": sem tab bar, com barra de ações própria. */
export function isFocusRoute(pathname: string) {
  return /\/atendimento(\/|$)/.test(pathname);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/perfil")
    return pathname.startsWith("/perfil") || pathname.startsWith("/exercicios");
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const pathname = usePathname();
  const focus = isFocusRoute(pathname);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-surface border-r border-line">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="w-9 h-9 rounded-xl bg-accent text-accent-fg flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <p className="font-semibold leading-tight">Global Fisio</p>
            <p className="text-[11px] text-fg-muted">Gestão de pacientes</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {[...links, ...desktopOnly].map(({ href, label, icon: Icon }) => {
            const active =
              href === "/exercicios"
                ? pathname.startsWith("/exercicios")
                : href === "/perfil"
                  ? pathname.startsWith("/perfil")
                  : isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 h-11 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent-soft text-accent-soft-fg"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile tab bar — some nas rotas de foco (atendimento) */}
      {!focus && (
        <nav
          aria-label="Navegação principal"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-nav/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="grid grid-cols-4 h-16">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href} className="min-w-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                      active ? "text-accent-soft-fg dark:text-accent" : "text-fg-muted"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-14 h-8 rounded-full transition-colors ${
                        active ? "bg-accent-soft" : ""
                      }`}
                    >
                      <Icon
                        size={22}
                        strokeWidth={active ? 2.4 : 2}
                      />
                    </span>
                    <span className="truncate max-w-full px-1">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
