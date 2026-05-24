import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Use the production build, not `pnpm dev`. Fast-refresh adds JS work on
// the same main thread that drives the screen transitions, so timing-
// sensitive specs (animationend, `data-flemo-status` transitions) flake.
// `next start` serves the optimized bundle exactly as users see it.
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 5_000,
    navigationTimeout: 15_000
  },
  expect: {
    // Most flemo assertions wait for `data-flemo-status="COMPLETED"`.
    // Give every transition + 1s headroom before flagging a stuck queue.
    timeout: 4_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] }
    }
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe"
  }
});
