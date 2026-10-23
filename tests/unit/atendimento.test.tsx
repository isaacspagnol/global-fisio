import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AtendimentoClient from "@/app/(app)/pacientes/[id]/atendimento/AtendimentoClient";
import { ToastProvider } from "@/components/ui/Toast";
import type { Exercise, Patient } from "@/lib/types";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() }),
}));

const insertedRows: Record<string, unknown[]> = {};

/** Builder encadeável mínimo que resolve com { error: null }. */
function okBuilder() {
  const b: Record<string, unknown> = {};
  for (const m of ["eq", "in", "gte", "lte", "order", "select"]) b[m] = () => b;
  b.single = async () => ({ data: { id: "new-session-id" }, error: null });
  b.then = (resolve: (v: { error: null }) => void) => resolve({ error: null });
  return b;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      const record = (payload: unknown) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        insertedRows[table] = [...(insertedRows[table] ?? []), ...rows];
        return okBuilder();
      };
      return {
        insert: record,
        upsert: record,
        update: () => okBuilder(),
        delete: () => okBuilder(),
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      };
    },
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
    window.localStorage.clear();
  });

  /** Card expandido do exercício (li#entry-...) a partir do título. */
  function cardOf(name: string): HTMLElement {
    const title = screen.getByRole("heading", { level: 3, name });
    return title.closest("li") as HTMLElement;
  }

  it("mostra o catálogo de exercícios pré-cadastrados", () => {
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    expect(screen.getByText("Agachamento livre")).toBeInTheDocument();
    expect(screen.getByText("Alongamento de panturrilha")).toBeInTheDocument();
  });

  it("adiciona exercício com séries/reps padrão ao tocar", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));
    const card = cardOf("Agachamento livre");
    expect(card).toBeInTheDocument();
    // steppers com os padrões 3 séries x 15 reps
    expect(within(card).getByLabelText("séries")).toHaveValue("3");
    expect(within(card).getByLabelText("repetições")).toHaveValue("15");
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
    await user.click(screen.getAllByRole("button", { name: /Finalizar atendimento/ })[0]);
    expect(
      screen.getByText("Registre a escala EVA de dor em todos os exercícios.")
    ).toBeInTheDocument();
    expect(insertedRows["sessions"]).toBeUndefined();
  });

  it("não permite salvar sessão vazia", () => {
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    for (const b of screen.getAllByRole("button", { name: /Finalizar atendimento/ })) {
      expect(b).toBeDisabled();
    }
    expect(insertedRows["sessions"]).toBeUndefined();
  });

  it("salva sessão e exercícios com EVA e redireciona", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));

    const card = cardOf("Agachamento livre");
    // seleciona EVA 6
    await user.click(within(card).getByRole("radio", { name: /^Dor 6 de 10/ }));
    expect(within(card).getByRole("radio", { name: /^Dor 6 de 10/ })).toHaveAttribute("aria-checked", "true");
    expect(within(card).getByText("Dor moderada")).toBeInTheDocument();

    // observação por exercício (abre inline)
    await user.click(within(card).getByRole("button", { name: /Observação/ }));
    await user.type(
      within(card).getByPlaceholderText(/dor no final da amplitude/),
      "Compensou com o tronco"
    );

    await user.click(screen.getAllByRole("button", { name: /Finalizar atendimento/ })[0]);

    expect(insertedRows["sessions"]).toHaveLength(1);
    expect(insertedRows["session_exercises"]).toHaveLength(1);
    const row = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(row.exercise_id).toBe("ex1");
    expect(row.sets).toBe(3);
    expect(row.reps).toBe(15);
    expect(row.pain_eva).toBe(6);
    expect(row.notes).toBe("Compensou com o tronco");
    expect(pushMock).toHaveBeenCalledWith("/pacientes/p1?saved=1");
  });

  it("exercício cardio pede tempo/velocidade/distância/inclinação (sem séries e reps)", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Esteira (caminhada)"));

    // campos de cardio visíveis, campos de séries/reps ausentes
    const card = cardOf("Esteira (caminhada)");
    expect(within(card).getByText(/^Tempo/)).toBeInTheDocument();
    expect(within(card).getByText(/^Velocidade/)).toBeInTheDocument();
    expect(within(card).getByText(/^Distância/)).toBeInTheDocument();
    expect(within(card).getByText(/^Inclinação/)).toBeInTheDocument();
    expect(within(card).queryByText("Séries")).not.toBeInTheDocument();
    expect(within(card).queryByText("Repetições")).not.toBeInTheDocument();

    await user.type(within(card).getByLabelText(/^Velocidade/), "6");
    await user.click(within(card).getByRole("radio", { name: /^Dor 3 de 10/ }));
    await user.click(screen.getAllByRole("button", { name: /Finalizar atendimento/ })[0]);

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

    const card = cardOf("Alongamento de panturrilha");
    expect(within(card).getByText(/^Tempo por série/)).toBeInTheDocument();
    expect(within(card).queryByText("Repetições")).not.toBeInTheDocument();

    await user.click(within(card).getByRole("radio", { name: /^Dor 2 de 10/ }));
    await user.click(screen.getAllByRole("button", { name: /Finalizar atendimento/ })[0]);

    const row = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(row.sets).toBe(3);
    expect(row.reps).toBeNull();
    expect(row.duration_seconds).toBe(30);
    expect(row.pain_eva).toBe(2);
  });

  it("pré-preenche com a última sessão e 'Concluir' recolhe o card abrindo o próximo", async () => {
    const user = userEvent.setup();
    const lastSession = {
      session_date: "2026-10-20",
      items: [
        {
          exercise: exercises[0],
          sets: 4,
          reps: 10,
          load_kg: 20,
          duration_seconds: null,
          speed_kmh: null,
          distance_m: null,
          incline_pct: null,
          pain_eva: 4,
        },
        {
          exercise: exercises[1],
          sets: 3,
          reps: null,
          load_kg: null,
          duration_seconds: 45,
          speed_kmh: null,
          distance_m: null,
          incline_pct: null,
          pain_eva: 2,
        },
      ],
    };
    render(
      <AtendimentoClient
        patient={patient}
        exercises={exercises}
        lastSession={lastSession}
      />
    );
    await user.click(screen.getByRole("button", { name: /Repetir última sessão/ }));

    // 1º card aberto com valores da última sessão; 2º recolhido
    const card = cardOf("Agachamento livre");
    expect(within(card).getByLabelText("séries")).toHaveValue("4");
    expect(within(card).getByLabelText("repetições")).toHaveValue("10");
    expect(within(card).getByLabelText(/^Carga/)).toHaveValue("20");
    expect(within(card).getByText(/Última \(20\/10\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir Alongamento de panturrilha/ })).toBeInTheDocument();

    // sem EVA não há botão Concluir
    expect(within(card).queryByRole("button", { name: /^Concluir/ })).not.toBeInTheDocument();
    await user.click(within(card).getByRole("radio", { name: /^Dor 3 de 10/ }));
    await user.click(within(card).getByRole("button", { name: /^Concluir/ }));

    // o 1º virou linha recolhida com EVA e o 2º abriu
    expect(screen.getByRole("button", { name: /Abrir Agachamento livre/ })).toHaveTextContent("EVA 3");
    const card2 = cardOf("Alongamento de panturrilha");
    expect(within(card2).getByLabelText(/^Tempo por série/)).toHaveValue("45");
    expect(screen.getByText("1 de 2 registrados")).toBeInTheDocument();
  });

  it("remover exercício pode ser desfeito pelo toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <AtendimentoClient patient={patient} exercises={exercises} />
      </ToastProvider>
    );
    await user.click(screen.getByText("Agachamento livre"));
    const card = cardOf("Agachamento livre");
    await user.click(within(card).getByRole("button", { name: /Remover Agachamento livre/ }));
    expect(screen.queryByRole("heading", { level: 3, name: "Agachamento livre" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("heading", { level: 3, name: "Agachamento livre" })).toBeInTheDocument();
  });

  it("guarda rascunho local e o recupera ao reabrir a tela", async () => {
    const user = userEvent.setup();
    const first = render(
      <AtendimentoClient patient={patient} exercises={exercises} />
    );
    await user.click(screen.getByText("Agachamento livre"));
    await user.click(within(cardOf("Agachamento livre")).getByRole("radio", { name: /^Dor 5 de 10/ }));
    expect(window.localStorage.getItem("gf:draft:p1")).toContain('"pain_eva":5');
    first.unmount();

    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    const card = cardOf("Agachamento livre");
    expect(within(card).getByRole("radio", { name: /^Dor 5 de 10/ })).toHaveAttribute("aria-checked", "true");
  });

  it("usa a data local (não UTC) como data padrão da sessão", () => {
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(screen.getByLabelText("Data da sessão", { selector: "input" })).toHaveValue(expected);
  });

  it("salva com id de sessão gerado no cliente (upsert) e o rascunho guarda o mesmo id", async () => {
    const user = userEvent.setup();
    render(<AtendimentoClient patient={patient} exercises={exercises} />);
    await user.click(screen.getByText("Agachamento livre"));
    await user.click(within(cardOf("Agachamento livre")).getByRole("radio", { name: /^Dor 1 de 10/ }));
    const draft = JSON.parse(window.localStorage.getItem("gf:draft:p1")!);
    expect(draft.sessionId).toMatch(/^[0-9a-f-]{36}$/);

    await user.click(screen.getAllByRole("button", { name: /Finalizar atendimento/ })[0]);
    const session = insertedRows["sessions"]![0] as Record<string, unknown>;
    expect(session.id).toBe(draft.sessionId);
    const ex = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(ex.session_id).toBe(draft.sessionId);
    // sessão gravada → rascunho apagado
    expect(window.localStorage.getItem("gf:draft:p1")).toBeNull();
  });

  it("modo edição: insere os novos exercícios antes de apagar os antigos", async () => {
    const user = userEvent.setup();
    const editingSession = {
      id: "s-old",
      session_date: "2026-10-20",
      general_notes: null,
      items: [
        {
          id: "se-1",
          exercise: exercises[0],
          sets: 3,
          reps: 15,
          load_kg: null,
          duration_seconds: null,
          speed_kmh: null,
          distance_m: null,
          incline_pct: null,
          pain_eva: 7,
          notes: null,
        },
      ],
    };
    render(
      <AtendimentoClient
        patient={patient}
        exercises={exercises}
        editingSession={editingSession}
      />
    );
    // o card vem recolhido com a EVA registrada
    expect(screen.getByRole("button", { name: /Abrir Agachamento livre/ })).toHaveTextContent("EVA 7");
    await user.click(screen.getAllByRole("button", { name: /Salvar alterações/ })[0]);
    const ex = insertedRows["session_exercises"]![0] as Record<string, unknown>;
    expect(ex.session_id).toBe("s-old");
    expect(ex.pain_eva).toBe(7);
    expect(insertedRows["sessions"]).toBeUndefined(); // update, não insert
    expect(pushMock).toHaveBeenCalledWith("/pacientes/p1");
  });
});
