"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";
import { PHOTO_BUCKET, photoPathFor, resizeImage } from "@/lib/photos";
import PhotoPicker, { type PhotoChange } from "@/components/PhotoPicker";
import {
  Button,
  Card,
  Field,
  inputCls,
  textareaCls,
  useToast,
} from "@/components/ui";

export default function PatientForm({
  patient,
  photoUrl = null,
}: {
  patient?: Patient;
  /** URL assinada da foto atual (modo edição) */
  photoUrl?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: "keep" });
  const [nameForAvatar, setNameForAvatar] = useState(patient?.full_name ?? "");

  /**
   * Aplica a escolha de foto depois que o paciente já existe no banco:
   * envia a nova (reduzida) e grava o caminho; remove a antiga do bucket.
   * Falha aqui não desfaz o cadastro — só avisa.
   */
  async function applyPhoto(patientId: string, previousPath: string | null | undefined) {
    if (photo.kind === "keep") return true;
    const supabase = createClient();
    let newPath: string | null = null;
    if (photo.kind === "replace") {
      const blob = await resizeImage(photo.file);
      newPath = photoPathFor(patientId);
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(newPath, blob, { contentType: blob.type || "image/jpeg", upsert: true });
      if (upErr) return false;
    }
    const { error: dbErr } = await supabase
      .from("patients")
      .update({ photo_path: newPath })
      .eq("id", patientId);
    if (dbErr) return false;
    if (previousPath && previousPath !== newPath) {
      await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]).catch(() => {});
    }
    return true;
  }

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
      const okPhoto = await applyPhoto(patient.id, patient.photo_path);
      toast(
        okPhoto
          ? "Dados do paciente atualizados."
          : "Dados salvos, mas a foto não pôde ser enviada.",
        okPhoto ? undefined : { kind: "error" }
      );
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
      const okPhoto = await applyPhoto(data.id, null);
      toast(
        okPhoto ? "Paciente cadastrado." : "Paciente cadastrado, mas a foto não pôde ser enviada.",
        okPhoto ? undefined : { kind: "error" }
      );
      router.push(`/pacientes/${data.id}`);
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24 md:pb-0">
      <Card className="p-4 md:p-6 space-y-4">
        <h2 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">
          Identificação
        </h2>
        <PhotoPicker name={nameForAvatar} currentUrl={photoUrl} onChange={setPhoto} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome completo *" className="md:col-span-2">
            <input
              name="full_name"
              required
              defaultValue={patient?.full_name}
              onChange={(e) => setNameForAvatar(e.target.value)}
              className={inputCls}
              autoComplete="off"
              autoCapitalize="words"
            />
          </Field>
          <Field label="Data de nascimento">
            <input
              type="date"
              name="birth_date"
              defaultValue={patient?.birth_date ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="CPF">
            <input
              name="cpf"
              inputMode="numeric"
              defaultValue={patient?.cpf ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Telefone / WhatsApp">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={patient?.phone ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              name="email"
              inputMode="email"
              autoCapitalize="none"
              defaultValue={patient?.email ?? ""}
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      <Card className="p-4 md:p-6 space-y-4">
        <h2 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider">
          Tratamento
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Diagnóstico / motivo do tratamento" className="md:col-span-2">
            <input
              name="diagnosis"
              defaultValue={patient?.diagnosis ?? ""}
              className={inputCls}
              placeholder="Ex.: Pós-operatório LCA joelho direito"
            />
          </Field>
          <Field label="Médico solicitante">
            <input
              name="referring_doctor"
              defaultValue={patient?.referring_doctor ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select
              name="status"
              defaultValue={patient?.status ?? "ativo"}
              className={inputCls}
            >
              <option value="ativo">Ativo</option>
              <option value="alta">Alta</option>
              <option value="inativo">Inativo</option>
            </select>
          </Field>
          <Field label="Plano de saúde">
            <input
              name="health_insurance"
              defaultValue={patient?.health_insurance ?? ""}
              className={inputCls}
              placeholder="Ex.: Unimed"
            />
          </Field>
          <Field label="Nº da carteirinha">
            <input
              name="insurance_number"
              inputMode="numeric"
              defaultValue={patient?.insurance_number ?? ""}
              className={inputCls}
            />
          </Field>
          <Field label="Observações" className="md:col-span-2">
            <textarea
              name="notes"
              rows={3}
              defaultValue={patient?.notes ?? ""}
              className={textareaCls}
            />
          </Field>
        </div>
      </Card>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger bg-danger-soft rounded-xl px-3.5 py-2.5">
          {error}
        </p>
      )}

      {/* Desktop: ações inline */}
      <div className="hidden md:flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          {saving ? "Salvando..." : patient ? "Salvar alterações" : "Cadastrar paciente"}
        </Button>
      </div>

      {/* Mobile: barra fixa acima da tab bar */}
      <div className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 bg-surface/95 backdrop-blur border-t border-line px-4 py-2.5 flex gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" className="flex-1" loading={saving}>
          {saving ? "Salvando..." : patient ? "Salvar alterações" : "Cadastrar paciente"}
        </Button>
      </div>
    </form>
  );
}
