-- =====================================================================
-- Global Fisio - Schema do banco de dados (Supabase / Postgres)
-- Execute este arquivo no SQL Editor do Supabase (uma vez).
-- Depois execute o seed.sql para carregar os exercícios pré-cadastrados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  phone text,
  email text,
  cpf text,
  health_insurance text,          -- plano de saúde
  insurance_number text,          -- nº da carteirinha
  diagnosis text,                 -- diagnóstico / motivo do tratamento
  referring_doctor text,          -- médico solicitante
  notes text,
  status text not null default 'ativo' check (status in ('ativo', 'alta', 'inativo')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfil do fisioterapeuta responsável (linha única)
-- Dados usados no cabeçalho e na assinatura do relatório PDF.
-- ---------------------------------------------------------------------
create table if not exists public.therapist_profile (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  crefito text,                   -- registro profissional (ex.: CREFITO-8/123456-F)
  phone text,
  email text,
  clinic_name text,               -- nome da clínica exibido no relatório
  clinic_address text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Documentos do paciente (exames, raio-x, laudos...)
-- Os arquivos ficam no Storage (bucket "documentos"); aqui fica o índice.
-- ---------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  category text not null default 'outro' check (category in ('exame', 'raio-x', 'laudo', 'receita', 'outro')),
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists documents_patient_idx on public.documents(patient_id);

-- ---------------------------------------------------------------------
-- Catálogo de exercícios pré-cadastrados
-- ---------------------------------------------------------------------
-- measurement_type define quais campos o exercício exige no registro:
--   'series_reps'  -> séries x repetições (+ carga opcional)
--   'series_tempo' -> séries x tempo em segundos (isometrias, alongamentos, equilíbrio)
--   'cardio'       -> tempo + velocidade/distância/inclinação (esteira, bicicleta, marcha)
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'fortalecimento',
  description text,
  measurement_type text not null default 'series_reps',
  default_sets int not null default 3,
  default_reps int not null default 12,
  default_duration_seconds int,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists exercises_name_key on public.exercises(name);

-- ---------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null default 60,
  status text not null default 'agendado' check (status in ('agendado', 'concluido', 'cancelado', 'faltou')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists appointments_patient_idx on public.appointments(patient_id);
create index if not exists appointments_starts_idx on public.appointments(starts_at);

-- ---------------------------------------------------------------------
-- Sessões de atendimento (evolução diária)
-- ---------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  session_date date not null default current_date,
  general_notes text,
  created_at timestamptz not null default now()
);
create index if not exists sessions_patient_idx on public.sessions(patient_id);
create index if not exists sessions_date_idx on public.sessions(session_date);

-- ---------------------------------------------------------------------
-- Exercícios realizados em cada sessão, com escala EVA de dor (0-10)
-- ---------------------------------------------------------------------
-- Campos preenchidos conforme o measurement_type do exercício:
--   series_reps:  sets + reps (+ load_kg)
--   series_tempo: sets + duration_seconds
--   cardio:       duration_seconds (+ speed_kmh, distance_m, incline_pct)
create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  sets int,
  reps int,
  load_kg numeric(6,2),           -- carga opcional (kg)
  duration_seconds int,           -- tempo (isometria/alongamento/cardio)
  speed_kmh numeric(5,2),         -- cardio: velocidade
  distance_m numeric(8,1),        -- cardio: distância em metros
  incline_pct numeric(5,2),       -- cardio: elevação/inclinação %
  pain_eva int not null check (pain_eva between 0 and 10),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists session_exercises_session_idx on public.session_exercises(session_id);

-- =====================================================================
-- Segurança (RLS): sistema de uso único do fisioterapeuta.
-- Qualquer usuário autenticado no projeto tem acesso total.
-- (Crie apenas o usuário do fisio em Authentication -> Users.)
-- =====================================================================
alter table public.therapist_profile enable row level security;
alter table public.patients enable row level security;

drop policy if exists "authenticated full access" on public.therapist_profile;
create policy "authenticated full access" on public.therapist_profile
  for all to authenticated using (true) with check (true);

alter table public.documents enable row level security;
alter table public.exercises enable row level security;
alter table public.appointments enable row level security;
alter table public.sessions enable row level security;
alter table public.session_exercises enable row level security;

drop policy if exists "authenticated full access" on public.patients;
create policy "authenticated full access" on public.patients
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.documents;
create policy "authenticated full access" on public.documents
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.exercises;
create policy "authenticated full access" on public.exercises
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.appointments;
create policy "authenticated full access" on public.appointments
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.sessions;
create policy "authenticated full access" on public.sessions
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on public.session_exercises;
create policy "authenticated full access" on public.session_exercises
  for all to authenticated using (true) with check (true);

-- =====================================================================
-- Storage: bucket privado para documentos dos pacientes
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read documentos" on storage.objects;
create policy "authenticated read documentos" on storage.objects
  for select to authenticated using (bucket_id = 'documentos');

drop policy if exists "authenticated insert documentos" on storage.objects;
create policy "authenticated insert documentos" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos');

drop policy if exists "authenticated delete documentos" on storage.objects;
create policy "authenticated delete documentos" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos');

-- =====================================================================
-- Upgrade: se o banco foi criado com uma versão anterior deste schema,
-- os comandos abaixo adicionam as colunas novas sem perder dados.
-- (Seguros de rodar mais de uma vez.)
-- =====================================================================
alter table public.exercises add column if not exists measurement_type text not null default 'series_reps';
alter table public.exercises add column if not exists default_duration_seconds int;
alter table public.session_exercises add column if not exists duration_seconds int;
alter table public.session_exercises add column if not exists speed_kmh numeric(5,2);
alter table public.session_exercises add column if not exists distance_m numeric(8,1);
alter table public.session_exercises add column if not exists incline_pct numeric(5,2);
alter table public.session_exercises alter column sets drop not null;
alter table public.session_exercises alter column reps drop not null;

-- Ajusta o tipo de medição dos exercícios já cadastrados pelo seed antigo
update public.exercises set measurement_type = 'cardio', default_duration_seconds = coalesce(default_duration_seconds, 600)
  where category = 'condicionamento' and measurement_type = 'series_reps';
update public.exercises set measurement_type = 'series_tempo', default_duration_seconds = coalesce(default_duration_seconds, 30)
  where category = 'alongamento' and name <> 'Gato-camelo' and measurement_type = 'series_reps';
update public.exercises set measurement_type = 'series_tempo', default_duration_seconds = coalesce(default_duration_seconds, 30)
  where name in ('Agachamento na parede (wall sit)', 'Prancha frontal', 'Pêndulo de ombro (Codman)', 'Apoio unipodal', 'Apoio unipodal em superfície instável')
  and measurement_type = 'series_reps';
update public.exercises set measurement_type = 'cardio', default_duration_seconds = coalesce(default_duration_seconds, 600)
  where name = 'Treino de marcha' and measurement_type = 'series_reps';
