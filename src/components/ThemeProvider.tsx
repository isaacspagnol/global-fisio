"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect } from "react";

const THEME_COLOR: Record<string, string> = {
  light: "#f3f5f8",
  dark: "#0c1117",
};

/**
 * Mantém a cor da barra do navegador (meta theme-color) alinhada ao tema
 * escolhido no app — a meta com media query só acompanha o SISTEMA, então
 * quando o fisio força "escuro" com o sistema claro, ajustamos via JS.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!resolvedTheme) return;
    const color = THEME_COLOR[resolvedTheme] ?? THEME_COLOR.light;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", color));
  }, [resolvedTheme]);
  return null;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="gf-theme"
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
