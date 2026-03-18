import type { FilterInput, FilterOperator, FilterRecord, Scalar } from "./types.js";

const FILTER_OPERATOR_KEYS = [
  "value",
  "or",
  "values",
  "not",
  "gt",
  "gte",
  "lt",
  "lte",
  "range",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function serializeScalar(value: Scalar): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function serializeScalarList(values: readonly Scalar[]): string {
  return values.map((value) => serializeScalar(value)).join("|");
}

function serializeOperator(field: string, operator: FilterOperator): string {
  const plain = operator as Record<string, unknown>;
  const operatorRecord = operator as Partial<
    Record<(typeof FILTER_OPERATOR_KEYS)[number], unknown>
  >;
  const presentKeys = FILTER_OPERATOR_KEYS.filter(
    (key) => plain[key] !== undefined,
  );

  if (presentKeys.length === 0) {
    throw new Error(`Filter operator for "${field}" is empty`);
  }
  if (presentKeys.length > 1) {
    throw new Error(
      `Filter operator for "${field}" must use exactly one operator key`,
    );
  }

  const [key] = presentKeys;

  switch (key) {
    case "value":
      return `${field}:${serializeScalar(operatorRecord.value as Scalar)}`;
    case "or":
      return `${field}:${serializeScalarList(operatorRecord.or as Scalar[])}`;
    case "values":
      return `${field}:${serializeScalarList(
        operatorRecord.values as Scalar[],
      )}`;
    case "not": {
      const notValue = operatorRecord.not as Scalar | Scalar[];
      const value = Array.isArray(notValue)
        ? serializeScalarList(notValue)
        : serializeScalar(notValue);
      return `${field}:!${value}`;
    }
    case "gt":
      return `${field}:>${serializeScalar(operatorRecord.gt as Scalar)}`;
    case "gte":
      return `${field}:>=${serializeScalar(operatorRecord.gte as Scalar)}`;
    case "lt":
      return `${field}:<${serializeScalar(operatorRecord.lt as Scalar)}`;
    case "lte":
      return `${field}:<=${serializeScalar(operatorRecord.lte as Scalar)}`;
    case "range":
      return `${field}:${serializeScalar(
        (operatorRecord.range as [Scalar, Scalar])[0],
      )}-${serializeScalar(
        (operatorRecord.range as [Scalar, Scalar])[1],
      )}`;
    default:
      throw new Error(`Unsupported filter operator "${key}" for "${field}"`);
  }
}

function serializeFieldValue(
  field: string,
  value: FilterRecord[string],
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return `${field}:${serializeScalarList(value)}`;
  }

  if (isPlainObject(value)) {
    return serializeOperator(field, value as FilterOperator);
  }

  return `${field}:${serializeScalar(value)}`;
}

export function serializeFilter(filter: FilterInput): string | undefined {
  if (filter === undefined) {
    return undefined;
  }

  if (typeof filter === "string") {
    const trimmed = filter.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  const parts = Object.entries(filter)
    .map(([field, value]) => serializeFieldValue(field, value))
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(",") : undefined;
}

export function mergeFilters(...filters: FilterInput[]): string | undefined {
  const parts = filters
    .map((filter) => serializeFilter(filter))
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(",") : undefined;
}
