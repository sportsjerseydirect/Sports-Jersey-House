import { createSearchProvider } from "@sjh/search";

export function getSearchProvider() {
  return createSearchProvider({
    databaseUrl: process.env.DATABASE_URL
  });
}
