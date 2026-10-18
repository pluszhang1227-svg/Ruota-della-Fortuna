const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "1mb" }));

const TAGS_PATH = path.join(__dirname, "src", "tags.json");
function loadDimensions() {
  return JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));
}

const TOOLS = [
  {
    name: "ero_slot_spin",
    description: "Spin the Ruota della Fortuna slot machine. Returns a random NSFW tag per active dimension — tonight's recipe. Defaults to all 6 non-gore dimensions if none specified.",
    inputSchema: {
      type: "object",
      properties: {
        active: {
          type: "array",
          items: { type: "string", enum: ["position", "scenario", "props", "roleplay", "physical", "mental"] },
          description: "Which dimensions to include (1-6). Omit for all 6."
        },
        gore: { type: "boolean", description: "Unlock the 7th extreme dimension. Default false.", default: false }
      }
    }
  },
  {
    name: "ero_slot_dimensions",
    description: "List all 7 dimensions and their tag counts.",
    inputSchema: { type: "object", properties: {} }
  }
];

function callTool(name, args = {}) {
  const dims = loadDimensions();
  if (name === "ero_slot_dimensions") {
    return dims.map((d) => ({ id: d.id, label: d.full || d.short, tagCount: d.tags.length, gore: !!d.gore }));
  }
  if (name === "ero_slot_spin") {
    const allNonGore = dims.filter((d) => !d.gore).map((d) => d.id);
    const active = args.active && args.active.length ? args.active : allNonGore;
    const gore = !!args.gore;
    const results = [];
    for (const dim of dims) {
      if (dim.gore && !gore) continue;
      if (!dim.gore && !active.includes(dim.id)) continue;
      if (!dim.tags.length) continue;
      const tag = dim.tags[Math.floor(Math.random() * dim.tags.length)];
      results.push({ dimension: dim.id, label: dim.short || dim.en, zh: tag.zh, en: tag.en || "", ja: tag.ja || "" });
    }
    return results;
  }
  throw new Error("Unknown tool: " + name);
}

function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }

// Stateless Streamable HTTP MCP endpoint for remote clients such as Aru.
app.post("/mcp", (req, res) => {
  res.set("MCP-Protocol-Version", "2024-11-05");
  const msg = req.body || {};
  const { id, method, params } = msg;

  if (method === "initialize") {
    res.set("Mcp-Session-Id", crypto.randomUUID());
    return res.json(rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "ero-slot", version: "1.1.0" }
    }));
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return res.status(202).end();
  }
  if (method === "ping") return res.json(rpcResult(id, {}));
  if (method === "tools/list") return res.json(rpcResult(id, { tools: TOOLS }));
  if (method === "tools/call") {
    try {
      const output = callTool(params?.name, params?.arguments || {});
      return res.json(rpcResult(id, { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] }));
    } catch (e) {
      return res.json(rpcResult(id, { content: [{ type: "text", text: "Error: " + e.message }], isError: true }));
    }
  }
  return res.status(404).json(rpcError(id, -32601, "Method not found"));
});

app.get("/mcp", (_req, res) => res.status(405).set("Allow", "POST, DELETE").send("SSE stream not required by this stateless server"));
app.delete("/mcp", (_req, res) => res.status(204).end());

app.get("/health", (_req, res) => res.json({ ok: true, service: "ero-slot-mcp" }));

app.get("/api/dimensions", (_req, res) => res.json(loadDimensions()));
app.post("/api/spin", (req, res) => {
  try {
    const active = req.body?.active;
    const gore = !!req.body?.gore;
    res.json({ results: callTool("ero_slot_spin", { active, gore }), timestamp: new Date().toISOString() });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/tags", (req, res) => {
  const { dimension, zh, en, ja } = req.body || {};
  if (!dimension || !zh) return res.status(400).json({ error: "dimension and zh are required" });
  const dims = loadDimensions();
  const dim = dims.find((d) => d.id === dimension);
  if (!dim) return res.status(404).json({ error: "unknown dimension: " + dimension });
  const tag = { zh, en: en || "", ja: ja || "" };
  dim.tags.push(tag);
  fs.writeFileSync(TAGS_PATH, JSON.stringify(dims, null, 2), "utf-8");
  res.json({ ok: true, tag, dimension, tagCount: dim.tags.length });
});

app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`ERO SLOT + MCP running on port ${PORT}`));
