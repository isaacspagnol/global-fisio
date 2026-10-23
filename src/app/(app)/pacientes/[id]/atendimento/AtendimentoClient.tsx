"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import DocumentsPanel from "@/components/DocumentsPanel";
import {
  BottomSheet,
  Button,
  Chip,
  ChipRow,
  Stepper,
  textareaCls,
  useToast,
} from "@/components/ui";
import {
  EXERCISE_CATEGORIES,
  evaColor,
  evaLabel,
  evaTextColor,
  formatDefaults,
  formatDose,
  type Exercise,
  type Patient,
} from "@/lib/types";
import { formatDayMonth, todayLocalISO } from "@/lib/dates";
import {
  haptic,
  useKeyboardOpen,
  useMounted,
  useOnline,
  useWakeLock,
  withTimeout,
} from "@/lib/hooks";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CloudOff,
  FolderOpen,
  History,
  MessageSquarePlus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tipos                                                                */
/* ------------------------------------------------------------------ */

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
  collapsed: boolean;
};

type LastItem = {
  exercise: Exercise;
  sets: number | null;
  reps: number | null;
  load_kg: number | null;
  duration_seconds: number | null;
  speed_kmh: number | null;
  distance_m: number | null;
  incline_pct: number | null;
  pain_eva?: number | null;
};

export type LastSession = {
  session_date: string;
  items: LastItem[];
};

export type EditingSession = {
  id: string;
  session_date: string;
  general_notes: string | null;
  items: (LastItem & { id: string; pain_eva: number; notes: string | null })[];
};

type Draft = {
  savedAt: number;
  /** id da sessão gerado no cliente — garante retry idempotente */
  sessionId?: string;
  sessionDate: string;
  generalNotes: string;
  entries: (Omit<Entry, "exercise"> & { exerciseId: string })[];
};

