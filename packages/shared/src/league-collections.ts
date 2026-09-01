/** Short URL slugs customers expect — resolved via products.league when no collection row exists. */
export const LEAGUE_COLLECTION_SLUGS: Record<
  string,
  { id: string; title: string; league: string; description?: string }
> = {
  nfl: {
    id: "a1000001-0001-4001-8001-000000000001",
    title: "NFL Jerseys",
    league: "NFL",
    description: "National Football League team jerseys."
  },
  nba: {
    id: "a1000001-0001-4001-8001-000000000002",
    title: "NBA Jerseys",
    league: "NBA",
    description: "National Basketball Association team jerseys."
  },
  nhl: {
    id: "a1000001-0001-4001-8001-000000000003",
    title: "NHL Jerseys",
    league: "NHL",
    description: "National Hockey League team jerseys."
  },
  mlb: {
    id: "a1000001-0001-4001-8001-000000000004",
    title: "MLB Jerseys",
    league: "MLB",
    description: "Major League Baseball team jerseys."
  },
  ncaa: {
    id: "a1000001-0001-4001-8001-000000000005",
    title: "NCAA Jerseys",
    league: "NCAA",
    description: "College football, basketball, and hockey jerseys."
  },
  soccer: {
    id: "a1000001-0001-4001-8001-000000000006",
    title: "Soccer Jerseys",
    league: "Soccer",
    description: "Club and international football jerseys."
  }
};

export const LEAGUE_BROWSE_SLUGS = ["nfl", "nba", "nhl", "mlb", "soccer", "ncaa"] as const;
