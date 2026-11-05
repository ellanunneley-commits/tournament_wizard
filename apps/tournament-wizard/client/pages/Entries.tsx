import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2, ShieldCheck, Ticket } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Label } from "../components/Label";
import { Badge } from "../components/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { Stat } from "../components/Stat";
import { ShareLink } from "../components/ShareLink";
import { FeesCard, useFees, usd } from "../components/FeesCard";
import { useT } from "../lib/useT";
import { ScorekeepersCard } from "../components/ScorekeepersCard";
import { List, ListItem } from "../components/List";
import { Media } from "../components/Media";
import { EmptyState } from "../components/EmptyState";
import { toast } from "../components/Toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { api } from "../lib/tournament";
import { useAccess } from "../lib/access";
import { get } from "../lib/http";

type Entry = {
	id: string;
	email: string;
	source: "stripe" | "manual";
	amount_total: number | null;
	currency: string | null;
	created_at: string;
	team_id: string | null;
	team_name: string | null;
	pool: string | null;
	pool_slot: number | null;
	player_count: number | null;
};
type Organizer = { id: string; email: string };

const money = (e: Entry) => (e.amount_total == null ? "—" : `${(e.amount_total / 100).toFixed(2)} ${String(e.currency ?? "").toUpperCase()}`);

type Summary = {
	totals: { currency: string; entries: number; total_cents: number; missing_amount: number }[];
};

function moneyTotals(s: Summary | undefined, key: "total_cents") {
	if (!s || s.totals.length === 0) return "0.00";
	return s.totals.map((t) => `${(t[key] / 100).toFixed(2)} ${t.currency.toUpperCase()}`).join(" + ");
}

