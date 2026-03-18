export const PACKAGE_NAME = "openalex-mcp-server";
export const PACKAGE_VERSION = "0.1.0";
export const DEFAULT_BASE_URL = "https://api.openalex.org";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_MAX_RETRIES = 3;
export const MAX_JSON_PREVIEW_CHARS = 12_000;

export const DEFAULT_CODEX_SERVER_NAME = "openalex";

export const CODEX_ENV_VARS = [
  "OPENALEX_API_KEY",
  "OPENALEX_EMAIL",
  "OPENALEX_BASE_URL",
  "OPENALEX_TIMEOUT_MS",
  "OPENALEX_MAX_RETRIES",
] as const;
