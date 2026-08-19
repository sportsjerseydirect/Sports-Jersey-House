export const DEV_COLLECTIONS_SEED_TAG = "dev-collections-v1";

export type DevCollection = {
  slug: string;
  title: string;
  description: string;
  league: string;
};

/** Fake development collections — linked to seeded products by league. */
export const devCollections: DevCollection[] = [
  {
    slug: "nfl-jerseys",
    title: "NFL Jerseys",
    description: "Development collection for National Football League jerseys in the local dev catalogue.",
    league: "NFL"
  },
  {
    slug: "nba-jerseys",
    title: "NBA Jerseys",
    description: "Development collection for National Basketball Association jerseys.",
    league: "NBA"
  },
  {
    slug: "nhl-jerseys",
    title: "NHL Jerseys",
    description: "Development collection for National Hockey League jerseys.",
    league: "NHL"
  }
];
