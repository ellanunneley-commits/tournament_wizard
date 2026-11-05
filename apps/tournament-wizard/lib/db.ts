import { neon, types } from "@neondatabase/serverless";
import type { Sql } from "./ctx";

types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.DATE, (v) => v);

// The database connection for one request. In production this is Neon over HTTP.
// The local dev server passes its own connection (a plain Postgres) as env.LOCAL_SQL.
export function db(c: { env: { DATABASE_URL: string; LOCAL_SQL?: Sql } }): Sql {
	return c.env.LOCAL_SQL ?? neon(c.env.DATABASE_URL);
}
