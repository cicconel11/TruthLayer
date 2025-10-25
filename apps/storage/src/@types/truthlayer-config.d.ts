declare module "@truthlayer/config" {
  export interface EnvConfig {
    STORAGE_URL?: string;
    [key: string]: unknown;
  }

  export function loadEnv(): EnvConfig;
}

