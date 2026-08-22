import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type {
  Patient,
  Session,
  SessionExercise,
  TherapistProfile,
} from "@/lib/types";
import { evaLabel, formatDose } from "@/lib/types";

export type SessionWithExercises = Session & {
  session_exercises: SessionExercise[];
};

const BRAND = "#0e7490";

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND,
    paddingBottom: 10,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    marginBottom: 6,
    marginTop: 14,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridItem: { width: "50%", marginBottom: 4 },
  label: { color: "#6b7280", fontSize: 8 },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  summaryBox: {
    backgroundColor: "#ecfeff",
    borderRadius: 6,
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BRAND },
  summaryLabel: { fontSize: 7.5, color: "#6b7280", marginTop: 2 },
  sessionBlock: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 8,
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sessionDate: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 3,
    marginBottom: 3,
  },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#6b7280" },
  row: { flexDirection: "row", paddingVertical: 2 },
  colExercise: { flex: 2.6 },
  colDose: { flex: 2.4, textAlign: "center" },
  colEva: { flex: 1.6, textAlign: "center" },
  notes: {
    marginTop: 4,
    fontSize: 8,
    color: "#4b5563",
    backgroundColor: "#f9fafb",
    padding: 5,
    borderRadius: 4,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: "#9ca3af" },
  signature: {
    marginTop: 40,
    alignItems: "center",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    width: 220,
    paddingTop: 4,
    alignItems: "center",
  },
});

function fmt(dateStr: string) {
  return format(parseISO(dateStr), "dd/MM/yyyy");
}

