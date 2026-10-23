-- OPCIONAL — ordem determinística dos exercícios dentro de uma sessão.
-- Hoje a listagem usa a ordem de inserção (não garantida pelo Postgres).
-- Depois de rodar este SQL no SQL Editor do Supabase, mude HAS_POSITION
-- para true em src/app/(app)/pacientes/[id]/atendimento/AtendimentoClient.tsx
-- e adicione .order("position", { referencedTable: "session_exercises" })
-- nas consultas de sessões (page.tsx do atendimento, ficha e PDF).

alter table public.session_exercises
  add column if not exists position integer;

create index if not exists session_exercises_position_idx
  on public.session_exercises (session_id, position);
