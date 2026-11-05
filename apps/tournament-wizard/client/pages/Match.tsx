import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { DetailList, DetailItem } from "../components/DetailList";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { ScoreForm } from "../components/ScoreForm";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";
import { MatchRow, isLive, isScored, matchTitle, teamLabel } from "../lib/tournament";
import { get } from "../lib/http";

export default function Match() {
	const { id } = useParams();
	const tour = useT();
	const { data: access } = useAccess();
	const { data: match, isLoading, isError } = useQuery<MatchRow>({
		queryKey: ["matches", tour.tid, id],
		refetchInterval: 5000,
		queryFn: () => get(tour.api(`/matches/${id}`)),
	});

	if (isError) return <EmptyState title="Match not found" description="It may have been removed." />;
	if (isLoading || !match) return <PageHeader title="Match" />;

	const sets = match.sets ?? [];
	const status = isScored(match) ? <Badge tone="success">Final</Badge> : isLive(match) ? <Badge tone="info">Live</Badge> : <Badge>To play</Badge>;

	return (
		<div className="space-y-6">
			<PageHeader
				breadcrumbs={<Link to={tour.to("/schedule")}>Schedule</Link>}
				title={`${match.label} · ${matchTitle(match)}`}
				actions={
					match.can_score && !isScored(match) && match.team_a_id && match.team_b_id ? (
						<Button variant="primary" asChild>
							<Link to={tour.to(`/score/${match.id}`)}>{isLive(match) ? "Keep score" : "Score this match"}</Link>
						</Button>
					) : undefined
				}
			/>
			<div className="grid gap-4 md:grid-cols-2">
				<DetailList title="Details">
					<DetailItem label="Pool">{match.pool ?? "—"}</DetailItem>
					<DetailItem label="Round">{match.round ?? match.bracket_round ?? "—"}</DetailItem>
					<DetailItem label="Court">{match.court ?? "—"}</DetailItem>
					<DetailItem label="Team A">{teamLabel(match.team_a_name, match.team_a_code)}</DetailItem>
					<DetailItem label="Team B">{teamLabel(match.team_b_name, match.team_b_code)}</DetailItem>
					<DetailItem label="Ref">{teamLabel(match.ref_name, match.ref_code)}</DetailItem>
					<DetailItem label="Sets won">{match.a_sets == null ? "—" : `${match.a_sets} – ${match.b_sets}`}</DetailItem>
					<DetailItem label="Status">{status}</DetailItem>
				</DetailList>
				<DetailList title="Set by set">
					{sets.length === 0 ? (
						<DetailItem label="Sets">Not started</DetailItem>
					) : (
						sets.map((s) => (
							<DetailItem key={s.set_number} label={`Set ${s.set_number}${s.finished ? "" : " (playing)"}`}>
								{`${s.a_pts} – ${s.b_pts}`}
							</DetailItem>
						))
					)}
				</DetailList>
			</div>
			{access?.is_admin && (
				<Card>
					<h3 className="mb-1 text-base font-semibold">Court and final score by hand</h3>
					<p className="mb-3 text-sm text-secondary">Use this to set the court or fix a result. Saving a score here replaces anything scored live.</p>
					<ScoreForm match={match} />
				</Card>
			)}
		</div>
	);
}
