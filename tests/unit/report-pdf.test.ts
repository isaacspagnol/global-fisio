// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ReportDocument from "@/lib/pdf/ReportDocument";
import type { Patient, TherapistProfile } from "@/lib/types";

const patient: Patient = {
  id: "p1",
  full_name: "Maria Aparecida de Souza",
  birth_date: "1975-03-20",
  phone: "45 99999-0000",
  email: null,
  cpf: "111.222.333-44",
  health_insurance: "Unimed",
  insurance_number: "0001234",
  diagnosis: "Lombalgia crônica",
  referring_doctor: "Dra. Ana",
  notes: null,
  status: "ativo",
  created_at: "2026-08-01T00:00:00Z",
};

function makeSession(id: string, date: string, evas: number[]) {
  return {
    id,
    patient_id: "p1",
    appointment_id: null,
    session_date: date,
    general_notes: null,
    created_at: "",
    session_exercises: evas.map((eva, i) => ({
      id: `${id}-e${i}`,
      session_id: id,
      exercise_id: `x${i}`,
      sets: 3,
      reps: 12,
      load_kg: i === 0 ? 5 : null,
      duration_seconds: null,
      speed_kmh: null,
      distance_m: null,
      incline_pct: null,
      pain_eva: eva,
      notes: null,
      created_at: "",
      exercises: { id: `x${i}`, name: `Exercício ${i + 1}`, category: "fortalecimento" },
    })),
  };
}

describe("Relatório PDF", () => {
  it("gera um PDF válido com sessões e exercícios", async () => {
    const sessions = [
      makeSession("s1", "2026-08-01", [8, 7]),
      makeSession("s2", "2026-08-08", [5, 4]),
      makeSession("s3", "2026-08-15", [2, 1]),
    ];
    const buf = await renderToBuffer(
      createElement(ReportDocument, { patient, sessions }) as never
    );
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("gera PDF mesmo sem nenhuma sessão registrada", async () => {
    const buf = await renderToBuffer(
      createElement(ReportDocument, { patient, sessions: [] }) as never
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("gera PDF com os dados do fisioterapeuta responsável", async () => {
    const therapist: TherapistProfile = {
      id: "t1",
      full_name: "Dra. Ana Fisioterapeuta",
      crefito: "CREFITO-8/98765-F",
      phone: "45 98888-0000",
      email: "ana@clinica.com",
      clinic_name: "Clínica Movimento",
      clinic_address: null,
      updated_at: "",
      created_at: "",
    };
    const sessions = [makeSession("s1", "2026-08-01", [5])];
    const buf = await renderToBuffer(
      createElement(ReportDocument, { patient, sessions, therapist }) as never
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("gera PDF com muitas sessões (multi-página)", async () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      makeSession(
        `s${i}`,
        `2026-0${(i % 6) + 1}-1${i % 9}`,
        [Math.max(0, 8 - Math.floor(i / 4))]
      )
    );
    const buf = await renderToBuffer(
      createElement(ReportDocument, { patient, sessions }) as never
    );
    expect(buf.length).toBeGreaterThan(8000);
  });
});
