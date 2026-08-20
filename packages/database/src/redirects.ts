import { and, eq } from "drizzle-orm";
import { createDatabaseClient, redirects } from "./index";

export type RedirectMatch = {
  toPath: string;
  statusCode: number;
};

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required for redirect lookups.");
  }

  return url;
}

/** Normalize request pathnames for redirect matching. */
export function normalizeRedirectPath(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return `/${pathname}`;
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export async function findActiveRedirect(
  fromPath: string,
  databaseUrl?: string
): Promise<RedirectMatch | null> {
  const normalized = normalizeRedirectPath(fromPath);

  if (normalized === "/" || normalized.startsWith("/api/") || normalized.startsWith("/_next/")) {
    return null;
  }

  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));

  try {
    const [row] = await db
      .select({
        toPath: redirects.toPath,
        statusCode: redirects.statusCode
      })
      .from(redirects)
      .where(and(eq(redirects.fromPath, normalized), eq(redirects.isActive, true)))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      toPath: row.toPath,
      statusCode: row.statusCode
    };
  } finally {
    // postgres-js clients from createDatabaseClient are short-lived per call elsewhere;
    // cart.ts leaves them open — match that pattern (pooler handles cleanup).
  }
}
