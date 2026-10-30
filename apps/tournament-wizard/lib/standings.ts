type Row = Record<string, any>;

// Pool standings, same rules as the workbook:
// score = wins*1000 + (sets won / sets lost)*10 + (points for / points against)
export function computeStandings(teams: Row[], poolMatches: Row[]) {
	const stats = new Map<number, Row>();
	for (const t of teams) {
		stats.set(Number(t.id), {
			id: Number(t.id),
			number: t.number,
			name: t.name,
			pool: t.pool,
			pool_slot: t.pool_slot,
			code: `${t.pool}${t.pool_slot}`,
			played: 0,
			wins: 0,
			losses: 0,
			sets_won: 0,
			sets_lost: 0,
			pts_for: 0,
			pts_against: 0,
		});
	}
	for (const m of poolMatches) {
		if (m.status !== "final" || m.a_sets == null || m.b_sets == null) continue;
		const a = stats.get(Number(m.team_a_id));
		const b = stats.get(Number(m.team_b_id));
		if (!a || !b) continue;
		a.played++;
		b.played++;
		a.sets_won += m.a_sets;
		a.sets_lost += m.b_sets;
		b.sets_won += m.b_sets;
		b.sets_lost += m.a_sets;
		a.pts_for += m.a_pts ?? 0;
		a.pts_against += m.b_pts ?? 0;
		b.pts_for += m.b_pts ?? 0;
		b.pts_against += m.a_pts ?? 0;
		if (m.a_sets > m.b_sets) a.wins++;
		else if (m.b_sets > m.a_sets) b.wins++;
	}
	const list = [...stats.values()];
	for (const s of list) {
		s.losses = s.played - s.wins;
		const setRatio = s.sets_lost > 0 ? s.sets_won / s.sets_lost : s.sets_won;
		const ptRatio = s.pts_against > 0 ? s.pts_for / s.pts_against : 1;
		s.score = s.wins * 1000 + setRatio * 10 + ptRatio;
	}
	const byScore = (x: Row, y: Row) => y.score - x.score || x.number - y.number;
	for (const pool of ["A", "B", "C", "D"]) {
		list
			.filter((s) => s.pool === pool)
			.sort(byScore)
			.forEach((s, i) => (s.pool_rank = i + 1));
	}
	for (let r = 1; r <= 4; r++) {
		list
			.filter((s) => s.pool_rank === r)
			.sort(byScore)
			.forEach((s, i) => (s.seed = (r - 1) * 4 + i + 1));
	}
	return list.sort((x, y) => x.seed - y.seed);
}

// Verify a Stripe webhook: header "t=...,v1=..." signed with HMAC-SHA256 over "t.body".
export async function verifyStripeSignature(body: string, header: string | undefined, secret: string) {
	if (!header) return false;
	const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
	const t = parts["t"];
	const v1 = header
		.split(",")
		.filter((p) => p.startsWith("v1="))
		.map((p) => p.slice(3));
	if (!t || v1.length === 0) return false;
	if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
	const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return v1.some((candidate) => candidate.length === hex.length && candidate === hex);
}
