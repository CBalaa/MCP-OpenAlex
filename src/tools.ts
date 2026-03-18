import { entityPath, ENTITY_TYPES, isAutocompleteEntityType, isEntityType, supportsSingleton, AUTOCOMPLETE_ENTITY_TYPES } from "./entities.js";
import { buildErrorResult, buildSuccessResult } from "./format.js";
import { mergeFilters } from "./filter.js";
import type { OpenAlexClient } from "./openalex.js";
import type { CommonListArgs, DelimitedInput, FilterInput, QueryRecord } from "./types.js";

type ToolResult =
  | {
      content: Array<{ type: "text"; text: string }>;
      structuredContent: Record<string, unknown>;
      isError: false;
    }
  | {
      content: Array<{ type: "text"; text: string }>;
      isError: true;
    };

interface ToolContext {
  client: OpenAlexClient;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error("Tool arguments must be an object");
  }
  return value;
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`"${key}" must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(
  args: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`"${key}" must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalNumber(
  args: Record<string, unknown>,
  key: string,
  bounds?: { min?: number; max?: number; integer?: boolean },
): number | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`"${key}" must be a number`);
  }
  if (bounds?.integer && !Number.isInteger(value)) {
    throw new Error(`"${key}" must be an integer`);
  }
  if (bounds?.min !== undefined && value < bounds.min) {
    throw new Error(`"${key}" must be >= ${bounds.min}`);
  }
  if (bounds?.max !== undefined && value > bounds.max) {
    throw new Error(`"${key}" must be <= ${bounds.max}`);
  }
  return value;
}

function optionalDelimitedInput(
  args: Record<string, unknown>,
  key: string,
): DelimitedInput {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  ) {
    return value as string[];
  }
  throw new Error(`"${key}" must be a string or array of strings`);
}

function optionalFilterInput(
  args: Record<string, unknown>,
  key: string,
): FilterInput {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (isPlainObject(value)) {
    return value as FilterInput;
  }
  throw new Error(`"${key}" must be a string or object`);
}

function optionalSeed(
  args: Record<string, unknown>,
  key: string,
): string | number | undefined {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  throw new Error(`"${key}" must be a string or number`);
}

function parseCommonListArgs(args: Record<string, unknown>): CommonListArgs {
  return {
    filter: optionalFilterInput(args, "filter"),
    search: optionalString(args, "search"),
    sort: optionalDelimitedInput(args, "sort"),
    group_by: optionalDelimitedInput(args, "group_by"),
    select: optionalDelimitedInput(args, "select"),
    page: optionalNumber(args, "page", { min: 1, integer: true }),
    cursor: optionalString(args, "cursor"),
    per_page: optionalNumber(args, "per_page", {
      min: 1,
      max: 100,
      integer: true,
    }),
    sample: optionalNumber(args, "sample", {
      min: 1,
      max: 10_000,
      integer: true,
    }),
    seed: optionalSeed(args, "seed"),
  };
}

function listArgsToQuery(args: CommonListArgs): QueryRecord {
  return {
    filter: args.filter as QueryRecord["filter"],
    search: args.search,
    sort: args.sort as QueryRecord["sort"],
    group_by: args.group_by as QueryRecord["group_by"],
    select: args.select as QueryRecord["select"],
    page: args.page,
    cursor: args.cursor,
    per_page: args.per_page,
    sample: args.sample,
    seed: args.seed,
  };
}

function normalizeWorkIdForFilter(workId: string): string {
  const trimmed = workId.trim();
  const openAlexPrefix = "https://openalex.org/";
  if (trimmed.startsWith(openAlexPrefix)) {
    return trimmed.slice(openAlexPrefix.length);
  }
  return trimmed;
}

const stringOrStringArraySchema = (description: string) => ({
  anyOf: [
    { type: "string", description },
    {
      type: "array",
      description,
      items: { type: "string" },
    },
  ],
});

const filterSchema = {
  anyOf: [
    {
      type: "string",
      description:
        "Raw OpenAlex filter string, for example publication_year:2024,type:article",
    },
    {
      type: "object",
      description:
        "Structured filter object. Scalar values map to field:value, arrays map to field:a|b, and operator objects support value/or/not/gt/gte/lt/lte/range.",
      additionalProperties: true,
    },
  ],
};

const commonListSchemaProperties = {
  filter: filterSchema,
  search: {
    type: "string",
    description: "Full-text search string passed to OpenAlex search=",
  },
  sort: stringOrStringArraySchema(
    "sort field or fields, for example cited_by_count:desc",
  ),
  group_by: stringOrStringArraySchema(
    "group_by field or fields, for example publication_year",
  ),
  select: stringOrStringArraySchema(
    "Fields to select, for example id,display_name,cited_by_count",
  ),
  page: { type: "number", minimum: 1, description: "Page number" },
  cursor: {
    type: "string",
    description: "Cursor pagination token, or * to start deep pagination",
  },
  per_page: {
    type: "number",
    minimum: 1,
    maximum: 100,
    description: "Results per page, maximum 100",
  },
  sample: {
    type: "number",
    minimum: 1,
    maximum: 10000,
    description: "Random sample size, maximum 10000",
  },
  seed: {
    anyOf: [{ type: "string" }, { type: "number" }],
    description: "Optional sample seed",
  },
};

