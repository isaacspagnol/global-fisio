import { defineConfig, devices } from "@playwright/test";

const SUPABASE_URL = "http://127.0.0.1:54321";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Usa o Chromium do ambiente quando PLAYWRIGHT_CHROMIUM_PATH estiver
        // definido (ex.: CI/sandbox); localmente o Playwright baixa o dele.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      url: "http://127.0.0.1:54321/auth/v1/user",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run start -- --port 3100",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      },
    },
  ],
});
