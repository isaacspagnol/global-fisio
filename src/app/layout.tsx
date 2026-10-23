import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Global Fisio",
  description: "Gestão de pacientes de fisioterapia",
  applicationName: "Global Fisio",
  appleWebApp: {
    capable: true,
    title: "Global Fisio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: o layout encolhe com o teclado, mantendo barras fixas visíveis.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1117" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: o next-themes define data-theme no <html>
    // antes da hidratação (evita flash do tema errado).
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased min-h-dvh`}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
