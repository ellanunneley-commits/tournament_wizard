import { Hono } from "hono";
import { neon, types } from "@neondatabase/serverless";
import { auth } from "./auth";
import { computeStandings } from "./lib/standings";
import { createTournament } from "./lib/create";
import { advance } from "./lib/bracket";
import { announceNext } from "./lib/autoannounce";
import { canScoreMatch, captainTeamIds, setTarget } from "./lib/scoring";
import { FLAT_FEE_CENTS, APP_FEE_RATE, feeFigures } from "./lib/fees";
import { Env, Row, Sql, Viewer, forbidden, locked, ownerOnly } from "./lib/ctx";
import { moneyRoutes } from "./routes/money";
import { liveRoutes } from "./routes/live";
import { announcementRoutes } from "./routes/announcements";

types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.DATE, (v) => v);

const app = new Hono<Env>();
const P = "/app-api/t/:tid";

// ---------- who is looking ----------

const emailOf = (c: any) => auth(c).user()?.email?.trim().toLowerCase() ?? null;

async function isAppOwner(sql: Sql, email: string | null) {
	if (!email) return false;
	const rows = (await sql`SELECT 1 FROM app_owners WHERE lower(email) = ${email}`) as Row[];
	return rows.length > 0;
}

// Organizers run a tournament and app owners can run any. Teams and guests see a tournament once its app fee is paid or waived.
async function getViewer(c: any, sql: Sql, tid: number): Promise<Viewer | null> {
	const email = emailOf(c);
	const [t] = (await sql`SELECT id, name, payment_link, fees_waived, scoring_format, sets_to_win, set_points, deciding_set_points, auto_announce, announce_minutes, day_start, day_end, game_minutes, (stripe_webhook_secret IS NOT NULL) AS has_secret FROM tournaments WHERE id = ${tid}`) as Row[];
	if (!t) return null;
	let isOrganizer = false;
	let scorekeeper = false;
	let paid = false;
	let invited = false;
	const isOwner = await isAppOwner(sql, email);
	if (email) {
		isOrganizer = ((await sql`SELECT 1 FROM organizers WHERE tournament_id = ${tid} AND lower(email) = ${email}`) as Row[]).length > 0;
		scorekeeper = ((await sql`SELECT 1 FROM scorekeepers WHERE tournament_id = ${tid} AND lower(email) = ${email}`) as Row[]).length > 0;
		paid = ((await sql`SELECT 1 FROM registrations WHERE tournament_id = ${tid} AND lower(email) = ${email} AND status = 'paid'`) as Row[]).length > 0;
		invited = ((await sql`SELECT 1 FROM viewers v JOIN teams tm ON tm.id = v.team_id WHERE tm.tournament_id = ${tid} AND lower(v.email) = ${email}`) as Row[]).length > 0;
	}
	const fees = await feeFigures(sql, tid, !!t.fees_waived);
	const isAdmin = isOrganizer || isOwner;
	return { email, isAdmin, isOwner, scorekeeper, paid, invited, activated: fees.activated, canSee: isAdmin || ((paid || invited) && fees.activated), tournament: t };
}

app.use(`${P}/*`, async (c, next) => {
	const sql = neon(c.env.DATABASE_URL);
	const tid = Number(c.req.param("tid"));
	if (!Number.isInteger(tid)) return c.json({ error: "Tournament not found" }, 404);
	const v = await getViewer(c, sql, tid);
	if (!v) return c.json({ error: "Tournament not found" }, 404);
	c.set("sql", sql);
	c.set("tid", tid);
	c.set("v", v);
	await next();
});

async function ownsTeam(sql: Sql, v: Viewer, tid: number, teamId: number) {
	const inTournament = (await sql`SELECT 1 FROM teams WHERE id = ${teamId} AND tournament_id = ${tid}`) as Row[];
	if (inTournament.length === 0) return false;
	if (v.isAdmin) return true;
	if (!v.email) return false;
	return ((await sql`SELECT 1 FROM registrations WHERE team_id = ${teamId} AND lower(email) = ${v.email}`) as Row[]).length > 0;
}

