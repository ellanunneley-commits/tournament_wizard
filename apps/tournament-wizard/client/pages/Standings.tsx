import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Trophy } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/Badge";
import { TeamRow, Summary } from "../lib/tournament";
import { useT } from "../lib/useT";
import { AnnouncementsBanner } from "../components/AnnouncementsBanner";
import { get } from "../lib/http";

const columns: ColumnDef<TeamRow, unknown>[] = [
	{
		accessorKey: "name",
		header: "Team",
		cell: ({ row }) => (
			<span>
				{row.original.name} <span className="text-secondary">({row.original.code})</span>
			</span>
		),
	},
	{ accessorKey: "pool_rank", header: "Pool rank" },
	{ accessorKey: "played", header: "Played" },
	{ accessorKey: "wins", header: "Wins" },
	{ accessorKey: "losses", header: "Losses" },
	{ id: "sets", header: "Sets (W–L)", enableSorting: false, cell: ({ row }) => `${row.original.sets_won}–${row.original.sets_lost}` },
	{ id: "pts", header: "Points (F–A)", enableSorting: false, cell: ({ row }) => `${row.original.pts_for}–${row.original.pts_against}` },
	{
		accessorKey: "seed",
		header: "Bracket seed",
		cell: ({ row }) => <Badge tone={row.original.seed <= 8 ? "success" : undefined}>#{row.original.seed}</Badge>,
	},
];

// One team on a phone: pool rank, name, record and bracket seed on a single line.
function TeamLine({ t, top }: { t: TeamRow; top: number }) {
	return (
		<div className="flex items-center gap-3">
			<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-bold">{t.pool_rank}</span>
			<div className="min-w-0 flex-1">
				<p className="truncate font-semibold">
					{t.name} <span className="font-normal text-secondary">({t.code})</span>
				</p>
				<p className="text-xs text-secondary">
					{t.wins}–{t.losses} · sets {t.sets_won}–{t.sets_lost} · pts {t.pts_for}–{t.pts_against}
				</p>
			</div>
			<Badge tone={t.seed <= top ? "success" : undefined}>Seed {t.seed}</Badge>
		</div>
	);
}

export default function Standings() {
	const tour = useT();
	const { data: teams = [], isLoading } = useQuery<TeamRow[]>({
		queryKey: ["standings", tour.tid],
		refetchInterval: 8000,
		queryFn: () => get(tour.api("/standings")),
	});
	const { data: summary } = useQuery<Summary>({
		queryKey: ["summary", tour.tid],
		refetchInterval: 8000,
		queryFn: () => get(tour.api("/summary")),
	});

	return (
		<div className="space-y-6">
			<AnnouncementsBanner />
			<PageHeader title="Standings" />
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Pool matches played" value={summary ? `${summary.pool_done} of ${summary.pool_total}` : "—"} />
				<Stat label="Bracket matches played" value={summary ? `${summary.bracket_done} of ${summary.bracket_total}` : "—"} />
				<Stat label="Live now" value={summary ? String(summary.live_now) : "—"} context="matches being scored" />
				<Stat label="Champion" value={summary?.champion ?? "Not decided"} icon={<Trophy className="size-4" />} />
			</div>
			{[...new Set(teams.map((t) => t.pool))].sort().map((pool) => (
				<section key={pool} className="space-y-2">
					<h3 className="text-base font-semibold">Pool {pool}</h3>
					<DataTable
						columns={columns}
						data={teams.filter((t) => t.pool === pool).sort((a, b) => a.pool_rank - b.pool_rank)}
						getRowHref={(t: TeamRow) => tour.to(`/teams/${t.id}`)}
						mobileCard={(t: TeamRow) => <TeamLine t={t} top={teams.length / 2} />}
						isLoading={isLoading}
						emptyState={<EmptyState title="No teams in this pool" />}
					/>
				</section>
			))}
		</div>
	);
}
