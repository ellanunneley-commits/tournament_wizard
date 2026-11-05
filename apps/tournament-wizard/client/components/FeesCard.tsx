import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";
import { Badge } from "./Badge";
import { DetailList, DetailItem } from "./DetailList";
import { List, ListItem } from "./List";
import { toast } from "./Toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./Dialog";
import { api } from "../lib/tournament";
import { useT } from "../lib/useT";
import { Switch } from "./Switch";
import { get } from "../lib/http";

export type Fees = {
	waived: boolean;
	flat_cents: number;
	fee_rate: number;
	entries: number;
	entries_total_cents: number;
	percent_cents: number;
	due_cents: number;
	paid_cents: number;
	balance_cents: number;
	activated: boolean;
	is_owner: boolean;
	payment_link: string | null;
	payments: { id: string; amount_cents: number; note: string | null; created_at: string }[];
};

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function useFees(enabled: boolean) {
	const t = useT();
	return useQuery<Fees>({
		queryKey: ["fees", t.tid],
		enabled,
		queryFn: () => get(t.api("/fees")),
	});
}

// The money owed to the app owner. Only organizers ever see this; only the owner can record payments.
export function FeesCard({ fees }: { fees: Fees }) {
	const qc = useQueryClient();
	const tour = useT();
	const [link, setLink] = React.useState(fees.payment_link ?? "");
	const [open, setOpen] = React.useState(false);
	const [amount, setAmount] = React.useState("");
	const [note, setNote] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	React.useEffect(() => setLink(fees.payment_link ?? ""), [fees.payment_link]);

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

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-base font-semibold">App fee</h3>
				{fees.waived ? <Badge tone="success">Fee waived</Badge> : fees.activated ? <Badge tone="success">Tournament open</Badge> : <Badge tone="warning">Pay {usd(fees.flat_cents || 10000)} to open the tournament</Badge>}
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<DetailList title="What is owed">
					<DetailItem label="Flat fee for this tournament">{usd(fees.flat_cents)}</DetailItem>
					<DetailItem label={`${Math.round(fees.fee_rate * 100)}% of ${usd(fees.entries_total_cents)} in entry fees`}>{usd(fees.percent_cents)}</DetailItem>
					<DetailItem label="Total so far">{usd(fees.due_cents)}</DetailItem>
					<DetailItem label="Paid">{usd(fees.paid_cents)}</DetailItem>
					<DetailItem label="Balance">{usd(fees.balance_cents)}</DetailItem>
				</DetailList>
				<Card>
					<h3 className="text-base font-semibold">Pay the app fee</h3>
					<p className="mt-1 text-sm text-secondary">
						Teams and guests can see the tournament once the {usd(fees.flat_cents)} flat fee is paid. The {Math.round(fees.fee_rate * 100)}% share grows as teams pay their entry fee.
					</p>
					{fees.balance_cents > 0 && fees.payment_link && (
						<div className="mt-3">
							<Button variant="primary" asChild>
								<a href={fees.payment_link} target="_blank" rel="noreferrer">
									Pay the app fee
								</a>
							</Button>
						</div>
					)}
					{fees.is_owner && (
						<div className="mt-4 flex items-center gap-2">
							<Switch id="waive-fee" checked={fees.waived} disabled={busy} onCheckedChange={(on: boolean) => run(() => api(tour.api("/fees/waive"), "PUT", { waived: on }), on ? "Fee waived" : "Fee restored")} />
							<Label htmlFor="waive-fee">Waive the app fee for this tournament</Label>
						</div>
					)}
					{fees.is_owner && (
						<form
							className="mt-4 space-y-2"
							onSubmit={(e) => {
								e.preventDefault();
								run(() => api(tour.api("/fees/settings"), "PUT", { payment_link: link }), "Payment link saved");
							}}
						>
							<Label htmlFor="fee-link">Where organizers pay you (link)</Label>
							<div className="flex gap-2">
								<Input id="fee-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
								<Button type="submit" variant="secondary" isLoading={busy}>
									Save
								</Button>
							</div>
						</form>
					)}
				</Card>
			</div>
			{fees.is_owner && (
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<h3 className="text-base font-semibold">Payments received</h3>
						<Button variant="secondary" onClick={() => setOpen(true)}>
							<Plus /> Record payment
						</Button>
					</div>
					<List emptyState={<p className="p-4 text-sm text-secondary">No payments recorded yet.</p>}>
						{fees.payments.map((p) => (
							<ListItem key={p.id} title={usd(p.amount_cents)} description={`${p.note ?? "Payment"} · ${new Date(p.created_at).toLocaleDateString()}`} />
						))}
					</List>
				</div>
			)}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Record a payment</DialogTitle>
						<DialogDescription>Add what the organizer paid you. Once {usd(fees.flat_cents)} is recorded, teams can see the tournament.</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="pay-amount">Amount (dollars)</Label>
						<Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
					</div>
					<div className="space-y-2">
						<Label htmlFor="pay-note">Note (optional)</Label>
						<Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Flat fee" />
					</div>
					<DialogFooter>
						<Button variant="tertiary" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							isLoading={busy}
							disabled={!amount.trim()}
							onClick={async () => {
								if (await run(() => api(tour.api("/fees/payments"), "POST", { amount, note }), "Payment recorded")) {
									setOpen(false);
									setAmount("");
									setNote("");
								}
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
