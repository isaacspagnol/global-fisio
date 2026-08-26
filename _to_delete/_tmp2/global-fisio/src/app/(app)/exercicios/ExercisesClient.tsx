"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EXERCISE_CATEGORIES,
  MEASUREMENT_LABEL,
  formatDefaults,
  type Exercise,
  type MeasurementType,
} from "@/lib/types";
import { Pencil, Plus, Search, X } from "lucide-react";

const field =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

export default function ExercisesClient({ initial }: { initial: Exercise[] }) {
  const [exercises, setExercises] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [mType, setMType] = useState<MeasurementType>("series_reps");

  const filtered = useMemo(
    () =>
      exercises.filter((e) =>
        search ? e.name.toLowerCase().includes(search.toLowerCase()) : true
      ),
    [exercises, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [filtered]);

  async function reload() {
    const supabase = createClient();
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .order("category")
      .order("name");
    setExercises((data ?? []) as Exercise[]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const durationRaw = Number(fd.get("default_duration") ?? 0);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      category: fd.get("category") as string,
      description: (fd.get("description") as string) || null,
      measurement_type: mType,
      default_sets: Number(fd.get("default_sets") ?? 3) || 1,
      default_reps: Number(fd.get("default_reps") ?? 12) || 1,
      default_duration_seconds:
        mType === "series_tempo"
          ? durationRaw || 30
          : mType === "cardio"
            ? (durationRaw || 10) * 60
            : null,
      active: fd.get("active") === "on",
    };
    const supabase = createClient();
    if (editing && editing !== "new") {
      await supabase.from("exercises").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("exercises").insert(payload);
    }
    setSaving(false);
    setEditing(null);
    reload();
  }

  const current = editing !== "new" ? editing : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Exercícios</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Catálogo usado nos registros de atendimento
          </p>
        </div>
        <button
          onClick={() => {
            setMType("series_reps");
            setEditing("new");
          }}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
        >
          <Plus size={16} /> Novo exercício
        </button>
      </div>

      <div className="relative max-w-sm mb-5">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      <div className="space-y-6">
        {[...grouped.entries()].map(([cat, list]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {EXERCISE_CATEGORIES[cat] ?? cat}
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {list.map((ex) => (
                <div
                  key={ex.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    !ex.active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {ex.name}
                      {!ex.active && (
                        <span className="ml-2 text-[10px] font-semibold text-gray-400 uppercase">
                          inativo
                        </span>
                      )}
                    </p>
                    {ex.description && (
                      <p className="text-xs text-gray-500 truncate">
                        {ex.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {formatDefaults(ex)}
                  </span>
                  <button
                    onClick={() => {
                      setMType(ex.measurement_type);
                      setEditing(ex);
                    }}
                    className="p-2 text-gray-400 hover:text-brand transition"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {current ? "Editar exercício" : "Novo exercício"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-1 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <input
                name="name"
                required
                defaultValue={current?.name}
                className={field}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <select
                name="category"
                defaultValue={current?.category ?? "fortalecimento"}
                className={field}
              >
                {Object.entries(EXERCISE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <input
                name="description"
                defaultValue={current?.description ?? ""}
                className={field}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Como este exercício é medido?
              </label>
              <select
                value={mType}
                onChange={(e) => setMType(e.target.value as MeasurementType)}
                className={field}
              >
                {Object.entries(MEASUREMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mType !== "cardio" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Séries padrão
                  </label>
                  <input
                    type="number"
                    name="default_sets"
                    min={1}
                    defaultValue={current?.default_sets ?? 3}
                    className={field}
                  />
                </div>
              )}
              {mType === "series_reps" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repetições padrão
                  </label>
                  <input
                    type="number"
                    name="default_reps"
                    min={1}
                    defaultValue={current?.default_reps ?? 12}
                    className={field}
                  />
                </div>
              )}
              {mType === "series_tempo" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo padrão (segundos)
                  </label>
                  <input
                    type="number"
                    name="default_duration"
                    min={1}
                    defaultValue={current?.default_duration_seconds ?? 30}
                    className={field}
                  />
                </div>
              )}
              {mType === "cardio" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tempo padrão (minutos)
                  </label>
                  <input
                    type="number"
                    name="default_duration"
                    min={1}
                    defaultValue={
                      current?.default_duration_seconds
                        ? Math.round(current.default_duration_seconds / 60)
                        : 10
                    }
                    className={field}
                  />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={current?.active ?? true}
                className="rounded border-gray-300 text-brand focus:ring-brand"
              />
              Ativo (aparece no atendimento)
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand hover:bg-brand-dark text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
