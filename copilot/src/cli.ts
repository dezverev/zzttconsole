#!/usr/bin/env node
import { ask, shutdown } from "./client.js";

const prompt = process.argv.slice(2).join(" ");
if (!prompt) {
  console.error("Usage: copilot <prompt>");
  process.exit(1);
}

try {
  const response = await ask(prompt);
  console.log(response);
} finally {
  await shutdown();
}
