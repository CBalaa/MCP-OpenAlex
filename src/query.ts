import { serializeFilter } from "./filter.js";
import type { QueryRecord, QueryScalar, QueryValue } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function serializeScalar(value: QueryScalar): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function appendValue(
  params: URLSearchParams,
  key: string,
  value: QueryValue,
): void {
  if (value === undefined) {
    return;
  }

  if (key === "filter" && (typeof value === "string" || isPlainObject(value))) {
    const serialized = serializeFilter(value);
    if (serialized) {
      params.set(key, serialized);
    }
    return;
  }

  if (Array.isArray(value)) {
    params.set(key, value.map((item) => serializeScalar(item)).join(","));
    return;
  }

  if (isPlainObject(value)) {
    throw new Error(
      `Query parameter "${key}" must be a scalar, array, or filter object`,
    );
  }

  params.set(key, serializeScalar(value as QueryScalar));
}

export function buildQueryParams(
  query: QueryRecord = {},
  apiKey?: string,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    appendValue(params, key, value);
  }

  if (apiKey) {
    params.set("api_key", apiKey);
  }

  return params;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query: QueryRecord = {},
  apiKey?: string,
): string {
  if (!path.startsWith("/")) {
    throw new Error(`OpenAlex path must start with "/": ${path}`);
  }

  const url = new URL(path, `${baseUrl}/`);
  const params = buildQueryParams(query, apiKey);
  url.search = params.toString();
  return url.toString();
}
