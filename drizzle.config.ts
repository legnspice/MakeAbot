import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

// drizzle-kit's schema introspection needs a SESSION-mode connection.
// Supabase's transaction pooler (port 6543) hangs on introspection, so use the
// session pooler / direct connection (port 5432). Prefer an explicit DIRECT_URL.
const migrationUrl =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL!.replace(":6543", ":5432");

export default defineConfig({
  schema: "./lib/db/*",
  schemaFilter: ["public"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  introspect: {
    casing: "preserve",
  },
});
