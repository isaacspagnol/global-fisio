import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AtendimentoClient from "@/app/(app)/pacientes/[id]/atendimento/AtendimentoClient";
import type { Exercise, Patient } from "@/lib/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() }),
}));

const insertedRows: Record<string, unknown[]> = {};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (payload: unknown) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        insertedRows[table] = [...(insertedRows[table] ?? []), ...rows];
        return {
          select: () => ({
            single: async () => ({ data: { id: "new-session-id" }, error: null }),
          }),
          then: (resolve: (v: { error: null }) => void) =>
            resolve({ error: null }),
        };
      },
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

const patient: Patient = {
  id: "p1",
  full_name: "Fulano Teste",
  birth_date: null,
  phone: null,
  email: null,
  cpf: null,
  health_insurance: null,
  insurance_number: null,
  diagnosis: "Entorse de tornozelo",
  referring_doctor: null,
  notes: null,
  status: "ativo",
  created_at: "",
};

const exercises: Exercise[] = [
  {
    id: "ex1",
    name: "Agachamento livre",
    category: "fortalecimento",
    description: null,
    measurement_type: "series_reps",
    default_sets: 3,
    default_reps: 15,
    default_duration_seconds: null,
    active: true,
    created_at: "",
  },
  {
    id: "ex2",
    name: "Alongamento de panturrilha",
    category: "alongamento",
    description: null,
    measurement_type: "series_tempo",
    default_sets: 3,
    default_reps: 1,
    default_duration_seconds: 30,
    active: true,
    created_at: "",
  },
  {
    id: "ex3",
    name: "Esteira (caminhada)",
    category: "condicionamento",
    description: null,
    measurement_type: "cardio",
    default_sets: 1,
    default_reps: 1,
    default_duration_seconds: 600,
    active: true,
    created_at: "",
  },
];

describe("Tela de atendimento", () => {
  beforeEach(() => {
    pushMock.mockClear();
    for (const k of Object.keys(insertedRows)) delete insertedRows[k];
  });

  it("mostra o catálogo de exercícios pré-cadastrados", () => {
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    expect(screen.getByText("Agachamento livre")).toBeInTheDocument();
    expect(screen.getByText("Alongamento de panturrilha")).toBeInTheDocument();
  });

  it("adiciona exercício com séries/reps padrão ao tocar", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));
    const title = screen.getByText("1. Agachamento livre");
    expect(title).toBeInTheDocument();
    // steppers com os padrões 3 séries x 15 reps
    const card = title.closest("div")!.parentElement as HTMLElement;
    expect(within(card).getByText("15")).toBeInTheDocument();
    expect(within(card).getAllByText("3").length).toBeGreaterThan(0);
  });

  it("filtra o catálogo pela busca", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.type(
      screen.getByPlaceholderText("Buscar exercício..."),
      "panturrilha"
    );
    expect(screen.queryByText("Agachamento livre")).not.toBeInTheDocument();
    expect(screen.getByText("Alongamento de panturrilha")).toBeInTheDocument();
  });

  it("exige EVA em todos os exercícios antes de salvar", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));
    await user.click(screen.getByRole("button", { name: /Salvar sessão/ }));
    expect(
      screen.getByText("Registre a escala EVA de dor em todos os exercícios.")
    ).toBeInTheDocument();
    expect(insertedRows["sessions"]).toBeUndefined();
  });

  it("não permite salvar sessão vazia", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByRole("button", { name: /Salvar sessão/ }));
    expect(
      screen.getByText("Adicione pelo menos um exercício.")
    ).toBeInTheDocument();
  });

  it("salva sessão e exercícios com EVA e redireciona", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));

    const card = screen
      .getByText("1. Agachamento livre")
      .closest("div")!.parentElement!;
    // seleciona EVA 6
    await user.click(within(card as HTMLElement).getByRole("button", { name: "6" }));
    expect(screen.getByText(/6 — Dor moderada/)).toBeInTheDocument();

    // observação por exercício
    await user.type(
      within(card as HTMLElement).getByPlaceholderText(/dor no final da amplitude/),
      "Compensou com o tronco"
    );

    await user.click(screen.getByRole("button", { name: /Salvar sessão/ }));

    expect(insertedRows["sessions"]).toHaveLength(1);
    expect(insertedRows["session_exercises"]).toHaveLength(1);
    const row = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(row.exercise_id).toBe("ex1");
    expect(row.sets).toBe(3);
    expect(row.reps).toBe(15);
    expect(row.pain_eva).toBe(6);
    expect(row.notes).toBe("Compensou com o tronco");
    expect(pushMock).toHaveBeenCalledWith("/pacientes/p1");
  });

  it("exercício cardio pede tempo/velocidade/distância/inclinação (sem séries e reps)", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Esteira (caminhada)"));

    // campos de cardio visíveis, campos de séries/reps ausentes
    expect(screen.getByText("Tempo (min)")).toBeInTheDocument();
    expect(screen.getByText("Velocidade (km/h)")).toBeInTheDocument();
    expect(screen.getByText("Distância (m)")).toBeInTheDocument();
    expect(screen.getByText("Elevação/Inclinação (%)")).toBeInTheDocument();
    expect(screen.queryByText("Séries")).not.toBeInTheDocument();
    expect(screen.queryByText("Repetições")).not.toBeInTheDocument();

    const card = screen
      .getByText("1. Esteira (caminhada)")
      .closest("div")!.parentElement as HTMLElement;
    await user.type(within(card).getAllByPlaceholderText("—")[0], "6"); // velocidade
    await user.click(within(card).getByRole("button", { name: "3" }));
    await user.click(screen.getByRole("button", { name: /Salvar sessão/ }));

    const row = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(row.exercise_id).toBe("ex3");
    expect(row.sets).toBeNull();
    expect(row.reps).toBeNull();
    expect(row.duration_seconds).toBe(600); // 10min padrão
    expect(row.speed_kmh).toBe(6);
    expect(row.pain_eva).toBe(3);
  });

  it("exercício de tempo (isometria/alongamento) pede séries x segundos", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Alongamento de panturrilha"));

    expect(screen.getByText("Tempo por série (segundos)")).toBeInTheDocument();
    expect(screen.queryByText("Repetições")).not.toBeInTheDocument();

    const card = screen
      .getByText("1. Alongamento de panturrilha")
      .closest("div")!.parentElement as HTMLElement;
    await user.click(within(card).getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: /Salvar sessão/ }));

    const row = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(row.sets).toBe(3);
    expect(row.reps).toBeNull();
    expect(row.duration_seconds).toBe(30);
    expect(row.pain_eva).toBe(2);
  });
});
