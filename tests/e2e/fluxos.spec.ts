import { expect, test } from "@playwright/test";
import { CREDENTIALS, login } from "./helpers";

test.describe("Autenticação", () => {
  test("rejeita credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("seu@email.com").fill("errado@teste.com");
    await page.getByPlaceholder("••••••••").fill("senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  });

  test("redireciona visitante não autenticado para /login", async ({ page }) => {
    await page.goto("/pacientes");
    await expect(page).toHaveURL(/\/login/);
  });

  test("faz login e mostra o dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Resumo do seu dia na clínica")).toBeVisible();
    await expect(page.getByText("Pacientes ativos")).toBeVisible();
  });
});

test.describe("Pacientes", () => {
  test("lista o paciente seed e abre a ficha", async ({ page }) => {
    await login(page);
    await page.goto("/pacientes");
    await page.getByText("Paciente Exemplo").click();
    await expect(
      page.getByRole("heading", { name: "Paciente Exemplo" })
    ).toBeVisible();
    await expect(page.getByText("Iniciar atendimento")).toBeVisible();
  });

  test("cadastra um novo paciente", async ({ page }) => {
    await login(page);
    const nome = `Novo Paciente E2E ${Date.now()}`;
    await page.goto("/pacientes/novo");
    await page.locator('input[name="full_name"]').fill(nome);
    await page.locator('input[name="health_insurance"]').fill("Unimed");
    await page.locator('input[name="diagnosis"]').fill("Tendinite de ombro");
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    await expect(page.getByRole("heading", { name: nome })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Tendinite de ombro").first()).toBeVisible();
  });
});

test.describe("Atendimento com EVA", () => {
  test("registra sessão com exercício pré-cadastrado e escala EVA", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/pacientes");
    await page.getByText("Paciente Exemplo").click();
    await page.getByRole("link", { name: "Iniciar atendimento" }).click();

    await expect(
      page.getByText("Exercícios pré-cadastrados")
    ).toBeVisible();

    // adiciona exercício do catálogo
    await page.getByRole("button", { name: /Agachamento livre/ }).click();
    await expect(page.getByText("1. Agachamento livre")).toBeVisible();

    // tenta salvar sem EVA -> erro
    await page.getByRole("button", { name: /Salvar sessão/ }).click();
    await expect(
      page.getByText("Registre a escala EVA de dor em todos os exercícios.")
    ).toBeVisible();

    // marca EVA 6
    await page.getByRole("button", { name: "6", exact: true }).click();
    await expect(page.getByText(/6 — Dor moderada/)).toBeVisible();

    // salva
    await page.getByRole("button", { name: /Salvar sessão/ }).click();

    // volta para a ficha e mostra a evolução
    await expect(page).toHaveURL(/\/pacientes\/[\w-]+$/, { timeout: 20_000 });
    await expect(page.getByText("EVA 6").first()).toBeVisible();
    await expect(page.getByText("Agachamento livre").first()).toBeVisible();
  });
});

test.describe("Agenda", () => {
  test("cria um agendamento e o exibe na semana", async ({ page }) => {
    await login(page);
    await page.goto("/agenda");
    await page.getByRole("button", { name: "Agendar" }).first().click();
    await page
      .locator('select[name="patient_id"]')
      .selectOption({ label: "Paciente Exemplo" });
    await page.locator('input[name="time"]').fill("09:30");
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("09:30 · 60min")).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Perfil do fisioterapeuta", () => {
  test("cadastra os dados do fisio responsável e eles persistem", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/perfil");
    await page
      .locator('input[name="full_name"]')
      .fill("Dr. Fisio Responsável E2E");
    await page.locator('input[name="crefito"]').fill("CREFITO-8/123456-F");
    await page.locator('input[name="clinic_name"]').fill("Clínica E2E");
    await page.getByRole("button", { name: "Salvar dados" }).click();
    await expect(page.getByText(/Dados salvos/)).toBeVisible();

    // recarrega e confere persistência
    await page.goto("/perfil");
    await expect(page.locator('input[name="full_name"]')).toHaveValue(
      "Dr. Fisio Responsável E2E"
    );
    await expect(page.locator('input[name="crefito"]')).toHaveValue(
      "CREFITO-8/123456-F"
    );
  });
});

test.describe("Relatório PDF", () => {
  test("gera o PDF do tratamento para o plano de saúde", async ({ page }) => {
    await login(page);
    const resp = await page.request.get(
      "/api/relatorio/11111111-1111-4111-8111-111111111111"
    );
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/pdf");
    const body = await resp.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(2000);
  });

  test("bloqueia o PDF sem autenticação", async ({ request }) => {
    const resp = await request.get(
      "http://127.0.0.1:3100/api/relatorio/11111111-1111-4111-8111-111111111111"
    );
    expect(resp.status()).toBe(401);
  });
});
