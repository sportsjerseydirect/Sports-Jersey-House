# Related-links map brief

**Status:** Rules locked. Map not started. Theme work paused.  
**Owner:** Maya drafts the map. Akshay green-lights going live.  
**Date:** 1 Oct 2026

Collection pages will get a related-links block (heading plus a short list of text links, grouped by league or sport). The block exists to strengthen internal linking. It ships only after this map is filled with live targets and approved.

## Rule for every link

A row is allowed only when all four are true:

1. **Anchor matches the host collection.** The visible text is a keyword people search for that page’s intent: team, league, player, or apparel type (for example “NFL hoodies” on an NFL collection, “Shohei Ohtani jerseys” on an MLB collection).
2. **Search demand is real and cited.** The keyword is high search volume for that topic. Record the source and figure (Ahrefs search volume, or Google Search Console impressions). If there is no volume source, leave the row out.
3. **Target is a live SJH collection.** `href` is `/collections/{slug}` for a collection that already exists, is published, and is merchandised for customers. Prefer collections that actually list products.
4. **One intent per page.** Links on a collection stay inside that collection’s sport, league, team, or apparel intent.

## Leave out

- Anchors copied from another store that we do not sell.
- Targets that are empty shells, internal export buckets, or AI description collections.
- New URLs created only so a keyword has somewhere to point.
- Cross-sport stuffing (MLB card terms on an NFL jersey page, and the reverse).

## Map shape

Group by league or sport. One section per host collection:

| Field | What to record |
| --- | --- |
| Host | Collection title and slug |
| Anchor | Exact link text |
| Target | Published `/collections/{slug}` |
| Why it fits | One line on how the keyword matches that page |
| Demand | Source, metric, and date checked |

League hubs already in the storefront: `nfl`, `nba`, `nhl`, `mlb`, `soccer`, `ncaa` (`packages/shared/src/league-collections.ts`). Use those only when the published page is a real customer collection. Add team and apparel collections the same way, from the live catalogue, not from a keyword list.

## Not in this step

Storefront markup stays unchanged until the map is reviewed and Akshay approves going live. Anchor copy that is generated for publish still follows draft, then review, then published.