// A spot nobody has taken yet still carries its placeholder name, so it is shown as "Open spot".
const OPEN_SPOT = "Open spot";

async function standings(sql: Sql, tid: number) {
	const teams = (await sql`SELECT t.id, t.number, t.pool, t.pool_slot,
		CASE WHEN t.name = 'Team ' || t.number AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = t.id) THEN ${OPEN_SPOT} ELSE t.name END AS name
		FROM teams t WHERE t.tournament_id = ${tid}`) as Row[];
	const ms = (await sql`SELECT * FROM matches WHERE tournament_id = ${tid} AND stage = 'pool'`) as Row[];
	return computeStandings(teams, ms);
}

// A tournament has 39 matches, so they are loaded with team names and filtered in code.
async function allMatches(sql: Sql, tid: number) {
	return (await sql`
		SELECT m.*,
			CASE WHEN ta.name = 'Team ' || ta.number AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = ta.id) THEN ${OPEN_SPOT} ELSE ta.name END AS team_a_name, ta.number AS team_a_number,
			CASE WHEN tb.name = 'Team ' || tb.number AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = tb.id) THEN ${OPEN_SPOT} ELSE tb.name END AS team_b_name, tb.number AS team_b_number,
			CASE WHEN tr.name = 'Team ' || tr.number AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = tr.id) THEN ${OPEN_SPOT} ELSE tr.name END AS ref_name, tr.number AS ref_number,
			ta.pool || ta.pool_slot AS team_a_code, tb.pool || tb.pool_slot AS team_b_code, tr.pool || tr.pool_slot AS ref_code,
			(SELECT s.set_number FROM match_sets s WHERE s.match_id = m.id AND NOT s.finished ORDER BY s.set_number LIMIT 1) AS cur_set,
			(SELECT s.a_pts FROM match_sets s WHERE s.match_id = m.id AND NOT s.finished ORDER BY s.set_number LIMIT 1) AS cur_a,
			(SELECT s.b_pts FROM match_sets s WHERE s.match_id = m.id AND NOT s.finished ORDER BY s.set_number LIMIT 1) AS cur_b
		FROM matches m
		LEFT JOIN teams ta ON ta.id = m.team_a_id
		LEFT JOIN teams tb ON tb.id = m.team_b_id
		LEFT JOIN teams tr ON tr.id = m.ref_team_id
		WHERE m.tournament_id = ${tid}
		ORDER BY m.stage, m.sort_order`) as Row[];
}

// ---------- the list of tournaments ----------

app.get("/app-api/tournaments", async (c) => {
	const sql = neon(c.env.DATABASE_URL);
	const email = emailOf(c);
	const isOwner = await isAppOwner(sql, email);
	if (!email) return c.json({ is_owner: false, tournaments: [] });
	const rows = (await sql`
		SELECT t.id, t.name, t.created_at, t.fees_waived,
			EXISTS (SELECT 1 FROM organizers o WHERE o.tournament_id = t.id AND lower(o.email) = ${email}) AS organizer,
			EXISTS (SELECT 1 FROM registrations r WHERE r.tournament_id = t.id AND lower(r.email) = ${email} AND r.status = 'paid') AS captain,
			EXISTS (SELECT 1 FROM viewers v JOIN teams tm ON tm.id = v.team_id WHERE tm.tournament_id = t.id AND lower(v.email) = ${email}) AS guest,
			(SELECT count(*)::int FROM registrations r WHERE r.tournament_id = t.id AND r.team_id IS NOT NULL) AS teams
		FROM tournaments t ORDER BY t.id DESC`) as Row[];
	const mine = rows
		.filter((t) => isOwner || t.organizer || t.captain || t.guest)
		.map((t) => ({ id: t.id, name: t.name, created_at: t.created_at, teams: t.teams, role: t.organizer ? "organizer" : t.captain ? "captain" : t.guest ? "guest" : "owner" }));
	return c.json({ is_owner: isOwner, tournaments: mine });
});

