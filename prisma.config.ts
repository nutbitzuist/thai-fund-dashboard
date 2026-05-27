// prisma.config.ts
// Prisma 7 configuration — connection URLs moved here from schema.prisma
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
