/** Cap static paths generated at build time; remaining slugs render on first request. */
export function staticPrerenderLimit(): number | undefined {
  const raw = process.env.STATIC_PRERENDER_LIMIT;

  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/** Build-time slug fetch that never fails the build if the database is unreachable. */
export async function safeStaticSlugs(
  fetchSlugs: (limit?: number) => Promise<string[]>
): Promise<Array<{ slug: string }>> {
  try {
    const slugs = await fetchSlugs(staticPrerenderLimit());
    return slugs.map((slug) => ({ slug }));
  } catch (error) {
    console.warn(
      "[isr] Skipping static params — catalogue unavailable:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
