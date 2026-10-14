"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  UserCog,
  Users,
} from "lucide-react";

const links = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/exercicios", label: "Exercícios", icon: Dumbbell },
  { href: "/perfil", label: "Perfil", icon: UserCog },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-cyan-950 text-white">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-cyan-900">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
            <Activity size={20} />
          </div>
          <div>
            <p className="font-semibold leading-tight">Global Fisio</p>
            <p className="text-[11px] text-cyan-300">Gestão de pacientes</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand text-white"
                    : "text-cyan-200 hover:bg-cyan-900 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 mx-3 mb-4 rounded-lg px-3 py-2.5 text-sm text-cyan-200 hover:bg-cyan-900 hover:text-white transition"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-cyan-950 text-cyan-200 flex justify-around h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] border-t border-cyan-900">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                active ? "text-white" : ""
              }`}
            >
              <span className={`flex items-center justify-center w-12 h-7 rounded-full transition ${active ? "bg-brand" : ""}`}>
                <Icon size={20} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
