import {
  extractionCheckpointSchema,
  migrationCheckpointPayloadSchema,
  type ExtractionCheckpoint,
  type MigrationCheckpointPayload
} from "@sjh/shared";
import type { MigrationCheckpoint } from "./index";

export function parseMigrationCheckpointPayload(payload: unknown): MigrationCheckpointPayload {
  return migrationCheckpointPayloadSchema.parse(payload ?? {});
}

export function toExtractionCheckpoint(
  row: Pick<MigrationCheckpoint, "resource" | "cursor" | "completed" | "payload">
): ExtractionCheckpoint {
  const payload = parseMigrationCheckpointPayload(row.payload);

  return extractionCheckpointSchema.parse({
    resource: row.resource,
    cursor: row.cursor,
    completed: row.completed,
    importedCount: payload.importedCount
  });
}

export function fromExtractionCheckpoint(checkpoint: ExtractionCheckpoint): {
  resource: ExtractionCheckpoint["resource"];
  cursor: string | null;
  completed: boolean;
  payload: MigrationCheckpointPayload;
} {
  return {
    resource: checkpoint.resource,
    cursor: checkpoint.cursor,
    completed: checkpoint.completed,
    payload: { importedCount: checkpoint.importedCount }
  };
}
