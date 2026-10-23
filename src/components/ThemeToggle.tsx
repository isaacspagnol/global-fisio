"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui";
import { useMounted } from "@/lib/hooks";

type Mode = "system" | "light" | "dark";

/** Seletor Sistema / Claro / Escuro (usado no Perfil). */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // useTheme() é undefined no servidor → renderiza só depois de montar
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-12 rounded-xl skeleton" aria-hidden />;
  }

  return (
    <Segmented<Mode>
      ariaLabel="Aparência"
      value={(theme as Mode) ?? "system"}
      onChange={(v) => setTheme(v)}
      options={[
        { value: "system", label: (<><Monitor size={16} /> Sistema</>) },
        { value: "light", label: (<><Sun size={16} /> Claro</>) },
        { value: "dark", label: (<><Moon size={16} /> Escuro</>) },
      ]}
    />
  );
}
