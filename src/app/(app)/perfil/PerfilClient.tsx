"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TherapistProfile } from "@/lib/types";
import {
  BadgeCheck,
  ChevronRight,
  Dumbbell,
  LogOut,
  Palette,
  UserRound,
} from "lucide-react";
import {
  Button,
  Card,
  Field,
  PageHeader,
  inputCls,
  useToast,
} from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";

export default function PerfilClient({
  profile,
}: {
  profile: TherapistProfile | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const fd = new FormData(e.currentTarget);
    const payload = {
      full_name: String(fd.get("full_name") ?? "").trim(),
      crefito: (fd.get("crefito") as string) || null,
      phone: (fd.get("phone") as string) || null,
      email: (fd.get("email") as string) || null,
      clinic_name: (fd.get("clinic_name") as string) || null,
      clinic_address: (fd.get("clinic_address") as string) || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = createClient();
    const { error } = profile
      ? await supabase.from("therapist_profile").update(payload).eq("id", profile.id)
      : await supabase.from("therapist_profile").insert(payload);

    setSaving(false);
    if (error) {
      setError("Erro ao salvar. Tente novamente.");
      return;
    }
    setSaved(true);
    toast("Dados salvos — já vão aparecer nos próximos PDFs.");
    router.refresh();
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Perfil"
        subtitle="Fisioterapeuta responsável, aparência e catálogo"
      />

      {/* Aparência */}
      <Card className="p-4 md:p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center">
            <Palette size={18} />
          </span>
          <div>
            <h2 className="font-semibold text-sm">Aparência</h2>
            <p className="text-xs text-fg-muted">
              Modo noturno para a clínica à noite; “Sistema” segue o celular.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </Card>

      {/* Catálogo */}
      <Card className="overflow-hidden">
        <Link
          href="/exercicios"
          className="flex items-center gap-3 px-4 py-3.5 min-h-16 hover:bg-surface-2 active:bg-surface-3 transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center shrink-0">
            <Dumbbell size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-medium">Catálogo de exercícios</span>
            <span className="block text-xs text-fg-muted">
              Exercícios, tipos de medição e padrões de séries
            </span>
          </span>
          <ChevronRight size={18} className="text-fg-faint" />
        </Link>
      </Card>

      {/* Dados do fisioterapeuta */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center">
            <UserRound size={18} />
          </span>
          <div>
            <h2 className="font-semibold text-sm">Fisioterapeuta responsável</h2>
            <p className="text-xs text-fg-muted">
              Aparece no cabeçalho e na assinatura do relatório PDF do convênio.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome completo *" className="md:col-span-2">
              <input
                name="full_name"
                required
                defaultValue={profile?.full_name ?? ""}
                className={inputCls}
                placeholder="Ex.: Dr. João Pereira da Silva"
                autoComplete="name"
              />
            </Field>
            <Field label="Registro CREFITO">
              <input
                name="crefito"
                defaultValue={profile?.crefito ?? ""}
                className={inputCls}
                placeholder="Ex.: CREFITO-8/123456-F"
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={profile?.phone ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label="E-mail profissional" className="md:col-span-2">
              <input
                type="email"
                name="email"
                inputMode="email"
                defaultValue={profile?.email ?? ""}
                className={inputCls}
              />
            </Field>
            <Field label="Nome da clínica">
              <input
                name="clinic_name"
                defaultValue={profile?.clinic_name ?? ""}
                className={inputCls}
                placeholder="Ex.: Global Fisio"
              />
            </Field>
            <Field label="Endereço da clínica">
              <input
                name="clinic_address"
                defaultValue={profile?.clinic_address ?? ""}
                className={inputCls}
              />
            </Field>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger bg-danger-soft rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}
          {saved && (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-success bg-success-soft rounded-xl px-3.5 py-2.5">
              <BadgeCheck size={16} /> Dados salvos — já vão aparecer nos próximos PDFs.
            </p>
          )}

          <Button type="submit" size="lg" className="w-full md:w-auto" loading={saving}>
            {saving ? "Salvando..." : "Salvar dados"}
          </Button>
        </form>
      </Card>

      <Button variant="ghost" className="w-full text-danger" onClick={handleLogout}>
        <LogOut size={18} /> Sair da conta
      </Button>
    </div>
  );
}
