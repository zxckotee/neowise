import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { classify } from "./mock-ai.mjs";

const html = await readFile(new URL("./index.html", import.meta.url));

const VALID_TOPICS = new Set(["delivery", "pricing", "other"]);
const MODEL_TIMEOUT_MS = 300;

export function parseTriageBody(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  const { text } = body ?? {};
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false };
  }
  return { ok: true, text };
}

export async function triageText(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  let raw;
  try {
    raw = await classify(text, { signal: controller.signal });
  } catch {
    return { status: "manual_review", topic: null, draft: null };
  } finally {
    clearTimeout(timer);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "manual_review", topic: null, draft: null };
  }

  const topic = parsed?.topic;
  const draft = parsed?.draft;
  if (
    typeof topic !== "string" ||
    !VALID_TOPICS.has(topic) ||
    typeof draft !== "string" ||
    draft.trim().length === 0
  ) {
    return { status: "manual_review", topic: null, draft: null };
  }

  return { status: "ready", topic, draft: draft.trim() };
}

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function handleTriage(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const parsed = parseTriageBody(Buffer.concat(chunks).toString("utf8"));
  if (!parsed.ok) {
    return json(response, 400, { status: "invalid_input" });
  }
  const result = await triageText(parsed.text);
  return json(response, 200, result);
}

const listen = process.env.NODE_ENV !== "test";

if (listen) {
  createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (request.method !== "POST" || request.url !== "/api/triage") {
      return json(response, 404, { status: "not_found" });
    }
    try {
      await handleTriage(request, response);
    } catch {
      json(response, 500, { status: "server_error" });
    }
  }).listen(Number(process.env.PORT || 3000), "127.0.0.1");
}