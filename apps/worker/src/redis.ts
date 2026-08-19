import type { ConnectionOptions } from "bullmq";

export function resolveRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required to start background workers.");
  }

  return redisUrl;
}

export function createRedisConnectionOptions(redisUrl = resolveRedisUrl()): ConnectionOptions {
  const parsed = new URL(redisUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    ...(parsed.password ? { password: parsed.password } : {}),
    maxRetriesPerRequest: null
  };
}
