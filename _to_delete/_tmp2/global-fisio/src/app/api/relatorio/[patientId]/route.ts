import { NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import ReportDocument, {
  type SessionWithExercises,
} from "@/lib/pdf/ReportDocument";
import type { Patient, TherapistProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  const { patientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const [{ data: patient }, { data: sessions }, { data: therapistRows }] =
    await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId).single(),
      supabase
        .from("sessions")
        .select("*, session_exercises(*, exercises(id, name, category))")
        .eq("patient_id", patientId)
        .order("session_date"),
      supabase
        .from("therapist_profile")
        .select("*")
        .order("created_at")
        .limit(1),
    ]);

  if (!patient) {
    return NextResponse.json(
      { error: "Paciente não encontrado" },
      { status: 404 }
    );
  }

  const doc = createElement(ReportDocument, {
    patient: patient as Patient,
    sessions: (sessions ?? []) as SessionWithExercises[],
    therapist: (therapistRows?.[0] ?? null) as TherapistProfile | null,
  }) as unknown as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(doc);

  const safeName = (patient as Patient).full_name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-${safeName}.pdf"`,
    },
  });
}