export default function ReportDocument({
  patient,
  sessions,
  therapist,
}: {
  patient: Patient;
  sessions: SessionWithExercises[];
  therapist?: TherapistProfile | null;
}) {
  const ordered = [...sessions].sort((a, b) =>
    a.session_date.localeCompare(b.session_date)
  );
  const withEva = ordered.filter((x) => x.session_exercises.length > 0);
  const avg = (x: SessionWithExercises) =>
    x.session_exercises.reduce((acc, e) => acc + e.pain_eva, 0) /
    x.session_exercises.length;

  const firstEva = withEva.length > 0 ? avg(withEva[0]) : null;
  const lastEva =
    withEva.length > 0 ? avg(withEva[withEva.length - 1]) : null;

  const generatedAt = format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <Document
      title={`Relatório de tratamento - ${patient.full_name}`}
      author="Global Fisio"
    >
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.title}>Relatório de Tratamento Fisioterapêutico</Text>
            <Text style={s.subtitle}>
              {therapist?.clinic_name || "Global Fisio"} · Documento gerado em{" "}
              {generatedAt}
            </Text>
            {therapist && (
              <Text style={s.subtitle}>
                Fisioterapeuta responsável: {therapist.full_name}
                {therapist.crefito ? ` · ${therapist.crefito}` : ""}
              </Text>
            )}
          </View>
        </View>

        {/* Dados do paciente */}
        <Text style={s.sectionTitle}>1. Identificação do paciente</Text>
        <View style={s.grid}>
          <View style={{ ...s.gridItem, width: "100%" }}>
            <Text style={s.label}>Nome completo</Text>
            <Text style={s.value}>{patient.full_name}</Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>Data de nascimento</Text>
            <Text style={s.value}>
              {patient.birth_date ? fmt(patient.birth_date) : "—"}
            </Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>CPF</Text>
            <Text style={s.value}>{patient.cpf || "—"}</Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>Plano de saúde</Text>
            <Text style={s.value}>{patient.health_insurance || "—"}</Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>Nº da carteirinha</Text>
            <Text style={s.value}>{patient.insurance_number || "—"}</Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>Diagnóstico / motivo do tratamento</Text>
            <Text style={s.value}>{patient.diagnosis || "—"}</Text>
          </View>
          <View style={s.gridItem}>
            <Text style={s.label}>Médico solicitante</Text>
            <Text style={s.value}>{patient.referring_doctor || "—"}</Text>
          </View>
        </View>

        {/* Resumo */}
        <Text style={s.sectionTitle}>2. Resumo do tratamento</Text>
        <View style={s.summaryBox}>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>{ordered.length}</Text>
            <Text style={s.summaryLabel}>Sessões realizadas</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>
              {ordered.length > 0
                ? `${fmt(ordered[0].session_date)} – ${fmt(ordered[ordered.length - 1].session_date)}`
                : "—"}
            </Text>
            <Text style={s.summaryLabel}>Período do tratamento</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>
              {firstEva !== null ? firstEva.toFixed(1) : "—"}
            </Text>
            <Text style={s.summaryLabel}>EVA média inicial</Text>
          </View>
          <View style={s.summaryItem}>
            <Text style={s.summaryValue}>
              {lastEva !== null ? lastEva.toFixed(1) : "—"}
            </Text>
            <Text style={s.summaryLabel}>EVA média atual</Text>
          </View>
        </View>
        {firstEva !== null && lastEva !== null && (
          <Text style={{ marginTop: 6, fontSize: 8.5, color: "#4b5563" }}>
            Evolução da dor (Escala Visual Analógica 0–10): de{" "}
            {firstEva.toFixed(1)} ({evaLabel(Math.round(firstEva))}) na
            primeira sessão para {lastEva.toFixed(1)} (
            {evaLabel(Math.round(lastEva))}) na sessão mais recente.
          </Text>
        )}

        {/* Sessões */}
        <Text style={s.sectionTitle}>
          3. Evolução diária — exercícios realizados
        </Text>
        {ordered.map((sess) => (
          <View key={sess.id} style={s.sessionBlock} wrap={false}>
            <View style={s.sessionHeader}>
              <Text style={s.sessionDate}>
                {format(parseISO(sess.session_date), "EEEE, dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </Text>
              {sess.session_exercises.length > 0 && (
                <Text style={{ fontSize: 8, color: "#6b7280" }}>
                  EVA média da sessão: {avg(sess).toFixed(1)}
                </Text>
              )}
            </View>
            <View style={s.tableHeader}>
              <Text style={[s.th, s.colExercise]}>Exercício</Text>
              <Text style={[s.th, s.colDose]}>Realizado</Text>
              <Text style={[s.th, s.colEva]}>Dor (EVA 0–10)</Text>
            </View>
            {sess.session_exercises.map((e) => (
              <View key={e.id} style={s.row}>
                <Text style={s.colExercise}>
                  {e.exercises?.name ?? "Exercício"}
                </Text>
                <Text style={s.colDose}>{formatDose(e)}</Text>
                <Text style={s.colEva}>
                  {e.pain_eva} — {evaLabel(e.pain_eva)}
                </Text>
              </View>
            ))}
            {sess.general_notes && (
              <Text style={s.notes}>Obs.: {sess.general_notes}</Text>
            )}
          </View>
        ))}

        {/* Assinatura */}
        <View style={s.signature} wrap={false}>
          <View style={s.signatureLine}>
            {therapist ? (
              <>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
                  {therapist.full_name}
                </Text>
                <Text style={{ fontSize: 8, color: "#374151" }}>
                  Fisioterapeuta responsável
                  {therapist.crefito ? ` · ${therapist.crefito}` : ""}
                </Text>
                {(therapist.phone || therapist.email) && (
                  <Text style={{ fontSize: 7.5, color: "#6b7280" }}>
                    {[therapist.phone, therapist.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
                <Text style={{ fontSize: 7.5, color: "#6b7280", marginTop: 2 }}>
                  Assinatura e carimbo
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 8.5 }}>
                  Fisioterapeuta responsável
                </Text>
                <Text style={{ fontSize: 7.5, color: "#6b7280" }}>
                  Assinatura e carimbo (CREFITO)
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Rodapé */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {therapist?.clinic_name || "Global Fisio"} — relatório gerado
            automaticamente a partir dos registros de atendimento
          </Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
