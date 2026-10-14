"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  History,
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

export type LastSession = {
  session_date: string;
  items: {
    exercise: Exercise;
    sets: number | null;
    reps: number | null;
    load_kg: number | null;
    duration_seconds: number | null;
    speed_kmh: number | null;
    distance_m: number | null;
    incline_pct: number | null;
  }[];
};

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null): string {
  return v === null || v === undefined ? "" : String(v);
}

/** scrollIntoView não existe no jsdom (testes) — chama só se disponível. */
function scrollTo(el: HTMLElement | null, block: ScrollLogicalPosition = "start") {
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block });
  }
}

let uidCounter = 0;
function newUid(prefix: string) {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

const inputCls =
  "h-11 rounded-lg border border-gray-300 bg-white px-3 text-base sm:text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand";

function Stepper({
  value,
  onChange,
  min = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 bg-white overflow-hidden">
      <button
        type="button"
        aria-label={`Diminuir ${label}`}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-11 h-11 flex items-center justify-center text-gray-600 active:bg-gray-100 hover:text-gray-900"
      >
        <Minus size={18} />
      </button>
      <span className="w-10 text-center text-base font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(value + 1)}
        className="w-11 h-11 flex items-center justify-center text-gray-600 active:bg-gray-100 hover:text-gray-900"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

export default function AtendimentoClient({
  patient,
  exercises,
  lastSession = null,
}: {
  patient: Patient;
  exercises: Exercise[];
  lastSession?: LastSession | null;
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
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Trava o scroll do fundo enquanto o catálogo (mobile) ou os docs estão abertos
  useEffect(() => {
    const open = catalogOpen || showDocs;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [catalogOpen, showDocs]);

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
        uid: newUid(ex.id),
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
    setError(null);
    setJustAdded(ex.name);
    window.setTimeout(() => setJustAdded(null), 1500);
  }

  function repeatLastSession() {
    if (!lastSession) return;
    setEntries(
      lastSession.items.map((it) => {
        const mt = it.exercise.measurement_type;
        return {
          uid: newUid(it.exercise.id),
          exercise: it.exercise,
          sets: it.sets ?? it.exercise.default_sets,
          reps: it.reps ?? it.exercise.default_reps,
          duration_value:
            mt === "cardio"
              ? numToStr(
                  it.duration_seconds !== null
                    ? Math.round(it.duration_seconds / 60)
                    : null
                )
              : numToStr(it.duration_seconds),
          load_kg: numToStr(it.load_kg),
          speed_kmh: numToStr(it.speed_kmh),
          distance_m: numToStr(it.distance_m),
          incline_pct: numToStr(it.incline_pct),
          pain_eva: null,
          notes: "",
        };
      })
    );
    setError(null);
  }

  function closeCatalog() {
    setCatalogOpen(false);
    setSearch("");
    // leva o fisio direto para o último exercício adicionado
    window.setTimeout(() => scrollTo(listEndRef.current), 50);
  }

  function openCatalog() {
    setCatalogOpen(true);
    window.setTimeout(() => searchRef.current?.focus(), 100);
  }

  function updateEntry(uid: string, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e))
    );
  }

  function removeEntry(uid: string) {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
  }

  const missingEvaCount = entries.filter((e) => e.pain_eva === null).length;
  const missingEva = missingEvaCount > 0;

  async function handleSave() {
    if (entries.length === 0) {
      setError("Adicione pelo menos um exercício.");
      return;
    }
    if (missingEva) {
      setError("Registre a escala EVA de dor em todos os exercícios.");
      const first = entries.find((e) => e.pain_eva === null);
      if (first) {
        scrollTo(document.getElementById(`entry-${first.uid}`), "center");
      }
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

  const lastSessionDateLabel = lastSession
    ? lastSession.session_date.split("-").reverse().join("/")
    : null;

  const catalog = (
    <>
      <div className="relative mb-2">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          className="w-full h-11 rounded-lg border border-gray-300 pl-9 pr-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setCategory("todas")}
          className={`shrink-0 whitespace-nowrap text-sm font-medium rounded-full px-4 h-9 transition ${
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
            className={`shrink-0 whitespace-nowrap text-sm font-medium rounded-full px-4 h-9 transition ${
              category === k
                ? "bg-brand text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 lg:max-h-[55vh] -mx-1 px-1">
        {[...grouped.entries()].map(([cat, list]) => (
          <div key={cat}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 sticky top-0 bg-white py-1">
              {EXERCISE_CATEGORIES[cat] ?? cat}
            </p>
            <ul className="space-y-1">
              {list.map((ex) => (
                <li key={ex.id}>
                  <button
                    onClick={() => addExercise(ex)}
                    className="w-full min-h-11 flex items-center gap-3 rounded-lg px-3 py-2 text-left text-base sm:text-sm active:bg-cyan-100 hover:bg-cyan-50 transition group"
                  >
                    <span className="w-8 h-8 rounded-full bg-cyan-50 text-brand flex items-center justify-center shrink-0 group-active:bg-brand group-active:text-white">
                      <Plus size={16} />
                    </span>
                    <span className="flex-1 leading-snug">{ex.name}</span>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">
                      {formatDefaults(ex)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            Nenhum exercício encontrado.
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="pb-28 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4 lg:mb-6">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href={`/pacientes/${patient.id}`}
            aria-label="Voltar"
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base lg:text-xl font-bold leading-tight truncate">
              <span className="hidden lg:inline">Atendimento · </span>
              {patient.full_name}
            </h1>
            <p className="text-xs text-gray-500 truncate">
              {patient.diagnosis || "Sem diagnóstico registrado"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            aria-label="Data da sessão"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            className="h-11 rounded-lg border border-gray-300 bg-white px-2 lg:px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            onClick={() => setShowDocs(true)}
            aria-label="Ver documentos"
            className="h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white w-11 lg:w-auto lg:px-3.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            <FolderOpen size={18} />
            <span className="hidden lg:inline">Ver documentos</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Catálogo — coluna fixa no desktop; bottom sheet no mobile */}
        <div className="lg:col-span-2">
          <div
            className={`${
              catalogOpen
                ? "fixed inset-0 z-50 flex flex-col justify-end lg:static lg:z-auto lg:block"
                : "hidden lg:block"
            }`}
          >
            {catalogOpen && (
              <div
                className="absolute inset-0 bg-black/40 lg:hidden"
                onClick={closeCatalog}
              />
            )}
            <div
              className={`relative bg-white flex flex-col lg:sticky lg:top-4 lg:rounded-xl lg:border lg:border-gray-200 lg:p-4 ${
                catalogOpen
                  ? "rounded-t-2xl max-h-[88dvh] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
                  : ""
              }`}
            >
              {catalogOpen && (
                <div className="mx-auto w-10 h-1 rounded-full bg-gray-300 mb-3 lg:hidden" />
              )}
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-sm">
                  Exercícios pré-cadastrados
                </h2>
                <button
                  onClick={closeCatalog}
                  className="lg:hidden h-9 px-4 rounded-full bg-brand text-white text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <Check size={16} /> Pronto
                  {entries.length > 0 ? ` (${entries.length})` : ""}
                </button>
              </div>
              {catalog}
              {justAdded && (
                <div className="lg:hidden pointer-events-none absolute bottom-20 inset-x-0 flex justify-center">
                  <span className="bg-gray-900 text-white text-sm rounded-full px-4 py-2 shadow-lg">
                    ✓ {justAdded} adicionado
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Registro da sessão */}
        <div className="lg:col-span-3 space-y-3 lg:space-y-4">
          {entries.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 lg:p-10 text-center space-y-3">
              <p className="text-sm text-gray-500 hidden lg:block">
                Toque em um exercício ao lado para adicioná-lo à sessão de
                hoje.
              </p>
              <p className="text-sm text-gray-500 lg:hidden">
                Nenhum exercício na sessão de hoje.
              </p>
              {lastSession && (
                <button
                  onClick={repeatLastSession}
                  className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-light text-brand-dark font-semibold text-sm border border-cyan-200 active:bg-cyan-100"
                >
                  <History size={18} />
                  Repetir última sessão ({lastSession.items.length}{" "}
                  exercício{lastSession.items.length === 1 ? "" : "s"} ·{" "}
                  {lastSessionDateLabel})
                </button>
              )}
              <button
                onClick={openCatalog}
                className="lg:hidden w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white font-semibold text-sm active:bg-gray-50"
              >
                <Plus size={18} /> Adicionar exercício
              </button>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const done = entry.pain_eva !== null;
              const highlightMissing = !!error && !done;
              return (
                <div
                  key={entry.uid}
                  id={`entry-${entry.uid}`}
                  className={`bg-white rounded-xl border p-4 ${
                    highlightMissing
                      ? "border-red-300 ring-2 ring-red-100"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-sm flex items-center gap-2 min-w-0">
                      {done && (
                        <span
                          className="w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: evaColor(entry.pain_eva!) }}
                        >
                          <Check size={12} />
                        </span>
                      )}
                      <span className="truncate">
                        {idx + 1}. {entry.exercise.name}
                      </span>
                    </p>
                    <button
                      onClick={() => removeEntry(entry.uid)}
                      aria-label={`Remover ${entry.exercise.name}`}
                      className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-400 hover:text-red-600 active:text-red-600 transition shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-end gap-x-4 gap-y-3 mb-3">
                    {entry.exercise.measurement_type !== "cardio" && (
                      <Field label="Séries">
                        <Stepper
                          label="séries"
                          value={entry.sets}
                          onChange={(v) => updateEntry(entry.uid, { sets: v })}
                        />
                      </Field>
                    )}
                    {entry.exercise.measurement_type === "series_reps" && (
                      <>
                        <Field label="Repetições">
                          <Stepper
                            label="repetições"
                            value={entry.reps}
                            onChange={(v) =>
                              updateEntry(entry.uid, { reps: v })
                            }
                          />
                        </Field>
                        <Field label="Carga (kg) — opcional">
                          <input
                            inputMode="decimal"
                            value={entry.load_kg}
                            onChange={(e) =>
                              updateEntry(entry.uid, {
                                load_kg: e.target.value,
                              })
                            }
                            placeholder="—"
                            className={`w-20 ${inputCls}`}
                          />
                        </Field>
                      </>
                    )}
                    {entry.exercise.measurement_type === "series_tempo" && (
                      <Field label="Tempo por série (segundos)">
                        <input
                          inputMode="numeric"
                          value={entry.duration_value}
                          onChange={(e) =>
                            updateEntry(entry.uid, {
                              duration_value: e.target.value,
                            })
                          }
                          placeholder="30"
                          className={`w-24 ${inputCls}`}
                        />
                      </Field>
                    )}
                    {entry.exercise.measurement_type === "cardio" && (
                      <>
                        <Field label="Tempo (min)">
                          <input
                            inputMode="numeric"
                            value={entry.duration_value}
                            onChange={(e) =>
                              updateEntry(entry.uid, {
                                duration_value: e.target.value,
                              })
                            }
                            placeholder="10"
                            className={`w-20 ${inputCls}`}
                          />
                        </Field>
                        <Field label="Velocidade (km/h)">
                          <input
                            inputMode="decimal"
                            value={entry.speed_kmh}
                            onChange={(e) =>
                              updateEntry(entry.uid, {
                                speed_kmh: e.target.value,
                              })
                            }
                            placeholder="—"
                            className={`w-24 ${inputCls}`}
                          />
                        </Field>
                        <Field label="Distância (m)">
                          <input
                            inputMode="decimal"
                            value={entry.distance_m}
                            onChange={(e) =>
                              updateEntry(entry.uid, {
                                distance_m: e.target.value,
                              })
                            }
                            placeholder="—"
                            className={`w-24 ${inputCls}`}
                          />
                        </Field>
                        <Field label="Elevação/Inclinação (%)">
                          <input
                            inputMode="decimal"
                            value={entry.incline_pct}
                            onChange={(e) =>
                              updateEntry(entry.uid, {
                                incline_pct: e.target.value,
                              })
                            }
                            placeholder="—"
                            className={`w-24 ${inputCls}`}
                          />
                        </Field>
                      </>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">
                      Escala EVA de dor{" "}
                      {done ? (
                        <span
                          className="font-semibold"
                          style={{ color: evaColor(entry.pain_eva!) }}
                        >
                          · {entry.pain_eva} — {evaLabel(entry.pain_eva!)}
                        </span>
                      ) : (
                        <span className="text-gray-400">· toque para marcar</span>
                      )}
                    </p>
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                      {Array.from({ length: 11 }, (_, i) => i).map((v) => (
                        <button
                          key={v}
                          onClick={() =>
                            updateEntry(entry.uid, { pain_eva: v })
                          }
                          className={`h-11 rounded-lg text-base font-semibold tabular-nums transition border ${
                            entry.pain_eva === v
                              ? "text-white border-transparent scale-105 shadow"
                              : "bg-white text-gray-600 border-gray-200 active:border-gray-400 hover:border-gray-400"
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

                  <div className="mt-3">
                    <input
                      value={entry.notes}
                      onChange={(e) =>
                        updateEntry(entry.uid, { notes: e.target.value })
                      }
                      aria-label="Observação do exercício (opcional)"
                      placeholder="Ex.: dor no final da amplitude, compensou com o tronco..."
                      className="w-full h-11 rounded-lg border border-gray-300 px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
              );
            })
          )}

          {entries.length > 0 && (
            <button
              onClick={openCatalog}
              className="lg:hidden w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white font-semibold text-sm text-gray-700 active:bg-gray-50"
            >
              <Plus size={18} /> Adicionar exercício
            </button>
          )}
          <div ref={listEndRef} />

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium mb-2">
              Observações da sessão (opcional)
            </p>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Ex.: paciente relatou melhora ao subir escadas..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Barra de salvar: fixa acima da tab bar no mobile, inline no desktop */}
          <div className="fixed lg:static inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 lg:z-auto bg-white/95 backdrop-blur border-t border-gray-200 lg:border-0 lg:bg-transparent px-4 py-2.5 lg:p-0">
            {entries.length > 0 && missingEva && (
              <p className="lg:hidden text-xs text-amber-700 mb-1.5 text-center">
                Falta marcar a EVA em {missingEvaCount} exercício
                {missingEvaCount === 1 ? "" : "s"}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 lg:h-auto lg:py-3.5 inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark active:bg-brand-dark text-white font-semibold rounded-xl text-base lg:text-sm transition disabled:opacity-60"
            >
              <Check size={18} />
              {saving
                ? "Salvando..."
                : `Salvar sessão (${entries.length} exercício${entries.length === 1 ? "" : "s"})`}
            </button>
          </div>
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
            <div className="flex items-center justify-between pl-5 pr-2 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-sm truncate">
                Documentos · {patient.full_name}
              </h2>
              <button
                onClick={() => setShowDocs(false)}
                aria-label="Fechar"
                className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-900"
              >
                <X size={20} />
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
