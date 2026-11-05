import { Row, Sql } from "./ctx";


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

// Before a bracket result changes: which later matches have already started or finished and would be cleared,
// because the team that advanced from this match would change. `winner` is the team that would advance (null if none).
export async function laterMatchesCleared(sql: Sql, matchId: number, winner: number | string | null): Promise<string[]> {
	const [m] = (await sql`SELECT next_match_id, next_side FROM matches WHERE id = ${matchId}`) as Row[];
	if (!m?.next_match_id) return [];
	const [next] = (await sql`SELECT team_a_id, team_b_id FROM matches WHERE id = ${m.next_match_id}`) as Row[];
	const current = m.next_side === "a" ? next.team_a_id : next.team_b_id;
	if (String(current ?? "") === String(winner ?? "")) return [];
	// Walk the rest of the path to the final: any match on it that has been played gets reset.
	const touched: string[] = [];
	let id: number | null = Number(m.next_match_id);
	while (id) {
		const [x] = (await sql`SELECT label, status, next_match_id FROM matches WHERE id = ${id}`) as Row[];
		if (!x) break;
		if (x.status !== "scheduled") touched.push(x.label);
		id = x.next_match_id ? Number(x.next_match_id) : null;
	}
	return touched;
}

export const clearsLaterMessage = (labels: string[]) =>
	`This changes who moves on, so ${labels.join(", ")} ${labels.length === 1 ? "has" : "have"} to be cleared and played again.`;