async function handleGetEntity(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const entityType = requireString(args, "entity_type");
  if (!isEntityType(entityType)) {
    throw new Error(`Unsupported entity_type "${entityType}"`);
  }

  const id = requireString(args, "id");
  const select = optionalDelimitedInput(args, "select");

  if (supportsSingleton(entityType)) {
    const response = await context.client.getJson(
      `${entityPath(entityType)}/${encodeURIComponent(id)}`,
      { select: select as QueryRecord["select"] },
    );
    return buildSuccessResult("openalex_get_entity", response);
  }

  const response = await context.client.getJson(entityPath(entityType), {
    filter: `id:${id}`,
    select: select as QueryRecord["select"],
    per_page: 1,
  });
  const results =
    response.data &&
    typeof response.data === "object" &&
    Array.isArray((response.data as Record<string, unknown>).results)
      ? ((response.data as Record<string, unknown>).results as unknown[])
      : [];

  if (results.length === 0) {
    throw new Error(`No ${entityType} record matched id "${id}"`);
  }

  return buildSuccessResult(
    "openalex_get_entity",
    {
      ...response,
      data: results[0],
    },
    "This entity type does not have a singleton endpoint, so the MCP emulated it with filter=id:<value> and per_page=1.",
  );
}

async function handleListEntities(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const entityType = requireString(args, "entity_type");
  if (!isEntityType(entityType)) {
    throw new Error(`Unsupported entity_type "${entityType}"`);
  }
  const response = await context.client.getJson(
    entityPath(entityType),
    listArgsToQuery(parseCommonListArgs(args)),
  );
  return buildSuccessResult("openalex_list_entities", response);
}

async function handleSearchWorks(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const commonArgs = parseCommonListArgs(args);
  if (!commonArgs.search) {
    throw new Error('"search" is required for openalex_search_works');
  }
  const response = await context.client.getJson(
    "/works",
    listArgsToQuery(commonArgs),
  );
  return buildSuccessResult("openalex_search_works", response);
}

async function handleCitingWorks(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const workId = normalizeWorkIdForFilter(requireString(args, "work_id"));
  const commonArgs = parseCommonListArgs(args);
  commonArgs.filter = mergeFilters(commonArgs.filter, `cites:${workId}`);

  const response = await context.client.getJson(
    "/works",
    listArgsToQuery(commonArgs),
  );
  return buildSuccessResult("openalex_get_citing_works", response);
}

async function handleReferencedWorks(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const workId = normalizeWorkIdForFilter(requireString(args, "work_id"));
  const commonArgs = parseCommonListArgs(args);
  commonArgs.filter = mergeFilters(
    commonArgs.filter,
    `referenced_works:${workId}`,
  );

  const response = await context.client.getJson(
    "/works",
    listArgsToQuery(commonArgs),
  );
  return buildSuccessResult("openalex_get_referenced_works", response);
}

async function handleAutocomplete(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const entityType = requireString(args, "entity_type");
  if (!isAutocompleteEntityType(entityType)) {
    throw new Error(`Unsupported autocomplete entity_type "${entityType}"`);
  }

  const q = requireString(args, "q");
  const filter = optionalFilterInput(args, "filter");
  const response = await context.client.getJson(
    `/autocomplete/${entityType}`,
    {
      q,
      filter: filter as QueryRecord["filter"],
    },
  );
  return buildSuccessResult("openalex_autocomplete", response);
}

async function handleRateLimit(
  _args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const response = await context.client.getJson(
    "/rate-limit",
    {},
    { requiresApiKey: true },
  );
  return buildSuccessResult("openalex_rate_limit_status", response);
}

async function handleListChangefiles(
  _args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const response = await context.client.getJson("/changefiles");
  return buildSuccessResult("openalex_list_changefile_dates", response);
}

async function handleGetChangefile(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const date = requireString(args, "date");
  const response = await context.client.getJson(
    `/changefiles/${encodeURIComponent(date)}`,
  );
  return buildSuccessResult("openalex_get_changefile", response);
}

async function handleClassifyText(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const title = optionalString(args, "title");
  const abstract = optionalString(args, "abstract");

  if (!title && !abstract) {
    throw new Error('At least one of "title" or "abstract" is required');
  }
  const combinedLength = (title?.length ?? 0) + (abstract?.length ?? 0);
  if (combinedLength < 20) {
    throw new Error(
      "The combined length of title and abstract must be at least 20 characters",
    );
  }

  const response = await context.client.getJson("/text/topics", {
    title,
    abstract,
  });
  return buildSuccessResult(
    "openalex_classify_text",
    response,
    "This endpoint is deprecated in the official OpenAlex spec and may change without notice.",
  );
}