// Anyone signed in can start a tournament and becomes its organizer. It opens to teams once the app fee is paid.
app.post("/app-api/tournaments", async (c) => {
	const sql = neon(c.env.DATABASE_URL);
	const email = emailOf(c);
	if (!email) return c.json({ error: "Sign in first" }, 400);
	const name = String((await c.req.json()).name ?? "").trim();
	if (!name) return c.json({ error: "Give the tournament a name" }, 400);
	const id = await createTournament(sql, name, email);
	return c.json({ id });
});

// The owner's view of every tournament and what each owes.
app.get("/app-api/owner/overview", async (c) => {
	const sql = neon(c.env.DATABASE_URL);
	if (!(await isAppOwner(sql, emailOf(c)))) return ownerOnly(c);
	const rows = (await sql`
		SELECT t.id, t.name, t.fees_waived, t.created_by, t.created_at,
			(SELECT count(*)::int FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'paid') AS entries,
			coalesce((SELECT sum(amount_total) FROM registrations r WHERE r.tournament_id = t.id AND r.status = 'paid'), 0)::int AS entries_total_cents,
			coalesce((SELECT sum(amount_cents) FROM platform_payments p WHERE p.tournament_id = t.id), 0)::int AS paid_cents
		FROM tournaments t ORDER BY t.id DESC`) as Row[];
	return c.json(
		rows.map((t) => {
			const due = t.fees_waived ? 0 : FLAT_FEE_CENTS + Math.round(t.entries_total_cents * APP_FEE_RATE);
			return { ...t, due_cents: due, balance_cents: Math.max(0, due - t.paid_cents) };
		}),
	);
});

// ---------- access, entries and rosters ----------

app.get(`${P}/access`, async (c) => {
	const { sql, tid, v } = c.var;
	const regs = v.email
		? ((await sql`SELECT r.id, r.status, r.team_id, t.name AS team_name, t.pool, t.pool_slot FROM registrations r LEFT JOIN teams t ON t.id = r.team_id WHERE r.tournament_id = ${tid} AND lower(r.email) = ${v.email} ORDER BY r.id`) as Row[])
		: [];
	const players = (await sql`SELECT p.* FROM players p JOIN teams t ON t.id = p.team_id WHERE t.tournament_id = ${tid} ORDER BY p.id`) as Row[];
	const guests = v.email ? ((await sql`SELECT g.id, g.team_id, g.email FROM viewers g JOIN teams t ON t.id = g.team_id WHERE t.tournament_id = ${tid} ORDER BY g.id`) as Row[]) : [];
	const [open] = (await sql`SELECT count(*)::int AS n FROM teams t WHERE t.tournament_id = ${tid} AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = t.id)`) as Row[];
	return c.json({
		tournament_id: tid,
		tournament_name: v.tournament.name,
		email: v.email,
		is_admin: v.isAdmin,
		can_see: v.canSee,
		activated: v.activated,
		is_owner: v.isOwner,
		open_slots: open.n,
		payment_link: v.activated || v.isAdmin ? (v.tournament.payment_link ?? null) : null,
		has_webhook_secret: v.isAdmin ? !!v.tournament.has_secret : false,
		auto_announce: { enabled: !!v.tournament.auto_announce, minutes: v.tournament.announce_minutes },
		day: { start: v.tournament.day_start, end: v.tournament.day_end, game_minutes: v.tournament.game_minutes },
		rules: { scoring_format: v.tournament.scoring_format, sets_to_win: v.tournament.sets_to_win, set_points: v.tournament.set_points, deciding_set_points: v.tournament.deciding_set_points },
		registrations: regs.map((r) => ({
			...r,
			players: players.filter((p) => r.team_id != null && String(p.team_id) === String(r.team_id)),
			guests: guests.filter((g) => r.team_id != null && String(g.team_id) === String(r.team_id)),
		})),
	});
});

