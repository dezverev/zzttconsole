import http from "node:http";
import { ask } from "./client.js";

const PORT = parseInt(process.env.PORT || "8080", 10);

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/ask") {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const { prompt } = JSON.parse(body);
      if (!prompt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing prompt" }));
        return;
      }
      const answer = await ask(prompt);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ response: answer }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  } else if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ usage: "POST /ask {\"prompt\":\"...\"}" }));
  }
});

server.listen(PORT, () => {
  console.log(`Copilot server listening on port ${PORT}`);
});