type SaveStatus = "idle" | "saving" | "error";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function numOrNull(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** scrollIntoView não existe no jsdom (testes) — chama só se disponível. */
function scrollTo(el: HTMLElement | null, block: ScrollLogicalPosition = "start") {
  if (el && typeof el.scrollIntoView === "function") {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
  }
}

let uidCounter = 0;
function newUid(prefix: string) {
  uidCounter += 1;
  return `${prefix}-${Date.now()}-${uidCounter}`;
}

function entryFromExercise(ex: Exercise, last?: LastItem | null): Entry {
  const mt = ex.measurement_type;
  const defaultDuration =
    mt === "series_tempo"
      ? String(ex.default_duration_seconds ?? 30)
      : mt === "cardio"
        ? String(Math.round((ex.default_duration_seconds ?? 600) / 60))
        : "";
  return {
    uid: newUid(ex.id),
    exercise: ex,
    sets: last?.sets ?? ex.default_sets,
    reps: last?.reps ?? ex.default_reps,
    duration_value: last?.duration_seconds
      ? mt === "cardio"
        ? String(Math.round(last.duration_seconds / 60))
        : String(last.duration_seconds)
      : defaultDuration,
    load_kg: numToStr(last?.load_kg),
    speed_kmh: numToStr(last?.speed_kmh),
    distance_m: numToStr(last?.distance_m),
    incline_pct: numToStr(last?.incline_pct),
    pain_eva: null,
    notes: "",
    collapsed: false,
  };
}

function doseOf(e: Entry) {
  const mt = e.exercise.measurement_type;
  return formatDose({
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
  });
}

const draftKey = (patientId: string) => `gf:draft:${patientId}`;
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;
/** Ligue após criar a coluna `position integer` em session_exercises (ver supabase/migrations). */
const HAS_POSITION = false;

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // fallback (ambientes sem randomUUID)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Bip curto no fim do timer (best-effort; iOS exige gesto prévio e som ligado).
 * Um único AudioContext, criado/retomado no toque em "Iniciar" (gesto do usuário).
 */
let audioCtx: AudioContext | null = null;
function primeAudio() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}
function beep() {
  try {
    if (!audioCtx || audioCtx.state !== "running") return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Sub-componentes                                                      */
/* ------------------------------------------------------------------ */

const numInput =
  "h-12 w-full rounded-xl border border-line-strong bg-surface text-fg px-2 text-center text-lg font-bold tnum placeholder:text-fg-faint placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";

function NumField({
  label,
  unit,
  value,
  onChange,
  placeholder,
  mode = "decimal",
  className = "",
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mode?: "decimal" | "numeric";
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-xs font-medium text-fg-muted mb-1.5 truncate">
        {label}
        {unit ? <span className="text-fg-faint"> · {unit}</span> : null}
      </span>
      <input
        inputMode={mode}
        pattern={mode === "numeric" ? "[0-9]*" : undefined}
        enterKeyHint="done"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className={numInput}
      />
    </label>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-fg-muted mb-1.5">{label}</p>
      {children}
    </div>
  );
}

/** Timer de isometria/alongamento — número grande, sem anel. */
function HoldTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const raf = useRef<number | null>(null);
  const endAt = useRef(0);

  const stop = useCallback(() => {
    setRunning(false);
    if (raf.current) window.clearInterval(raf.current);
    raf.current = null;
  }, []);

  const start = useCallback(() => {
    if (!seconds || seconds <= 0) return;
    primeAudio();
    endAt.current = Date.now() + seconds * 1000;
    setLeft(seconds);
    setRunning(true);
    if (raf.current) window.clearInterval(raf.current);
    raf.current = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) {
        stop();
        haptic(60);
        beep();
      }
    }, 200);
  }, [seconds, stop]);

  useEffect(() => () => stop(), [stop]);

  const finished = left === 0 && !running;

  if (!running && left === null) {
    return (
      <Button
        variant="soft"
        size="md"
        onClick={start}
        disabled={!seconds || seconds <= 0}
        aria-label={`Iniciar timer de ${seconds} segundos`}
        className="w-full"
      >
        <Play size={18} /> Iniciar {seconds}s
      </Button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 h-14 border transition-colors ${
        finished
          ? "bg-success-soft border-success/40"
          : "bg-accent-soft border-transparent"
      }`}
      role="timer"
      aria-live="off"
    >
      <span
        className={`text-3xl font-bold tnum ${
          finished ? "text-success" : "text-accent-soft-fg"
        }`}
      >
        {finished ? "✓" : `${left}s`}
      </span>
      <div className="flex gap-1.5">
        {running ? (
          <Button variant="secondary" size="sm" iconOnly onClick={stop} aria-label="Pausar timer">
            <Pause size={18} />
          </Button>
        ) : (
          <Button variant="secondary" size="sm" iconOnly onClick={start} aria-label="Reiniciar timer">
            <RotateCcw size={18} />
          </Button>
        )}
      </div>
    </div>
  );
}

function EvaPicker({
  value,
  lastValue,
  onChange,
  name,
}: {
  value: number | null;
  lastValue: number | null | undefined;
  onChange: (v: number) => void;
  name: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
          Dor (EVA 0–10)
        </p>
        <p className="text-[11px] text-fg-faint">
          0 sem dor · 10 pior dor
        </p>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        <div
          role="radiogroup"
          aria-label={`Dor (EVA) — ${name}`}
          className="contents"
        >
        {Array.from({ length: 11 }, (_, v) => {
          const selected = value === v;
          const isLast = lastValue === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (value === null && v === 0) ? 0 : -1}
              onKeyDown={(e) => {
                // setas percorrem a escala (roving tabindex)
                const delta =
                  e.key === "ArrowRight" || e.key === "ArrowDown"
                    ? 1
                    : e.key === "ArrowLeft" || e.key === "ArrowUp"
                      ? -1
                      : 0;
                if (!delta) return;
                e.preventDefault();
                const next = Math.min(10, Math.max(0, v + delta));
                onChange(next);
                const el = e.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                  `button[aria-label^="Dor ${next} de 10"]`
                );
                el?.focus();
              }}
              aria-label={`Dor ${v} de 10 — ${evaLabel(v)}${
                isLast ? " (última sessão)" : ""
              }`}
              onClick={() => {
                haptic();
                onChange(v);
              }}
              className={`relative h-12 rounded-xl text-lg font-bold tnum transition-[transform,background-color,color] active:scale-95 ${
                selected
                  ? "shadow-card ring-2 ring-offset-2 ring-offset-surface"
                  : "bg-surface-2 text-fg hover:bg-surface-3"
              }`}
              style={
                selected
                  ? ({
                      backgroundColor: evaColor(v),
                      color: evaTextColor(v),
                      "--tw-ring-color": evaColor(v),
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {v}
              {isLast && !selected && (
                <span
                  aria-hidden
                  className="absolute left-1/2 -translate-x-1/2 bottom-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: evaColor(v) }}
                />
              )}
            </button>
          );
        })}
        </div>
        {/* 12ª célula: leitura do valor escolhido (vira recurso, não buraco) */}
        <div
          aria-live="polite"
          className={`h-12 rounded-xl flex flex-col items-center justify-center leading-none ${
            value === null
              ? "border border-dashed border-line-strong text-fg-faint"
              : ""
          }`}
          style={
            value !== null
              ? { color: evaColor(value), backgroundColor: `${evaColor(value)}1f` }
              : undefined
          }
        >
          {value === null ? (
            <span className="text-[11px] font-medium text-center px-1">
              toque
              <br />
              para marcar
            </span>
          ) : (
            <>
              <span className="text-[11px] font-bold text-center px-1 leading-tight">
                {evaLabel(value)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tela                                                                 */
/* ------------------------------------------------------------------ */

export default function AtendimentoClient({
  patient,
  exercises,
  lastSession = null,
  recentExerciseIds = [],
  editingSession = null,
}: {
  patient: Patient;
  exercises: Exercise[];
  lastSession?: LastSession | null;
  recentExerciseIds?: string[];
  editingSession?: EditingSession | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const online = useOnline();
  const isEditing = !!editingSession;

  useWakeLock(true);
  const mounted = useMounted();

  const rootRef = useRef<HTMLDivElement>(null);
  const keyboardOpen = useKeyboardOpen(rootRef);

  const [entries, setEntries] = useState<Entry[]>(() =>
    editingSession
      ? editingSession.items.map((it) => ({
          ...entryFromExercise(it.exercise, it),
          pain_eva: it.pain_eva,
          notes: it.notes ?? "",
          collapsed: true,
        }))
      : []
  );
  const [generalNotes, setGeneralNotes] = useState(
    editingSession?.general_notes ?? ""
  );
  const [sessionDate, setSessionDate] = useState(
    () => editingSession?.session_date ?? todayLocalISO()
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>(
    recentExerciseIds.length ? "recentes" : "todas"
  );
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [notesOpenFor, setNotesOpenFor] = useState<string | null>(null);
  const [, setDraftRestored] = useState(false);
  const sessionIdRef = useRef<string>(newSessionId());

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey(patient.id));
    } catch {
      /* ignore */
    }
  }, [patient.id]);

  const lastByExercise = useMemo(() => {
    const m = new Map<string, LastItem>();
    for (const it of lastSession?.items ?? []) m.set(it.exercise.id, it);
    return m;
  }, [lastSession]);

  const exerciseById = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const e of exercises) m.set(e.id, e);
    for (const it of lastSession?.items ?? []) m.set(it.exercise.id, it.exercise);
    return m;
  }, [exercises, lastSession]);

  /* ---------------- Rascunho local ---------------- */

  // Restaura rascunho (só em sessão nova) depois de montar, sem mexer na hidratação.
  // (setState em effect é intencional: localStorage só existe no cliente.)
  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = window.localStorage.getItem(draftKey(patient.id));
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (!d.entries?.length || Date.now() - d.savedAt > DRAFT_TTL_MS) {
        window.localStorage.removeItem(draftKey(patient.id));
        return;
      }
      const restored: Entry[] = [];
      for (const e of d.entries) {
        const ex = exerciseById.get(e.exerciseId);
        if (ex) restored.push({ ...e, exercise: ex });
      }
      if (!restored.length) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntries(restored);
      setGeneralNotes(d.generalNotes ?? "");
      setSessionDate(d.sessionDate ?? todayLocalISO());
      if (d.sessionId) sessionIdRef.current = d.sessionId;
      setDraftRestored(true);
      const dropped = d.entries.length - restored.length;
      toast(
        dropped > 0
          ? `Rascunho recuperado (${dropped} exercício${dropped === 1 ? "" : "s"} já não existe no catálogo).`
          : "Rascunho recuperado — nada foi perdido.",
        {
          kind: "info",
          actionLabel: "Descartar",
          onAction: () => {
            setEntries([]);
            setGeneralNotes("");
            setSessionDate(todayLocalISO());
            sessionIdRef.current = newSessionId();
            clearDraft();
          },
        }
      );
    } catch {
      /* rascunho inválido: ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  // Persiste a cada mudança (barato: sessão tem poucos itens).
  useEffect(() => {
    if (isEditing) return;
    try {
      if (entries.length === 0) {
        // sessão esvaziada (ou nunca começou): sem rascunho fantasma
        window.localStorage.removeItem(draftKey(patient.id));
        return;
      }
      const d: Draft = {
        savedAt: Date.now(),
        sessionId: sessionIdRef.current,
        sessionDate,
        generalNotes,
        entries: entries.map(({ exercise, ...rest }) => ({
          ...rest,
          exerciseId: exercise.id,
        })),
      };
      window.localStorage.setItem(draftKey(patient.id), JSON.stringify(d));
    } catch {
      /* storage cheio/indisponível: segue sem rascunho */
    }
  }, [entries, generalNotes, sessionDate, patient.id, isEditing]);

  /* ---------------- Catálogo ---------------- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((e) => {
      if (q) return e.name.toLowerCase().includes(q);
      if (category === "recentes") return recentExerciseIds.includes(e.id);
      if (category !== "todas" && e.category !== category) return false;
      return true;
    });
  }, [exercises, search, category, recentExerciseIds]);

  const grouped = useMemo(() => {
    if (category === "recentes" && !search.trim()) {
      const order = new Map(recentExerciseIds.map((id, i) => [id, i]));
      return new Map([
        [
          "recentes",
          [...filtered].sort(
            (a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
          ),
        ],
      ]);
    }
    const map = new Map<string, Exercise[]>();
    for (const e of filtered) {
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [filtered, category, search, recentExerciseIds]);

  const countInSession = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(e.exercise.id, (m.get(e.exercise.id) ?? 0) + 1);
    return m;
  }, [entries]);

  function addExercise(ex: Exercise) {
    const last = lastByExercise.get(ex.id) ?? null;
    setEntries((prev) => [
      // ao adicionar um novo, os já concluídos continuam colapsados
      ...prev,
      entryFromExercise(ex, last),
    ]);
    setError(null);
    setJustAdded(ex.id);
    haptic();
    window.setTimeout(() => setJustAdded(null), 900);
  }

  function repeatLastSession() {
    if (!lastSession) return;
    setEntries(
      lastSession.items.map((it, i) => ({
        ...entryFromExercise(it.exercise, it),
        collapsed: i !== 0, // abre só o primeiro; os demais ficam compactos
      }))
    );
    setError(null);
    haptic();
  }

  const listEndRef = useRef<HTMLDivElement>(null);
  function closeCatalog() {
    setCatalogOpen(false);
    setSearch("");
    window.setTimeout(() => scrollTo(listEndRef.current, "end"), 80);
  }

  /* ---------------- Entradas ---------------- */

  function updateEntry(uid: string, patch: Partial<Entry>) {
    setEntries((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, ...patch } : e))
    );
  }

  function removeEntry(uid: string) {
    const index = entries.findIndex((e) => e.uid === uid);
    if (index < 0) return;
    const entry = entries[index];
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    toast(`${entry.exercise.name} removido`, {
      kind: "info",
      actionLabel: "Desfazer",
      onAction: () => {
        // captura {entry, index} desta remoção — vários "Desfazer" não se misturam
        setEntries((prev) =>
          prev.some((e) => e.uid === entry.uid)
            ? prev
            : [...prev.slice(0, index), entry, ...prev.slice(index)]
        );
      },
    });
  }

  function concludeEntry(uid: string) {
    haptic(20);
    const idx = entries.findIndex((e) => e.uid === uid);
    const after = entries
      .slice(idx + 1)
      .find((e) => e.pain_eva === null && e.collapsed);
    const pending =
      after ?? entries.find((e) => e.uid !== uid && e.pain_eva === null && e.collapsed);
    setEntries((prev) =>
      prev.map((e) =>
        e.uid === uid
          ? { ...e, collapsed: true }
          : pending && e.uid === pending.uid
            ? { ...e, collapsed: false }
            : e
      )
    );
    // abre o próximo pendente e rola até ele; sem pendentes, rola até o fim
    window.setTimeout(() => {
      if (pending) scrollTo(document.getElementById(`entry-${pending.uid}`), "center");
      else scrollTo(listEndRef.current, "end");
    }, 60);
  }

  const missing = entries.filter((e) => e.pain_eva === null);
  const missingEvaCount = missing.length;
  const doneCount = entries.length - missingEvaCount;

  /* ---------------- Salvar ---------------- */

  async function handleSave() {
    if (status === "saving") return;
    if (entries.length === 0) {
      setError("Adicione pelo menos um exercício.");
      return;
    }
    if (missingEvaCount > 0) {
      setError("Registre a escala EVA de dor em todos os exercícios.");
      const first = missing[0];
      setEntries((prev) =>
        prev.map((e) => (e.uid === first.uid ? { ...e, collapsed: false } : e))
      );
      window.setTimeout(
        () => scrollTo(document.getElementById(`entry-${first.uid}`), "center"),
        60
      );
      return;
    }

    setStatus("saving");
    setError(null);
    const supabase = createClient();
    const T = 15000;

    const rows = (sessionId: string) =>
      entries.map((e, position) => {
        const mt = e.exercise.measurement_type;
        return {
          session_id: sessionId,
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
          pain_eva: e.pain_eva ?? 0,
          notes: e.notes.trim() || null,
          // ordem de registro (coluna opcional; ignorada se não existir no schema)
          ...(HAS_POSITION ? { position } : {}),
        };
      });

    try {
      if (isEditing && editingSession) {
        const { error: uErr } = await withTimeout(
          Promise.resolve(
            supabase
              .from("sessions")
              .update({
                session_date: sessionDate,
                general_notes: generalNotes.trim() || null,
              })
              .eq("id", editingSession.id)
          ),
          T
        );
        if (uErr) throw uErr;
        // Insere os novos ANTES de apagar os antigos: se falhar aqui, a sessão
        // continua íntegra com os exercícios anteriores.
        const { error: iErr } = await withTimeout(
          Promise.resolve(
            supabase.from("session_exercises").insert(rows(editingSession.id))
          ),
          T
        );
        if (iErr) throw iErr;
        const oldIds = editingSession.items.map((it) => it.id).filter(Boolean);
        if (oldIds.length > 0) {
          const { error: dErr } = await withTimeout(
            Promise.resolve(
              supabase.from("session_exercises").delete().in("id", oldIds)
            ),
            T
          );
          if (dErr) throw dErr;
        }

        toast("Sessão atualizada.");
        router.push(`/pacientes/${patient.id}`);
        return;
      }

      // Id gerado no cliente e guardado no rascunho: "tentar de novo" após um
      // timeout faz UPSERT na mesma sessão em vez de criar uma duplicada.
      const sessionId = sessionIdRef.current;
      const { error: sErr } = await withTimeout(
        Promise.resolve(
          supabase.from("sessions").upsert(
            {
              id: sessionId,
              patient_id: patient.id,
              session_date: sessionDate,
              general_notes: generalNotes.trim() || null,
            },
            { onConflict: "id" }
          )
        ),
        T
      );
      if (sErr) throw sErr;

      // Limpa exercícios de uma tentativa anterior que tenha chegado ao servidor
      // depois do timeout (idempotência do retry).
      await withTimeout(
        Promise.resolve(
          supabase.from("session_exercises").delete().eq("session_id", sessionId)
        ),
        T
      ).catch(() => {});

      const { error: exErr } = await withTimeout(
        Promise.resolve(
          supabase.from("session_exercises").insert(rows(sessionId))
        ),
        T
      );
      if (exErr) {
        // compensação best-effort: não deixa sessão vazia no histórico;
        // o rascunho (com o mesmo id) continua salvo para tentar de novo
        await withTimeout(
          Promise.resolve(supabase.from("sessions").delete().eq("id", sessionId)),
          T
        ).catch(() => {});
        throw exErr;
      }

      // Sessão gravada: o rascunho sai AGORA (antes de qualquer passo opcional).
      clearDraft();

      // Marca a consulta de hoje como concluída (poupa uma tarefa na Agenda).
      try {
        const dayStart = new Date(`${sessionDate}T00:00:00`);
        const dayEnd = new Date(`${sessionDate}T23:59:59.999`);
        await withTimeout(
          Promise.resolve(
            supabase
              .from("appointments")
              .update({ status: "concluido" })
              .eq("patient_id", patient.id)
              .eq("status", "agendado")
              .gte("starts_at", dayStart.toISOString())
              .lte("starts_at", dayEnd.toISOString())
          ),
          8000
        );
      } catch {
        /* opcional */
      }

      toast(`Sessão salva · ${entries.length} exercício${entries.length === 1 ? "" : "s"}`);
      router.push(`/pacientes/${patient.id}?saved=1`);
    } catch (e) {
      const timeout = e instanceof Error && e.message === "timeout";
      setStatus("error");
      const offline = timeout || !navigator.onLine;
      setError(
        isEditing
          ? offline
            ? "Sem conexão. As alterações ainda não foram gravadas — tente de novo quando a rede voltar."
            : "Erro ao salvar as alterações. Tente novamente."
          : offline
            ? "Sem conexão. A sessão continua salva neste aparelho — tente de novo quando a rede voltar."
            : "Erro ao salvar a sessão. Tente novamente."
      );
    }
  }

  /* ---------------- Render ---------------- */

  const lastDateLabel = lastSession ? formatDayMonth(lastSession.session_date) : null;
  const allDone = entries.length > 0 && missingEvaCount === 0;

  // rolar a lista do catálogo esconde o teclado (iOS não tem tecla "OK")
  const blurOnScroll = () => {
    const a = document.activeElement;
    if (a instanceof HTMLInputElement) a.blur();
  };

  const catalog = (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-faint"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar exercício..."
          enterKeyHint="search"
          className="w-full h-12 rounded-xl border border-line-strong bg-surface pl-11 pr-3 text-base md:text-sm placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </label>
      {!search.trim() && (
        <ChipRow>
          {recentExerciseIds.length > 0 && (
            <Chip active={category === "recentes"} onClick={() => setCategory("recentes")}>
              <History size={14} /> Recentes
            </Chip>
          )}
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
      <div className="space-y-4">
        {[...grouped.entries()].map(([cat, list]) => (
          <div key={cat}>
            <p className="text-[11px] font-semibold text-fg-faint uppercase tracking-wider mb-1.5">
              {cat === "recentes"
                ? "Recentes deste paciente"
                : EXERCISE_CATEGORIES[cat] ?? cat}
            </p>
            <ul className="space-y-1">
              {list.map((ex) => {
                const n = countInSession.get(ex.id) ?? 0;
                const last = lastByExercise.get(ex.id);
                const added = justAdded === ex.id;
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(ex)}
                      className={`w-full min-h-14 flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors active:bg-accent-soft ${
                        n > 0 ? "bg-surface-2" : "hover:bg-surface-2"
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          added
                            ? "bg-success text-white anim-pop"
                            : n > 0
                              ? "bg-accent text-accent-fg"
                              : "bg-accent-soft text-accent-soft-fg"
                        }`}
                      >
                        {added ? <Check size={18} /> : n > 0 ? <span className="text-sm font-bold tnum">{n}</span> : <Plus size={18} />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium leading-snug">
                          {ex.name}
                        </span>
                        <span className="block text-xs text-fg-muted tnum">
                          {last
                            ? `Última: ${formatDose(last)}${
                                last.pain_eva != null ? ` · EVA ${last.pain_eva}` : ""
                              }`
                            : `Padrão: ${formatDefaults(ex)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-8">
            Nenhum exercício encontrado.
          </p>
        )}
        <Link
          href="/exercicios"
          className="flex items-center justify-center gap-2 h-11 text-sm font-medium text-fg-muted hover:text-fg"
        >
          <Settings2 size={16} /> Gerenciar catálogo
        </Link>
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="pb-32 lg:pb-8">
      {/* Header fixo e compacto */}
      <header className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 bg-bg/90 backdrop-blur border-b border-line">
        <div className="flex items-center gap-2 h-14 md:h-16">
          <Link
            href={`/pacientes/${patient.id}`}
            aria-label="Voltar para a ficha"
            className="w-11 h-11 -ml-2 shrink-0 flex items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 active:bg-surface-3"
          >
            <ArrowLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] md:text-lg font-bold leading-tight truncate">
              {patient.full_name}
            </h1>
            <p className="text-xs text-fg-muted truncate">
              {isEditing ? "Editando sessão · " : ""}
              {entries.length > 0
                ? `${doneCount} de ${entries.length} registrado${entries.length === 1 ? "" : "s"}`
                : patient.diagnosis || "Sem diagnóstico registrado"}
            </p>
          </div>
          <label className="relative shrink-0 h-10 inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-2.5 text-sm font-medium tnum">
            <CalendarDays size={16} className="text-fg-muted" />
            <span suppressHydrationWarning>{mounted ? formatDayMonth(sessionDate) : "—"}</span>
            <input
              type="date"
              aria-label="Data da sessão"
              suppressHydrationWarning
              value={sessionDate}
              onChange={(e) => e.target.value && setSessionDate(e.target.value)}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            iconOnly
            onClick={() => setShowDocs(true)}
            aria-label="Ver documentos do paciente"
            className="shrink-0"
          >
            <FolderOpen size={20} />
          </Button>
        </div>
      </header>

      {!online && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-warning-soft text-warning px-3 py-2 text-sm font-medium">
          <CloudOff size={16} /> Sem conexão — o registro fica salvo neste
          aparelho até a rede voltar.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-4">
        {/* Catálogo: coluna fixa no desktop; bottom sheet no mobile */}
        <aside className="hidden lg:block lg:col-span-2">
          <div
            className="sticky top-24 bg-surface rounded-2xl border border-line shadow-card p-4 max-h-[calc(100dvh-8rem)] overflow-y-auto"
            onScroll={blurOnScroll}
          >
            <h2 className="font-semibold text-sm mb-3">Exercícios pré-cadastrados</h2>
            {catalog}
          </div>
        </aside>

        {/* Registro da sessão */}
        <section className="lg:col-span-3 space-y-3">
          {entries.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line shadow-card p-5 md:p-8 space-y-3">
              <div className="text-center">
                <p className="font-semibold">Sessão de hoje</p>
                <p className="text-sm text-fg-muted mt-0.5">
                  {lastSession
                    ? `Última sessão em ${lastDateLabel} · ${lastSession.items.length} exercício${lastSession.items.length === 1 ? "" : "s"}`
                    : "Primeira sessão deste paciente."}
                </p>
              </div>
              {lastSession && (
                <Button size="lg" className="w-full" onClick={repeatLastSession}>
                  <History size={20} />
                  Repetir última sessão
                </Button>
              )}
              <Button
                variant={lastSession ? "secondary" : "primary"}
                size="lg"
                className="w-full lg:hidden"
                onClick={() => setCatalogOpen(true)}
              >
                <Plus size={20} /> Adicionar exercício
              </Button>
              <p className="hidden lg:block text-sm text-fg-muted text-center">
                Ou toque em um exercício ao lado.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry, idx) => {
                const done = entry.pain_eva !== null;
                const highlightMissing = !!error && !done && status !== "saving";
                const last = lastByExercise.get(entry.exercise.id);
                const mt = entry.exercise.measurement_type;

                if (entry.collapsed) {
                  return (
                    <li key={entry.uid} id={`entry-${entry.uid}`}>
                      <button
                        type="button"
                        onClick={() => updateEntry(entry.uid, { collapsed: false })}
                        aria-expanded={false}
                        aria-label={`Abrir ${entry.exercise.name}`}
                        className={`w-full min-h-16 flex items-center gap-3 rounded-2xl border bg-surface px-3.5 py-2.5 text-left shadow-card transition-colors active:bg-surface-2 ${
                          highlightMissing ? "border-danger" : "border-line"
                        }`}
                      >
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                          style={
                            done
                              ? {
                                  backgroundColor: evaColor(entry.pain_eva!),
                                  color: evaTextColor(entry.pain_eva!),
                                }
                              : undefined
                          }
                        >
                          {done ? (
                            <Check size={18} strokeWidth={3} />
                          ) : (
                            <span className="w-8 h-8 rounded-full border-2 border-dashed border-line-strong flex items-center justify-center text-fg-faint tnum">
                              {idx + 1}
                            </span>
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold truncate">
                            {entry.exercise.name}
                          </span>
                          <span className="block text-xs text-fg-muted tnum truncate">
                            {doseOf(entry)}
                            {entry.notes ? " · obs." : ""}
                          </span>
                        </span>
                        {done ? (
                          <span
                            className="text-xs font-bold rounded-lg px-2 py-1 tnum shrink-0"
                            style={{
                              backgroundColor: evaColor(entry.pain_eva!),
                              color: evaTextColor(entry.pain_eva!),
                            }}
                          >
                            EVA {entry.pain_eva}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-fg-faint shrink-0">
                            EVA —
                          </span>
                        )}
                        <ChevronDown size={18} className="text-fg-faint shrink-0" />
                      </button>
                    </li>
                  );
                }

                return (
                  <li
                    key={entry.uid}
                    id={`entry-${entry.uid}`}
                    data-testid={`entry-${entry.uid}`}
                    className={`bg-surface rounded-2xl border shadow-card p-4 space-y-4 anim-fade-in ${
                      highlightMissing
                        ? "border-danger ring-2 ring-danger/20"
                        : "border-line"
                    }`}
                  >
                    {/* Cabeçalho do card */}
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-surface-2 text-fg-muted flex items-center justify-center text-sm font-bold tnum shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[15px] font-semibold leading-snug">
                          {entry.exercise.name}
                        </h3>
                        <p className="text-xs text-fg-muted tnum mt-0.5">
                          {last ? (
                            <>
                              Última ({lastDateLabel}): {formatDose(last)}
                              {last.pain_eva != null ? ` · EVA ${last.pain_eva}` : ""}
                            </>
                          ) : (
                            <>{EXERCISE_CATEGORIES[entry.exercise.category] ?? entry.exercise.category}</>
                          )}
                        </p>
                      </div>
                      {entries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateEntry(entry.uid, { collapsed: true })}
                          aria-label="Recolher"
                          className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-fg-faint hover:bg-surface-2"
                        >
                          <ChevronDown size={18} className="rotate-180" />
                        </button>
                      )}
                    </div>

                    {/* Dose — específica do tipo */}
                    {mt === "series_reps" && (
                      <div className="space-y-3">
                        {/* 2 steppers de 48 px não cabem com a carga numa linha
                            de 393 px (iPhone): séries/reps dividem a largura e a
                            carga vai para a linha de baixo */}
                        <div className="grid grid-cols-2 gap-3">
                          <Labeled label="Séries">
                            <Stepper
                              label="séries"
                              value={entry.sets}
                              onChange={(v) => updateEntry(entry.uid, { sets: v })}
                              fullWidth
                            />
                          </Labeled>
                          <Labeled label="Repetições">
                            <Stepper
                              label="repetições"
                              value={entry.reps}
                              onChange={(v) => updateEntry(entry.uid, { reps: v })}
                              fullWidth
                            />
                          </Labeled>
                        </div>
                        <div className="grid grid-cols-2 gap-3 items-end">
                          <NumField
                            label="Carga"
                            unit="kg"
                            value={entry.load_kg}
                            onChange={(v) => updateEntry(entry.uid, { load_kg: v })}
                          />
                          {last?.load_kg != null && (
                            <p className="text-xs text-fg-muted tnum pb-3">
                              Última: {last.load_kg} kg
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {mt === "series_tempo" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 items-end">
                          <Labeled label="Séries">
                            <Stepper
                              label="séries"
                              value={entry.sets}
                              onChange={(v) => updateEntry(entry.uid, { sets: v })}
                              fullWidth
                            />
                          </Labeled>
                          <NumField
                            label="Tempo por série"
                            unit="s"
                            mode="numeric"
                            value={entry.duration_value}
                            onChange={(v) =>
                              updateEntry(entry.uid, { duration_value: v })
                            }
                            placeholder="30"
                          />
                        </div>
                        <HoldTimer seconds={numOrNull(entry.duration_value) ?? 0} />
                      </div>
                    )}
                    {mt === "cardio" && (
                      <div className="grid grid-cols-2 gap-3">
                        <NumField
                          label="Tempo"
                          unit="min"
                          mode="numeric"
                          value={entry.duration_value}
                          onChange={(v) => updateEntry(entry.uid, { duration_value: v })}
                          placeholder="10"
                        />
                        <NumField
                          label="Velocidade"
                          unit="km/h"
                          value={entry.speed_kmh}
                          onChange={(v) => updateEntry(entry.uid, { speed_kmh: v })}
                        />
                        <NumField
                          label="Distância"
                          unit="m"
                          value={entry.distance_m}
                          onChange={(v) => updateEntry(entry.uid, { distance_m: v })}
                        />
                        <NumField
                          label="Inclinação"
                          unit="%"
                          value={entry.incline_pct}
                          onChange={(v) => updateEntry(entry.uid, { incline_pct: v })}
                        />
                      </div>
                    )}

                    {/* EVA */}
                    <EvaPicker
                      name={entry.exercise.name}
                      value={entry.pain_eva}
                      lastValue={last?.pain_eva}
                      onChange={(v) => {
                        updateEntry(entry.uid, { pain_eva: v });
                        if (error) setError(null);
                      }}
                    />

                    {/* Observação */}
                    {entry.notes !== "" || entry.uid === notesOpenFor ? (
                      <textarea
                        rows={2}
                        value={entry.notes}
                        autoFocus={entry.uid === notesOpenFor && entry.notes === ""}
                        onChange={(e) => updateEntry(entry.uid, { notes: e.target.value })}
                        aria-label="Observação do exercício (opcional)"
                        placeholder="Ex.: dor no final da amplitude, compensou com o tronco..."
                        className={textareaCls}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNotesOpenFor(entry.uid)}
                        className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 rounded-lg text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-2"
                      >
                        <MessageSquarePlus size={16} /> Observação
                      </button>
                    )}

                    {/* Rodapé: remover à esquerda, concluir à direita */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.uid)}
                        aria-label={`Remover ${entry.exercise.name}`}
                        className="h-12 px-3 -ml-3 inline-flex items-center gap-1.5 rounded-xl text-sm font-medium text-fg-muted hover:text-danger hover:bg-danger-soft/60"
                      >
                        <Trash2 size={18} />
                        <span className="hidden sm:inline">Remover</span>
                      </button>
                      {done ? (
                        <Button
                          onClick={() => concludeEntry(entry.uid)}
                          className="flex-1 max-w-xs"
                          aria-label={`Concluir ${entry.exercise.name}`}
                        >
                          <Check size={18} strokeWidth={2.5} /> Concluir
                        </Button>
                      ) : (
                        <span className="text-sm text-fg-faint font-medium pr-1">
                          Marque a dor para concluir
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {entries.length > 0 && (
            <Button
              variant="secondary"
              size="lg"
              className="w-full border-dashed lg:hidden"
              onClick={() => setCatalogOpen(true)}
            >
              <Plus size={20} /> Adicionar exercício
            </Button>
          )}
          <div ref={listEndRef} />

          {(entries.length > 0 || generalNotes) && (
            <div className="bg-surface rounded-2xl border border-line shadow-card p-4">
              <label className="block">
                <span className="block text-sm font-semibold mb-2">
                  Observações da sessão{" "}
                  <span className="text-fg-faint font-normal">(opcional)</span>
                </span>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Ex.: paciente relatou melhora ao subir escadas..."
                  className={textareaCls}
                />
              </label>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-sm font-medium text-danger bg-danger-soft rounded-xl px-3.5 py-2.5"
            >
              {error}
            </p>
          )}

          {/* Desktop: botão inline */}
          <div className={entries.length > 0 ? "hidden lg:block" : "hidden"}>
            <Button
              size="lg"
              className="w-full"
              onClick={handleSave}
              loading={status === "saving"}
              disabled={entries.length === 0}
            >
              <Check size={20} />
              {status === "saving"
                ? "Salvando..."
                : isEditing
                  ? "Salvar alterações"
                  : `Finalizar atendimento (${entries.length})`}
            </Button>
          </div>
        </section>
      </div>

      {/* Barra fixa inferior (mobile) — some com o teclado aberto */}
      {!keyboardOpen && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-line px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {entries.length > 0 && missingEvaCount > 0 && (
            <p className="text-xs text-fg-muted mb-1.5 text-center tnum">
              Falta a EVA em {missingEvaCount} exercício
              {missingEvaCount === 1 ? "" : "s"}
            </p>
          )}
          {allDone && status !== "saving" && !isEditing && (
            <p className="text-xs text-success font-medium mb-1.5 text-center">
              Tudo registrado — pode finalizar.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              iconOnly
              onClick={() => setCatalogOpen(true)}
              aria-label="Adicionar exercício"
            >
              <Plus size={22} />
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleSave}
              loading={status === "saving"}
              disabled={entries.length === 0}
              variant={status === "error" ? "danger" : "primary"}
            >
              {status === "saving" ? (
                "Salvando..."
              ) : status === "error" ? (
                <>
                  <RotateCcw size={18} /> Tentar de novo
                </>
              ) : isEditing ? (
                <>
                  <Check size={20} strokeWidth={2.5} /> Salvar alterações
                </>
              ) : (
                <>
                  <Check size={20} strokeWidth={2.5} /> Finalizar atendimento
                  {entries.length > 0 ? ` (${entries.length})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Catálogo (mobile) */}
      <BottomSheet
        open={catalogOpen}
        onClose={closeCatalog}
        onScroll={blurOnScroll}
        title="Adicionar exercício"
        tall
        headerAction={
          <Button size="sm" onClick={closeCatalog}>
            <Check size={16} /> Pronto
            {entries.length > 0 ? ` (${entries.length})` : ""}
          </Button>
        }
      >
        <div className="lg:hidden">{catalog}</div>
      </BottomSheet>

      {/* Documentos */}
      <BottomSheet
        open={showDocs}
        onClose={() => setShowDocs(false)}
        title={`Documentos · ${patient.full_name}`}
        tall
        size="lg"
      >
        <DocumentsPanel patientId={patient.id} compact />
      </BottomSheet>
    </div>
  );
}
