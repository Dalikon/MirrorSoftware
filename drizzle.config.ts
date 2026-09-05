import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./js/db/schema.ts",
	out: "./js/db/migrations",
	dialect: "sqlite",
	dbCredentials: {
		url: "./workData/mirror.db",
	},
});
