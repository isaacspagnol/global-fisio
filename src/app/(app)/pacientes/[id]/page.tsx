import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { format, parseISO, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardPlus,
  FileDown,
  Pencil,
} from "lucide-react";
import DocumentsPanel from "@/components/DocumentsPanel";
import EvaChart from "@/components/EvaChart";
import {
  evaColor,
  evaLabel,
  formatDose,
  type Patient,
  type Session,
  type SessionExercise,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type SessionWithExercises = Session & {
  session_exercises: SessionExercise[];
};

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "evolucao" } = await searchParams;
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

  const chartPoints = [...sessions]
    .reverse()
    .filter((s) => s.session_exercises.length > 0)
    .map((s) => ({
      date: format(parseISO(s.session_date), "dd/MM"),
      avg:
        s.session_exercises.reduce((acc, e) => acc + e.pain_eva, 0) /
        s.session_exercises.length,
    }));

  const age = patient.birth_date
    ? differenceInYears(new Date(), parseISO(patient.birth_date))
    : null;

  const statusStyle: Record<string, string> = {
    ativo: "bg-green-50 text-green-700",
    alta: "bg-blue-50 text-blue-700",
    inativo: "bg-gray-100 text-gray-500",
  };

  const tabs = [
    { key: "evolucao", label: "Evolução" },
    { key: "documentos", label: "Documentos" },
    { key: "dados", label: "Dados do paciente" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-100 text-brand-dark flex items-center justify-center font-bold text-lg">
            {patient.full_name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{patient.full_name}</h1>
              <span
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${statusStyle[patient.status]}`}
              >
                {patient.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {age !== null ? `${age} anos · ` : ""}
              {patient.diagnosis || "Sem diagnóstico registrado"}
              {patient.health_insurance
                ? ` · ${patient.health_insurance}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/pacientes/${id}/editar`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            <Pencil size={15} /> Editar
          </Link>
          <a
            href={`/api/relatorio/${id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            <FileDown size={15} /> Relatório PDF
          </a>
          <Link
            href={`/pacientes/${id}/atendimento`}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-medium rounded-lg px-4 py-2.5 transition"
          >
            <ClipboardPlus size={15} /> Iniciar atendimento
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/pacientes/${id}?tab=${t.key}`}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "evolucao" && (
        <div className="space-y-6">
          {chartPoints.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-1">Evolução da dor (EVA)</h2>
              <p className="text-xs text-gray-500 mb-4">
                Média da escala EVA por sessão — quanto menor, melhor.
              </p>
              <EvaChart points={chartPoints} />
            </div>
          )}

          {sessions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-sm text-gray-500 mb-3">
                Nenhuma sessão registrada ainda.
              </p>
              <Link
                href={`/pacientes/${id}/atendimento`}
                className="text-sm text-brand hover:underline font-medium"
              >
                Registrar primeiro atendimento
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((s) => {
                const avg =
                  s.session_exercises.length > 0
                    ? s.session_exercises.reduce(
                        (acc, e) => acc + e.pain_eva,
                        0
                      ) / s.session_exercises.length
                    : null;
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-gray-200 p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">
                        {format(
                          parseISO(s.session_date),
                          "EEEE, dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </h3>
                      {avg !== null && (
                        <span
                          className="text-[11px] font-semibold rounded-full px-2.5 py-1 text-white"
                          style={{ backgroundColor: evaColor(Math.round(avg)) }}
                        >
                          EVA média {avg.toFixed(1)} ·{" "}
                          {evaLabel(Math.round(avg))}
                        </span>
                      )}
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {s.session_exercises.map((e) => (
                        <li key={e.id} className="py-2 text-sm">
                          <div className="flex items-center gap-3">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: evaColor(e.pain_eva) }}
                            />
                            <span className="flex-1">
                              {e.exercises?.name ?? "Exercício"}
                            </span>
                            <span className="text-gray-500 tabular-nums">
                              {formatDose(e)}
                            </span>
                            <span
                              className="text-[11px] font-semibold rounded-md px-2 py-0.5 text-white tabular-nums"
                              style={{ backgroundColor: evaColor(e.pain_eva) }}
                              title={evaLabel(e.pain_eva)}
                            >
                              EVA {e.pain_eva}
                            </span>
                          </div>
                          {e.notes && (
                            <p className="ml-5 mt-1 text-xs text-gray-500 italic">
                              Obs.: {e.notes}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {s.general_notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 mt-3">
                        {s.general_notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "documentos" && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">
            Exames, raio-x e documentos
          </h2>
          <DocumentsPanel patientId={id} />
        </div>
      )}

      {tab === "dados" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                <dt className="text-xs text-gray-500 mb-0.5">{k}</dt>
                <dd className="font-medium">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
