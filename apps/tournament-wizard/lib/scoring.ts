import { Row, Viewer, Sql } from "./ctx";


// Teams whose captain is the signed-in person (they may score the matches their team refs).
export async function captainTeamIds(sql: Sql, v: Viewer, tid: number) {
	if (!v.email) return new Set<string>();
	const rows = (await sql`SELECT team_id FROM registrations WHERE tournament_id = ${tid} AND lower(email) = ${v.email} AND team_id IS NOT NULL`) as Row[];
	return new Set(rows.map((r) => String(r.team_id)));
}

// Organizers and scorekeepers may score any match; a ref team's captain may score the matches that team refs.
export function canScoreMatch(v: Viewer, captainTeams: Set<string>, m: Row) {
	return v.isAdmin || v.scorekeeper || (m.ref_team_id != null && captainTeams.has(String(m.ref_team_id)));
}

// A set is played to a points target (the last possible set has its own, shorter target) and won by two clear points.
export function setTarget(t: Row, setNumber: number) {
	const decidingSet = 2 * t.sets_to_win - 1;
	return setNumber >= decidingSet ? t.deciding_set_points : t.set_points;
}

export const setIsOver = (a: number, b: number, target: number) => Math.max(a, b) >= target && Math.abs(a - b) >= 2;

// Keep the match's totals (sets won, points for and against) in step with its sets.
export async function recompute(sql: Sql, matchId: number) {
	const sets = (await sql`SELECT a_pts, b_pts, finished FROM match_sets WHERE match_id = ${matchId}`) as Row[];
	let aSets = 0;
	let bSets = 0;
	let aPts = 0;
	let bPts = 0;
	for (const s of sets) {
		aPts += s.a_pts;
		bPts += s.b_pts;
		if (s.finished) {
			if (s.a_pts > s.b_pts) aSets++;
			else bSets++;
		}
	}
	await sql`UPDATE matches SET a_sets = ${aSets}, b_sets = ${bSets}, a_pts = ${aPts}, b_pts = ${bPts}, updated_at = NOW() WHERE id = ${matchId}`;
	return { aSets, bSets };
}
