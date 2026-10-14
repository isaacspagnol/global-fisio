import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AtendimentoClient, { type LastSession } from "./AtendimentoClient";
import type { Exercise, Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: exercises }, { data: last }] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("exercises")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name"),
      supabase
        .from("sessions")
        .select("id, session_date, session_exercises(*, exercises(*))")
        .eq("patient_id", id)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!patient) notFound();

  const lastSession: LastSession | null =
    last && last.session_exercises?.length
      ? {
          session_date: last.session_date,
          items: last.session_exercises
            .filter((se) => se.exercises)
            .map((se) => ({
              exercise: se.exercises as Exercise,
              sets: se.sets,
              reps: se.reps,
              load_kg: se.load_kg,
              duration_seconds: se.duration_seconds,
              speed_kmh: se.speed_kmh,
              distance_m: se.distance_m,
              incline_pct: se.incline_pct,
            })),
        }
      : null;

  return (
    <AtendimentoClient
      patient={patient as Patient}
      exercises={(exercises ?? []) as Exercise[]}
      lastSession={lastSession}
    />
  );
}
