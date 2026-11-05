import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// While developing, answer /app-api requests with the real server code, using a local Postgres.
function localApi(): Plugin {
	return {
		name: "local-api",
		apply: "serve",
		configureServer(server) {
			const env = loadEnv("development", process.cwd(), "");
			server.middlewares.use(async (req, res, next) => {
				if (!req.url?.startsWith("/app-api/")) return next();
				try {
					const { getRequestListener } = await import("@hono/node-server");
					const { localSql } = await server.ssrLoadModule(path.resolve("dev/local-sql.ts"));
					const app = (await server.ssrLoadModule(path.resolve("apps/tournament-wizard/server.ts"))).default;
					const bindings = {
						DATABASE_URL: env.DATABASE_URL,
						LOCAL_SQL: (globalThis as any).__twSql ??= localSql(env.DATABASE_URL),
						DEV_AUTH: env.CLERK_SECRET_KEY ? undefined : "1",
						CLERK_SECRET_KEY: env.CLERK_SECRET_KEY || undefined,
					};
					await getRequestListener((request) => app.fetch(request, bindings))(req, res);
				} catch (err) {
					console.error(err);
					res.statusCode = 500;
					res.end(JSON.stringify({ error: String(err) }));
				}
			});
		},
	};
}

export default defineConfig({
	root: "apps/tournament-wizard/client",
	envDir: process.cwd(),
	plugins: [react(), tailwindcss(), localApi()],
	build: { outDir: "../../../dist", emptyOutDir: true },
});
