"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardPlus,
  Plus,
  Trash2,
} from "lucide-react";
import type { Appointment, Patient } from "@/lib/types";
import {
  APPT_STATUS,
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Fab,
  Field,
  LinkButton,
  Skeleton,
  inputCls,
  useToast,
} from "@/components/ui";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useMounted } from "@/lib/hooks";

const STATUS_BORDER: Record<string, string> = {
  agendado: "border-l-accent",
  concluido: "border-l-success",
  cancelado: "border-l-line-strong opacity-60",
  faltou: "border-l-danger",
};

function ApptRow({
a,
compact = false,
onSelect,
}: {
a: Appointment;
compact?: boolean;
onSelect: (a: Appointment) => void;
}) {
  const st = APPT_STATUS[a.status] ?? APPT_STATUS.agendado;
  return (
    <button
      type="button"
      onClick={() => onSelect(a)}
      className={`w-full text-left rounded-xl border-l-4 bg-surface border border-line shadow-card px-3 py-2.5 transition-colors active:bg-surface-2 ${STATUS_BORDER[a.status] ?? ""}`}
    >
      <div className="flex items-center gap-3">
        <span className={`font-bold tnum ${compact ? "text-sm" : "text-base w-12"}`}>
          {format(new Date(a.starts_at), "HH:mm")}
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block font-medium truncate ${compact ? "text-xs" : "text-[15px]"}`}>
            {a.patients?.full_name}
          </span>
          <span className="block text-xs text-fg-muted tnum truncate">
            {a.duration_min} min{a.notes ? ` · ${a.notes}` : ""}
          </span>
        </span>
        {!compact && <Badge tone={st.tone}>{st.label}</Badge>}
      </div>
    </button>
  );
}

export default function AgendaClient({ patients }: { patients: Patient[] }) {
  // "hoje" depende do fuso do aparelho; o servidor (UTC) chutaria errado à noite
  const mounted = useMounted();
  if (!mounted) return <AgendaSkeleton />;
  return <AgendaInner patients={patients} />;
}

function AgendaSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando agenda">
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-4 w-24 mb-5" />
      <div className="grid grid-cols-7 gap-1 mb-4 md:hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-16 mb-2" />
      <Skeleton className="h-16" />
    </div>
  );
}

function AgendaInner({ patients }: { patients: Patient[] }) {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Cada carga tem um "ticket": se o fisio trocar de semana rápido, só a
  // resposta da semana atual é aplicada (a última a chegar não vence).
  const loadTicket = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++loadTicket.current;
    const supabase = createClient();
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const { data } = await supabase
      .from("appointments")
      .select("*, patients(id, full_name)")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    if (ticket !== loadTicket.current) return;
    setAppointments((data ?? []) as Appointment[]);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  function goWeek(delta: number) {
    const ws = addWeeks(weekStart, delta);
    setLoading(true);
    setWeekStart(ws);
    // mantém o mesmo dia da semana selecionado
    const dow = (selectedDay.getDay() + 6) % 7;
    setSelectedDay(addDays(ws, dow));
  }

  function goToday() {
    setLoading(true);
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSelectedDay(new Date());
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const supabase = createClient();
    const { error } = await supabase.from("appointments").insert({
      patient_id: fd.get("patient_id") as string,
      starts_at: new Date(`${date}T${time}:00`).toISOString(),
      duration_min: Number(fd.get("duration_min") ?? 60),
      notes: (fd.get("notes") as string) || null,
    });
    setSaving(false);
    if (error) {
      toast("Não foi possível agendar. Tente de novo.", { kind: "error" });
      return;
    }
    setShowForm(false);
    toast("Consulta agendada.");
    load();
  }

  async function updateStatus(appt: Appointment, status: Appointment["status"]) {
    const prev = appt.status;
    // otimista
    setAppointments((list) =>
      list.map((a) => (a.id === appt.id ? { ...a, status } : a))
    );
    setSelected(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appt.id);
    if (error) {
      setAppointments((list) =>
        list.map((a) => (a.id === appt.id ? { ...a, status: prev } : a))
      );
      toast("Não foi possível atualizar.", { kind: "error" });
      return;
    }
    toast(`Marcado como ${APPT_STATUS[status]?.label.toLowerCase()}.`, {
      actionLabel: "Desfazer",
      onAction: async () => {
        setAppointments((list) =>
          list.map((a) => (a.id === appt.id ? { ...a, status: prev } : a))
        );
        const { error: undoErr } = await supabase
          .from("appointments")
          .update({ status: prev })
          .eq("id", appt.id);
        if (undoErr) {
          toast("Não foi possível desfazer.", { kind: "error" });
          load();
        }
      },
    });
  }

  async function handleDelete(appt: Appointment) {
    const supabase = createClient();
    const { error } = await supabase.from("appointments").delete().eq("id", appt.id);
    setConfirmDelete(null);
    setSelected(null);
    if (error) {
      toast("Não foi possível excluir.", { kind: "error" });
      return;
    }
    toast("Agendamento excluído.");
    load();
  }

  const dayAppts = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.starts_at), day));

  const selectedAppts = dayAppts(selectedDay);

  const openForm = (date: Date) => {
    setFormDate(format(date, "yyyy-MM-dd"));
    setShowForm(true);
  };

  /* ---------------- Render ---------------- */

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-7">
        <div className="min-w-0">
          <h1 className="text-[22px] md:text-2xl font-bold leading-tight tracking-tight">
            Agenda
          </h1>
          <p className="text-sm text-fg-muted mt-0.5 capitalize truncate">
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="secondary" size="sm" iconOnly onClick={() => goWeek(-1)} aria-label="Semana anterior">
            <ChevronLeft size={18} />
          </Button>
          <Button variant="secondary" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="secondary" size="sm" iconOnly onClick={() => goWeek(1)} aria-label="Próxima semana">
            <ChevronRight size={18} />
          </Button>
          <Button size="sm" className="hidden md:inline-flex ml-2" onClick={() => openForm(selectedDay)}>
            <Plus size={16} /> Agendar
          </Button>
        </div>
      </div>

      {/* MOBILE: faixa de dias + lista do dia */}
      <div className="md:hidden">
        <div className="grid grid-cols-7 gap-1 mb-4" role="tablist" aria-label="Dias da semana">
          {days.map((day) => {
            const active = isSameDay(day, selectedDay);
            const n = dayAppts(day).filter((a) => a.status !== "cancelado").length;
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedDay(day)}
                className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "bg-fg text-bg dark:bg-accent dark:text-accent-fg"
                    : isToday(day)
                      ? "bg-accent-soft text-accent-soft-fg"
                      : "bg-surface border border-line text-fg"
                }`}
              >
                <span className="text-[10px] uppercase font-semibold opacity-80">
                  {format(day, "EEEEEE", { locale: ptBR })}
                </span>
                <span className="text-lg font-bold leading-none tnum">
                  {format(day, "d")}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    n > 0 ? (active ? "bg-current opacity-90" : "bg-accent") : "opacity-0"
                  }`}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>

        <h2 className="text-sm font-semibold text-fg-muted capitalize mb-2 px-0.5">
          {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          {isToday(selectedDay) ? " · hoje" : ""}
        </h2>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : selectedAppts.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Dia livre"
            description="Nenhuma consulta neste dia."
            action={
              <Button variant="secondary" onClick={() => openForm(selectedDay)}>
                <Plus size={18} /> Agendar neste dia
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {selectedAppts.map((a) => (
              <ApptRow key={a.id} a={a} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* DESKTOP: grade semanal */}
      <div className="hidden md:grid grid-cols-3 xl:grid-cols-7 gap-3">
        {days.map((day) => {
          const list = dayAppts(day);
          return (
            <Card
              key={day.toISOString()}
              className={`p-3 min-h-[160px] ${isToday(day) ? "border-accent" : ""}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className={`text-xs font-semibold capitalize ${
                    isToday(day) ? "text-accent-soft-fg dark:text-accent" : "text-fg-muted"
                  }`}
                >
                  {format(day, "EEE dd/MM", { locale: ptBR })}
                </p>
                <button
                  type="button"
                  onClick={() => openForm(day)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-fg-faint hover:text-accent hover:bg-surface-2 transition-colors"
                  aria-label={`Agendar em ${format(day, "dd/MM")}`}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-1.5">
                {list.map((a) => (
                  <ApptRow key={a.id} a={a} compact onSelect={setSelected} />
                ))}
                {list.length === 0 && (
                  <p className="text-[11px] text-fg-faint text-center py-4">Livre</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Fab onClick={() => openForm(selectedDay)} label="Agendar consulta">
        <Plus size={22} /> Agendar
      </Fab>

      {/* Novo agendamento */}
      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title="Novo agendamento">
        <form onSubmit={handleCreate} className="space-y-4 pb-2" id="new-appt-form">
          <Field label="Paciente">
            <select name="patient_id" required className={inputCls} defaultValue="">
              <option value="" disabled>
                Selecione...
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input type="date" name="date" required defaultValue={formDate} className={inputCls} />
            </Field>
            <Field label="Hora">
              <input type="time" name="time" required defaultValue="08:00" className={inputCls} />
            </Field>
          </div>
          <Field label="Duração">
            <select name="duration_min" defaultValue="60" className={inputCls}>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </Field>
          <Field label="Observações">
            <input name="notes" className={inputCls} placeholder="Opcional" />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={saving}>
            {saving ? "Salvando..." : "Agendar"}
          </Button>
        </form>
      </BottomSheet>

      {/* Detalhes do agendamento */}
      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? format(new Date(selected.starts_at), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR }) : ""}
      >
        {selected && (
          <div className="space-y-4 pb-2">
            <div className="flex items-center gap-3">
              <Avatar name={selected.patients?.full_name ?? "P"} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selected.patients?.full_name}</p>
                <p className="text-sm text-fg-muted tnum">
                  {selected.duration_min} min
                  {selected.notes ? ` · ${selected.notes}` : ""}
                </p>
              </div>
              <Badge tone={(APPT_STATUS[selected.status] ?? APPT_STATUS.agendado).tone}>
                {(APPT_STATUS[selected.status] ?? APPT_STATUS.agendado).label}
              </Badge>
            </div>

            <LinkButton
              href={`/pacientes/${selected.patient_id}/atendimento`}
              size="lg"
              className="w-full"
            >
              <ClipboardPlus size={20} /> Iniciar atendimento
            </LinkButton>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="secondary" onClick={() => updateStatus(selected, "concluido")} disabled={selected.status === "concluido"}>
                Concluído
              </Button>
              <Button variant="secondary" onClick={() => updateStatus(selected, "faltou")} disabled={selected.status === "faltou"}>
                Falta
              </Button>
              <Button variant="secondary" onClick={() => updateStatus(selected, "cancelado")} disabled={selected.status === "cancelado"}>
                Cancelar
              </Button>
            </div>
            {selected.status !== "agendado" && (
              <Button variant="ghost" className="w-full" onClick={() => updateStatus(selected, "agendado")}>
                Voltar para “agendado”
              </Button>
            )}

            <div className="flex items-center justify-between pt-1">
              <Link
                href={`/pacientes/${selected.patient_id}`}
                className="text-sm font-medium text-accent-soft-fg dark:text-accent h-11 inline-flex items-center"
              >
                Ver ficha do paciente
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(selected)} className="text-danger">
                <Trash2 size={16} /> Excluir
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Excluir agendamento?"
        description={
          confirmDelete
            ? `${confirmDelete.patients?.full_name ?? "Paciente"} · ${format(new Date(confirmDelete.starts_at), "dd/MM 'às' HH:mm")}. Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        cancelLabel="Manter"
      />
    </div>
  );
}
