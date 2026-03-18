export const SINGLETON_ENTITY_TYPES = [
  "works",
  "authors",
  "sources",
  "institutions",
  "topics",
  "keywords",
  "publishers",
  "funders",
  "domains",
  "fields",
  "subfields",
  "sdgs",
  "countries",
  "continents",
  "languages",
  "awards",
  "concepts",
] as const;

export const LIST_ONLY_ENTITY_TYPES = [
  "work-types",
  "source-types",
  "institution-types",
  "licenses",
] as const;

export const AUTOCOMPLETE_ENTITY_TYPES = [
  "works",
  "authors",
  "sources",
  "institutions",
  "topics",
  "keywords",
  "publishers",
  "funders",
] as const;

export const ENTITY_TYPES = [
  ...SINGLETON_ENTITY_TYPES,
  ...LIST_ONLY_ENTITY_TYPES,
] as const;

export type SingletonEntityType = (typeof SINGLETON_ENTITY_TYPES)[number];
export type ListOnlyEntityType = (typeof LIST_ONLY_ENTITY_TYPES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];
export type AutocompleteEntityType = (typeof AUTOCOMPLETE_ENTITY_TYPES)[number];

const entityTypeSet = new Set<string>(ENTITY_TYPES);
const singletonTypeSet = new Set<string>(SINGLETON_ENTITY_TYPES);
const autocompleteTypeSet = new Set<string>(AUTOCOMPLETE_ENTITY_TYPES);

export function isEntityType(value: unknown): value is EntityType {
  return typeof value === "string" && entityTypeSet.has(value);
}

export function isAutocompleteEntityType(
  value: unknown,
): value is AutocompleteEntityType {
  return typeof value === "string" && autocompleteTypeSet.has(value);
}

export function supportsSingleton(entityType: EntityType): boolean {
  return singletonTypeSet.has(entityType);
}

export function entityPath(entityType: EntityType): string {
  return `/${entityType}`;
}