app.post(`${P}/entries/:id/claim`, async (c) => {
	const { sql, tid, v } = c.var;
	const id = Number(c.req.param("id"));
	const name = String((await c.req.json()).name ?? "").trim();
	if (!name) return c.json({ error: "Enter a team name" }, 400);
	const [reg] = (await sql`SELECT * FROM registrations WHERE id = ${id} AND tournament_id = ${tid}`) as Row[];
	if (!reg || (!v.isAdmin && String(reg.email).toLowerCase() !== v.email)) return c.json({ error: "Entry not found" }, 404);
	if (reg.status !== "paid") return c.json({ error: "This entry has not been confirmed as paid yet" }, 400);
	if (reg.team_id) return c.json({ error: "This entry already has a team" }, 400);
	for (let attempt = 0; attempt < 4; attempt++) {
		const [free] = (await sql`SELECT t.id FROM teams t WHERE t.tournament_id = ${tid} AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.team_id = t.id) ORDER BY t.number LIMIT 1`) as Row[];
		if (!free) return c.json({ error: "The tournament is full" }, 409);
		try {
			await sql`UPDATE registrations SET team_id = ${free.id}, updated_at = NOW() WHERE id = ${id} AND team_id IS NULL`;
		} catch {
			continue; // someone took that slot a moment ago: try the next one
		}
		const [team] = await sql`UPDATE teams SET name = ${name}, updated_at = NOW() WHERE id = ${free.id} RETURNING *`;
		return c.json(team);
	}
	return c.json({ error: "Could not reserve a slot, please try again" }, 409);
});

app.patch(`${P}/teams/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	const id = Number(c.req.param("id"));
	if (!(await ownsTeam(sql, v, tid, id))) return forbidden(c);
	const name = String((await c.req.json()).name ?? "").trim();
	if (!name) return c.json({ error: "Name is required" }, 400);
	const [row] = await sql`UPDATE teams SET name = ${name}, updated_at = NOW() WHERE id = ${id} RETURNING *`;
	return c.json(row);
});

app.post(`${P}/teams/:id/players`, async (c) => {
	const { sql, tid, v } = c.var;
	const id = Number(c.req.param("id"));
	if (!(await ownsTeam(sql, v, tid, id))) return forbidden(c);
	const name = String((await c.req.json()).name ?? "").trim();
	if (!name) return c.json({ error: "Enter the player's name" }, 400);
	const [count] = (await sql`SELECT count(*)::int AS n FROM players WHERE team_id = ${id}`) as Row[];
	if (count.n >= 20) return c.json({ error: "A roster can have up to 20 players" }, 400);
	const [row] = await sql`INSERT INTO players (team_id, name) VALUES (${id}, ${name}) RETURNING *`;
	return c.json(row);
});

app.delete(`${P}/players/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	const [p] = (await sql`SELECT * FROM players WHERE id = ${Number(c.req.param("id"))}`) as Row[];
	if (!p) return c.json({ ok: true });
	if (!(await ownsTeam(sql, v, tid, Number(p.team_id)))) return forbidden(c);
	await sql`DELETE FROM players WHERE id = ${p.id}`;
	return c.json({ ok: true });
});

// A captain invites friends and family by email; they sign in with that email to watch.
app.post(`${P}/teams/:id/viewers`, async (c) => {
	const { sql, tid, v } = c.var;
	const id = Number(c.req.param("id"));
	if (!(await ownsTeam(sql, v, tid, id))) return forbidden(c);
	const email = String((await c.req.json()).email ?? "").trim().toLowerCase();
	if (!email.includes("@")) return c.json({ error: "Enter a valid email" }, 400);
	const [count] = (await sql`SELECT count(*)::int AS n FROM viewers WHERE team_id = ${id}`) as Row[];
	if (count.n >= 25) return c.json({ error: "A team can invite up to 25 guests" }, 400);
	const [row] = await sql`INSERT INTO viewers (team_id, email) VALUES (${id}, ${email}) ON CONFLICT (team_id, email) DO UPDATE SET email = excluded.email RETURNING *`;
	return c.json(row);
});

