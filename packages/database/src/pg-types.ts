import { customType } from "drizzle-orm/pg-core";

/** pgvector column — dimensions match `0000_foundation.sql`. */
export const embeddingVector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  }
});
