export type Scalar = string | number | boolean | null;

export type FilterOperator =
  | { value: Scalar }
  | { or: Scalar[] }
  | { values: Scalar[] }
  | { not: Scalar | Scalar[] }
  | { gt: Scalar }
  | { gte: Scalar }
  | { lt: Scalar }
  | { lte: Scalar }
  | { range: [Scalar, Scalar] };

export type FilterRecord = Record<
  string,
  Scalar | Scalar[] | FilterOperator | undefined
>;

export type FilterInput = string | FilterRecord | undefined;
export type DelimitedInput = string | readonly string[] | undefined;
export type QueryScalar = string | number | boolean | null;
export type QueryValue =
  | QueryScalar
  | readonly QueryScalar[]
  | FilterRecord
  | undefined;
export type QueryRecord = Record<string, QueryValue>;

export interface CommonListArgs {
  filter?: FilterInput;
  search?: string;
  sort?: DelimitedInput;
  group_by?: DelimitedInput;
  select?: DelimitedInput;
  page?: number;
  cursor?: string;
  per_page?: number;
  sample?: number;
  seed?: string | number;
}

export interface RateLimitSnapshot {
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  oneTimeRemaining?: number;
  creditsUsed?: number;
  creditsRequired?: number;
  limitUsd?: number;
  remainingUsd?: number;
  prepaidRemainingUsd?: number;
  costUsd?: number;
  costRequiredUsd?: number;
  retryAfterSeconds?: number;
}

export interface OpenAlexRequestSummary {
  path: string;
  url: string;
  status: number;
  rateLimit: RateLimitSnapshot;
}

export interface OpenAlexRuntimeConfig {
  apiKey?: string;
  email?: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  userAgent: string;
}
