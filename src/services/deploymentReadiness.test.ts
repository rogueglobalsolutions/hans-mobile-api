import assert from "node:assert/strict";
import test from "node:test";
import { waitForDeploymentReadiness } from "./deploymentReadiness";

const revision = "a".repeat(40);
const url = "http://127.0.0.1:5656/api/health/ready";

function clock() {
  let time = 0;
  return { now: () => time, sleep: async (ms: number) => { time += ms; } };
}

test("deployment readiness requires healthy database and exact tested revision", async () => {
  let calls = 0;
  const responses = [
    Response.json({ status: "not_ready", revision }, { status: 503 }),
    Response.json({ status: "ready", revision: "b".repeat(40) }),
    Response.json({ status: "ready", revision }),
  ];
  await waitForDeploymentReadiness(url, revision, { ...clock(), intervalMs: 1,
    fetcher: async () => responses[calls++]! });
  assert.equal(calls, 3);
});

test("an active process with missing schema never passes deployment readiness", async () => {
  await assert.rejects(waitForDeploymentReadiness(url, revision, { ...clock(), timeoutMs: 3, intervalMs: 1,
    fetcher: async () => Response.json({ status: "not_ready", revision }, { status: 503 }) }), /HTTP 503/);
});

test("an older running commit never passes readiness", async () => {
  await assert.rejects(waitForDeploymentReadiness(url, revision, { ...clock(), timeoutMs: 3, intervalMs: 1,
    fetcher: async () => Response.json({ status: "ready", revision: "b".repeat(40) }) }), /does not match/);
});

test("unreachable or invalid readiness responses fail within the deadline", async () => {
  for (const fetcher of [async () => { throw new Error("connection refused"); }, async () => new Response("not json")]) {
    await assert.rejects(waitForDeploymentReadiness(url, revision, { ...clock(), timeoutMs: 3, intervalMs: 1, fetcher }), /timed out/);
  }
});

test("readiness refuses remote URLs, redirects and invalid revisions", async () => {
  await assert.rejects(waitForDeploymentReadiness("https://example.com", revision), /local HTTP/);
  await assert.rejects(waitForDeploymentReadiness(url, "invalid"), /revision/);
  await waitForDeploymentReadiness(url, revision, { fetcher: async (_url, options) => {
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal);
    return Response.json({ status: "ready", revision });
  } });
});
