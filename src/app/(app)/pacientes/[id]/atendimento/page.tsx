import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AtendimentoClient, {
  type EditingSession,
  type LastSession,
} from "./AtendimentoClient";
import type { Exercise, Patient } from "@/lib/types";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  session_date: string;
  general_notes: string | null;
  session_exercises: {
    id: string;
    exercise_id: string;
    sets: number | null;
    reps: number | null;
    load_kg: number | null;
    duration_seconds: number | null;
    speed_kmh: number | null;
    distance_m: number | null;
    incline_pct: number | null;
    pain_eva: number;
    notes: string | null;
    exercises: Exercise | null;
  }[];
};

export default async function AtendimentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session: editId } = await searchParams;
  const supabase = await createClient();

  const [{ data: patient }, { data: exercises }, { data: recent }, editRes] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase
        .from("exercises")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("name"),
      // Últimas 5 sessões: a 1ª vira "última sessão" (pré-preenchimento) e
      // o conjunto alimenta "Recentes deste paciente" no catálogo.
      supabase
        .from("sessions")
        .select(
          "id, session_date, general_notes, session_exercises(*, exercises(*))"
        )
        .eq("patient_id", id)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      editId
        ? supabase
            .from("sessions")
            .select(
              "id, session_date, general_notes, session_exercises(*, exercises(*))"
            )
            .eq("id", editId)
            .eq("patient_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (!patient) notFound();

  const recentSessions = (recent ?? []) as SessionRow[];
  const editing = (editRes?.data ?? null) as SessionRow | null;

  // Ao editar uma sessão, a "última sessão" de referência é a anterior a ela
  // (por data); numa sessão nova é simplesmente a mais recente.
  const reference = editing
    ? recentSessions.find(
        (s) => s.id !== editing.id && s.session_date <= editing.session_date
      ) ?? null
    : recentSessions[0] ?? null;

  const lastSession: LastSession | null =
    reference && reference.session_exercises?.length
      ? {
          session_date: reference.session_date,
          items: reference.session_exercises
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
              pain_eva: se.pain_eva,
            })),
        }
      : null;

  // Exercícios usados nas últimas sessões, do mais recente para o mais antigo.
  const recentIds: string[] = [];
  for (const s of recentSessions) {
    for (const se of s.session_exercises ?? []) {
      if (se.exercises && !recentIds.includes(se.exercise_id))
        recentIds.push(se.exercise_id);
    }
  }

  const editingSession: EditingSession | null =
    editing
      ? {
          id: editing.id,
          session_date: editing.session_date,
          general_notes: editing.general_notes,
          items: editing.session_exercises
            .filter((se) => se.exercises)
            .map((se) => ({
              id: se.id,
              exercise: se.exercises as Exercise,
              sets: se.sets,
              reps: se.reps,
              load_kg: se.load_kg,
              duration_seconds: se.duration_seconds,
              speed_kmh: se.speed_kmh,
              distance_m: se.distance_m,
              incline_pct: se.incline_pct,
              pain_eva: se.pain_eva,
              notes: se.notes,
            })),
        }
      : null;

  return (
    <AtendimentoClient
      patient={patient as Patient}
      exercises={(exercises ?? []) as Exercise[]}
      lastSession={lastSession}
      recentExerciseIds={recentIds}
      editingSession={editingSession}
    />
  );
}
