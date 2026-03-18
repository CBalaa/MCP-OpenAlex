#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "../src/config.js";
import { OpenAlexClient } from "../src/openalex.js";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function assertServerStarts(serverEntry: string): Promise<void> {
  const child = spawn(process.execPath, [serverEntry], {
    stdio: ["pipe", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  await Promise.race([
    new Promise<never>((_, reject) => {
      child.once("exit", (code) => {
        reject(
          new Error(
            `MCP server exited during startup with code ${code ?? "unknown"}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
      });
    }),
    wait(500),
  ]);

  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..", "..");
  const serverEntry = path.join(repoRoot, "dist", "src", "index.js");

  await access(serverEntry);
  await assertServerStarts(serverEntry);

  const client = new OpenAlexClient(loadRuntimeConfig());
  const works = await client.getJson("/works", { per_page: 1 });
  const changefiles = await client.getJson("/changefiles");

  console.log(
    `works ok: status=${works.status}, remaining=${works.rateLimit.remaining ?? "unknown"}`,
  );
  console.log(
    `changefiles ok: status=${changefiles.status}, count=${(changefiles.data as { meta?: { count?: number } }).meta?.count ?? "unknown"}`,
  );

  if (loadRuntimeConfig().apiKey) {
    const rateLimit = await client.getJson(
      "/rate-limit",
      {},
      { requiresApiKey: true },
    );
    console.log(
      `rate-limit ok: remaining=${rateLimit.rateLimit.remaining ?? "unknown"}`,
    );
  } else {
    console.log("rate-limit skipped: OPENALEX_API_KEY is not set");
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
