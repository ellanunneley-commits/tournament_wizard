import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { List, ListItem } from "../components/List";
import { Media } from "../components/Media";
import { useT } from "../lib/useT";
import { AnnouncementsBanner } from "../components/AnnouncementsBanner";
import { Countdown } from "../components/Countdown";
import { MatchRow, isLive, matchTitle } from "../lib/tournament";
import { get } from "../lib/http";

const where = (m: MatchRow) => (m.stage === "pool" ? `Pool ${m.pool} · Round ${m.round}` : (m.bracket_round ?? "Bracket"));

function TeamRow({ name, pts, sets }: { name: string | null; pts: number | null; sets: number | null }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<div className="min-w-0">
				<p className="truncate text-base font-semibold">{name ?? "To be decided"}</p>
				<p className="text-xs text-secondary">Sets won: {sets ?? 0}</p>
			</div>
			<p className="shrink-0 text-5xl font-bold tabular-nums leading-none">{pts ?? 0}</p>
		</div>
	);
}

// Every match being played right now, updating as the refs score, and what is coming up next.
export default function Live() {
	const tour = useT();
	const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
		queryKey: ["matches", tour.tid, "all"],
		refetchInterval: 4000,
		queryFn: () => get(tour.api("/matches")),
	});

	const live = matches.filter(isLive).sort((a, b) => (a.court ?? "~").localeCompare(b.court ?? "~") || a.sort_order - b.sort_order);
	const upNext = matches.filter((m) => m.status === "scheduled" && m.team_a_id && m.team_b_id).slice(0, 6);

	return (
		<div className="space-y-6">
			<AnnouncementsBanner />
			<PageHeader title="Live scoring" />

			{live.length === 0 && !isLoading ? (
				<EmptyState icon={<Radio />} title="No games are being played right now" description="Games show up here the moment a ref starts scoring them." />
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{live.map((m) => (
						<Card key={m.id}>
							<div className="space-y-3">
								<div className="flex items-center justify-between gap-2">
									<span className="text-sm text-secondary">
										{where(m)}
										{m.court ? ` · ${m.court}` : ""}
									</span>
									<Badge tone="info">Live · Set {m.cur_set ?? 1}</Badge>
								</div>
								<TeamRow name={m.team_a_name} pts={m.cur_a} sets={m.a_sets} />
								<TeamRow name={m.team_b_name} pts={m.cur_b} sets={m.b_sets} />
								<div className="flex gap-2">
									<Button variant="secondary" size="sm" asChild>
										<Link to={tour.to(`/schedule/${m.id}`)}>Match details</Link>
									</Button>
									{m.can_score && (
										<Button variant="primary" size="sm" asChild>
											<Link to={tour.to(`/score/${m.id}`)}>Keep score</Link>
										</Button>
									)}
								</div>
							</div>
						</Card>
					))}
				</div>
			)}

			{upNext.length > 0 && (
				<section className="space-y-2">
					<h3 className="text-base font-semibold">Up next</h3>
					<List>
						{upNext.map((m) => (
							<ListItem
								key={m.id}
								to={tour.to(`/schedule/${m.id}`)}
								leading={<Media icon={<Radio />} />}
								title={matchTitle(m)}
								description={`${where(m)}${m.court ? ` · ${m.court}` : ""}`}
								trailing={m.starts_at ? <Countdown to={m.starts_at} className="text-sm font-medium" /> : m.can_score ? <Badge>You can score</Badge> : undefined}
							/>
						))}
					</List>
				</section>
			)}
		</div>
	);
}
