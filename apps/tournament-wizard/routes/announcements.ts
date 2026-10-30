import { Hono } from "hono";
import { Env, Row, forbidden, locked } from "../lib/ctx";

const P = "/app-api/t/:tid";

// Messages from the organizers, like "Courts 3-4 running 10 min behind". Everyone in the tournament sees the active ones; organizers manage them all.
export function announcementRoutes(app: Hono<Env>) {
	app.get(`${P}/announcements`, async (c) => {
		const { sql, tid, v } = c.var;
		if (!v.canSee) return locked(c);
		// An automatic "next game" message is expired once that game has started or finished.
		const rows = v.isAdmin
			? ((await sql`SELECT a.id, a.message, a.active, a.auto, a.created_at, a.countdown_to, (a.match_id IS NOT NULL AND m.status <> 'scheduled') AS expired
				FROM announcements a LEFT JOIN matches m ON m.id = a.match_id WHERE a.tournament_id = ${tid} ORDER BY a.created_at DESC`) as Row[])
			: ((await sql`SELECT a.id, a.message, a.active, a.auto, a.created_at, a.countdown_to, (a.match_id IS NOT NULL AND m.status <> 'scheduled') AS expired
				FROM announcements a LEFT JOIN matches m ON m.id = a.match_id WHERE a.tournament_id = ${tid} AND a.active AND (a.match_id IS NULL OR m.status = 'scheduled') ORDER BY a.created_at DESC`) as Row[]);
		return c.json(rows);
	});

	// Switch the automatic "next game starts in N minutes" messages on or off and set how far ahead they warn.
	app.put(`${P}/announcements/auto`, async (c) => {
		const { sql, tid, v } = c.var;
		if (!v.isAdmin) return forbidden(c);
		const body = await c.req.json();
		const minutes = Math.floor(Number(body.minutes));
		const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 60 ? minutes : null;
		if (typeof body.enabled === "boolean") await sql`UPDATE tournaments SET auto_announce = ${body.enabled}, updated_at = NOW() WHERE id = ${tid}`;
		if (valid !== null) await sql`UPDATE tournaments SET announce_minutes = ${valid}, updated_at = NOW() WHERE id = ${tid}`;
		return c.json({ ok: true });
	});

	app.post(`${P}/announcements`, async (c) => {
		const { sql, tid, v } = c.var;
		if (!v.isAdmin) return forbidden(c);
		const message = String((await c.req.json()).message ?? "").trim();
		if (!message) return c.json({ error: "Write the message first" }, 400);
		if (message.length > 280) return c.json({ error: "Keep it under 280 characters" }, 400);
		const [row] = await sql`INSERT INTO announcements (tournament_id, message) VALUES (${tid}, ${message}) RETURNING id, message, active, created_at`;
		return c.json(row);
	});

	app.patch(`${P}/announcements/:id`, async (c) => {
		const { sql, tid, v } = c.var;
		if (!v.isAdmin) return forbidden(c);
		const body = await c.req.json();
		const id = Number(c.req.param("id"));
		if (typeof body.message === "string") {
			const message = body.message.trim();
			if (!message) return c.json({ error: "Write the message first" }, 400);
			if (message.length > 280) return c.json({ error: "Keep it under 280 characters" }, 400);
			await sql`UPDATE announcements SET message = ${message}, updated_at = NOW() WHERE id = ${id} AND tournament_id = ${tid}`;
		}
		if (typeof body.active === "boolean") {
			await sql`UPDATE announcements SET active = ${body.active}, updated_at = NOW() WHERE id = ${id} AND tournament_id = ${tid}`;
		}
		return c.json({ ok: true });
	});
}
