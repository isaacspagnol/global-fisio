# Global Fisio

Sistema de gestão de pacientes de fisioterapia — Next.js 15 + Supabase.

## Funcionalidades

- **Pacientes**: cadastro completo (plano de saúde, carteirinha, diagnóstico, médico solicitante), busca e status (ativo / alta / inativo).
- **Documentos**: upload de exames, raio-x, laudos e receitas por paciente, com visualização de imagens e PDFs direto no sistema (armazenados em bucket privado do Supabase Storage).
- **Atendimento**: registro diário da evolução com **exercícios pré-cadastrados** — o fisio só toca no exercício, ajusta os campos do tipo dele (séries/reps/carga, séries/tempo ou tempo/velocidade/distância/inclinação) e marca a **escala EVA de dor (0–10)** de cada exercício. Documentos do paciente ficam acessíveis em painel lateral durante o atendimento.
- **Agenda**: visão semanal com criação de consultas, status (concluído, falta, cancelado) e atalho para iniciar o atendimento.
- **Exercícios**: catálogo editável (~35 exercícios no seed), cada um com seu **tipo de medição**: séries x repetições (+ carga), séries x tempo (isometrias/alongamentos) ou cardio (tempo, velocidade, distância, inclinação — esteira, bicicleta, marcha). A tela de atendimento pede apenas os campos do tipo certo.
- **Relatório PDF**: gera automaticamente o relatório do tratamento para o plano de saúde a partir dos registros diários — identificação do paciente, resumo (nº de sessões, período, evolução da EVA) e detalhamento sessão a sessão, com os dados do **fisioterapeuta responsável** (nome, CREFITO, clínica — cadastrados na tela Perfil) no cabeçalho e na assinatura.

## Setup (primeira vez)

### 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto (o plano gratuito atende bem).
2. No **SQL Editor**, cole e execute o conteúdo de `supabase/schema.sql` (tabelas, políticas de segurança e bucket de documentos).
3. Em seguida execute `supabase/seed.sql` (exercícios pré-cadastrados).
4. Em **Authentication → Users → Add user**, crie o usuário do fisioterapeuta (e-mail + senha). Marque "Auto confirm user".
5. Em **Authentication → Sign In / Up**, desative "Allow new users to sign up" (opcional, mas recomendado — só o fisio deve ter login).

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com a URL e a anon key do projeto (Supabase Dashboard → **Project Settings → API Keys**).

### 3. Rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 e faça login com o usuário criado no passo 1.4.

## Deploy (Vercel)

O projeto está pronto para deploy na Vercel: importe o repositório, adicione as duas variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`) e publique.

## Estrutura

```
supabase/schema.sql       Schema do banco + RLS + bucket de storage
supabase/seed.sql         Exercícios pré-cadastrados
src/middleware.ts         Proteção de rotas (redireciona p/ login)
src/lib/supabase/         Clients Supabase (browser e server)
src/lib/pdf/              Documento PDF do relatório (@react-pdf/renderer)
src/app/login/            Tela de login
src/app/(app)/            Área logada: dashboard, pacientes, agenda, exercícios
src/app/(app)/pacientes/[id]/atendimento/   Registro da sessão com EVA
src/app/api/relatorio/[patientId]/          Geração do PDF
```

## Observações

- Os documentos dos pacientes ficam em bucket **privado**; a visualização usa URLs assinadas temporárias.
- A escala EVA é obrigatória em cada exercício registrado — é ela que alimenta o gráfico de evolução da dor e o relatório do plano de saúde.
- Dados de pacientes são dados sensíveis (LGPD): mantenha o acesso restrito ao profissional e considere ativar backups no Supabase.

## Testes

```bash
npm test            # testes unitários (Vitest): utils EVA, PDF, tela de atendimento
npm run test:e2e    # testes end-to-end (Playwright): login, pacientes, atendimento+EVA, agenda, PDF
```

Os testes E2E não precisam de Supabase real: sobem automaticamente um mock local
(`tests/e2e/mock-supabase.mjs`) e o app em modo produção na porta 3100.
Na primeira execução do Playwright, rode `npx playwright install chromium`.
