import { defineConfig } from "drizzle-kit";
import path from "path";

const url = process.env.DATABASE_URL ?? "postgresql://dummy:dummy@localhost:5432/dummy";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  out: path.join(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: { url },
});
