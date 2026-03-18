#!/usr/bin/env node

import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CODEX_SERVER_NAME } from "../src/constants.js";
import { renderCodexConfigSnippet } from "../src/install.js";

interface CliOptions {
  serverName: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    serverName: DEFAULT_CODEX_SERVER_NAME,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--server-name") {
      options.serverName = argv[index + 1] ?? DEFAULT_CODEX_SERVER_NAME;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..", "..");
  const serverEntry = path.join(repoRoot, "dist", "src", "index.js");

  await access(serverEntry);

  const snippet = renderCodexConfigSnippet({
    serverName: cli.serverName,
    command: process.execPath,
    args: [serverEntry],
    cwd: repoRoot,
  });

  console.log("Copy the following block into ~/.codex/config.toml manually:\n");
  console.log(snippet.trimEnd());
  console.log("\nThis command does not modify or back up any local config files.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
