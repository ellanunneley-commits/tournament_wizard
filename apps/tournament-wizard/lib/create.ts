import type { Sql } from "./ctx";


// A new tournament starts with 16 open team spots in 4 pools, the 24 pool matches and the 15 bracket matches.
export async function createTournament(sql: Sql, name: string, email: string) {
	const [t] = (await sql`INSERT INTO tournaments (name, created_by) VALUES (${name}, ${email}) RETURNING id`) as { id: string }[];
	const id = Number(t.id);
	try {
		await sql.transaction([
			sql`INSERT INTO teams (tournament_id, number, name, pool, pool_slot)
				SELECT ${id}::bigint, n, 'Team ' || n, chr(65 + (n-1) % 4), (n-1) / 4 + 1 FROM generate_series(1,16) n`,
			sql`INSERT INTO matches (tournament_id, stage, pool, round, label, team_a_id, team_b_id, ref_team_id, sort_order)
				SELECT ${id}::bigint, 'pool', p.pool, t.round, p.pool || t.round, ta.id, tb.id, tr.id, t.round * 10 + ascii(p.pool) - 64
				FROM (VALUES ('A'),('B'),('C'),('D')) p(pool)
				CROSS JOIN (VALUES (1,1,3,4),(2,2,4,1),(3,1,2,3),(4,3,4,2),(5,1,4,3),(6,2,3,4)) t(round,a,b,r)
				JOIN teams ta ON ta.tournament_id = ${id}::bigint AND ta.pool = p.pool AND ta.pool_slot = t.a
				JOIN teams tb ON tb.tournament_id = ${id}::bigint AND tb.pool = p.pool AND tb.pool_slot = t.b
				JOIN teams tr ON tr.tournament_id = ${id}::bigint AND tr.pool = p.pool AND tr.pool_slot = t.r`,
			sql`INSERT INTO matches (tournament_id, stage, bracket_round, label, seed_a, seed_b, sort_order)
				SELECT ${id}::bigint, 'bracket', b.br, b.label, b.sa, b.sb, b.so FROM (VALUES
					('Round of 16','Match 1',1,16,1),('Round of 16','Match 2',2,15,2),('Round of 16','Match 3',3,14,3),('Round of 16','Match 4',4,13,4),
					('Round of 16','Match 5',5,12,5),('Round of 16','Match 6',6,11,6),('Round of 16','Match 7',7,10,7),('Round of 16','Match 8',8,9,8),
					('Quarterfinal','QF1',NULL::int,NULL::int,9),('Quarterfinal','QF2',NULL::int,NULL::int,10),('Quarterfinal','QF3',NULL::int,NULL::int,11),('Quarterfinal','QF4',NULL::int,NULL::int,12),
					('Semifinal','SF1',NULL::int,NULL::int,13),('Semifinal','SF2',NULL::int,NULL::int,14),('Final','Final',NULL::int,NULL::int,15)
				) b(br,label,sa,sb,so)`,
			sql`UPDATE matches m SET next_match_id = n.id, next_side = x.side
				FROM (VALUES ('Match 1','QF1','a'),('Match 2','QF1','b'),('Match 3','QF2','a'),('Match 4','QF2','b'),('Match 5','QF3','a'),('Match 6','QF3','b'),('Match 7','QF4','a'),('Match 8','QF4','b'),
					('QF1','SF1','a'),('QF2','SF1','b'),('QF3','SF2','a'),('QF4','SF2','b'),('SF1','Final','a'),('SF2','Final','b')) x(src,dst,side)
				JOIN matches n ON n.label = x.dst AND n.stage = 'bracket' AND n.tournament_id = ${id}::bigint
				WHERE m.label = x.src AND m.stage = 'bracket' AND m.tournament_id = ${id}::bigint`,
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
