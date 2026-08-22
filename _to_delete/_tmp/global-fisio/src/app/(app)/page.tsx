import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";
import type { Appointment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [patientsRes, todayApptsRes, sessionsWeekRes] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("appointments")
      .select("*, patients(id, full_name)")
      .gte("starts_at", todayStart.toISOString())
      .lte("starts_at", todayEnd.toISOString())
      .order("starts_at"),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .gte(
        "session_date",
        format(
          new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          "yyyy-MM-dd"
        )
      ),
  ]);

  const activePatients = patientsRes.count ?? 0;
  const todayAppts = (todayApptsRes.data ?? []) as Appointment[];
  const sessionsWeek = sessionsWeekRes.count ?? 0;

  const statusStyle: Record<string, string> = {
    agendado: "bg-blue-50 text-blue-700",
    concluido: "bg-green-50 text-green-700",
    cancelado: "bg-gray-100 text-gray-500",
    faltou: "bg-red-50 text-red-600",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Resumo do seu dia na clínica
          </p>
        </div>
        <Link
          href="/pacientes/novo"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
        >
          <Plus size={16} /> Novo paciente
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 text-brand flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">
                {activePatients}
              </p>
              <p className="text-xs text-gray-500">Pacientes ativos</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 text-brand flex items-center justify-center">
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">
                {todayAppts.length}
              </p>
              <p className="text-xs text-gray-500">Consultas hoje</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 text-brand flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold leading-tight">{sessionsWeek}</p>
              <p className="text-xs text-gray-500">
                Sessões nos últimos 7 dias
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Agenda de hoje</h2>
          <Link
            href="/agenda"
            className="text-sm text-brand hover:underline font-medium"
          >
            Ver agenda completa
          </Link>
        </div>
        {todayAppts.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">
            Nenhuma consulta agendada para hoje.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todayAppts.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <span className="text-sm font-semibold tabular-nums w-12">
                  {format(new Date(a.starts_at), "HH:mm")}
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/pacientes/${a.patient_id}`}
                    className="text-sm font-medium hover:text-brand truncate block"
                  >
                    {a.patients?.full_name ?? "Paciente"}
                  </Link>
                  {a.notes && (
                    <p className="text-xs text-gray-500 truncate">{a.notes}</p>
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${statusStyle[a.status]}`}
                >
                  {a.status}
                </span>
                <Link
                  href={`/pacientes/${a.patient_id}/atendimento`}
                  className="text-xs font-medium bg-brand text-white rounded-lg px-3 py-1.5 hover:bg-brand-dark transition"
                >
                  Atender
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
