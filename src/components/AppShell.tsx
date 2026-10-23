"use client";

import { usePathname } from "next/navigation";
import Sidebar, { isFocusRoute } from "./Sidebar";

/**
 * Casca da área logada: sidebar no desktop, tab bar no mobile.
 * Em rotas de foco (atendimento) a tab bar some e o padding inferior
 * passa a ser controlado pela própria tela.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focus = isFocusRoute(pathname);

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main
        className={`md:pl-60 ${
          focus ? "" : "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8"
        }`}
      >
        <div
          className={`max-w-6xl mx-auto px-4 md:px-8 ${
            focus ? "pt-0" : "pt-4 md:pt-8"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
