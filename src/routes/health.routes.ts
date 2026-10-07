import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { checkDatabaseReadiness } from "../services/readiness.service";

export function deploymentRevision(): string | null {
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployment.json"), "utf8"));
    return /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(metadata.revision) ? metadata.revision : null;
  } catch {
    return null;
  }
}

export function createHealthRouter({
  probe = checkDatabaseReadiness,
  revision = deploymentRevision(),
  now = Date.now,
  cacheMs = 5_000,
  logFailure = () => console.error("Database schema readiness check failed."),
}: {
  probe?: () => Promise<void>;
  revision?: string | null;
  now?: () => number;
  cacheMs?: number;
  logFailure?: () => void;
} = {}) {
  const router = Router();
  let cached: Promise<boolean> | undefined;
  let cacheUntil = 0;
  let pending = false;

  router.get("/", (_req, res) => res.json({ status: "API is up!" }));
  router.get("/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!cached || (!pending && now() >= cacheUntil)) {
      pending = true;
      cached = Promise.resolve().then(probe).then(() => true).catch(() => {
        logFailure();
        return false;
      }).finally(() => {
        pending = false;
        cacheUntil = now() + cacheMs;
      });
    }
    const ready = await cached;
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", revision });
  });
  return router;
}

export default createHealthRouter();
