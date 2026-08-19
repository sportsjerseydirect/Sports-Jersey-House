/** Cap static paths generated at build time; remaining slugs render on first request. */
export function staticPrerenderLimit(): number | undefined {
  const raw = process.env.STATIC_PRERENDER_LIMIT;

  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
