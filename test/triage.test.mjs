import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseTriageBody, triageText } from "../server.mjs";

describe("parseTriageBody", () => {
  it("rejects invalid JSON", () => {
    assert.equal(parseTriageBody("{").ok, false);
  });

  it("rejects empty or non-string text", () => {
    assert.equal(parseTriageBody(JSON.stringify({})).ok, false);
    assert.equal(parseTriageBody(JSON.stringify({ text: "" })).ok, false);
    assert.equal(parseTriageBody(JSON.stringify({ text: "   " })).ok, false);
    assert.equal(parseTriageBody(JSON.stringify({ text: 42 })).ok, false);
  });

  it("accepts non-empty string text", () => {
    const r = parseTriageBody(JSON.stringify({ text: "заявка" }));
    assert.equal(r.ok, true);
    assert.equal(r.text, "заявка");
  });
});

describe("triageText failure paths", () => {
  it("returns manual_review on model timeout", async () => {
    const r = await triageText("тест [timeout]");
    assert.deepEqual(r, { status: "manual_review", topic: null, draft: null });
  });

  it("returns manual_review on model error", async () => {
    const r = await triageText("тест [error]");
    assert.deepEqual(r, { status: "manual_review", topic: null, draft: null });
  });

  it("returns manual_review on bad JSON from model", async () => {
    const r = await triageText("[bad-json]");
    assert.deepEqual(r, { status: "manual_review", topic: null, draft: null });
  });

  it("returns manual_review on invalid topic", async () => {
    const r = await triageText("[bad-topic]");
    assert.deepEqual(r, { status: "manual_review", topic: null, draft: null });
  });

  it("returns manual_review on empty draft", async () => {
    const r = await triageText("[empty-draft]");
    assert.deepEqual(r, { status: "manual_review", topic: null, draft: null });
  });
});

describe("triageText success", () => {
  it("returns ready with valid topic and draft", async () => {
    const r = await triageText("Когда приедет доставка?");
    assert.equal(r.status, "ready");
    assert.equal(r.topic, "delivery");
    assert.ok(r.draft.length > 0);
  });
});