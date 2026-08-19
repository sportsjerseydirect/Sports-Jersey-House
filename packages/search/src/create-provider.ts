import { EmptySearchProvider, type SearchProvider } from "./index";
import { createPostgresSearchProvider } from "./postgres-provider";

export type SearchProviderOptions = {
  databaseUrl?: string | undefined;
};

export function createSearchProvider(options: SearchProviderOptions = {}): SearchProvider {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    return new EmptySearchProvider();
  }

  return createPostgresSearchProvider(databaseUrl);
}
