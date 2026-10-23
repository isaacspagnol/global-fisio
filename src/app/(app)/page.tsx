import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Plus,
  Users,
} from "lucide-react";
import type { Appointment } from "@/lib/types";
import {
  APPT_STATUS,
  Avatar,
  Badge,
  Card,
  EmptyState,
  LinkButton,
} from "@/components/ui";

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
        format(new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
      ),
  ]);

  const activePatients = patientsRes.count ?? 0;
  const todayAppts = (todayApptsRes.data ?? []) as Appointment[];
  const sessionsWeek = sessionsWeekRes.count ?? 0;

  const nowMs = new Date().getTime();
  const nextAppt = todayAppts.find(
    (a) => a.status === "agendado" && new Date(a.starts_at).getTime() >= nowMs - 15 * 60 * 1000
  );
  const pendingCount = todayAppts.filter((a) => a.status === "agendado").length;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const metrics = [
    { label: "Pacientes ativos", value: activePatients, icon: Users, href: "/pacientes?status=ativo" },
    { label: "Consultas hoje", value: todayAppts.length, icon: CalendarDays, href: "/agenda" },
    { label: "Sessões · 7 dias", value: sessionsWeek, icon: ClipboardList, href: "/pacientes" },
  ];

  return (
    <div className="space-y-5 md:space-y-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-fg-muted capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
          <h1 className="text-[26px] md:text-3xl font-bold tracking-tight leading-tight mt-0.5">
            {greeting}
          </h1>
        </div>
        <LinkButton href="/pacientes/novo" variant="secondary" size="sm" className="shrink-0">
          <Plus size={16} /> <span className="hidden sm:inline">Novo</span> paciente
        </LinkButton>
      </div>

      {/* Métricas: uma linha no celular */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {metrics.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-surface rounded-2xl border border-line shadow-card p-3 md:p-5 flex flex-col gap-2 md:flex-row md:items-center md:gap-3 active:bg-surface-2 transition-colors"
          >
            <span className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-accent-soft text-accent-soft-fg flex items-center justify-center shrink-0">
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl md:text-[28px] font-bold leading-none tnum">
                {value}
              </span>
              <span className="block text-[11px] md:text-xs text-fg-muted mt-1 leading-tight">
                {label}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Próximo atendimento em destaque */}
      {nextAppt && (
        <Card className="p-4 md:p-5 border-accent/30 bg-gradient-to-br from-accent-soft/60 to-surface">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft-fg mb-2">
            Próximo atendimento
          </p>
          <div className="flex items-center gap-3">
            <Avatar name={nextAppt.patients?.full_name ?? "P"} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {nextAppt.patients?.full_name ?? "Paciente"}
              </p>
              <p className="text-sm text-fg-muted tnum">
                {format(new Date(nextAppt.starts_at), "HH:mm")} · {nextAppt.duration_min} min
                {nextAppt.notes ? ` · ${nextAppt.notes}` : ""}
              </p>
            </div>
            <LinkButton href={`/pacientes/${nextAppt.patient_id}/atendimento`} size="md">
              Atender
            </LinkButton>
          </div>
        </Card>
      )}

      {/* Agenda de hoje */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h2 className="font-semibold">
            Agenda de hoje
            {pendingCount > 0 && (
              <span className="ml-2 text-xs font-medium text-fg-muted tnum">
                {pendingCount} pendente{pendingCount === 1 ? "" : "s"}
              </span>
            )}
          </h2>
          <Link
            href="/agenda"
            className="text-sm text-accent-soft-fg dark:text-accent font-medium inline-flex items-center gap-0.5 h-10 px-1"
          >
            Ver agenda <ChevronRight size={16} />
          </Link>
        </div>
        {todayAppts.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title="Nenhuma consulta hoje"
            description="Agende um paciente ou inicie um atendimento avulso pela ficha."
            action={
              <LinkButton href="/agenda" variant="secondary" size="md">
                Abrir agenda
              </LinkButton>
            }
          />
        ) : (
          <Card as="ul" className="divide-y divide-line overflow-hidden">
            {todayAppts.map((a) => {
              const st = APPT_STATUS[a.status] ?? APPT_STATUS.agendado;
              const past = a.status !== "agendado";
              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-3 ${past ? "opacity-70" : ""}`}
                >
                  <span className="text-base font-bold tnum w-12 shrink-0">
                    {format(new Date(a.starts_at), "HH:mm")}
                  </span>
                  <Link
                    href={`/pacientes/${a.patient_id}`}
                    className="flex-1 min-w-0 py-1"
                  >
                    <span className="block text-[15px] font-medium truncate">
                      {a.patients?.full_name ?? "Paciente"}
                    </span>
                    <span className="flex items-center gap-2 mt-0.5">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {a.notes && (
                        <span className="text-xs text-fg-muted truncate">{a.notes}</span>
                      )}
                    </span>
                  </Link>
                  {a.status === "agendado" && (
                    <LinkButton
                      href={`/pacientes/${a.patient_id}/atendimento`}
                      size="sm"
                      variant="soft"
                      className="shrink-0"
                    >
                      Atender
                    </LinkButton>
                  )}
                </li>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
