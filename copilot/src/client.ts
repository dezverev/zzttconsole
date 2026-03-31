import { CopilotClient } from "@github/copilot-sdk";
import { loadConfig } from "./config.js";

let client: CopilotClient | null = null;

async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient();
    await client.start();
  }
  return client;
}

export async function ask(prompt: string): Promise<string> {
  const config = loadConfig();
  const c = await getClient();

  const session = await c.createSession({
    model: config.model,
    provider: config.provider,
    onPermissionRequest: async () => ({ kind: "approved" as const }),
  });

  const response = await session.sendAndWait({ prompt });
  const content = response?.data.content ?? "(no response)";

  await session.disconnect();
  return content;
}

export async function shutdown(): Promise<void> {
  if (client) {
    await client.stop();
    client = null;
  }
}
