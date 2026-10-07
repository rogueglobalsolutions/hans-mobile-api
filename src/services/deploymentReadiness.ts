interface ReadinessWaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
  fetcher?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export async function waitForDeploymentReadiness(
  url: string, revision: string,
  { timeoutMs = 90_000, intervalMs = 2_000, fetcher = fetch, now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: ReadinessWaitOptions = {},
): Promise<void> {
  const target = new URL(url);
  if (target.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("Deployment readiness checks must target the local HTTP service.");
  }
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) throw new Error("Invalid deployment revision.");
  const deadline = now() + timeoutMs;
  let reason = "service did not respond";
  while (now() < deadline) {
    try {
      const response = await fetcher(target, {
        headers: { "Cache-Control": "no-cache" }, redirect: "error",
        signal: AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline - now()))),
      });
      const data = await response.json() as { status?: string; revision?: string };
      if (response.status === 200 && data.status === "ready" && data.revision === revision) return;
      reason = response.status !== 200 ? `readiness HTTP ${response.status}`
        : data.status !== "ready" ? "database is not ready" : "running revision does not match the tested commit";
    } catch {
      reason = "readiness endpoint was unreachable or returned an invalid response";
    }
    if (now() < deadline) await sleep(Math.min(intervalMs, deadline - now()));
  }
  throw new Error(`Deployment readiness timed out: ${reason}. Inspect the service logs; no automatic rollback was performed.`);
}
