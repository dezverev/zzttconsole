import "dotenv/config";

export interface ProviderConfig {
  type: "openai";
  baseUrl: string;
  apiKey?: string;
}

export interface AppConfig {
  model: string;
  provider: ProviderConfig;
}

export function loadConfig(): AppConfig {
  return {
    model: process.env.COPILOT_MODEL || "gpt-5.4-mini",
    provider: {
      type: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "http://localhost:1234/v1",
      apiKey: process.env.OPENAI_API_KEY,
    },
  };
}
