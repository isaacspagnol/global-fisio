"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import type { Appointment, Patient } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

const STATUS_STYLE: Record<string, string> = {
  agendado: "border-l-brand bg-cyan-50/60",
  concluido: "border-l-green-500 bg-green-50/60",
  cancelado: "border-l-gray-300 bg-gray-50 opacity-60",
  faltou: "border-l-red-400 bg-red-50/60",
};

export default function AgendaClient({ patients }: { patients: Patient[] }) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const days = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    const from = weekStart.toISOString();
    const to = addDays(weekStart, 7).toISOString();
    const { data } = await supabase
      .from("appointments")
      .select("*, patients(id, full_name)")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at");
    setAppointments((data ?? []) as Appointment[]);
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    const time = fd.get("time") as string;
    const supabase = createClient();
    await supabase.from("appointments").insert({
      patient_id: fd.get("patient_id") as string,
      starts_at: new Date(`${date}T${time}:00`).toISOString(),
      duration_min: Number(fd.get("duration_min") ?? 60),
      notes: (fd.get("notes") as string) || null,
    });
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function updateStatus(appt: Appointment, status: string) {
    const supabase = createClient();
    await supabase
      .from("appointments")
      .update({ status })
      .eq("id", appt.id);
    setSelected(null);
    load();
  }

  async function handleDelete(appt: Appointment) {
    if (!confirm("Excluir este agendamento?")) return;
    const supabase = createClient();
    await supabase.from("appointments").delete().eq("id", appt.id);
    setSelected(null);
    load();
  }

  const field =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {format(weekStart, "MMMM yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, -1))}
            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekStart((w) => addWeeks(w, 1))}
            className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => {
              setFormDate(format(new Date(), "yyyy-MM-dd"));
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
          >
            <Plus size={16} /> Agendar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {days.map((day) => {
          const dayAppts = appointments.filter((a) =>
            isSameDay(new Date(a.starts_at), day)
          );
          return (
            <div
              key={day.toISOString()}
              className={`bg-white rounded-xl border p-3 min-h-[140px] ${
                isToday(day) ? "border-brand" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className={`text-xs font-semibold capitalize ${
                    isToday(day) ? "text-brand" : "text-gray-500"
                  }`}
                >
                  {format(day, "EEE dd/MM", { locale: ptBR })}
                </p>
                <button
                  onClick={() => {
                    setFormDate(format(day, "yyyy-MM-dd"));
                    setShowForm(true);
                  }}
                  className="p-1 text-gray-300 hover:text-brand transition"
                  title="Agendar neste dia"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-1.5">
                {dayAppts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className={`w-full text-left rounded-lg border-l-4 px-2.5 py-2 transition hover:brightness-95 ${STATUS_STYLE[a.status]}`}
                  >
                    <p className="text-[11px] font-semibold tabular-nums">
                      {format(new Date(a.starts_at), "HH:mm")} ·{" "}
                      {a.duration_min}min
                    </p>
                    <p className="text-xs font-medium truncate">
                      {a.patients?.full_name}
                    </p>
                  </button>
                ))}
                {dayAppts.length === 0 && (
                  <p className="text-[11px] text-gray-300 text-center py-3">
                    Livre
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal novo agendamento */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Novo agendamento</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paciente
              </label>
              <select name="patient_id" required className={field}>
                <option value="">Selecione...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={formDate}
                  className={field}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora
                </label>
                <input
                  type="time"
                  name="time"
                  required
                  defaultValue="08:00"
                  className={field}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duração
                </label>
                <select name="duration_min" defaultValue="60" className={field}>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observações
              </label>
              <input name="notes" className={field} placeholder="Opcional" />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-brand hover:bg-brand-dark text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Agendar"}
            </button>
          </form>
        </div>
      )}

      {/* Modal detalhes */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">
                {selected.patients?.full_name}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="p-1 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              {format(
                new Date(selected.starts_at),
                "EEEE, dd/MM/yyyy 'às' HH:mm",
                { locale: ptBR }
              )}{" "}
              · {selected.duration_min} min
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Status: {STATUS_LABEL[selected.status]}
              {selected.notes ? ` · ${selected.notes}` : ""}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Link
                href={`/pacientes/${selected.patient_id}/atendimento`}
                className="col-span-2 text-center bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg py-2.5 transition"
              >
                Iniciar atendimento
              </Link>
              <button
                onClick={() => updateStatus(selected, "concluido")}
                className="rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Marcar concluído
              </button>
              <button
                onClick={() => updateStatus(selected, "faltou")}
                className="rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Marcar falta
              </button>
              <button
                onClick={() => updateStatus(selected, "cancelado")}
                className="rounded-lg border border-gray-300 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar consulta
              </button>
              <button
                onClick={() => handleDelete(selected)}
                className="rounded-lg border border-red-200 text-red-600 py-2 text-sm font-medium hover:bg-red-50"
              >
                Excluir
              </button>
            </div>
            <Link
              href={`/pacientes/${selected.patient_id}`}
              className="block text-center text-sm text-brand hover:underline"
            >
              Ver ficha do paciente
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
