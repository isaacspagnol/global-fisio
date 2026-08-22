import { expect, type Page } from "@playwright/test";

export const CREDENTIALS = {
  email: "fisio@teste.com",
  password: "senha123",
};

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill(CREDENTIALS.email);
  await page.getByPlaceholder("••••••••").fill(CREDENTIALS.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}
