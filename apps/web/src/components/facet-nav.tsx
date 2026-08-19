import Link from "next/link";
import type { Route } from "next";
import type { SearchFacet } from "@sjh/search";
import {
  buildCatalogueHref,
  type CatalogueBrowsePath,
  type CatalogueFilterParams,
  toggleCatalogueFilter
} from "@/lib/filters";

type FacetNavProps = {
  path: CatalogueBrowsePath;
  params: CatalogueFilterParams;
  facets: SearchFacet[];
};

export function FacetNav({ path, params, facets }: FacetNavProps) {
  const sportFacets = facets.filter((facet) => facet.field === "sport");
  const leagueFacets = facets.filter((facet) => facet.field === "league");

  if (sportFacets.length === 0 && leagueFacets.length === 0) {
    return null;
  }

  const activeSports = new Set((params.sport ?? "").split(",").filter(Boolean));
  const activeLeagues = new Set((params.league ?? "").split(",").filter(Boolean));
  const hasActiveFilters = activeSports.size > 0 || activeLeagues.size > 0;

  return (
    <nav aria-label="Catalogue filters" className="facet-nav">
      {sportFacets.length > 0 ? (
        <div className="facet-group">
          <h2>Sport</h2>
          <ul>
            {sportFacets.map((facet) => (
              <li key={`sport-${facet.value}`}>
                <Link
                  aria-current={activeSports.has(facet.value) ? "true" : undefined}
                  className={activeSports.has(facet.value) ? "facet-link is-active" : "facet-link"}
                  href={toggleCatalogueFilter(path, params, "sport", facet.value) as Route}
                >
                  {facet.value} ({facet.count})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {leagueFacets.length > 0 ? (
        <div className="facet-group">
          <h2>League</h2>
          <ul>
            {leagueFacets.map((facet) => (
              <li key={`league-${facet.value}`}>
                <Link
                  aria-current={activeLeagues.has(facet.value) ? "true" : undefined}
                  className={activeLeagues.has(facet.value) ? "facet-link is-active" : "facet-link"}
                  href={toggleCatalogueFilter(path, params, "league", facet.value) as Route}
                >
                  {facet.value} ({facet.count})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasActiveFilters ? (
        <Link className="facet-clear" href={buildCatalogueHref(path, { q: params.q }) as Route}>
          Clear filters
        </Link>
      ) : null}
    </nav>
  );
}
