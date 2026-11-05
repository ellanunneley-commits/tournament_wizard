import pg from "pg";

// A stand-in for Neon's `sql` tag that talks to a local Postgres, so the app can run on your own computer.
// Only used by `npm run dev`; production uses Neon.
pg.types.setTypeParser(1700, (v) => Number(v)); // NUMERIC
pg.types.setTypeParser(1082, (v) => v); // DATE

type Query = { text: string; values: unknown[] };

export function localSql(url: string) {
	const pool = new pg.Pool({ connectionString: url });
	const build = (strings: TemplateStringsArray, values: unknown[]): Query => {
		let text = strings[0];
		values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
		return { text, values };
	};
	const sql: any = (strings: TemplateStringsArray, ...values: unknown[]) => {
		const q = build(strings, values);
		let promise: Promise<any[]> | null = null;
		const run = () => (promise ??= pool.query(q.text, q.values as any[]).then((r) => r.rows));
		return { query: q, then: (ok: any, bad: any) => run().then(ok, bad), catch: (bad: any) => run().catch(bad) };
	};
	// Like Neon's sql.transaction([...]): run the queries one after another, all or nothing.
	sql.transaction = async (queries: { query: Query }[]) => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const out: any[][] = [];
			for (const q of queries) out.push((await client.query(q.query.text, q.query.values as any[])).rows);
			await client.query("COMMIT");
			return out;
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	};
	return sql;
}
