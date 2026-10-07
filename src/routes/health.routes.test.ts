import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import express from "express";
import test from "node:test";
import { createHealthRouter } from "./health.routes";

async function serverFor(router: ReturnType<typeof createHealthRouter>) {
  const app = express();
  app.use("/api/health", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve());
    }) };
}

test("legacy health response stays unchanged and does not query the database", async () => {
  let calls = 0;
  const server = await serverFor(createHealthRouter({ probe: async () => { calls++; } }));
  try {
    const response = await fetch(server.url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "API is up!" });
    assert.equal(calls, 0);
  } finally { await server.close(); }
});

test("readiness reports the startup revision and caches schema checks", async () => {
  let calls = 0;
  let now = 1000;
  const revision = "a".repeat(40);
  const server = await serverFor(createHealthRouter({ revision, now: () => now,
    probe: async () => { calls++; } }));
  try {
    for (let index = 0; index < 2; index++) {
      const response = await fetch(server.url + "/ready");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { status: "ready", revision });
    }
    assert.equal(calls, 1);
    now += 5000;
    await (await fetch(server.url + "/ready")).json();
    assert.equal(calls, 2);
  } finally { await server.close(); }
});

test("database failures return 503 without exposing error details and can recover", async () => {
  let now = 0;
  let failing = true;
  let logs = 0;
  const server = await serverFor(createHealthRouter({ revision: "b".repeat(40), now: () => now,
    logFailure: () => { logs++; }, probe: async () => {
      if (failing) throw new Error("private database credential and schema details");
    } }));
  try {
    const failed = await fetch(server.url + "/ready");
    assert.equal(failed.status, 503);
    const body = await failed.json();
    assert.deepEqual(body, { status: "not_ready", revision: "b".repeat(40) });
    assert.equal(logs, 1);
    failing = false;
    now += 5000;
    const recovered = await fetch(server.url + "/ready");
    assert.equal(recovered.status, 200);
    assert.equal((await recovered.json()).status, "ready");
  } finally { await server.close(); }
});

test("simultaneous readiness requests share one in-flight database probe", async () => {
  let release!: () => void;
  let calls = 0;
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const server = await serverFor(createHealthRouter({ probe: async () => { calls++; began(); await gate; } }));
  try {
    const first = fetch(server.url + "/ready");
    await started;
    const second = fetch(server.url + "/ready");
    release();
    for (const response of await Promise.all([first, second])) assert.equal(response.status, 200);
    assert.equal(calls, 1);
  } finally { await server.close(); }
});
