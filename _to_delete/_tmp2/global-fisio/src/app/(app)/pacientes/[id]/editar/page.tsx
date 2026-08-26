import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PatientForm from "@/components/PatientForm";
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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Editar paciente</h1>
      <PatientForm patient={data as Patient} />
    </div>
  );
}
