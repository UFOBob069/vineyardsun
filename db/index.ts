import { neon } from "@neondatabase/serverless";

let database: ReturnType<typeof neon> | undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  database ??= neon(connectionString);
  return database;
}
