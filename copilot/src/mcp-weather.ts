import https from "node:https";

// Minimal MCP server over stdio for Open-Meteo geocoding + weather

function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const TOOLS = [
  {
    name: "geocode",
    description: "Look up a location by name and return its coordinates",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "City or place name" },
      },
      required: ["name"],
    },
  },
  {
    name: "weather",
    description: "Get current weather for a latitude/longitude",
    inputSchema: {
      type: "object" as const,
      properties: {
        latitude: { type: "number", description: "Latitude" },
        longitude: { type: "number", description: "Longitude" },
      },
      required: ["latitude", "longitude"],
    },
  },
];

async function handleGeocode(args: { name: string }) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.name)}&count=3&language=en&format=json`;
  const data = JSON.parse(await fetch(url));
  if (!data.results?.length) {
    return { content: [{ type: "text", text: `No results found for "${args.name}"` }] };
  }
  const results = data.results.map((r: any) => ({
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
  return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
}

async function handleWeather(args: { latitude: number; longitude: number }) {
  const vars = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=${vars}&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const data = JSON.parse(await fetch(url));
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// JSON-RPC over stdio
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  // Process newline-delimited JSON-RPC messages
  let newline: number;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) processMessage(line);
  }
});

function respond(id: number | string, result: any) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(msg + "\n");
}

function respondError(id: number | string, code: number, message: string) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(msg + "\n");
}

async function processMessage(line: string) {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = msg;

  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "open-meteo", version: "1.0.0" },
    });
  } else if (method === "notifications/initialized") {
    // no response needed
  } else if (method === "tools/list") {
    respond(id, { tools: TOOLS });
  } else if (method === "tools/call") {
    try {
      const { name, arguments: args } = params;
      let result;
      if (name === "geocode") result = await handleGeocode(args);
      else if (name === "weather") result = await handleWeather(args);
      else {
        respondError(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      respond(id, result);
    } catch (e) {
      respondError(id, -32603, String(e));
    }
  } else if (id !== undefined) {
    respondError(id, -32601, `Unknown method: ${method}`);
  }
}
