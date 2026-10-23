import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format, parseISO, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  ClipboardPlus,
  FileDown,
  Pencil,
  Check,
  ClipboardList,
} from "lucide-react";
import DocumentsPanel from "@/components/DocumentsPanel";
import EvaChart from "@/components/EvaChart";
import {
  evaColor,
  evaLabel,
  evaTextColor,
  formatDose,
  type Patient,
  type Session,
  type SessionExercise,
} from "@/lib/types";
import {
  Avatar,
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  LinkButton,
  PATIENT_STATUS,
  buttonClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

type SessionWithExercises = Session & {
  session_exercises: SessionExercise[];
};

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { tab = "evolucao", saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: patientData }, { data: sessionsData }] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).single(),
    supabase
      .from("sessions")
      .select("*, session_exercises(*, exercises(id, name, category))")
      .eq("patient_id", id)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!patientData) notFound();
  const patient = patientData as Patient;
  const sessions = (sessionsData ?? []) as SessionWithExercises[];

  const avgOf = (s: SessionWithExercises) =>
    s.session_exercises.length > 0
      ? s.session_exercises.reduce((acc, e) => acc + e.pain_eva, 0) /
        s.session_exercises.length
      : null;

  const chartPoints = [...sessions]
    .reverse()
    .filter((s) => s.session_exercises.length > 0)
    .map((s) => ({
      date: format(parseISO(s.session_date), "dd/MM"),
      avg: avgOf(s) as number,
    }));

  const age = patient.birth_date
    ? differenceInYears(new Date(), parseISO(patient.birth_date))
    : null;

  const st = PATIENT_STATUS[patient.status] ?? PATIENT_STATUS.ativo;

  const tabs = [
    { key: "evolucao", label: "Evolução" },
    { key: "documentos", label: "Documentos" },
    { key: "dados", label: "Dados" },
  ];

  const latest = sessions[0];
  const previous = sessions[1];
  const latestAvg = latest ? avgOf(latest) : null;
  const prevAvg = previous ? avgOf(previous) : null;
  const delta =
    latestAvg !== null && prevAvg !== null ? latestAvg - prevAvg : null;

  return (
    <div className="pb-24 md:pb-0">
      {/* Header */}
      <div className="flex items-start gap-2 mb-5">
        <Link
          href="/pacientes"
          aria-label="Voltar para pacientes"
          className="w-11 h-11 -ml-2 shrink-0 flex items-center justify-center rounded-xl text-fg-muted hover:bg-surface-2 active:bg-surface-3"
        >
          <ArrowLeft size={22} />
        </Link>
        <Avatar name={patient.full_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold leading-tight tracking-tight">
              {patient.full_name}
            </h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="text-sm text-fg-muted mt-0.5">
            {age !== null ? `${age} anos · ` : ""}
            {patient.diagnosis || "Sem diagnóstico registrado"}
            {patient.health_insurance ? ` · ${patient.health_insurance}` : ""}
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 mb-5">
        <LinkButton
          href={`/pacientes/${id}/atendimento`}
          size="md"
          className="hidden md:inline-flex"
        >
          <ClipboardPlus size={18} /> Iniciar atendimento
        </LinkButton>
        <a
          href={`/api/relatorio/${id}`}
          className={buttonClass({ variant: "secondary", size: "md", className: "flex-1 md:flex-none" })}
        >
          <FileDown size={18} /> Relatório PDF
        </a>
        <LinkButton
          href={`/pacientes/${id}/editar`}
          variant="secondary"
          size="md"
          className="flex-1 md:flex-none"
        >
          <Pencil size={16} /> Editar
        </LinkButton>
      </div>

      {saved && latest && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-success-soft text-success px-4 py-3 anim-slide-up">
          <span className="w-8 h-8 rounded-full bg-success text-white flex items-center justify-center shrink-0">
            <Check size={18} strokeWidth={3} />
          </span>
          <p className="flex-1 text-sm font-medium leading-snug">
            Sessão de {format(parseISO(latest.session_date), "dd/MM")} salva ·{" "}
            {latest.session_exercises.length} exercício
            {latest.session_exercises.length === 1 ? "" : "s"}
            {latestAvg !== null && (
              <>
                {" "}· EVA média {latestAvg.toFixed(1).replace(".", ",")}
                {delta !== null && delta !== 0 && (
                  <span className="tnum"> {delta < 0 ? "↓" : "↑"}{Math.abs(delta).toFixed(1).replace(".", ",")}</span>
                )}
              </>
            )}
          </p>
          <Link
            href={`/pacientes/${id}/atendimento?session=${latest.id}`}
            className="text-sm font-semibold underline-offset-2 hover:underline shrink-0 h-10 inline-flex items-center"
          >
            Editar
          </Link>
        </div>
      )}

      {/* Abas */}
      <ChipRow className="mb-4">
        {tabs.map((t) => (
          <Chip key={t.key} href={`/pacientes/${id}?tab=${t.key}`} active={tab === t.key}>
            {t.label}
          </Chip>
        ))}
      </ChipRow>

      {tab === "evolucao" && (
        <div className="space-y-4">
          {chartPoints.length > 1 && (
            <Card className="p-4 md:p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h2 className="font-semibold">Evolução da dor (EVA)</h2>
                {delta !== null && (
                  <span
                    className={`text-xs font-semibold tnum ${
                      delta < 0 ? "text-success" : delta > 0 ? "text-danger" : "text-fg-muted"
                    }`}
                  >
                    {delta < 0 ? "↓" : delta > 0 ? "↑" : "="} {Math.abs(delta).toFixed(1).replace(".", ",")} vs. anterior
                  </span>
                )}
              </div>
              <p className="text-xs text-fg-muted mb-3">
                Média da escala EVA por sessão — quanto menor, melhor.
              </p>
              <EvaChart points={chartPoints} />
            </Card>
          )}

          {sessions.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={22} />}
              title="Nenhuma sessão registrada"
              description="O histórico de evolução e o relatório para o convênio nascem do primeiro atendimento."
              action={
                <LinkButton href={`/pacientes/${id}/atendimento`}>
                  <ClipboardPlus size={18} /> Registrar primeiro atendimento
                </LinkButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const avg = avgOf(s);
                return (
                  <Card key={s.id} className="p-4 md:p-5">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-sm capitalize">
                        {format(parseISO(s.session_date), "EEEE, dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {avg !== null && (
                          <span
                            className="text-[11px] font-bold rounded-full px-2.5 py-1 tnum"
                            style={{
                              backgroundColor: evaColor(Math.round(avg)),
                              color: evaTextColor(Math.round(avg)),
                            }}
                            title={evaLabel(Math.round(avg))}
                          >
                            EVA {avg.toFixed(1).replace(".", ",")}
                          </span>
                        )}
                        <Link
                          href={`/pacientes/${id}/atendimento?session=${s.id}`}
                          aria-label="Editar sessão"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-fg-faint hover:text-fg hover:bg-surface-2"
                        >
                          <Pencil size={15} />
                        </Link>
                      </div>
                    </div>
                    <ul className="divide-y divide-line">
                      {s.session_exercises.map((e) => (
                        <li key={e.id} className="py-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span
                              className="text-[11px] font-bold rounded-md w-8 h-6 flex items-center justify-center tnum shrink-0"
                              style={{
                                backgroundColor: evaColor(e.pain_eva),
                                color: evaTextColor(e.pain_eva),
                              }}
                              title={evaLabel(e.pain_eva)}
                              aria-label={`EVA ${e.pain_eva} — ${evaLabel(e.pain_eva)}`}
                            >
                              {e.pain_eva}
                            </span>
                            <span className="flex-1 min-w-0 truncate">
                              {e.exercises?.name ?? "Exercício"}
                            </span>
                            <span className="text-fg-muted tnum text-xs shrink-0">
                              {formatDose(e)}
                            </span>
                          </div>
                          {e.notes && (
                            <p className="ml-11 mt-1 text-xs text-fg-muted italic">
                              {e.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {s.general_notes && (
                      <p className="text-xs text-fg-muted bg-surface-2 rounded-xl px-3 py-2 mt-3">
                        {s.general_notes}
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "documentos" && (
        <Card className="p-4 md:p-5">
          <h2 className="font-semibold mb-4">Exames, raio-x e documentos</h2>
          <DocumentsPanel patientId={id} />
        </Card>
      )}

      {tab === "dados" && (
        <Card className="p-4 md:p-6">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            {[
              ["Nome completo", patient.full_name],
              [
                "Data de nascimento",
                patient.birth_date
                  ? format(parseISO(patient.birth_date), "dd/MM/yyyy")
                  : null,
              ],
              ["Telefone", patient.phone],
              ["E-mail", patient.email],
              ["CPF", patient.cpf],
              ["Plano de saúde", patient.health_insurance],
              ["Nº carteirinha", patient.insurance_number],
              ["Diagnóstico", patient.diagnosis],
              ["Médico solicitante", patient.referring_doctor],
              ["Observações", patient.notes],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-fg-muted mb-0.5">{k}</dt>
                <dd className="font-medium break-words">
                  {k === "Telefone" && v ? (
                    <a href={`tel:${v}`} className="text-accent-soft-fg dark:text-accent">
                      {v}
                    </a>
                  ) : (
                    v || "—"
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* Mobile: ação primária fixa acima da tab bar */}
      <div className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2 pt-2 bg-gradient-to-t from-bg via-bg/90 to-transparent pointer-events-none">
        <LinkButton
          href={`/pacientes/${id}/atendimento`}
          size="lg"
          className="w-full pointer-events-auto shadow-lg shadow-black/15"
        >
          <ClipboardPlus size={20} /> Iniciar atendimento
        </LinkButton>
      </div>
    </div>
  );
}
