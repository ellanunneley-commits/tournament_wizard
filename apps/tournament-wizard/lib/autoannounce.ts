import { neon } from "@neondatabase/serverless";
import { Row } from "./ctx";

type Sql = ReturnType<typeof neon>;

// When a match is final: retire its own announcement, then tell everyone which game is next and start its countdown.
// The next game is the next unstarted match on the same court (or the next one in the schedule when courts are not used).
export async function announceNext(sql: Sql, tid: number, finished: Row) {
	await sql`UPDATE announcements SET active = FALSE, updated_at = NOW() WHERE match_id = ${finished.id} AND auto`;
	const [t] = (await sql`SELECT auto_announce, announce_minutes FROM tournaments WHERE id = ${tid}`) as Row[];
	if (!t?.auto_announce) return;

	const queue = (await sql`
		SELECT m.id, m.court, ta.name AS a_name, tb.name AS b_name
		FROM matches m
		JOIN teams ta ON ta.id = m.team_a_id
		JOIN teams tb ON tb.id = m.team_b_id
		WHERE m.tournament_id = ${tid} AND m.status = 'scheduled' AND m.starts_at IS NULL AND m.id <> ${finished.id}
		ORDER BY (m.stage = 'bracket'), m.sort_order`) as Row[];
	const next = finished.court ? queue.find((m) => m.court === finished.court) : queue[0];
	if (!next) return;

	const minutes = Number(t.announce_minutes) || 5;
	const [started] = (await sql`UPDATE matches SET starts_at = NOW() + (${minutes}::int * interval '1 minute') WHERE id = ${next.id} RETURNING starts_at`) as Row[];
	const where = next.court ? ` on ${next.court}` : "";
	const message = `Next game: ${next.a_name} vs ${next.b_name}${where} starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
	await sql`INSERT INTO announcements (tournament_id, message, auto, match_id, countdown_to) VALUES (${tid}, ${message}, TRUE, ${next.id}, ${started.starts_at})`;
}

// A match that has started no longer needs its "starts in" message.
export async function retireAnnouncements(sql: Sql, matchId: number) {
	await sql`UPDATE announcements SET active = FALSE, updated_at = NOW() WHERE match_id = ${matchId} AND auto`;
}
