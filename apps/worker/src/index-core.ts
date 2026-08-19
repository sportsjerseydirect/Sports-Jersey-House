export const queueNames = [
  "shopify:extract",
  "shopify:transform",
  "ai:product-seo",
  "ai:collection-seo",
  "ai:compliance",
  "creative:generate",
  "creative:compliance",
  "search:index",
  "search:embed",
  "seo:technical-audit"
] as const;

export type QueueName = (typeof queueNames)[number];

export type JobEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  idempotencyKey: string;
  queue: QueueName;
  payload: TPayload;
  requestedBy: "system" | "admin" | "migration";
};

export function createJobEnvelope<TPayload extends Record<string, unknown>>(
  queue: QueueName,
  payload: TPayload,
  requestedBy: JobEnvelope["requestedBy"] = "system"
): JobEnvelope<TPayload> {
  return {
    idempotencyKey: `${queue}:${JSON.stringify(payload)}`,
    queue,
    payload,
    requestedBy
  };
}
