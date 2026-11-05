import type { Sql } from "./ctx";

export const TEAM_COUNTS = [8, 16] as const;
export type TeamCount = (typeof TEAM_COUNTS)[number];

// Each pool has 4 teams and plays 6 rounds: [team A slot, team B slot, ref slot].
const POOL_ROUNDS = [
	[1, 1, 3, 4],
	[2, 2, 4, 1],
	[3, 1, 2, 3],
	[4, 3, 4, 2],
	[5, 1, 4, 3],
	[6, 2, 3, 4],
];

// The bracket's first round, in standard order: the top two seeds can only meet in the final,
// the top four only in the semifinals. [round, label, seed A, seed B, play order]
type First = [string, string, number, number, number];
const BRACKETS: Record<TeamCount, { first: First[]; later: [string, string, number][]; links: [string, string, "a" | "b"][] }> = {
	16: {
		first: [
			["Round of 16", "Match 1", 1, 16, 1],
			["Round of 16", "Match 2", 8, 9, 2],
			["Round of 16", "Match 3", 4, 13, 3],
			["Round of 16", "Match 4", 5, 12, 4],
			["Round of 16", "Match 5", 2, 15, 5],
			["Round of 16", "Match 6", 7, 10, 6],
			["Round of 16", "Match 7", 3, 14, 7],
			["Round of 16", "Match 8", 6, 11, 8],
		],
		later: [
			["Quarterfinal", "QF1", 9],
			["Quarterfinal", "QF2", 10],
			["Quarterfinal", "QF3", 11],
			["Quarterfinal", "QF4", 12],
			["Semifinal", "SF1", 13],
			["Semifinal", "SF2", 14],
			["Final", "Final", 15],
		],
		links: [
			["Match 1", "QF1", "a"], ["Match 2", "QF1", "b"], ["Match 3", "QF2", "a"], ["Match 4", "QF2", "b"],
			["Match 5", "QF3", "a"], ["Match 6", "QF3", "b"], ["Match 7", "QF4", "a"], ["Match 8", "QF4", "b"],
			["QF1", "SF1", "a"], ["QF2", "SF1", "b"], ["QF3", "SF2", "a"], ["QF4", "SF2", "b"],
			["SF1", "Final", "a"], ["SF2", "Final", "b"],
		],
	},
	8: {
		first: [
			["Quarterfinal", "QF1", 1, 8, 1],
			["Quarterfinal", "QF2", 4, 5, 2],
			["Quarterfinal", "QF3", 2, 7, 3],
			["Quarterfinal", "QF4", 3, 6, 4],
		],
		later: [
			["Semifinal", "SF1", 5],
			["Semifinal", "SF2", 6],
			["Final", "Final", 7],
		],
		links: [
			["QF1", "SF1", "a"], ["QF2", "SF1", "b"], ["QF3", "SF2", "a"], ["QF4", "SF2", "b"],
			["SF1", "Final", "a"], ["SF2", "Final", "b"],
		],
	},
};

const POOL_NAMES = ["A", "B", "C", "D"];

// A new tournament starts with its open team spots in pools of 4, every pool match and every bracket match.
// 16 teams: 4 pools, 24 pool matches, 15 bracket matches. 8 teams: 2 pools, 12 pool matches, 7 bracket matches.
export async function createTournament(sql: Sql, name: string, email: string, teamCount: TeamCount = 16) {
	const pools = teamCount / 4;
	const plan = BRACKETS[teamCount];
	const [t] = (await sql`INSERT INTO tournaments (name, created_by, team_count) VALUES (${name}, ${email}, ${teamCount}) RETURNING id`) as { id: string }[];
	const id = Number(t.id);
	const poolValues = POOL_NAMES.slice(0, pools);
	const bracketRows = [...plan.first, ...plan.later.map(([r, l, o]) => [r, l, null, null, o] as const)];
	try {
		await sql.transaction([
			sql`INSERT INTO teams (tournament_id, number, name, pool, pool_slot)
				SELECT ${id}::bigint, n, 'Team ' || n, chr(65 + (n-1) % ${pools}::int), (n-1) / ${pools}::int + 1 FROM generate_series(1, ${teamCount}::int) n`,
			sql`INSERT INTO matches (tournament_id, stage, pool, round, label, team_a_id, team_b_id, ref_team_id, sort_order)
				SELECT ${id}::bigint, 'pool', p.pool, (t->>0)::int, p.pool || (t->>0), ta.id, tb.id, tr.id, (t->>0)::int * 10 + ascii(p.pool) - 64
				FROM unnest(${poolValues}::text[]) p(pool)
				CROSS JOIN jsonb_array_elements(${JSON.stringify(POOL_ROUNDS)}::jsonb) t
				JOIN teams ta ON ta.tournament_id = ${id}::bigint AND ta.pool = p.pool AND ta.pool_slot = (t->>1)::int
				JOIN teams tb ON tb.tournament_id = ${id}::bigint AND tb.pool = p.pool AND tb.pool_slot = (t->>2)::int
				JOIN teams tr ON tr.tournament_id = ${id}::bigint AND tr.pool = p.pool AND tr.pool_slot = (t->>3)::int`,
			sql`INSERT INTO matches (tournament_id, stage, bracket_round, label, seed_a, seed_b, sort_order)
				SELECT ${id}::bigint, 'bracket', b->>0, b->>1, (b->>2)::int, (b->>3)::int, (b->>4)::int
				FROM jsonb_array_elements(${JSON.stringify(bracketRows)}::jsonb) b`,
			sql`UPDATE matches m SET next_match_id = n.id, next_side = x->>2
				FROM jsonb_array_elements(${JSON.stringify(plan.links)}::jsonb) x
				JOIN matches n ON n.label = x->>1 AND n.stage = 'bracket' AND n.tournament_id = ${id}::bigint
				WHERE m.label = x->>0 AND m.stage = 'bracket' AND m.tournament_id = ${id}::bigint`,
			sql`INSERT INTO organizers (tournament_id, email) VALUES (${id}::bigint, ${email})`,
		]);
	} catch (err) {
		// Leave nothing half-made behind.
		await sql`DELETE FROM organizers WHERE tournament_id = ${id}`;
		await sql`DELETE FROM matches WHERE tournament_id = ${id}`;
		await sql`DELETE FROM teams WHERE tournament_id = ${id}`;
		await sql`DELETE FROM tournaments WHERE id = ${id}`;
		throw err;
	}
	return id;
}
