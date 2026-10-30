import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Swords, Flag } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Label } from "../components/Label";
import { DetailList, DetailItem } from "../components/DetailList";
import { List, ListItem } from "../components/List";
import { Media } from "../components/Media";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { toast } from "../components/Toast";
import { MatchRow, TeamRow, api, isScored, scoreText } from "../lib/tournament";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";

type TeamDetail = { team: TeamRow; matches: MatchRow[]; players: { id: string; name: string }[]; claimed: boolean };

export default function Team() {
	const { id } = useParams();
	const tour = useT();
	const qc = useQueryClient();
	const { data: access } = useAccess();
	const [name, setName] = React.useState("");
	const [saving, setSaving] = React.useState(false);
	const { data, isLoading, isError } = useQuery<TeamDetail>({
		queryKey: ["teams", tour.tid, id],
		refetchInterval: 20000,
		queryFn: () =>
			fetch(tour.api(`/teams/${id}`)).then((r) => {
				if (!r.ok) throw new Error("Not found");
				return r.json();
			}),
	});

	React.useEffect(() => {
		if (data) setName(data.team.name);
	}, [data?.team.name]);

	if (isError) return <EmptyState title="Team not found" description="It may have been removed." />;
	if (isLoading || !data) return <PageHeader title="Team" />;
	const { team, matches, players, claimed } = data;
	const isAdmin = !!access?.is_admin;

	async function rename(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		try {
			await api(tour.api(`/teams/${team.id}`), "PATCH", { name });
			await qc.invalidateQueries();
			toast.success("Team renamed");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not rename");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader breadcrumbs={<Link to={tour.to("/teams")}>Teams</Link>} title={`${team.name} · ${team.code}`} />
			<div className="grid gap-4 md:grid-cols-2">
				<DetailList title="Record">
					<DetailItem label="Pool">{`Pool ${team.pool}`}</DetailItem>
					<DetailItem label="Entry">{claimed ? <Badge tone="success">Paid</Badge> : <Badge>Open place</Badge>}</DetailItem>
					<DetailItem label="Pool rank">{team.pool_rank}</DetailItem>
					<DetailItem label="Bracket seed">{team.seed}</DetailItem>
					<DetailItem label="Played">{team.played}</DetailItem>
					<DetailItem label="Wins – losses">{`${team.wins} – ${team.losses}`}</DetailItem>
					<DetailItem label="Sets (won – lost)">{`${team.sets_won} – ${team.sets_lost}`}</DetailItem>
					<DetailItem label="Points (for – against)">{`${team.pts_for} – ${team.pts_against}`}</DetailItem>
				</DetailList>
				<div className="space-y-4">
					{isAdmin && (
						<Card>
							<h3 className="mb-3 text-base font-semibold">Team name</h3>
							<form className="space-y-3" onSubmit={rename}>
								<div className="space-y-2">
									<Label htmlFor="team-name">Name</Label>
									<Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} />
								</div>
								<div className="flex justify-end">
									<Button type="submit" variant="primary" isLoading={saving} disabled={!name.trim() || name.trim() === team.name}>
										Save name
									</Button>
								</div>
							</form>
						</Card>
					)}
					<section className="space-y-2">
						<h3 className="text-base font-semibold">Players</h3>
						<List emptyState={<EmptyState title="No players listed yet" description="The captain adds players from the My team page." />}>
							{players.map((p) => (
								<ListItem key={p.id} leading={<Media initials={p.name} shape="circle" />} title={p.name} />
							))}
						</List>
					</section>
				</div>
			</div>
			<section className="space-y-2">
				<h3 className="text-base font-semibold">Matches</h3>
				<List emptyState={<EmptyState title="No matches yet" />}>
					{matches.map((m) => {
						const reffing = m.ref_team_id != null && String(m.ref_team_id) === String(team.id);
						const opponent = String(m.team_a_id) === String(team.id) ? m.team_b_name : m.team_a_name;
						return (
							<ListItem
								key={m.id}
								to={m.stage === "pool" ? tour.to(`/schedule/${m.id}`) : tour.to("/bracket")}
								leading={<Media icon={reffing ? <Flag /> : <Swords />} />}
								title={reffing ? `Ref: ${m.team_a_name} vs ${m.team_b_name}` : `${m.label} vs ${opponent ?? "TBD"}`}
								description={`${m.stage === "pool" ? `Pool ${m.pool} · Round ${m.round}` : m.bracket_round}${m.court ? ` · ${m.court}` : ""}`}
								trailing={reffing ? <Badge>Ref</Badge> : isScored(m) ? <span className="text-sm">{scoreText(m)}</span> : <Badge>To play</Badge>}
							/>
						);
					})}
				</List>
			</section>
		</div>
	);
}
