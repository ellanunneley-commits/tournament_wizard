export type MatchRow = {
	id: string;
	stage: "pool" | "bracket";
	pool: string | null;
	round: number | null;
	bracket_round: string | null;
	label: string;
	court: string | null;
	team_a_id: string | null;
	team_b_id: string | null;
	ref_team_id: string | null;
	a_sets: number | null;
	b_sets: number | null;
	a_pts: number | null;
	b_pts: number | null;
	team_a_name: string | null;
	team_b_name: string | null;
	ref_name: string | null;
	team_a_code: string | null;
	team_b_code: string | null;
	ref_code: string | null;
	seed_a: number | null;
	seed_b: number | null;
	sort_order: number;
	starts_at: string | null;
	started_at: string | null;
	ended_at: string | null;
	status: "scheduled" | "live" | "final";
	cur_set: number | null;
	cur_a: number | null;
	cur_b: number | null;
	can_score?: boolean;
	sets?: { set_number: number; a_pts: number; b_pts: number; finished: boolean }[];
	rules?: { sets_to_win: number; set_points: number; deciding_set_points: number; current_target: number | null };
};

export type TeamRow = {
	id: number;
	number: number;
	name: string;
	pool: string;
	pool_slot: number;
	code: string;
	played: number;
	wins: number;
	losses: number;
	sets_won: number;
	sets_lost: number;
	pts_for: number;
	pts_against: number;
	score: number;
	pool_rank: number;
	seed: number;
};

export type Summary = {
	pool_total: number;
	pool_done: number;
	bracket_total: number;
	bracket_done: number;
	bracket_seeded: number;
	live_now: number;
	champion: string | null;
};

export const isScored = (m: MatchRow) => m.status === "final";
export const isLive = (m: MatchRow) => m.status === "live";

// What to show for a match at a glance: the live set and sets won while it is being played, the final sets after.
export function scoreText(m: MatchRow) {
	if (m.status === "scheduled" || m.a_sets == null) return "—";
	if (m.status === "live") return `Set ${m.cur_set ?? "?"}: ${m.cur_a ?? 0} – ${m.cur_b ?? 0} (sets ${m.a_sets} – ${m.b_sets})`;
	return `${m.a_sets} – ${m.b_sets}`;
}

export function teamLabel(name: string | null, code: string | null) {
	if (!name) return "To be decided";
	return code ? `${name} (${code})` : name;
}

export function matchTitle(m: MatchRow) {
	return `${m.team_a_name ?? "TBD"} vs ${m.team_b_name ?? "TBD"}`;
}

export async function api(path: string, method: string, body?: unknown) {
	const res = await fetch(path, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? "Something went wrong");
	return data;
}
