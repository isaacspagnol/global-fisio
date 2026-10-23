export type Patient = {
  id: string;
  full_name: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  health_insurance: string | null;
  insurance_number: string | null;
  diagnosis: string | null;
  referring_doctor: string | null;
  notes: string | null;
  status: "ativo" | "alta" | "inativo";
  created_at: string;
};

export type TherapistProfile = {
  id: string;
  full_name: string;
  crefito: string | null;
  phone: string | null;
  email: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  updated_at: string;
  created_at: string;
};

export type PatientDocument = {
  id: string;
  patient_id: string;
  name: string;
  category: "exame" | "raio-x" | "laudo" | "receita" | "outro";
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type MeasurementType = "series_reps" | "series_tempo" | "cardio";

export type Exercise = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  measurement_type: MeasurementType;
  default_sets: number;
  default_reps: number;
  default_duration_seconds: number | null;
  active: boolean;
  created_at: string;
};

export type Appointment = {
  id: string;
  patient_id: string;
  starts_at: string;
  duration_min: number;
  status: "agendado" | "concluido" | "cancelado" | "faltou";
  notes: string | null;
  created_at: string;
  patients?: Pick<Patient, "id" | "full_name">;
};

export type Session = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  session_date: string;
  general_notes: string | null;
  created_at: string;
};

export type SessionExercise = {
  id: string;
  session_id: string;
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
  created_at: string;
  exercises?: Pick<Exercise, "id" | "name" | "category">;
};

export const EXERCISE_CATEGORIES: Record<string, string> = {
  fortalecimento: "Fortalecimento",
  alongamento: "Alongamento",
  mobilidade: "Mobilidade",
  propriocepcao: "Equilíbrio / Propriocepção",
  condicionamento: "Condicionamento",
};

export const DOC_CATEGORIES: Record<string, string> = {
  exame: "Exame",
  "raio-x": "Raio-X",
  laudo: "Laudo",
  receita: "Receita",
  outro: "Outro",
};

export const MEASUREMENT_LABEL: Record<MeasurementType, string> = {
  series_reps: "Séries x Repetições (+ carga)",
  series_tempo: "Séries x Tempo (isometria/alongamento)",
  cardio: "Cardio (tempo, velocidade, distância, inclinação)",
};

export function formatDuration(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}min`;
  return `${seconds}s`;
}

/** Formata o volume realizado conforme os campos preenchidos. */
export function formatDose(e: {
  sets?: number | null;
  reps?: number | null;
  load_kg?: number | null;
  duration_seconds?: number | null;
  speed_kmh?: number | null;
  distance_m?: number | null;
  incline_pct?: number | null;
}): string {
  const parts: string[] = [];
  if (e.sets && e.reps) parts.push(`${e.sets}x${e.reps}`);
  else if (e.sets && e.duration_seconds)
    parts.push(`${e.sets}x${formatDuration(e.duration_seconds)}`);
  else if (e.duration_seconds) parts.push(formatDuration(e.duration_seconds));
  if (e.load_kg) parts.push(`${e.load_kg}kg`);
  if (e.speed_kmh) parts.push(`${e.speed_kmh} km/h`);
  if (e.distance_m)
    parts.push(
      e.distance_m >= 1000
        ? `${(e.distance_m / 1000).toFixed(1).replace(".", ",")} km`
        : `${e.distance_m} m`
    );
  if (e.incline_pct) parts.push(`${e.incline_pct}% incl.`);
  return parts.join(" · ") || "—";
}

/** Rótulo dos padrões de um exercício do catálogo (ex.: 3x12, 3x30s, 10min). */
export function formatDefaults(ex: {
  measurement_type: MeasurementType;
  default_sets: number;
  default_reps: number;
  default_duration_seconds: number | null;
}): string {
  if (ex.measurement_type === "series_reps")
    return `${ex.default_sets}x${ex.default_reps}`;
  if (ex.measurement_type === "series_tempo")
    return `${ex.default_sets}x${formatDuration(ex.default_duration_seconds ?? 30)}`;
  return formatDuration(ex.default_duration_seconds ?? 600);
}

export function evaColor(eva: number): string {
  if (eva <= 2) return "#16a34a"; // verde
  if (eva <= 4) return "#84cc16";
  if (eva <= 6) return "#eab308"; // amarelo
  if (eva <= 8) return "#f97316"; // laranja
  return "#dc2626"; // vermelho
}

/** Cor do texto sobre o fundo de evaColor (amarelo/lima pedem texto escuro). */
export function evaTextColor(eva: number): string {
  return eva >= 3 && eva <= 6 ? "#1a1a1a" : "#ffffff";
}

export function evaLabel(eva: number): string {
  if (eva === 0) return "Sem dor";
  if (eva <= 3) return "Dor leve";
  if (eva <= 6) return "Dor moderada";
  if (eva <= 8) return "Dor intensa";
  return "Dor máxima";
}
