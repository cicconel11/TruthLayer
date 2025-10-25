import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSchedulerConfig } from "./config";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("makeSchedulerConfig", () => {
  it("applies defaults when env variables are unset", async () => {
    delete process.env.SCHEDULER_CRON_EXPRESSION;
    delete process.env.SCHEDULER_RUN_ON_START;
    delete process.env.SCHEDULER_TIMEZONE;

    const { makeSchedulerConfig: loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.cronExpression).toBe("0 * * * *");
    expect(config.runOnStart).toBe(true);
    expect(config.timezone).toBe("UTC");
    expect(config.manualAuditSamplePercent).toBe(5);
  });

  it("parses overrides from env", async () => {
    process.env.SCHEDULER_CRON_EXPRESSION = "*/15 * * * *";
    process.env.SCHEDULER_RUN_ON_START = "false";
    process.env.SCHEDULER_TIMEZONE = "America/New_York";
    process.env.SCHEDULER_MAX_RETRIES = "5";
    process.env.SCHEDULER_RETRY_DELAY_MS = "2000";
    process.env.SCHEDULER_MANUAL_AUDIT_PERCENT = "10";

    const { makeSchedulerConfig: loadConfig } = await import("./config");
    const config = loadConfig();

    expect(config.cronExpression).toBe("*/15 * * * *");
    expect(config.runOnStart).toBe(false);
    expect(config.timezone).toBe("America/New_York");
    expect(config.maxRetries).toBe(5);
    expect(config.retryDelayMs).toBe(2000);
    expect(config.manualAuditSamplePercent).toBe(10);
  });
});
