import { MAX_JSON_PREVIEW_CHARS } from "./constants.js";
import { OpenAlexApiError } from "./openalex.js";
import type { OpenAlexResponse, OpenAlexRequestOptions } from "./openalex.js";
import type { RateLimitSnapshot } from "./types.js";

function maskApiKey(url: string): string {
  return url.replace(/([?&]api_key=)[^&]+/g, "$1***");
}

function previewJson(value: unknown): string {
  const rendered = JSON.stringify(value, null, 2);
  if (rendered.length <= MAX_JSON_PREVIEW_CHARS) {
    return rendered;
  }
  return `${rendered.slice(0, MAX_JSON_PREVIEW_CHARS)}\n... <truncated>`;
}

function summarizeRateLimit(rateLimit: RateLimitSnapshot): string | undefined {
  const parts: string[] = [];

  if (rateLimit.remaining !== undefined && rateLimit.limit !== undefined) {
    parts.push(`requests ${rateLimit.remaining}/${rateLimit.limit} remaining`);
  }
  if (
    rateLimit.remainingUsd !== undefined &&
    rateLimit.limitUsd !== undefined
  ) {
    parts.push(`credits $${rateLimit.remainingUsd}/$${rateLimit.limitUsd}`);
  }
  if (rateLimit.resetSeconds !== undefined) {
    parts.push(`reset in ${rateLimit.resetSeconds}s`);
  }

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function summarizePayload(data: unknown): string[] {
  const lines: string[] = [];

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    if (typeof record.id === "string") {
      lines.push(`id: ${record.id}`);
    }
    if (typeof record.display_name === "string") {
      lines.push(`display_name: ${record.display_name}`);
    }
    if (typeof record.title === "string") {
      lines.push(`title: ${record.title}`);
    }

    const meta =
      record.meta && typeof record.meta === "object"
        ? (record.meta as Record<string, unknown>)
        : undefined;
    if (meta && typeof meta.count === "number") {
      lines.push(`meta.count: ${meta.count}`);
    }

    if (Array.isArray(record.results)) {
      lines.push(`results_in_page: ${record.results.length}`);
    }
    if (Array.isArray(record.group_by)) {
      lines.push(`grouped_rows: ${record.group_by.length}`);
    }
  }

  return lines;
}

export function buildSuccessResult(
  toolName: string,
  response: OpenAlexResponse<unknown>,
  note?: string,
): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError: false;
} {
  const lines = [
    `Tool: ${toolName}`,
    `Endpoint: ${response.path}`,
    `URL: ${maskApiKey(response.url)}`,
    ...summarizePayload(response.data),
  ];

  const rateLimitLine = summarizeRateLimit(response.rateLimit);
  if (rateLimitLine) {
    lines.push(`Rate limit: ${rateLimitLine}`);
  }
  if (note) {
    lines.push(`Note: ${note}`);
  }

  lines.push("", "Preview:", previewJson(response.data));

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: {
      tool: toolName,
      request: {
        path: response.path,
        url: maskApiKey(response.url),
        status: response.status,
      },
      rate_limit: response.rateLimit,
      note,
      data: response.data,
    },
    isError: false,
  };
}

export function buildErrorResult(
  toolName: string,
  error: unknown,
): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const lines = [`Tool: ${toolName}`, "Request failed."];

  if (error instanceof OpenAlexApiError) {
    lines.push(`Status: ${error.status}`);
    lines.push(`URL: ${maskApiKey(error.url)}`);
    lines.push(`Message: ${error.message}`);
  } else if (error instanceof Error) {
    lines.push(`Message: ${error.message}`);
  } else {
    lines.push(`Message: ${String(error)}`);
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    isError: true,
  };
}
