import { config } from "dotenv";
config();
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

// Create the enum type if it doesn't already exist
await sql`
  DO $$ BEGIN
    CREATE TYPE "type" AS ENUM ('Item', 'Service', 'Unknown');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`;
console.log("type enum: ready");

// Add type column to requests — single statement so DEFAULT fills existing rows before NOT NULL is enforced
await sql`
  ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS "type" "type" NOT NULL DEFAULT 'Unknown'
`;
console.log("requests.type: added");

// Add type column to posts — same approach
await sql`
  ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS "type" "type" NOT NULL DEFAULT 'Unknown'
`;
console.log("posts.type: added");

// Add description column to users (nullable — no backfill needed)
await sql`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "description" text
`;
console.log("users.description: added");

await sql.end();
console.log("\nDone. Run pnpm drizzle-kit push to sync the rest.");