app.delete(`${P}/viewers/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	const [g] = (await sql`SELECT * FROM viewers WHERE id = ${Number(c.req.param("id"))}`) as Row[];
	if (!g) return c.json({ ok: true });
	if (!(await ownsTeam(sql, v, tid, Number(g.team_id)))) return forbidden(c);
	await sql`DELETE FROM viewers WHERE id = ${g.id}`;
	return c.json({ ok: true });
});

// The organizer sets when the day starts and ends and how long one game is planned to take.
app.put(`${P}/day`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.isAdmin) return forbidden(c);
	const body = await c.req.json();
	const parse = (x: unknown) => {
		if (!x) return null;
		const d = new Date(String(x));
		return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
	};
	const start = parse(body.start);
	const end = parse(body.end);
	if (start === undefined || end === undefined) return c.json({ error: "Enter a valid date and time" }, 400);
	if (start && end && new Date(end) <= new Date(start)) return c.json({ error: "The day must end after it starts" }, 400);
	const minutes = Math.floor(Number(body.game_minutes));
	const game = Number.isFinite(minutes) && minutes >= 5 && minutes <= 180 ? minutes : v.tournament.game_minutes;
	await sql`UPDATE tournaments SET day_start = ${start}, day_end = ${end}, game_minutes = ${game}, updated_at = NOW() WHERE id = ${tid}`;
	return c.json({ ok: true });
});

moneyRoutes(app);

// ---------- tournament data (registered teams, invited guests and organizers only) ----------

app.get(`${P}/standings`, async (c) => {
	if (!c.var.v.canSee) return locked(c);
	return c.json(await standings(c.var.sql, c.var.tid));
});

app.get(`${P}/summary`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.canSee) return locked(c);
	const [s] = await sql`
		SELECT
			count(*) FILTER (WHERE stage = 'pool')::int AS pool_total,
			count(*) FILTER (WHERE stage = 'pool' AND status = 'final')::int AS pool_done,
			count(*) FILTER (WHERE stage = 'bracket')::int AS bracket_total,
			count(*) FILTER (WHERE stage = 'bracket' AND status = 'final')::int AS bracket_done,
			count(*) FILTER (WHERE stage = 'bracket' AND team_a_id IS NOT NULL)::int AS bracket_seeded,
			count(*) FILTER (WHERE status = 'live')::int AS live_now
		FROM matches WHERE tournament_id = ${tid}`;
	const ms = await allMatches(sql, tid);
	const final = ms.find((m) => m.stage === "bracket" && m.label === "Final");
	const champion = final && final.status === "final" ? (final.a_sets > final.b_sets ? final.team_a_name : final.team_b_name) : null;
	return c.json({ ...s, champion });
});

app.get(`${P}/teams`, async (c) => {
	if (!c.var.v.canSee) return locked(c);
	const list = await standings(c.var.sql, c.var.tid);
	return c.json(list.sort((a, b) => a.number - b.number));
});

app.get(`${P}/teams/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.canSee) return locked(c);
	const id = Number(c.req.param("id"));
	const team = (await standings(sql, tid)).find((t) => t.id === id);
	if (!team) return c.json({ error: "Team not found" }, 404);
	const ms = await allMatches(sql, tid);
	const mine = ms.filter((m) => [m.team_a_id, m.team_b_id, m.ref_team_id].some((x) => x != null && Number(x) === id));
	const matches = [...mine.filter((m) => m.stage === "pool"), ...mine.filter((m) => m.stage === "bracket" && m.ref_team_id == null)];
	const players = (await sql`SELECT id, name FROM players WHERE team_id = ${id} ORDER BY id`) as Row[];
	const [reg] = (await sql`SELECT id FROM registrations WHERE team_id = ${id}`) as Row[];
	return c.json({ team, matches, players, claimed: !!reg });
});

app.get(`${P}/matches`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.canSee) return locked(c);
	const stage = c.req.query("stage");
	const teams = await captainTeamIds(sql, v, tid);
	const ms: Row[] = (await allMatches(sql, tid)).map((m): Row => ({ ...m, can_score: canScoreMatch(v, teams, m) }));
	return c.json(stage === "pool" || stage === "bracket" ? ms.filter((m) => m.stage === stage) : ms);
});

