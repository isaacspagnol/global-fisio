"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";

const field =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";
const label = "block text-sm font-medium text-gray-700 mb-1";

export default function PatientForm({ patient }: { patient?: Patient }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      full_name: String(fd.get("full_name") ?? "").trim(),
      birth_date: (fd.get("birth_date") as string) || null,
      phone: (fd.get("phone") as string) || null,
      email: (fd.get("email") as string) || null,
      cpf: (fd.get("cpf") as string) || null,
      health_insurance: (fd.get("health_insurance") as string) || null,
      insurance_number: (fd.get("insurance_number") as string) || null,
      diagnosis: (fd.get("diagnosis") as string) || null,
      referring_doctor: (fd.get("referring_doctor") as string) || null,
      notes: (fd.get("notes") as string) || null,
      status: (fd.get("status") as string) || "ativo",
    };

    const supabase = createClient();
    if (patient) {
      const { error } = await supabase
        .from("patients")
        .update(payload)
        .eq("id", patient.id);
      if (error) {
        setError("Erro ao salvar. Tente novamente.");
        setSaving(false);
        return;
      }
      router.push(`/pacientes/${patient.id}`);
    } else {
      const { data, error } = await supabase
        .from("patients")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setError("Erro ao salvar. Tente novamente.");
        setSaving(false);
        return;
      }
      router.push(`/pacientes/${data.id}`);
    }
    router.refresh();
  }

  return (
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
            defaultValue={patient?.full_name}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Data de nascimento</label>
          <input
            type="date"
            name="birth_date"
            defaultValue={patient?.birth_date ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Telefone / WhatsApp</label>
          <input
            name="phone"
            defaultValue={patient?.phone ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className={label}>E-mail</label>
          <input
            type="email"
            name="email"
            defaultValue={patient?.email ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className={label}>CPF</label>
          <input
            name="cpf"
            defaultValue={patient?.cpf ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Plano de saúde</label>
          <input
            name="health_insurance"
            defaultValue={patient?.health_insurance ?? ""}
            className={field}
            placeholder="Ex.: Unimed"
          />
        </div>
        <div>
          <label className={label}>Nº da carteirinha</label>
          <input
            name="insurance_number"
            defaultValue={patient?.insurance_number ?? ""}
            className={field}
          />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Diagnóstico / motivo do tratamento</label>
          <input
            name="diagnosis"
            defaultValue={patient?.diagnosis ?? ""}
            className={field}
            placeholder="Ex.: Pós-operatório LCA joelho direito"
          />
        </div>
        <div>
          <label className={label}>Médico solicitante</label>
          <input
            name="referring_doctor"
            defaultValue={patient?.referring_doctor ?? ""}
            className={field}
          />
        </div>
        <div>
          <label className={label}>Status</label>
          <select
            name="status"
            defaultValue={patient?.status ?? "ativo"}
            className={field}
          >
            <option value="ativo">Ativo</option>
            <option value="alta">Alta</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={label}>Observações</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={patient?.notes ?? ""}
            className={field}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-5 py-2.5 transition disabled:opacity-60"
        >
          {saving ? "Salvando..." : patient ? "Salvar alterações" : "Cadastrar paciente"}
        </button>
      </div>
    </form>
  );
}
