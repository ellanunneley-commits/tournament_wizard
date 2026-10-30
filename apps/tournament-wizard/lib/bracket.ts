import { neon } from "@neondatabase/serverless";
import { Row } from "./ctx";

type Sql = ReturnType<typeof neon>;

// Put a finished bracket match's winner into the next round. If the winner changed (or the match was reopened), clear the later rounds.
export async function advance(sql: Sql, matchId: number) {
	let currentId: number | null = matchId;
	while (currentId) {
		const [m] = (await sql`SELECT * FROM matches WHERE id = ${currentId}`) as Row[];
		if (!m || !m.next_match_id) return;
		let winner: number | null = null;
		if (m.status === "final" && m.a_sets != null && m.b_sets != null) winner = m.a_sets > m.b_sets ? m.team_a_id : m.team_b_id;
		const [next] = (await sql`SELECT * FROM matches WHERE id = ${m.next_match_id}`) as Row[];
		const current = m.next_side === "a" ? next.team_a_id : next.team_b_id;
		if (String(current ?? "") === String(winner ?? "")) return;
		if (m.next_side === "a") {
			await sql`UPDATE matches SET team_a_id = ${winner}, a_sets = NULL, b_sets = NULL, a_pts = NULL, b_pts = NULL, status = 'scheduled', started_at = NULL, ended_at = NULL, updated_at = NOW() WHERE id = ${next.id}`;
		} else {
			await sql`UPDATE matches SET team_b_id = ${winner}, a_sets = NULL, b_sets = NULL, a_pts = NULL, b_pts = NULL, status = 'scheduled', started_at = NULL, ended_at = NULL, updated_at = NOW() WHERE id = ${next.id}`;
		}
		await sql`DELETE FROM match_sets WHERE match_id = ${next.id}`;
		currentId = Number(next.id);
	}
}
