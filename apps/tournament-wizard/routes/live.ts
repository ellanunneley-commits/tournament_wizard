import { Hono } from "hono";
import { Env, Row, forbidden } from "../lib/ctx";
import { advance } from "../lib/bracket";
import { canScoreMatch, captainTeamIds, recompute, setIsOver, setTarget } from "../lib/scoring";
import { announceNext, retireAnnouncements } from "../lib/autoannounce";

const P = "/app-api/t/:tid";

// Live scoring: a ref taps points one by one, ends each set, and the match finishes by itself when a team has won enough sets.
export function liveRoutes(app: Hono<Env>) {
	// Load the match and make sure this person may score it.
	async function scorable(c: any): Promise<{ error?: any; m?: Row }> {
		const { sql, tid, v } = c.var;
		const [m] = (await sql`SELECT * FROM matches WHERE id = ${Number(c.req.param("id"))} AND tournament_id = ${tid}`) as Row[];
		if (!m) return { error: c.json({ error: "Match not found" }, 404) };
		if (!canScoreMatch(v, await captainTeamIds(sql, v, tid), m)) return { error: forbidden(c) };
		return { m };
	}
	const currentSet = async (sql: any, matchId: number) =>
		((await sql`SELECT * FROM match_sets WHERE match_id = ${matchId} AND NOT finished ORDER BY set_number LIMIT 1`) as Row[])[0];

	app.post(`${P}/matches/:id/start`, async (c) => {
		const r = await scorable(c);
		if (r.error) return r.error;
		const { sql } = c.var;
		const m = r.m!;
		if (m.status !== "scheduled") return c.json({ error: "This match has already started" }, 400);
		if (!m.team_a_id || !m.team_b_id) return c.json({ error: "Both teams must be known before the match can start" }, 400);
		await sql`INSERT INTO match_sets (match_id, set_number) VALUES (${m.id}, 1) ON CONFLICT (match_id, set_number) DO NOTHING`;
		await sql`UPDATE matches SET status = 'live', started_at = NOW(), ended_at = NULL, updated_at = NOW() WHERE id = ${m.id}`;
		await retireAnnouncements(sql, Number(m.id));
		await recompute(sql, Number(m.id));
		return c.json({ ok: true });
	});

	// +1 or -1 point for one team in the set being played.
	app.post(`${P}/matches/:id/point`, async (c) => {
		const r = await scorable(c);
		if (r.error) return r.error;
		const { sql } = c.var;
		const m = r.m!;
		if (m.status !== "live") return c.json({ error: "Start the match first" }, 400);
		const body = await c.req.json();
		const delta = Number(body.delta) < 0 ? -1 : 1;
		const cur = await currentSet(sql, Number(m.id));
		if (!cur) return c.json({ error: "There is no set being played" }, 400);
		if (body.team === "a") await sql`UPDATE match_sets SET a_pts = greatest(a_pts + ${delta}, 0), updated_at = NOW() WHERE id = ${cur.id}`;
		else await sql`UPDATE match_sets SET b_pts = greatest(b_pts + ${delta}, 0), updated_at = NOW() WHERE id = ${cur.id}`;
		await recompute(sql, Number(m.id));
		return c.json({ ok: true });
	});

	// Close the set once it is really over. If a team now has the sets it needs, the match is final.
	app.post(`${P}/matches/:id/end-set`, async (c) => {
		const r = await scorable(c);
		if (r.error) return r.error;
		const { sql, v } = c.var;
		const m = r.m!;
		if (m.status !== "live") return c.json({ error: "The match is not being scored" }, 400);
		const cur = await currentSet(sql, Number(m.id));
		if (!cur) return c.json({ error: "There is no set being played" }, 400);
		const target = setTarget(v.tournament, cur.set_number);
		if (!setIsOver(cur.a_pts, cur.b_pts, target)) {
			return c.json({ error: `The set is not over yet. It is won at ${target} points with a lead of 2.` }, 400);
		}
		await sql`UPDATE match_sets SET finished = TRUE, updated_at = NOW() WHERE id = ${cur.id}`;
		const { aSets, bSets } = await recompute(sql, Number(m.id));
		const need = v.tournament.sets_to_win;
		if (aSets >= need || bSets >= need) {
			await sql`UPDATE matches SET status = 'final', ended_at = NOW(), updated_at = NOW() WHERE id = ${m.id}`;
			if (m.stage === "bracket") await advance(sql, Number(m.id));
			await announceNext(sql, c.var.tid, m);
		} else {
			await sql`INSERT INTO match_sets (match_id, set_number) VALUES (${m.id}, ${cur.set_number + 1}) ON CONFLICT (match_id, set_number) DO NOTHING`;
		}
		return c.json({ ok: true, final: aSets >= need || bSets >= need });
	});

	// Fix a mistake: reopen the last finished set (and take a finished match back to live).
	app.post(`${P}/matches/:id/reopen`, async (c) => {
		const r = await scorable(c);
		if (r.error) return r.error;
		const { sql } = c.var;
		const m = r.m!;
		const [last] = (await sql`SELECT * FROM match_sets WHERE match_id = ${m.id} AND finished ORDER BY set_number DESC LIMIT 1`) as Row[];
		if (!last) return c.json({ error: "No finished set to reopen" }, 400);
		const cur = await currentSet(sql, Number(m.id));
		if (cur && (cur.a_pts > 0 || cur.b_pts > 0)) return c.json({ error: "Take the points off the current set first" }, 400);
		if (cur) await sql`DELETE FROM match_sets WHERE id = ${cur.id}`;
		await sql`UPDATE match_sets SET finished = FALSE, updated_at = NOW() WHERE id = ${last.id}`;
		await sql`UPDATE matches SET status = 'live', ended_at = NULL, updated_at = NOW() WHERE id = ${m.id}`;
		await recompute(sql, Number(m.id));
		if (m.stage === "bracket") await advance(sql, Number(m.id));
		return c.json({ ok: true });
	});

	// Scorekeepers: extra people an organizer lets score any match.
	app.get(`${P}/scorekeepers`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		return c.json(await c.var.sql`SELECT id, email FROM scorekeepers WHERE tournament_id = ${c.var.tid} ORDER BY id`);
	});

	app.post(`${P}/scorekeepers`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const email = String((await c.req.json()).email ?? "").trim().toLowerCase();
		if (!email.includes("@")) return c.json({ error: "Enter a valid email" }, 400);
		const [row] = await c.var.sql`INSERT INTO scorekeepers (tournament_id, email) VALUES (${c.var.tid}, ${email}) ON CONFLICT (tournament_id, email) DO UPDATE SET email = excluded.email RETURNING id, email`;
		return c.json(row);
	});

	app.delete(`${P}/scorekeepers/:id`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		await c.var.sql`DELETE FROM scorekeepers WHERE id = ${Number(c.req.param("id"))} AND tournament_id = ${c.var.tid}`;
		return c.json({ ok: true });
	});
}
