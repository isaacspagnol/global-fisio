import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import ReportDocument from "./src/lib/pdf/ReportDocument";
import { writeFileSync } from "fs";
const patient: any = { id: "1", full_name: "João da Silva", birth_date: "1980-05-10", phone: null, email: null, cpf: "123.456.789-00", health_insurance: "Unimed", insurance_number: "9988", diagnosis: "Pós-operatório LCA joelho direito", referring_doctor: "Dr. Carlos", notes: null, status: "ativo", created_at: "" };
const therapist: any = { id: "t1", full_name: "Dra. Ana Beatriz Fisioterapeuta", crefito: "CREFITO-8/123456-F", phone: "45 98888-0000", email: "ana@globalfisio.com", clinic_name: "Global Fisio", clinic_address: null, updated_at: "", created_at: "" };
const sessions: any = [
  { id: "s1", patient_id: "1", appointment_id: null, session_date: "2026-08-01", general_notes: "Primeira sessão", created_at: "", session_exercises: [
    { id: "e1", session_id: "s1", exercise_id: "x1", sets: 3, reps: 15, load_kg: null, duration_seconds: null, speed_kmh: null, distance_m: null, incline_pct: null, pain_eva: 7, notes: null, created_at: "", exercises: { id: "x1", name: "Agachamento livre", category: "fortalecimento" } },
    { id: "e2", session_id: "s1", exercise_id: "x2", sets: 3, reps: null, load_kg: null, duration_seconds: 30, speed_kmh: null, distance_m: null, incline_pct: null, pain_eva: 5, notes: null, created_at: "", exercises: { id: "x2", name: "Prancha frontal", category: "fortalecimento" } },
    { id: "e3", session_id: "s1", exercise_id: "x3", sets: null, reps: null, load_kg: null, duration_seconds: 1200, speed_kmh: 5.5, distance_m: 1100, incline_pct: 2, pain_eva: 3, notes: null, created_at: "", exercises: { id: "x3", name: "Esteira (caminhada)", category: "condicionamento" } },
  ] },
];
const buf = await renderToBuffer(createElement(ReportDocument, { patient, sessions, therapist }) as any);
writeFileSync("/tmp/test-report2.pdf", buf);
console.log("OK", buf.length);
