import { loadEnv } from "@truthlayer/config";
import winston from "winston";

export function createLogger() {
  const { LOG_LEVEL } = loadEnv();

  return winston.createLogger({
    level: LOG_LEVEL ?? "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) =>
            JSON.stringify({ timestamp, level, message, ...meta })
          )
        )
      })
    ]
  });
}

export type Logger = ReturnType<typeof createLogger>;

