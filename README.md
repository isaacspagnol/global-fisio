# Global Fisio

Sistema de gestão de pacientes de fisioterapia — Next.js 16 + Supabase. Mobile-first (≈90% do uso é no celular), com modo noturno.

## Funcionalidades

- **Pacientes**: cadastro completo (plano de saúde, carteirinha, diagnóstico, médico solicitante), busca e status (ativo / alta / inativo).
- **Documentos**: upload de exames, raio-x, laudos e receitas por paciente, com visualização de imagens e PDFs direto no sistema (armazenados em bucket privado do Supabase Storage).
- **Atendimento** (tela principal, desenhada para uso em pé, com uma mão): cards por exercício **pré-preenchidos com a última sessão** ("Repetir última sessão" em um toque), steppers de 48 px, **EVA 0–10** em dois blocos de botões grandes (obrigatória), timer para isometrias, "Concluir" recolhe o card e abre o próximo, remover com **Desfazer**, **rascunho automático** no aparelho (nada se perde se o navegador fechar), salvamento com timeout e aviso de offline, tela não apaga (Wake Lock), documentos do paciente em bottom sheet. Sessões salvas podem ser **editadas** depois. Ao finalizar, a consulta do dia na Agenda é marcada como concluída.
- **Agenda**: no celular, faixa de 7 dias + lista do dia; no desktop, grade semanal. Criação de consultas, status (concluído, falta, cancelado — com desfazer) e atalho para iniciar o atendimento.
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

## Interface mobile e modo noturno

- Tokens semânticos de cor em `src/app/globals.css` (`bg-surface`, `text-fg`, `text-fg-muted`, `bg-accent`, `border-line`…). **Nunca use cores cruas** (`bg-white`, `text-gray-500`) nos componentes — é isso que faz o modo escuro funcionar em toda a UI.
- Modo escuro: `next-themes` com atributo `data-theme` no `<html>` (`src/components/ThemeProvider.tsx`); variante `dark:` do Tailwind configurada por `@custom-variant`. Seleção **Sistema / Claro / Escuro** em Perfil → Aparência.
- Componentes base em `src/components/ui/` (Button, BottomSheet, Toast com "Desfazer", ConfirmDialog, Chip, Badge, Stepper, Skeleton, EmptyState, Fab…).
- Tab bar com 4 abas (Início, Pacientes, Agenda, Perfil); o catálogo de exercícios fica em Perfil. No atendimento a tab bar some (fluxo em tela cheia com barra de ações própria).
- Instalável como app (manifest em `src/app/manifest.ts`, ícones em `public/icons/`).

## Estrutura

```
supabase/schema.sql       Schema do banco + RLS + bucket de storage
supabase/seed.sql         Exercícios pré-cadastrados
src/middleware.ts         Proteção de rotas (redireciona p/ login)
src/lib/supabase/         Clients Supabase (browser e server)
src/lib/pdf/              Documento PDF do relatório (@react-pdf/renderer)
src/app/login/            Tela de login
src/components/ui/        Componentes base (botões, sheets, toasts, chips…)
src/app/(app)/            Área logada: dashboard, pacientes, agenda, exercícios, perfil
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
