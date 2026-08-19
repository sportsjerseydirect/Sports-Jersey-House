import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://sjh:sjh@localhost:5432/sports_jersey_house"
  },
  strict: true,
  verbose: true
});
