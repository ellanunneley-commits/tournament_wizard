import type { Sql } from "./ctx";

type Row = Record<string, any>;

// The organizer pays the app owner a flat fee per tournament, plus a share of every team's entry fee.
export const FLAT_FEE_CENTS = 10000;
export const APP_FEE_RATE = 0.1;

// What one tournament owes the app owner. A waived tournament owes nothing and is open.
export async function feeFigures(sql: Sql, tid: number, waived: boolean) {
	const [e] = (await sql`SELECT coalesce(sum(amount_total), 0)::int AS total, count(*)::int AS entries FROM registrations WHERE tournament_id = ${tid} AND status = 'paid'`) as Row[];
	const [p] = (await sql`SELECT coalesce(sum(amount_cents), 0)::int AS paid FROM platform_payments WHERE tournament_id = ${tid}`) as Row[];
	const percentCents = waived ? 0 : Math.round(e.total * APP_FEE_RATE);
	const flatCents = waived ? 0 : FLAT_FEE_CENTS;
	const dueCents = flatCents + percentCents;
	return {
		waived,
		flat_cents: flatCents,
		fee_rate: APP_FEE_RATE,
		entries: e.entries as number,
		entries_total_cents: e.total as number,
		percent_cents: percentCents,
		due_cents: dueCents,
		paid_cents: p.paid as number,
		balance_cents: Math.max(0, dueCents - p.paid),
		activated: waived || p.paid >= FLAT_FEE_CENTS,
	};
}
