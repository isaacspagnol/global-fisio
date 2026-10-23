"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Activity } from "lucide-react";
import { Button, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col justify-end md:justify-center md:items-center bg-bg md:bg-[radial-gradient(ellipse_at_top,var(--accent-soft),var(--bg)_60%)]">
      <div className="w-full md:max-w-sm bg-surface md:rounded-3xl md:border md:border-line md:shadow-card rounded-t-3xl px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:p-8 flex-1 md:flex-none flex flex-col justify-center">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent text-accent-fg flex items-center justify-center mb-4 shadow-card">
            <Activity size={32} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Global Fisio</h1>
          <p className="text-sm text-fg-muted mt-1">
            Gestão de pacientes de fisioterapia
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="E-mail">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="seu@email.com"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
              autoComplete="current-password"
              enterKeyHint="go"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger bg-danger-soft rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
