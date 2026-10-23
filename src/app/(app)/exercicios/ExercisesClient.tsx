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
import { Dumbbell, Pencil, Plus, Search } from "lucide-react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Fab,
  Field,
  PageHeader,
  inputCls,
  useToast,
} from "@/components/ui";

export default function ExercisesClient({ initial }: { initial: Exercise[] }) {
  const { toast } = useToast();
  const [exercises, setExercises] = useState(initial);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todas");
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [mType, setMType] = useState<MeasurementType>("series_reps");

  const filtered = useMemo(
    () =>
      exercises.filter((e) => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (!search && category !== "todas" && e.category !== category)
          return false;
        return true;
      }),
    [exercises, search, category]
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
    const { error } =
      editing && editing !== "new"
        ? await supabase.from("exercises").update(payload).eq("id", editing.id)
        : await supabase.from("exercises").insert(payload);
    setSaving(false);
    if (error) {
      toast("Não foi possível salvar o exercício.", { kind: "error" });
      return;
    }
    setEditing(null);
    toast(editing === "new" ? "Exercício criado." : "Exercício atualizado.");
    reload();
  }

  const current = editing !== "new" ? editing : null;

  function openNew() {
    setMType("series_reps");
    setEditing("new");
  }

  return (
    <div>
      <PageHeader
        back="/perfil"
        title="Exercícios"
        subtitle="Catálogo usado nos registros de atendimento"
        action={
          <Button size="sm" onClick={openNew} className="hidden md:inline-flex">
            <Plus size={16} /> Novo exercício
          </Button>
        }
      />

      <label className="relative block mb-3">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          enterKeyHint="search"
          className={`${inputCls} pl-11`}
        />
      </label>

      {!search && (
        <ChipRow className="mb-4">
          <Chip active={category === "todas"} onClick={() => setCategory("todas")}>
            Todos
          </Chip>
          {Object.entries(EXERCISE_CATEGORIES).map(([k, v]) => (
            <Chip key={k} active={category === k} onClick={() => setCategory(k)}>
              {v}
            </Chip>
          ))}
        </ChipRow>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell size={22} />}
          title="Nenhum exercício encontrado"
          action={
            <Button onClick={openNew}>
              <Plus size={18} /> Novo exercício
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {[...grouped.entries()].map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-1.5 px-0.5">
                {EXERCISE_CATEGORIES[cat] ?? cat}
              </h2>
              <Card as="ul" className="divide-y divide-line overflow-hidden">
                {list.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMType(ex.measurement_type);
                        setEditing(ex);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 min-h-14 text-left hover:bg-surface-2 active:bg-surface-3 transition-colors ${
                        !ex.active ? "opacity-60" : ""
                      }`}
                    >
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[15px] font-medium truncate">{ex.name}</span>
                          {!ex.active && <Badge>Inativo</Badge>}
                        </span>
                        {ex.description && (
                          <span className="block text-xs text-fg-muted truncate">
                            {ex.description}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-fg-muted tnum shrink-0">
                        {formatDefaults(ex)}
                      </span>
                      <Pencil size={15} className="text-fg-faint shrink-0" />
                    </button>
                  </li>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      <Fab onClick={openNew} label="Novo exercício">
        <Plus size={22} /> Exercício
      </Fab>

      <BottomSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={current ? "Editar exercício" : "Novo exercício"}
        tall
      >
        <form onSubmit={handleSubmit} className="space-y-4 pb-2" key={current?.id ?? "new"}>
          <Field label="Nome *">
            <input name="name" required defaultValue={current?.name} className={inputCls} autoComplete="off" />
          </Field>
          <Field label="Categoria">
            <select name="category" defaultValue={current?.category ?? "fortalecimento"} className={inputCls}>
              {Object.entries(EXERCISE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descrição">
            <input name="description" defaultValue={current?.description ?? ""} className={inputCls} />
          </Field>
          <Field label="Como este exercício é medido?">
            <select
              value={mType}
              onChange={(e) => setMType(e.target.value as MeasurementType)}
              className={inputCls}
            >
              {Object.entries(MEASUREMENT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {mType !== "cardio" && (
              <Field label="Séries padrão">
                <input type="number" inputMode="numeric" name="default_sets" min={1} defaultValue={current?.default_sets ?? 3} className={inputCls} />
              </Field>
            )}
            {mType === "series_reps" && (
              <Field label="Repetições padrão">
                <input type="number" inputMode="numeric" name="default_reps" min={1} defaultValue={current?.default_reps ?? 12} className={inputCls} />
              </Field>
            )}
            {mType === "series_tempo" && (
              <Field label="Tempo padrão (s)">
                <input type="number" inputMode="numeric" name="default_duration" min={1} defaultValue={current?.default_duration_seconds ?? 30} className={inputCls} />
              </Field>
            )}
            {mType === "cardio" && (
              <Field label="Tempo padrão (min)">
                <input
                  type="number"
                  inputMode="numeric"
                  name="default_duration"
                  min={1}
                  defaultValue={current?.default_duration_seconds ? Math.round(current.default_duration_seconds / 60) : 10}
                  className={inputCls}
                />
              </Field>
            )}
          </div>
          <label className="flex items-center gap-3 min-h-12 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={current?.active ?? true}
              className="w-5 h-5 rounded accent-[var(--accent)]"
            />
            Ativo (aparece no atendimento)
          </label>
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}
