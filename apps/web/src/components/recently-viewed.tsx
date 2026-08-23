"use client";

import { useEffect } from "react";

const COOKIE = "sjh_recently_viewed";
const MAX = 8;

function readSlugs(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as unknown;
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function trackRecentlyViewed(slug: string, title: string): void {
  const existing = readSlugs().filter((s) => s !== slug);
  const next = [{ slug, title }, ...existing.map((s) => ({ slug: s, title: s }))].slice(0, MAX);
  const payload = encodeURIComponent(JSON.stringify(next.map((e) => e.slug)));
  document.cookie = `${COOKIE}=${payload}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function RecentlyViewedTracker({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    trackRecentlyViewed(slug, title);
  }, [slug, title]);
  return null;
}

export function getRecentlyViewedSlugs(): string[] {
  return readSlugs();
}