function toRawQuery(
  args: Record<string, unknown>,
): QueryRecord | undefined {
  const query = args.query;
  if (query === undefined) {
    return undefined;
  }
  if (!isPlainObject(query)) {
    throw new Error('"query" must be an object');
  }
  return query as QueryRecord;
}

async function handleRawRequest(
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const rawPath = requireString(args, "path");
  if (!rawPath.startsWith("/")) {
    throw new Error('"path" must start with "/"');
  }

  const response = await context.client.getJson(rawPath, toRawQuery(args));
  return buildSuccessResult(
    "openalex_raw_request",
    response,
    "Use this tool when OpenAlex adds a new endpoint or query parameter before the dedicated MCP tool surface is updated.",
  );
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "openalex_get_entity",
    description:
      "Get a single OpenAlex entity by ID. Supports all public entity types; list-only entity types are emulated with filter=id:<value>.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: [...ENTITY_TYPES],
          description: "OpenAlex entity type",
        },
        id: {
          type: "string",
          description:
            "OpenAlex ID or external ID, for example W2741809807 or doi:10.1234/example",
        },
        select: stringOrStringArraySchema("Fields to select"),
      },
      required: ["entity_type", "id"],
    },
    handler: handleGetEntity,
  },
  {
    name: "openalex_list_entities",
    description:
      "List any OpenAlex entity type with filters, search, sort, group_by, field selection, sampling, and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: [...ENTITY_TYPES],
          description: "OpenAlex entity type",
        },
        ...commonListSchemaProperties,
      },
      required: ["entity_type"],
    },
    handler: handleListEntities,
  },
  {
    name: "openalex_search_works",
    description:
      "Search works via OpenAlex full-text search, optionally combined with filters, sort, selection, and pagination.",
    inputSchema: {
      type: "object",
      properties: {
        ...commonListSchemaProperties,
      },
      required: ["search"],
    },
    handler: handleSearchWorks,
  },
  {
    name: "openalex_get_citing_works",
    description:
      "List works that cite a given work. Internally uses filter=cites:<work_id> and accepts all normal works list options.",
    inputSchema: {
      type: "object",
      properties: {
        work_id: {
          type: "string",
          description:
            "OpenAlex work ID or full OpenAlex work URL, for example W2741809807",
        },
        ...commonListSchemaProperties,
      },
      required: ["work_id"],
    },
    handler: handleCitingWorks,
  },
  {
    name: "openalex_get_referenced_works",
    description:
      "List works referenced by a given work. Internally uses filter=referenced_works:<work_id> and accepts all normal works list options.",
    inputSchema: {
      type: "object",
      properties: {
        work_id: {
          type: "string",
          description:
            "OpenAlex work ID or full OpenAlex work URL, for example W2741809807",
        },
        ...commonListSchemaProperties,
      },
      required: ["work_id"],
    },
    handler: handleReferencedWorks,
  },
  {
    name: "openalex_autocomplete",
    description:
      "Run OpenAlex autocomplete for supported entity types. Returns fast typeahead-style matches.",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: [...AUTOCOMPLETE_ENTITY_TYPES],
          description: "Autocomplete-supported entity type",
        },
        q: {
          type: "string",
          description: "Autocomplete query string",
        },
        filter: filterSchema,
      },
      required: ["entity_type", "q"],
    },
    handler: handleAutocomplete,
  },
  {
    name: "openalex_rate_limit_status",
    description:
      "Get current OpenAlex rate-limit status. Requires OPENALEX_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: handleRateLimit,
  },
  {
    name: "openalex_list_changefile_dates",
    description: "List available OpenAlex changefile dates.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: handleListChangefiles,
  },
  {
    name: "openalex_get_changefile",
    description:
      "Get changefile metadata and download links for one YYYY-MM-DD date.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Changefile date in YYYY-MM-DD format",
        },
      },
      required: ["date"],
    },
    handler: handleGetChangefile,
  },
  {
    name: "openalex_classify_text",
    description:
      "Classify text into OpenAlex topics via /text/topics. The endpoint is officially deprecated, but still exposed here because it remains in the public API.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title text to classify",
        },
        abstract: {
          type: "string",
          description: "Abstract text to classify",
        },
      },
    },
    handler: handleClassifyText,
  },
  {
    name: "openalex_raw_request",
    description:
      "Raw GET access to any OpenAlex endpoint path with arbitrary query parameters. Use this as a future-proof escape hatch.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Absolute OpenAlex API path, for example "/works" or "/rate-limit"',
        },
        query: {
          type: "object",
          additionalProperties: true,
          description:
            "Raw query object. filter may still be passed as a string or structured object.",
        },
      },
      required: ["path"],
    },
    handler: handleRawRequest,
  },
];

export async function handleToolCall(
  name: string,
  rawArgs: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = toolDefinitions.find((candidate) => candidate.name === name);
  if (!tool) {
    return buildErrorResult(name, new Error(`Unknown tool "${name}"`));
  }

  try {
    const args = requireObject(rawArgs ?? {});
    return await tool.handler(args, context);
  } catch (error) {
    return buildErrorResult(name, error);
  }
}