export default function Entries() {
	const qc = useQueryClient();
	const tour = useT();
	const { data: access } = useAccess();
	const isAdmin = !!access?.is_admin;
	const { data: entries = [], isLoading } = useQuery<Entry[]>({
		queryKey: ["entries", tour.tid],
		enabled: isAdmin,
		queryFn: () => get(tour.api("/entries")),
	});
	const { data: organizers = [] } = useQuery<Organizer[]>({
		queryKey: ["organizers", tour.tid],
		enabled: isAdmin,
		queryFn: () => get(tour.api("/organizers")),
	});

	const { data: summary } = useQuery<Summary>({
		queryKey: ["entries-summary", tour.tid],
		enabled: isAdmin,
		queryFn: () => get(tour.api("/entries/summary")),
	});
	const { data: fees } = useFees(isAdmin);

	const [link, setLink] = React.useState("");
	const [tName, setTName] = React.useState("");
	const [secret, setSecret] = React.useState("");
	const [format, setFormat] = React.useState("court");
	const [dialog, setDialog] = React.useState<{ id: string | null; email: string; amount: string } | null>(null);
	const [orgEmail, setOrgEmail] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	React.useEffect(() => setLink(access?.payment_link ?? ""), [access?.payment_link]);
	React.useEffect(() => setTName(access?.tournament_name ?? ""), [access?.tournament_name]);
	React.useEffect(() => {
		if (access?.rules) setFormat(access.rules.scoring_format);
	}, [access?.rules?.scoring_format]);

	async function run(fn: () => Promise<unknown>, ok: string) {
		setBusy(true);
		try {
			await fn();
			await qc.invalidateQueries();
			toast.success(ok);
			return true;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (!access) return <PageHeader title="Entries" />;
	if (!isAdmin) return <EmptyState icon={<ShieldCheck />} title="Organizers only" description="This page is for the people running the tournament." />;

	const columns: ColumnDef<Entry, unknown>[] = [
		{ accessorKey: "email", header: "Paid with" },
		{
			id: "team",
			header: "Team",
			accessorFn: (e) => e.team_name ?? "Not named yet",
			cell: ({ row }) => (row.original.team_name ? `${row.original.team_name} (${row.original.pool}${row.original.pool_slot})` : <Badge tone="warning">Not named yet</Badge>),
		},
		{ id: "players", header: "Players", accessorFn: (e) => e.player_count ?? 0 },
		{ id: "amount", header: "Amount", enableSorting: false, accessorFn: money },
		{ accessorKey: "source", header: "Source", cell: ({ row }) => <Badge>{row.original.source === "stripe" ? "Stripe" : "Added by hand"}</Badge> },
		{
			id: "edit",
			header: "",
			enableSorting: false,
			cell: ({ row }) => (
				<Button size="icon" variant="tertiary" aria-label={`Edit email for ${row.original.email}`} onClick={() => setDialog({ id: row.original.id, email: row.original.email, amount: "" })}>
					<Pencil />
				</Button>
			),
		},
	];

	const webhookUrl = `${window.location.origin}/app-api/stripe-webhook/${tour.tid}`;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Entries"
				actions={
					<Button variant="primary" onClick={() => setDialog({ id: null, email: "", amount: "" })}>
						<Plus /> Add entry
					</Button>
				}
			/>

			<ShareLink title="Tournament link" note="Print or send this QR code and link. Anyone can open it and sign in, but they only see the tournament if they are registered or invited by a captain." />

			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Paid entries" value={String(summary?.totals.reduce((n, t) => n + t.entries, 0) ?? 0)} />
				<Stat label="Entry fees collected" value={moneyTotals(summary, "total_cents")} />
				<Stat label="App fee balance" value={fees ? usd(fees.balance_cents) : "—"} context={fees ? (fees.waived ? "waived" : `${usd(fees.flat_cents)} flat + ${Math.round(fees.fee_rate * 100)}% of entries`) : undefined} />
				<Stat label="Entries without an amount" value={String(summary?.totals.reduce((n, t) => n + t.missing_amount, 0) ?? 0)} context="not in the totals" />
			</div>

			{fees && <FeesCard fees={fees} />}

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<h3 className="text-base font-semibold">Tournament and entry payment</h3>
					<form
						className="mt-3 space-y-3"
						onSubmit={async (e) => {
							e.preventDefault();
							if (await run(() => api(tour.api("/settings"), "PUT", { name: tName, payment_link: link, stripe_webhook_secret: secret, scoring_format: format }), "Saved")) setSecret("");
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="t-name">Tournament name</Label>
							<Input id="t-name" value={tName} onChange={(e) => setTName(e.target.value)} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="r-format">Scoring</Label>
							<Select value={format} onValueChange={setFormat}>
								<SelectTrigger id="r-format">
									<SelectValue placeholder="Choose a format" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="court">Court or grass</SelectItem>
									<SelectItem value="sand">Sand</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-sm text-secondary">
								{format === "sand" ? "Sand: one set to 21, win by 2." : "Court or grass: best of 3 sets to 25, win by 2. The third set is to 15, win by 2."}
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="pay-link">Stripe payment link</Label>
							<Input id="pay-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://buy.stripe.com/…" />
							<p className="text-sm text-secondary">Teams that have not paid are shown this link. It is your own Stripe, so you keep the entry fees. Teams should pay from the button in this app: it tags the payment with this tournament. Someone who paid another way can be added with "Add entry".</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="hook-url">Webhook address for Stripe</Label>
							<Input id="hook-url" readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} />
							<p className="text-sm text-secondary">In your Stripe dashboard, add this as a webhook endpoint and send it the "checkout.session.completed" event.</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="hook-secret">Stripe signing secret</Label>
							<Input id="hook-secret" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={access?.has_webhook_secret ? "Saved. Paste a new one to replace it" : "whsec_…"} autoComplete="off" />
							<p className="text-sm text-secondary">Stripe shows this after you add the webhook. It lets the app confirm payments really came from Stripe.</p>
						</div>
						<div className="flex justify-end">
							<Button type="submit" variant="primary" isLoading={busy}>
								Save
							</Button>
						</div>
					</form>
				</Card>

				<div className="space-y-2">
					<h3 className="text-base font-semibold">Organizers</h3>
					<form
						className="flex gap-2"
						onSubmit={async (e) => {
							e.preventDefault();
							if (await run(() => api(tour.api("/organizers"), "POST", { email: orgEmail }), "Organizer added")) setOrgEmail("");
						}}
					>
						<Input type="email" aria-label="Organizer email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="organizer@email.com" />
						<Button type="submit" variant="primary" disabled={!orgEmail.includes("@") || busy}>
							Add
						</Button>
					</form>
					<List>
						{organizers.map((o) => (
							<ListItem
								key={o.id}
								leading={<Media initials={o.email} shape="circle" />}
								title={o.email}
								trailing={
									<Button size="icon" variant="tertiary" aria-label={`Remove ${o.email}`} disabled={busy || organizers.length <= 1} onClick={() => run(() => api(tour.api(`/organizers/${o.id}`), "DELETE"), "Organizer removed")}>
										<Trash2 />
									</Button>
								}
							/>
						))}
					</List>
				</div>
			</div>

			<ScorekeepersCard />
			<section className="space-y-2">
				<h3 className="text-base font-semibold">Paid entries</h3>
				<DataTable
					columns={columns}
					data={entries}
					isLoading={isLoading}
					emptyState={<EmptyState icon={<Ticket />} title="No entries yet" description="Paid entries appear here as soon as Stripe confirms a payment." />}
				/>
			</section>

			<Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{dialog?.id ? "Change the paying email" : "Add an entry"}</DialogTitle>
						<DialogDescription>
							{dialog?.id ? "Use this when a captain signs in with a different email than the one they paid with." : "For someone who paid another way. They sign in with this email to name their team."}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="entry-email">Email</Label>
						<Input id="entry-email" type="email" value={dialog?.email ?? ""} onChange={(e) => setDialog((d) => (d ? { ...d, email: e.target.value } : d))} />
					</div>
					{dialog && !dialog.id && (
						<div className="space-y-2">
							<Label htmlFor="entry-amount">Amount paid (dollars, optional)</Label>
							<Input id="entry-amount" inputMode="decimal" value={dialog.amount} onChange={(e) => setDialog((d) => (d ? { ...d, amount: e.target.value } : d))} placeholder="60" />
							<p className="text-sm text-secondary">Counts toward the entry fee total used for the app fee.</p>
						</div>
					)}
					<DialogFooter>
						<Button variant="tertiary" onClick={() => setDialog(null)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							isLoading={busy}
							disabled={!dialog?.email.includes("@")}
							onClick={async () => {
								if (!dialog) return;
								const ok = dialog.id
									? await run(() => api(tour.api(`/entries/${dialog.id}`), "PATCH", { email: dialog.email }), "Email updated")
									: await run(() => api(tour.api("/entries"), "POST", { email: dialog.email, amount: dialog.amount }), "Entry added");
								if (ok) setDialog(null);
							}}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
