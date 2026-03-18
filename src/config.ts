import {
  DEFAULT_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  PACKAGE_NAME,
  PACKAGE_VERSION,
} from "./constants.js";
import type { OpenAlexRuntimeConfig } from "./types.js";

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(
  name: string,
  rawValue: string | undefined,
  fallback: number,
): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function normalizeBaseUrl(rawValue: string | undefined): string {
  const candidate = trimToUndefined(rawValue) ?? DEFAULT_BASE_URL;
  return candidate.replace(/\/+$/, "");
}

export function loadRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenAlexRuntimeConfig {
  return {
    apiKey: trimToUndefined(env.OPENALEX_API_KEY),
    email: trimToUndefined(env.OPENALEX_EMAIL),
    baseUrl: normalizeBaseUrl(env.OPENALEX_BASE_URL),
    timeoutMs: parsePositiveInteger(
      "OPENALEX_TIMEOUT_MS",
      env.OPENALEX_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    maxRetries: parsePositiveInteger(
      "OPENALEX_MAX_RETRIES",
      env.OPENALEX_MAX_RETRIES,
      DEFAULT_MAX_RETRIES,
    ),
    userAgent: `${PACKAGE_NAME}/${PACKAGE_VERSION}`,
  };
}
