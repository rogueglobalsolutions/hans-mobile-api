import "../config/env";
import { waitForDeploymentReadiness } from "../services/deploymentReadiness";

async function main() {
  const revision = process.argv[2] || "";
  const port = Number(process.env.PORT || 5656);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid backend PORT.");
  await waitForDeploymentReadiness(`http://127.0.0.1:${port}/api/health/ready`, revision);
  console.log(`Running backend and database verified for ${revision}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Deployment readiness check failed.");
  process.exitCode = 1;
});
