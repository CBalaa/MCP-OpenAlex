import { CODEX_ENV_VARS, DEFAULT_CODEX_SERVER_NAME } from "./constants.js";

export interface CodexConfigSnippetOptions {
  serverName?: string;
  command: string;
  args: string[];
  cwd?: string;
  envVars?: readonly string[];
}

function escapeTomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlArray(values: readonly string[]): string {
  return `[${values.map((value) => escapeTomlString(value)).join(", ")}]`;
}

function serverSectionHeader(serverName: string): string {
  return `[mcp_servers.${serverName}]`;
}

export function renderCodexConfigSnippet(
  options: CodexConfigSnippetOptions,
): string {
  const serverName = options.serverName ?? DEFAULT_CODEX_SERVER_NAME;
  const envVars = options.envVars ?? CODEX_ENV_VARS;
  const lines = [
    serverSectionHeader(serverName),
    `command = ${escapeTomlString(options.command)}`,
    `args = ${tomlArray(options.args)}`,
  ];

  if (envVars.length > 0) {
    lines.push(`env_vars = ${tomlArray(envVars)}`);
  }
  if (options.cwd) {
    lines.push(`cwd = ${escapeTomlString(options.cwd)}`);
  }

  return `${lines.join("\n")}\n`;
}
