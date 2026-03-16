import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

config({ path: ".env" }); // or .env.local

// Declare a global variable to store the client
declare global {
  var pgClient: ReturnType<typeof postgres> | undefined;
}

// Reuse the client in development to avoid exhausting the connection pool
const client = global.pgClient || postgres(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  global.pgClient = client;
}

export const db = drizzle({ client, schema });