app.get(`${P}/matches/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.canSee) return locked(c);
	const id = Number(c.req.param("id"));
	const row = (await allMatches(sql, tid)).find((m) => Number(m.id) === id);
	if (!row) return c.json({ error: "Match not found" }, 404);
	const sets = (await sql`SELECT set_number, a_pts, b_pts, finished FROM match_sets WHERE match_id = ${id} ORDER BY set_number`) as Row[];
	const t = v.tournament;
	const cur = sets.find((s) => !s.finished);
	const rules = { sets_to_win: t.sets_to_win, set_points: t.set_points, deciding_set_points: t.deciding_set_points, current_target: cur ? setTarget(t, cur.set_number) : null };
	return c.json({ ...row, sets, rules, can_score: canScoreMatch(v, await captainTeamIds(sql, v, tid), row) });
});

const toInt = (v: unknown) => (v === null || v === undefined || v === "" ? null : Math.max(0, Math.floor(Number(v))));

app.patch(`${P}/matches/:id`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.isAdmin) return forbidden(c);
	const id = Number(c.req.param("id"));
	const body = await c.req.json();
	const [m] = (await sql`SELECT * FROM matches WHERE id = ${id} AND tournament_id = ${tid}`) as Row[];
	if (!m) return c.json({ error: "Match not found" }, 404);
	const court = String(body.court ?? "").trim() || null;
	const aSets = toInt(body.a_sets);
	const bSets = toInt(body.b_sets);
	const aPts = toInt(body.a_pts);
	const bPts = toInt(body.b_pts);
	if ((aSets === null) !== (bSets === null)) return c.json({ error: "Enter sets for both teams" }, 400);
	if (m.stage === "bracket" && aSets !== null && bSets !== null) {
		if (!m.team_a_id || !m.team_b_id) return c.json({ error: "Both teams must be set before scoring" }, 400);
		if (aSets === bSets) return c.json({ error: "A bracket match cannot end in a tie" }, 400);
	}
	// A score typed in by hand is a finished match; clearing it also clears anything scored live.
	const status = aSets !== null ? "final" : "scheduled";
	await sql`DELETE FROM match_sets WHERE match_id = ${id}`;
	const [row] = await sql`UPDATE matches SET court = ${court}, a_sets = ${aSets}, b_sets = ${bSets}, a_pts = ${aPts}, b_pts = ${bPts}, status = ${status},
		ended_at = CASE WHEN ${status} = 'final' THEN coalesce(ended_at, NOW()) ELSE NULL END,
		started_at = CASE WHEN ${status} = 'final' THEN started_at ELSE NULL END, updated_at = NOW() WHERE id = ${id} RETURNING *`;
	if (m.stage === "bracket") await advance(sql, id);
	if (status === "final" && m.status !== "final") await announceNext(sql, tid, row);
	return c.json(row);
});

app.post(`${P}/bracket/seed`, async (c) => {
	const { sql, tid, v } = c.var;
	if (!v.isAdmin) return forbidden(c);
	const list = await standings(sql, tid);
	const bySeed = new Map<number, number>(list.map((t) => [t.seed as number, t.id as number]));
	await sql`DELETE FROM match_sets WHERE match_id IN (SELECT id FROM matches WHERE tournament_id = ${tid} AND stage = 'bracket')`;
	await sql`UPDATE matches SET team_a_id = NULL, team_b_id = NULL, a_sets = NULL, b_sets = NULL, a_pts = NULL, b_pts = NULL, status = 'scheduled', started_at = NULL, ended_at = NULL, updated_at = NOW() WHERE tournament_id = ${tid} AND stage = 'bracket'`;
	const first = (await sql`SELECT id, seed_a, seed_b FROM matches WHERE tournament_id = ${tid} AND stage = 'bracket' AND seed_a IS NOT NULL`) as Row[];
	for (const m of first) {
		await sql`UPDATE matches SET team_a_id = ${bySeed.get(m.seed_a) ?? null}, team_b_id = ${bySeed.get(m.seed_b) ?? null} WHERE id = ${m.id}`;
	}
	return c.json({ ok: true });
});

liveRoutes(app);
announcementRoutes(app);

export default { fetch: app.fetch };
