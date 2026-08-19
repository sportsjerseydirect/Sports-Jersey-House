import type { SearchFilters } from "@sjh/search";

export type CatalogueFilterParams = {
  q?: string | undefined;
  league?: string | undefined;
  sport?: string | undefined;
};

export type CatalogueBrowsePath = "/products" | "/search";

export function parseCatalogueFilters(params: CatalogueFilterParams): SearchFilters {
  const filters: SearchFilters = {};

  if (params.league) {
    filters.league = splitFilterValues(params.league);
  }

  if (params.sport) {
    filters.sport = splitFilterValues(params.sport);
  }

  return filters;
}

export function buildCatalogueHref(
  path: CatalogueBrowsePath,
  params: CatalogueFilterParams
): string {
  const searchParams = new URLSearchParams();

  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.league) {
    searchParams.set("league", params.league);
  }

  if (params.sport) {
    searchParams.set("sport", params.sport);
  }

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export function toggleCatalogueFilter(
  path: CatalogueBrowsePath,
  params: CatalogueFilterParams,
  field: "league" | "sport",
  value: string
): string {
  const currentValues = splitFilterValues(params[field] ?? "");
  const isActive = currentValues.includes(value);
  const nextValues = isActive
    ? currentValues.filter((entry) => entry !== value)
    : [...currentValues, value];

  return buildCatalogueHref(path, {
    ...params,
    [field]: nextValues.length > 0 ? nextValues.join(",") : undefined
  });
}

function splitFilterValues(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
