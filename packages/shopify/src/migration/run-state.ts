import {
  createDatabaseClient,
  fromExtractionCheckpoint,
  migrationCheckpoints,
  migrationRuns,
  toExtractionCheckpoint
} from "@sjh/database";
import { eq } from "drizzle-orm";
import type { ExtractionCheckpoint, MigrationResource } from "@sjh/shared";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function createMigrationRun(db: DatabaseClient): Promise<string> {
  const [run] = await db
    .insert(migrationRuns)
    .values({
      source: "shopify",
      status: "pending"
    })
    .returning({ id: migrationRuns.id });

  if (!run) {
    throw new Error("Failed to create migration run.");
  }

  return run.id;
}

export async function getOrCreateCheckpoint(db: DatabaseClient, runId: string, resource: MigrationResource) {
  const existing = await db
    .select()
    .from(migrationCheckpoints)
    .where(eq(migrationCheckpoints.runId, runId));

  const checkpoint = existing.find((row) => row.resource === resource);

  if (checkpoint) {
    return checkpoint;
  }

  const [created] = await db
    .insert(migrationCheckpoints)
    .values({
      runId,
      resource,
      cursor: null,
      completed: false,
      payload: { importedCount: 0 }
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create migration checkpoint.");
  }

  return created;
}

export async function saveCheckpoint(
  db: DatabaseClient,
  runId: string,
  checkpoint: ExtractionCheckpoint
): Promise<void> {
  const payload = fromExtractionCheckpoint(checkpoint);

  await db
    .insert(migrationCheckpoints)
    .values({
      runId,
      resource: payload.resource,
      cursor: payload.cursor,
      completed: payload.completed,
      payload: payload.payload
    })
    .onConflictDoUpdate({
      target: [migrationCheckpoints.runId, migrationCheckpoints.resource],
      set: {
        cursor: payload.cursor,
        completed: payload.completed,
        payload: payload.payload,
        updatedAt: new Date()
      }
    });
}

export async function markRunProgress(
  db: DatabaseClient,
  runId: string,
  checkpoint: ExtractionCheckpoint,
  counters: Record<string, number>
): Promise<void> {
  await db
    .update(migrationRuns)
    .set({
      status: checkpoint.completed ? "completed" : "running",
      finishedAt: checkpoint.completed ? new Date() : null,
      lastCheckpoint: checkpoint,
      counters,
      updatedAt: new Date()
    })
    .where(eq(migrationRuns.id, runId));
}

export { toExtractionCheckpoint };