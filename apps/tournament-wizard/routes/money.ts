import { Hono } from "hono";
import { db } from "../lib/db";
import { verifyStripeSignature } from "../lib/standings";
import { feeFigures } from "../lib/fees";
import { Env, Row, forbidden, ownerOnly } from "../lib/ctx";

const P = "/app-api/t/:tid";

// The tag put on a tournament's payment link, which Stripe hands back with each payment.
export const stripeRef = (tid: number) => `tw-${tid}`;

// Entries, fees, payment settings, organizers and the Stripe webhook. Only organizers (and the app owner) see the money.
export function moneyRoutes(app: Hono<Env>) {
	app.get(`${P}/entries`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		return c.json(
			await c.var.sql`SELECT r.id, r.email, r.source, r.amount_total, r.currency, r.created_at, r.team_id, t.name AS team_name, t.pool, t.pool_slot,
				(SELECT count(*)::int FROM players p WHERE p.team_id = r.team_id) AS player_count
				FROM registrations r LEFT JOIN teams t ON t.id = r.team_id WHERE r.tournament_id = ${c.var.tid} ORDER BY r.id DESC`,
		);
	});

	app.get(`${P}/entries/summary`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const rows = (await c.var.sql`SELECT coalesce(lower(currency), 'usd') AS currency, count(*)::int AS entries, coalesce(sum(amount_total), 0)::int AS total_cents,
			count(*) FILTER (WHERE amount_total IS NULL)::int AS missing_amount
			FROM registrations WHERE tournament_id = ${c.var.tid} AND status = 'paid' GROUP BY 1 ORDER BY 1`) as Row[];
		return c.json({ totals: rows });
	});

	app.post(`${P}/entries`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const body = await c.req.json();
		const email = String(body.email ?? "").trim().toLowerCase();
		if (!email.includes("@")) return c.json({ error: "Enter a valid email" }, 400);
		const amountText = String(body.amount ?? "").trim().replace(/^\$/, "");
		if (amountText && !/^\d+(\.\d{1,2})?$/.test(amountText)) return c.json({ error: "Enter the amount as a number, like 60" }, 400);
		const cents = amountText ? Math.round(Number(amountText) * 100) : null;
		const [row] = await c.var.sql`INSERT INTO registrations (tournament_id, email, source, amount_total, currency) VALUES (${c.var.tid}, ${email}, 'manual', ${cents}, ${cents === null ? null : "usd"}) RETURNING *`;
		return c.json(row);
	});

	app.patch(`${P}/entries/:id`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const email = String((await c.req.json()).email ?? "").trim().toLowerCase();
		if (!email.includes("@")) return c.json({ error: "Enter a valid email" }, 400);
		const [row] = await c.var.sql`UPDATE registrations SET email = ${email}, updated_at = NOW() WHERE id = ${Number(c.req.param("id"))} AND tournament_id = ${c.var.tid} RETURNING *`;
		return c.json(row ?? {});
	});

	// Where teams pay their entry fee, and the signing secret that lets this tournament's Stripe confirm payments.
	app.put(`${P}/settings`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const body = await c.req.json();
		const link = String(body.payment_link ?? "").trim();
		const name = String(body.name ?? "").trim();
		const secret = String(body.stripe_webhook_secret ?? "").trim();
		await c.var.sql`UPDATE tournaments SET payment_link = ${link || null}, name = coalesce(${name || null}, name), updated_at = NOW() WHERE id = ${c.var.tid}`;
		if (secret) await c.var.sql`UPDATE tournaments SET stripe_webhook_secret = ${secret} WHERE id = ${c.var.tid}`;
		// Scoring format: sand is one set to 21; court or grass is best of three, to 25 with the last set to 15. Both are won by 2.
		const format = body.scoring_format === "sand" ? "sand" : body.scoring_format === "court" ? "court" : null;
		if (format === "sand") {
			await c.var.sql`UPDATE tournaments SET scoring_format = 'sand', sets_to_win = 1, set_points = 21, deciding_set_points = 21 WHERE id = ${c.var.tid}`;
		} else if (format === "court") {
			await c.var.sql`UPDATE tournaments SET scoring_format = 'court', sets_to_win = 2, set_points = 25, deciding_set_points = 15 WHERE id = ${c.var.tid}`;
		}
		return c.json({ ok: true });
	});

	app.get(`${P}/organizers`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		return c.json(await c.var.sql`SELECT id, email FROM organizers WHERE tournament_id = ${c.var.tid} ORDER BY id`);
	});

	app.post(`${P}/organizers`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const email = String((await c.req.json()).email ?? "").trim().toLowerCase();
		if (!email.includes("@")) return c.json({ error: "Enter a valid email" }, 400);
		const [row] = await c.var.sql`INSERT INTO organizers (tournament_id, email) VALUES (${c.var.tid}, ${email}) ON CONFLICT (tournament_id, email) DO UPDATE SET email = excluded.email RETURNING id, email`;
		return c.json(row);
	});

	app.delete(`${P}/organizers/:id`, async (c) => {
		if (!c.var.v.isAdmin) return forbidden(c);
		const [n] = (await c.var.sql`SELECT count(*)::int AS n FROM organizers WHERE tournament_id = ${c.var.tid}`) as Row[];
		if (n.n <= 1) return c.json({ error: "There must be at least one organizer" }, 400);
		await c.var.sql`DELETE FROM organizers WHERE id = ${Number(c.req.param("id"))} AND tournament_id = ${c.var.tid}`;
		return c.json({ ok: true });
	});

	// The app fee: a flat fee plus a share of the entry fees.
	app.get(`${P}/fees`, async (c) => {
		const v = c.var.v;
		if (!v.isAdmin) return forbidden(c);
		const figures = await feeFigures(c.var.sql, c.var.tid, !!v.tournament.fees_waived);
		const [link] = (await c.var.sql`SELECT value FROM settings WHERE key = 'platform_fee_link'`) as Row[];
		const payments = (await c.var.sql`SELECT id, amount_cents, note, created_at FROM platform_payments WHERE tournament_id = ${c.var.tid} ORDER BY id DESC`) as Row[];
		return c.json({ ...figures, is_owner: v.isOwner, payment_link: link?.value ?? null, payments });
	});

	// Only the owner records what an organizer paid, waives a tournament's fee, and sets where organizers pay.
	app.post(`${P}/fees/payments`, async (c) => {
		if (!c.var.v.isOwner) return ownerOnly(c);
		const body = await c.req.json();
		const amountText = String(body.amount ?? "").trim().replace(/^\$/, "");
		if (!/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) return c.json({ error: "Enter the amount as a number, like 100" }, 400);
		const note = String(body.note ?? "").trim() || null;
		const [row] = await c.var.sql`INSERT INTO platform_payments (tournament_id, amount_cents, note) VALUES (${c.var.tid}, ${Math.round(Number(amountText) * 100)}, ${note}) RETURNING *`;
		return c.json(row);
	});

	app.put(`${P}/fees/waive`, async (c) => {
		if (!c.var.v.isOwner) return ownerOnly(c);
		const waived = !!(await c.req.json()).waived;
		await c.var.sql`UPDATE tournaments SET fees_waived = ${waived}, updated_at = NOW() WHERE id = ${c.var.tid}`;
		return c.json({ ok: true });
	});

	app.put(`${P}/fees/settings`, async (c) => {
		if (!c.var.v.isOwner) return ownerOnly(c);
		const link = String((await c.req.json()).payment_link ?? "").trim();
		await c.var.sql`INSERT INTO settings (key, value) VALUES ('platform_fee_link', ${link || null}) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = NOW()`;
		return c.json({ ok: true });
	});

	// Stripe calls a tournament's own address when a team pays. The signature, checked with that tournament's secret, proves it came from its Stripe.
	app.post("/app-api/stripe-webhook/:tid", async (c) => {
		const tid = Number(c.req.param("tid"));
		const sql = db(c);
		const [t] = (await sql`SELECT stripe_webhook_secret FROM tournaments WHERE id = ${tid}`) as Row[];
		if (!t?.stripe_webhook_secret) return c.json({ error: "This tournament has no webhook secret yet" }, 400);
		const raw = await c.req.text();
		if (!(await verifyStripeSignature(raw, c.req.header("stripe-signature"), t.stripe_webhook_secret))) {
			return c.json({ error: "Bad signature" }, 400);
		}
		const event = JSON.parse(raw);
		if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
			const s = event.data?.object ?? {};
			// Only payments made through this tournament's link count. Anything else sold on the same Stripe account
			// (t-shirts, another event) has no tag or a different one, and is ignored.
			if (s.client_reference_id !== stripeRef(tid)) return c.json({ received: true, ignored: "not a payment for this tournament" });
			if (s.payment_status === "paid") {
				const email = String(s.customer_details?.email ?? s.customer_email ?? "").trim().toLowerCase();
				if (email) {
					await sql`INSERT INTO registrations (tournament_id, email, stripe_session_id, amount_total, currency, source, status)
						VALUES (${tid}, ${email}, ${s.id}, ${s.amount_total ?? null}, ${s.currency ?? null}, 'stripe', 'paid')
						ON CONFLICT (stripe_session_id) DO NOTHING`;
				}
			}
		}
		return c.json({ received: true });
	});
}
