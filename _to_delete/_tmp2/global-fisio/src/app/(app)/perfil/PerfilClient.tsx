"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TherapistProfile } from "@/lib/types";
import { BadgeCheck } from "lucide-react";

const field =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function PerfilClient({
  profile,
}: {
  profile: TherapistProfile | null;
}) {
  const router = useRouter();
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
      ? await supabase
          .from("therapist_profile")
          .update(payload)
          .eq("id", profile.id)
      : await supabase.from("therapist_profile").insert(payload);

    if (error) {
      setError("Erro ao salvar. Tente novamente.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Fisioterapeuta responsável</h1>
      <p className="text-sm text-gray-500 mb-6">
        Estes dados aparecem no cabeçalho e na assinatura do relatório PDF
        exportado para o plano de saúde.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={label}>Nome completo *</label>
            <input
              name="full_name"
              required
              defaultValue={profile?.full_name ?? ""}
              className={field}
              placeholder="Ex.: Dr. João Pereira da Silva"
            />
          </div>
          <div>
            <label className={label}>Registro CREFITO</label>
            <input
              name="crefito"
              defaultValue={profile?.crefito ?? ""}
              className={field}
              placeholder="Ex.: CREFITO-8/123456-F"
            />
          </div>
          <div>
            <label className={label}>Telefone / WhatsApp</label>
            <input
              name="phone"
              defaultValue={profile?.phone ?? ""}
              className={field}
            />
          </div>
          <div className="md:col-span-2">
            <label className={label}>E-mail profissional</label>
            <input
              type="email"
              name="email"
              defaultValue={profile?.email ?? ""}
              className={field}
            />
          </div>
          <div>
            <label className={label}>Nome da clínica</label>
            <input
              name="clinic_name"
              defaultValue={profile?.clinic_name ?? ""}
              className={field}
              placeholder="Ex.: Global Fisio"
            />
          </div>
          <div>
            <label className={label}>Endereço da clínica</label>
            <input
              name="clinic_address"
              defaultValue={profile?.clinic_address ?? ""}
              className={field}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="inline-flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <BadgeCheck size={15} /> Dados salvos — já vão aparecer nos
            próximos PDFs.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-5 py-2.5 transition disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      </form>
    </div>
  );
}
