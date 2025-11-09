import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/dashboard/tests",
  
  fullyParallel: true,
  
  forbidOnly: !!process.env.CI,
  
  retries: process.env.CI ? 2 : 0,
  
  workers: process.env.CI ? 1 : undefined,
  
  reporter: "html",
  
  use: {
    baseURL: "http://localhost:3000",
    
    trace: "on-first-retry",
    
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm run dev:dashboard",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
