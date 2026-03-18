import { buildUrl } from "./query.js";
import type {
  OpenAlexRequestSummary,
  OpenAlexRuntimeConfig,
  QueryRecord,
  RateLimitSnapshot,
} from "./types.js";

export interface OpenAlexResponse<T> extends OpenAlexRequestSummary {
  data: T;
}

export interface OpenAlexRequestOptions {
  requiresApiKey?: boolean;
}

function parseNumberHeader(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffDelayMs(attempt: number, retryAfterSeconds?: number): number {
  if (retryAfterSeconds !== undefined) {
    return Math.max(retryAfterSeconds * 1_000, 250);
  }
  return Math.min(1_000 * 2 ** attempt, 8_000);
}

function formatErrorBody(body: unknown): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message =
      (typeof record.message === "string" && record.message) ||
      (typeof record.error === "string" && record.error);
    if (message) {
      return message;
    }
  }

  if (typeof body === "string") {
    return body;
  }

  return "Unknown OpenAlex error";
}

export function extractRateLimit(headers: Headers): RateLimitSnapshot {
  return {
    limit: parseNumberHeader(headers.get("x-ratelimit-limit")),
    remaining: parseNumberHeader(headers.get("x-ratelimit-remaining")),
    resetSeconds: parseNumberHeader(headers.get("x-ratelimit-reset")),
    oneTimeRemaining: parseNumberHeader(
      headers.get("x-ratelimit-onetime-remaining"),
    ),
    creditsUsed: parseNumberHeader(headers.get("x-ratelimit-credits-used")),
    creditsRequired: parseNumberHeader(
      headers.get("x-ratelimit-credits-required"),
    ),
    limitUsd: parseNumberHeader(headers.get("x-ratelimit-limit-usd")),
    remainingUsd: parseNumberHeader(headers.get("x-ratelimit-remaining-usd")),
    prepaidRemainingUsd: parseNumberHeader(
      headers.get("x-ratelimit-prepaid-remaining-usd"),
    ),
    costUsd: parseNumberHeader(headers.get("x-ratelimit-cost-usd")),
    costRequiredUsd: parseNumberHeader(
      headers.get("x-ratelimit-cost-required-usd"),
    ),
    retryAfterSeconds: parseNumberHeader(headers.get("retry-after")),
  };
}

export class OpenAlexApiError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly body: unknown;
  public readonly rateLimit: RateLimitSnapshot;

  constructor(params: {
    status: number;
    url: string;
    body: unknown;
    rateLimit: RateLimitSnapshot;
  }) {
    super(
      `OpenAlex request failed with status ${params.status}: ${formatErrorBody(
        params.body,
      )}`,
    );
    this.name = "OpenAlexApiError";
    this.status = params.status;
    this.url = params.url;
    this.body = params.body;
    this.rateLimit = params.rateLimit;
  }
}

export class OpenAlexClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: OpenAlexRuntimeConfig,
    fetchImpl: typeof fetch = globalThis.fetch,
  ) {
    if (!fetchImpl) {
      throw new Error("Global fetch is not available in this runtime");
    }
    this.fetchImpl = fetchImpl;
  }

  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": this.config.userAgent,
    };

    if (this.config.email) {
      headers.from = this.config.email;
    }

    return headers;
  }

  async getJson<T>(
    path: string,
    query: QueryRecord = {},
    options: OpenAlexRequestOptions = {},
  ): Promise<OpenAlexResponse<T>> {
    if (options.requiresApiKey && !this.config.apiKey) {
      throw new Error(
        "This tool requires OPENALEX_API_KEY. Set it before calling this endpoint.",
      );
    }

    const url = buildUrl(this.config.baseUrl, path, query, this.config.apiKey);
    let attempt = 0;

    while (true) {
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: this.buildHeaders(),
          signal: AbortSignal.timeout(this.config.timeoutMs),
        });
        const rateLimit = extractRateLimit(response.headers);

        if (!response.ok) {
          const body = await parseResponseBody(response);

          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < this.config.maxRetries
          ) {
            await sleep(backoffDelayMs(attempt, rateLimit.retryAfterSeconds));
            attempt += 1;
            continue;
          }

          throw new OpenAlexApiError({
            status: response.status,
            url,
            body,
            rateLimit,
          });
        }

        const data = (await parseResponseBody(response)) as T;
        return {
          data,
          path,
          url,
          status: response.status,
          rateLimit,
        };
      } catch (error) {
        if (isRetryableError(error) && attempt < this.config.maxRetries) {
          await sleep(backoffDelayMs(attempt));
          attempt += 1;
          continue;
        }

        if (error instanceof Error) {
          error.message = `${error.message} (${url})`;
        }
        throw error;
      }
    }
  }
}
