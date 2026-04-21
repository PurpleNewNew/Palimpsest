import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/**/*.sql.ts",
  out: "./migration",
  dbCredentials: {
    url: process.env["PALIMPSEST_DB_PATH"] || "/home/thdxr/.local/share/palimpsest/palimpsest.db",
  },
})
