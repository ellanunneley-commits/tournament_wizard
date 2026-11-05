import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, Eye, LogIn, Trash2, UserPlus } from "lucide-react";
import { useSession } from "../lib/auth";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Label } from "../components/Label";
import { List, ListItem } from "../components/List";
import { Media } from "../components/Media";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { toast } from "../components/Toast";
import { api } from "../lib/tournament";
import { MyEntry, useAccess } from "../lib/access";
import { ShareLink } from "../components/ShareLink";
import { useT } from "../lib/useT";

function ClaimForm({ entry, openSlots }: { entry: MyEntry; openSlots: number }) {
	const tour = useT();
	const qc = useQueryClient();
	const [name, setName] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			await api(tour.api(`/entries/${entry.id}/claim`), "POST", { name });
			await qc.invalidateQueries();
			toast.success("Your team is in");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not save your team");
		} finally {
			setBusy(false);
		}
	}
	return (
		<Card>
			<h3 className="text-base font-semibold">Name your team</h3>
			<p className="mt-1 text-sm text-secondary">Your payment is confirmed. Enter your team name to take your place in the tournament.</p>
			<form className="mt-4 space-y-3" onSubmit={submit}>
				<div className="space-y-2">
					<Label htmlFor={`claim-${entry.id}`}>Team name</Label>
					<Input id={`claim-${entry.id}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spike Squad" disabled={openSlots === 0} />
				</div>
				{openSlots === 0 && <p className="text-sm text-secondary">All 16 places are taken. Please contact the organizers.</p>}
				<div className="flex justify-end">
					<Button type="submit" variant="primary" isLoading={busy} disabled={!name.trim() || openSlots === 0}>
						Join the tournament
					</Button>
				</div>
			</form>
		</Card>
	);
}

function TeamEditor({ entry }: { entry: MyEntry }) {
	const tour = useT();
	const qc = useQueryClient();
	const [name, setName] = React.useState(entry.team_name ?? "");
	const [player, setPlayer] = React.useState("");
	const [guest, setGuest] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	React.useEffect(() => setName(entry.team_name ?? ""), [entry.team_name]);

	async function run(fn: () => Promise<unknown>, ok: string) {
		setBusy(true);
		try {
			await fn();
			await qc.invalidateQueries();
			toast.success(ok);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Card>
				<div className="mb-3 flex items-center justify-between gap-2">
					<h3 className="text-base font-semibold">Team</h3>
					<Badge tone="success">{`Pool ${entry.pool} · Slot ${entry.pool_slot}`}</Badge>
				</div>
				<form
					className="space-y-3"
					onSubmit={(e) => {
						e.preventDefault();
						run(() => api(tour.api(`/teams/${entry.team_id}`), "PATCH", { name }), "Team name saved");
					}}
				>
					<div className="space-y-2">
						<Label htmlFor={`name-${entry.id}`}>Team name</Label>
						<Input id={`name-${entry.id}`} value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div className="flex justify-end">
						<Button type="submit" variant="primary" isLoading={busy} disabled={!name.trim() || name.trim() === entry.team_name}>
							Save name
						</Button>
					</div>
				</form>
			</Card>
			<div className="space-y-3">
				<h3 className="text-base font-semibold">Players</h3>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						run(async () => {
							await api(tour.api(`/teams/${entry.team_id}/players`), "POST", { name: player });
							setPlayer("");
						}, "Player added");
					}}
				>
					<Input aria-label="Player name" value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Player name" />
					<Button type="submit" variant="primary" disabled={!player.trim() || busy}>
						<UserPlus /> Add
					</Button>
				</form>
				<List emptyState={<EmptyState title="No players yet" description="Add everyone on your team." />}>
					{entry.players.map((p) => (
						<ListItem
							key={p.id}
							leading={<Media initials={p.name} shape="circle" />}
							title={p.name}
							trailing={
								<Button size="icon" variant="tertiary" aria-label={`Remove ${p.name}`} disabled={busy} onClick={() => run(() => api(tour.api(`/players/${p.id}`), "DELETE"), "Player removed")}>
									<Trash2 />
								</Button>
							}
						/>
					))}
				</List>
			</div>
			<div className="space-y-3 md:col-span-2">
				<h3 className="text-base font-semibold">Friends and family</h3>
				<p className="text-sm text-secondary">Invite people by email. They sign in with that email to follow standings, schedule and bracket, but can't change anything.</p>
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						run(async () => {
							await api(tour.api(`/teams/${entry.team_id}/viewers`), "POST", { email: guest });
							setGuest("");
						}, "Guest invited");
					}}
				>
					<Input type="email" aria-label="Guest email" value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="friend@email.com" />
					<Button type="submit" variant="primary" disabled={!guest.includes("@") || busy}>
						<UserPlus /> Invite
					</Button>
				</form>
				<List emptyState={<EmptyState title="No guests invited yet" description="Invite anyone who wants to watch." />}>
					{entry.guests.map((g) => (
						<ListItem
							key={g.id}
							leading={<Media initials={g.email} shape="circle" />}
							title={g.email}
							trailing={
								<Button size="icon" variant="tertiary" aria-label={`Remove ${g.email}`} disabled={busy} onClick={() => run(() => api(tour.api(`/viewers/${g.id}`), "DELETE"), "Guest removed")}>
									<Trash2 />
								</Button>
							}
						/>
					))}
				</List>
				<ShareLink title="Share the app" note="Send this link or QR code to your guests after you invite them. They sign in with the email you invited." />
			</div>
		</div>
	);
}

function PayWithStripe({ email, link }: { email: string; link: string | null }) {
	if (!link) {
		return <EmptyState icon={<CreditCard />} title="Entry payments are not open yet" description="The organizers have not set up payment. Check back soon." />;
	}
	return (
		<EmptyState
			icon={<CreditCard />}
			title="Pay the entry fee to join"
			description={`Pay once for your whole team, using ${email} as your email at checkout. Come back here afterwards to name your team.`}
			action={
				<Button variant="primary" asChild>
					<a href={link} target="_blank" rel="noreferrer">
						Pay the entry fee
					</a>
				</Button>
			}
		/>
	);
}

export default function MyTeam() {
	const { data, isLoading } = useAccess();
	const { signIn } = useSession();

	if (isLoading || !data) return <PageHeader title="My team" />;

	if (!data.email) {
		return (
			<div className="space-y-6">
				<PageHeader title="My team" />
				<EmptyState
					icon={<LogIn />}
					title="Sign in to manage your team"
					description="Sign in with the email you used to pay the entry fee."
					action={<Button variant="primary" onClick={() => signIn()}>Sign in</Button>}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader title="My team" />
			{data.registrations.map((entry) => (entry.team_id ? <TeamEditor key={entry.id} entry={entry} /> : <ClaimForm key={entry.id} entry={entry} openSlots={data.open_slots} />))}
			{data.registrations.length === 0 && data.is_admin && (
				<EmptyState icon={<Eye />} title="You're running this tournament" description="Organizers don't have a team of their own here. Captains manage their teams from this page; you can rename any team from the Teams page." />
			)}
			{data.registrations.length === 0 && !data.is_admin && data.can_see && (
				<EmptyState icon={<Eye />} title="You're watching this tournament" description="You were invited as a guest, so you can follow standings, schedule and the bracket. Team pages are managed by captains." />
			)}
			{data.registrations.length === 0 && !data.can_see && <PayWithStripe email={data.email} link={data.payment_link} />}
		</div>
	);
}
