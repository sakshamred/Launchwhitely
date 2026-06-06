import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI uses DIRECT_URL (non-pooled). Prisma Client at runtime uses
// DATABASE_URL (pooled via Supavisor) — see src/db/client.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
