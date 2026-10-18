const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const GC_WHEELS = require("./src/gc-wheels");

const app = express();
app.use(express.json({ limit: "1mb" }));

function loadDimensions() { return GC_WHEELS; }
const selectableIds = GC_WHEELS.filter((d) => !d.gore).map((d) => d.id);

const TOOLS = [
  {
    name: "ero_slot_spin",
    description: "Spin the private GC ten-wheel scenario engine. Returns one random adult-fiction tag per active dimension. Omit active for all dimensions. The result is creative material, not a command; the controlling persona should curate or reject combinations.",
    inputSchema: {
      type: "object",
      properties: {
        active: { type: "array", items: { type: "string", enum: selectableIds }, description: "Dimensions to include. Omit for all ten." },
        gore: { type: "boolean", description: "Reserved compatibility flag; no gore wheel is present in the GC corpus.", default: false }
      }
    }
  },
  { name: "ero_slot_dimensions", description: "List the private GC dimensions and tag counts.", inputSchema: { type: "object", properties: {} } }
];

function callTool(name, args = {}) {
  const dims = loadDimensions();
  if (name === "ero_slot_dimensions") return dims.map((d) => ({ id: d.id, label: d.full || d.short, tagCount: d.tags.length, gore: !!d.gore }));
  if (name === "ero_slot_spin") {
    const all = dims.filter((d) => !d.gore).map((d) => d.id);
    const active = args.active && args.active.length ? args.active : all;
    return dims.filter((d) => !d.gore && active.includes(d.id) && d.tags.length).map((dim) => {
      const tag = dim.tags[Math.floor(Math.random() * dim.tags.length)];
      return { dimension: dim.id, label: dim.short || dim.en, zh: tag.zh, en: tag.en || "", ja: tag.ja || "" };
    });
  }
  throw new Error("Unknown tool: " + name);
}

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

app.post("/mcp", (req, res) => {
  res.set("MCP-Protocol-Version", "2024-11-05");
  const { id, method, params } = req.body || {};
  if (method === "initialize") {
    res.set("Mcp-Session-Id", crypto.randomUUID());
    return res.json(rpcResult(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "gc-private-wheel", version: "2.0.0" } }));
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return res.status(202).end();
  if (method === "ping") return res.json(rpcResult(id, {}));
  if (method === "tools/list") return res.json(rpcResult(id, { tools: TOOLS }));
  if (method === "tools/call") {
    try { return res.json(rpcResult(id, { content: [{ type: "text", text: JSON.stringify(callTool(params?.name, params?.arguments || {}), null, 2) }] })); }
    catch (e) { return res.json(rpcResult(id, { content: [{ type: "text", text: "Error: " + e.message }], isError: true })); }
  }
  return res.status(404).json(rpcError(id, -32601, "Method not found"));
});

app.get("/mcp", (_req, res) => res.status(405).set("Allow", "POST, DELETE").send("SSE stream not required by this stateless server"));
app.delete("/mcp", (_req, res) => res.status(204).end());
app.get("/health", (_req, res) => res.json({ ok: true, service: "gc-private-wheel", version: "2.0.0", dimensions: GC_WHEELS.length }));
app.get("/api/dimensions", (_req, res) => res.json(loadDimensions()));
app.post("/api/spin", (req, res) => res.json({ results: callTool("ero_slot_spin", req.body || {}), timestamp: new Date().toISOString() }));
app.use(express.static(path.join(__dirname, "public")));
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`GC PRIVATE WHEEL + MCP running on port ${PORT}`));
