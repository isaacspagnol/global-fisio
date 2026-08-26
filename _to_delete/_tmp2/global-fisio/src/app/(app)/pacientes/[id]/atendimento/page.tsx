import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AtendimentoClient from "./AtendimentoClient";
import type { Exercise, Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: exercises }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).single(),
    supabase
      .from("exercises")
      .select("*")
      .eq("active", true)
      .order("category")
      .order("name"),
  ]);

  if (!patient) notFound();

  return (
    <AtendimentoClient
      patient={patient as Patient}
      exercises={(exercises ?? []) as Exercise[]}
    />
  );
}
