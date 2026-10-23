import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PatientForm from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";
import type { Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const patient = data as Patient;

  return (
    <div className="max-w-3xl">
      <PageHeader back={`/pacientes/${id}`} title="Editar paciente" subtitle={patient.full_name} />
      <PatientForm patient={patient} />
    </div>
  );
}
