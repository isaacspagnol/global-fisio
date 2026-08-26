"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentsPanel from "@/components/DocumentsPanel";
import {
  EXERCISE_CATEGORIES,
  evaColor,
  evaLabel,
  formatDefaults,
  type Exercise,
  type Patient,
} from "@/lib/types";
import {
  ArrowLeft,
  Check,
  FolderOpen,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

type Entry = {
  uid: string;
  exercise: Exercise;
  sets: number;
  reps: number;
  duration_value: string; // segundos (series_tempo) ou minutos (cardio)
  load_kg: string;
  speed_kmh: string;
  distance_m: string;
  incline_pct: string;
  pain_eva: number | null;
  notes: string;
};

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="px-2 py-1.5 text-gray-500 hover:text-gray-900"
      >
        <Minus size={14} />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="px-2 py-1.5 text-gray-500 hover:text-gray-900"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export default function AtendimentoClient({
  patient,
  exercises,
}: {
  patient: Patient;
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("todas");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (category !== "todas" && e.category !== category) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [exercises, search, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [filtered]);

  function addExercise(ex: Exercise) {
    const defaultDuration =
      ex.measurement_type === "series_tempo"
        ? String(ex.default_duration_seconds ?? 30)
        : ex.measurement_type === "cardio"
          ? String(Math.round((ex.default_duration_seconds ?? 600) / 60))
          : "";
    setEntries((prev) => [
      ...prev,
      {
        uid: `${ex.id}-${Date.now()}`,
        exercise: ex,
        sets: ex.default_sets,
        reps: ex.default_reps,
        duration_value: defaultDuration,
        load_kg: "",
        speed_kmh: "",
        distance_m: "",
        incline_pct: "",
        pain_eva: null,
        notes: "",
      },
    ]);
  }

  function updateEntry(uid: string, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e))
    );
  }

  function removeEntry(uid: string) {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  }

  const missingEva = entries.some((e) => e.pain_eva === null);

  async function handleSave() {
    if (entries.length === 0) {
      setError("Adicione pelo menos um exercício.");
      return;
    }
    if (missingEva) {
      setError("Registre a escala EVA de dor em todos os exercícios.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data: session, error: sErr } = await supabase
      .from("sessions")
      .insert({
        patient_id: patient.id,
        session_date: sessionDate,
        general_notes: generalNotes || null,
      })
      .select("id")
      .single();

    if (sErr || !session) {
      setError("Erro ao salvar a sessão. Tente novamente.");
      setSaving(false);
      return;
    }

    const rows = entries.map((e) => {
      const mt = e.exercise.measurement_type;
      return {
        session_id: session.id,
        exercise_id: e.exercise.id,
        sets: mt === "cardio" ? null : e.sets,
        reps: mt === "series_reps" ? e.reps : null,
        load_kg: mt === "series_reps" ? numOrNull(e.load_kg) : null,
        duration_seconds:
          mt === "series_tempo"
            ? numOrNull(e.duration_value)
            : mt === "cardio"
              ? (numOrNull(e.duration_value) ?? 0) * 60 || null
              : null,
        speed_kmh: mt === "cardio" ? numOrNull(e.speed_kmh) : null,
        distance_m: mt === "cardio" ? numOrNull(e.distance_m) : null,
        incline_pct: mt === "cardio" ? numOrNull(e.incline_pct) : null,
        pain_eva: e.pain_eva!,
        notes: e.notes || null,
      };
    });

    const { error: exErr } = await supabase
      .from("session_exercises")
      .insert(rows);

    if (exErr) {
      setError("Erro ao salvar os exercícios. Tente novamente.");
      setSaving(false);
      return;
    }

    router.push(`/pacientes/${patient.id}`);
    router.refresh();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/pacientes/${patient.id}`}
            className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">
              Atendimento · {patient.full_name}
            </h1>
            <p className="text-xs text-gray-500">
              {patient.diagnosis || "Sem diagnóstico registrado"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={() => setShowDocs(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium hover:bg-gray-50 transition"
          >
            <FolderOpen size={15} /> Ver documentos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-4 lg:sticky lg:top-4">
            <h2 className="font-semibold text-sm mb-3">
              Exercícios pré-cadastrados
            </h2>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar exercício..."
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap mb-3">
              <button
                onClick={() => setCategory("todas")}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition ${
                  category === "todas"
                    ? "bg-brand text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Todas
              </button>
              {Object.entries(EXERCISE_CATEGORIES).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setCategory(k)}
                  className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition ${
                    category === k
                      ? "bg-brand text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {[...grouped.entries()].map(([cat, list]) => (
                <div key={cat}>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                    {EXERCISE_CATEGORIES[cat] ?? cat}
                  </p>
                  <ul className="space-y-1">
                    {list.map((ex) => (
                      <li key={ex.id}>
                        <button
                          onClick={() => addExercise(ex)}
                          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-cyan-50 transition group"
                        >
                          <Plus
                            size={14}
                            className="text-gray-400 group-hover:text-brand shrink-0"
                          />
                          <span className="flex-1">{ex.name}</span>
                          <span className="text-[11px] text-gray-400 tabular-nums">
                            {formatDefaults(ex)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-gray-500 text-center py-4">
                  Nenhum exercício encontrado.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Registro da sessão */}
        <div className="lg:col-span-3 space-y-4">
          {entries.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500">
                Toque em um exercício ao lado para adicioná-lo à sessão de
                hoje.
              </p>
            </div>
          ) : (
            entries.map((entry, idx) => (
              <div
                key={entry.uid}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-sm">
                    {idx + 1}. {entry.exercise.name}
                  </p>
                  <button
                    onClick={() => removeEntry(entry.uid)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="flex flex-wrap items-end gap-4 mb-3">
                  {entry.exercise.measurement_type !== "cardio" && (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">Séries</p>
                      <Stepper
                        value={entry.sets}
                        onChange={(v) => updateEntry(entry.uid, { sets: v })}
                      />
                    </div>
                  )}
                  {entry.exercise.measurement_type === "series_reps" && (
                    <>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Repetições
                        </p>
                        <Stepper
                          value={entry.reps}
                          onChange={(v) => updateEntry(entry.uid, { reps: v })}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Carga (kg) — opcional
                        </p>
                        <input
                          inputMode="decimal"
                          value={entry.load_kg}
                          onChange={(e) =>
                            updateEntry(entry.uid, { load_kg: e.target.value })
                          }
                          placeholder="—"
                          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                    </>
                  )}
                  {entry.exercise.measurement_type === "series_tempo" && (
                    <div>
                      <p className="text-[11px] text-gray-500 mb-1">
                        Tempo por série (segundos)
                      </p>
                      <input
                        inputMode="numeric"
                        value={entry.duration_value}
                        onChange={(e) =>
                          updateEntry(entry.uid, {
                            duration_value: e.target.value,
                          })
                        }
                        placeholder="30"
                        className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                    </div>
                  )}
                  {entry.exercise.measurement_type === "cardio" && (
                    <>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Tempo (min)
                        </p>
                        <input
                          inputMode="numeric"
                          value={entry.duration_value}
                          onChange={(e) =>
                            updateEntry(entry.uid, {
                              duration_value: e.target.value,
                            })
                          }
                          placeholder="10"
                          className="w-20 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Velocidade (km/h)
                        </p>
                        <input
                          inputMode="decimal"
                          value={entry.speed_kmh}
                          onChange={(e) =>
                            updateEntry(entry.uid, {
                              speed_kmh: e.target.value,
                            })
                          }
                          placeholder="—"
                          className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Distância (m)
                        </p>
                        <input
                          inputMode="decimal"
                          value={entry.distance_m}
                          onChange={(e) =>
                            updateEntry(entry.uid, {
                              distance_m: e.target.value,
                            })
                          }
                          placeholder="—"
                          className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">
                          Elevação/Inclinação (%)
                        </p>
                        <input
                          inputMode="decimal"
                          value={entry.incline_pct}
                          onChange={(e) =>
                            updateEntry(entry.uid, {
                              incline_pct: e.target.value,
                            })
                          }
                          placeholder="—"
                          className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mb-3">
                  <p className="text-[11px] text-gray-500 mb-1">
                    Observação do exercício (opcional)
                  </p>
                  <input
                    value={entry.notes}
                    onChange={(e) =>
                      updateEntry(entry.uid, { notes: e.target.value })
                    }
                    placeholder="Ex.: dor no final da amplitude, compensou com o tronco..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>

                <div>
                  <p className="text-[11px] text-gray-500 mb-1.5">
                    Escala EVA de dor{" "}
                    {entry.pain_eva !== null && (
                      <span
                        className="font-semibold"
                        style={{ color: evaColor(entry.pain_eva) }}
                      >
                        · {entry.pain_eva} — {evaLabel(entry.pain_eva)}
                      </span>
                    )}
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => i).map((v) => (
                      <button
                        key={v}
                        onClick={() => updateEntry(entry.uid, { pain_eva: v })}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold tabular-nums transition border ${
                          entry.pain_eva === v
                            ? "text-white border-transparent scale-105"
                            : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                        }`}
                        style={
                          entry.pain_eva === v
                            ? { backgroundColor: evaColor(v) }
                            : undefined
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium mb-2">
              Observações da sessão (opcional)
            </p>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Ex.: paciente relatou melhora ao subir escadas..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl py-3.5 text-sm transition disabled:opacity-60"
          >
            <Check size={17} />
            {saving
              ? "Salvando..."
              : `Salvar sessão (${entries.length} exercício${entries.length === 1 ? "" : "s"})`}
          </button>
        </div>
      </div>

      {/* Painel lateral de documentos */}
      {showDocs && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowDocs(false)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-sm">
                Documentos · {patient.full_name}
              </h2>
              <button
                onClick={() => setShowDocs(false)}
                className="p-1.5 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <DocumentsPanel patientId={patient.id} compact />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
