import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/Badge";
import { Progress } from "../components/Progress";
import { DayPlanCard } from "../components/DayPlanCard";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";
import { MatchRow, isLive, isScored, teamLabel } from "../lib/tournament";
import { CourtStat, NO_COURT, courtStats, fmtDuration, fmtSigned, fmtTime, laneOf, lengthOf, playOrder, plannedStarts } from "../lib/timing";
import { get } from "../lib/http";

const paceBadge = (s: CourtStat) =>
	s.pace === "long" ? <Badge tone="warning">Running long {fmtSigned(s.diff ?? 0)}</Badge> : s.pace === "short" ? <Badge tone="info">Running short {fmtSigned(s.diff ?? 0)}</Badge> : s.pace === "on pace" ? <Badge tone="success">On pace</Badge> : <Badge>No data yet</Badge>;

const courtColumns = (planned: number): ColumnDef<CourtStat, unknown>[] => [
	{ accessorKey: "court", header: "Court" },
	{ id: "games", header: "Games finished", accessorFn: (s) => s.finished, cell: ({ row }) => `${row.original.finished} of ${row.original.games}` },
	{ id: "avg", header: "Average game", accessorFn: (s) => s.avg ?? 0, cell: ({ row }) => (row.original.avg == null ? "—" : fmtDuration(row.original.avg)) },
	{ id: "plan", header: "Planned game", enableSorting: false, accessorFn: () => `${planned} min` },
	{ id: "used", header: "Time played", accessorFn: (s) => s.timeUsed, cell: ({ row }) => (row.original.timeUsed ? fmtDuration(row.original.timeUsed) : "—") },
	{ id: "pace", header: "Pace", enableSorting: false, cell: ({ row }) => paceBadge(row.original) },
	{ id: "finish", header: "Projected finish", accessorFn: (s) => s.projectedFinish?.getTime() ?? 0, cell: ({ row }) => (row.original.projectedFinish ? fmtTime(row.original.projectedFinish) : "Done") },
];

// The master page: every game's planned and actual times, how much of the day is used, and which courts are running short or long.
export default function Master() {
	const tour = useT();
	const { data: access } = useAccess();
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(timer);
	}, []);
	const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
		queryKey: ["matches", tour.tid, "all"],
		refetchInterval: 8000,
		queryFn: () => get(tour.api("/matches")),
	});

	if (!access) return <PageHeader title="Master schedule" />;
	const day = access.day;
	const planned = plannedStarts(matches, day);
	const stats = courtStats(matches, day, now);
	const ordered = playOrder(matches);

	const dayStart = day.start ? new Date(day.start).getTime() : null;
	const dayEnd = day.end ? new Date(day.end).getTime() : null;
	const window_ = dayStart != null && dayEnd != null ? dayEnd - dayStart : null;
	const elapsed = dayStart != null && window_ ? Math.min(Math.max(now - dayStart, 0), window_) : 0;
	const pct = window_ ? Math.round((elapsed / window_) * 100) : 0;
	const finished = matches.filter(isScored).length;
	const played = stats.reduce((n, s) => n + s.timeUsed, 0);
	const finish = stats.reduce<Date | null>((latest, s) => (s.projectedFinish && (!latest || s.projectedFinish > latest) ? s.projectedFinish : latest), null);
	const overBy = finish && dayEnd != null ? (finish.getTime() - dayEnd) / 60000 : null;

	const columns: ColumnDef<MatchRow, unknown>[] = [
		{ accessorKey: "label", header: "Match" },
		{ id: "court", header: "Court", accessorFn: (m) => laneOf(m) },
		{ id: "teams", header: "Teams", enableSorting: false, accessorFn: (m) => `${teamLabel(m.team_a_name, m.team_a_code)} vs ${teamLabel(m.team_b_name, m.team_b_code)}` },
		{ id: "planned", header: "Planned start", accessorFn: (m) => planned.get(m.id)?.getTime() ?? 0, cell: ({ row }) => (planned.get(row.original.id) ? fmtTime(planned.get(row.original.id)!) : "—") },
		{ id: "started", header: "Started", accessorFn: (m) => (m.started_at ? new Date(m.started_at).getTime() : 0), cell: ({ row }) => (row.original.started_at ? fmtTime(row.original.started_at) : "—") },
		{ id: "ended", header: "Ended", accessorFn: (m) => (m.ended_at ? new Date(m.ended_at).getTime() : 0), cell: ({ row }) => (row.original.ended_at ? fmtTime(row.original.ended_at) : "—") },
		{
			id: "length",
			header: "Length",
			accessorFn: (m) => lengthOf(m) ?? 0,
			cell: ({ row }) => {
				const len = lengthOf(row.original);
				if (len == null) return "—";
				const diff = len - day.game_minutes;
				return (
					<span>
						{fmtDuration(len)} <span className={diff > 2 ? "text-warning-ink" : "text-secondary"}>({fmtSigned(diff)})</span>
					</span>
				);
			},
		},
		{
			id: "late",
			header: "Start vs plan",
			enableSorting: false,
			cell: ({ row }) => {
				const p = planned.get(row.original.id);
				if (!p || !row.original.started_at) return "—";
				const diff = (new Date(row.original.started_at).getTime() - p.getTime()) / 60000;
				return <span className={diff > 2 ? "text-warning-ink" : "text-secondary"}>{diff > 2 ? `${fmtSigned(diff)} late` : diff < -2 ? `${fmtSigned(diff)} early` : "On time"}</span>;
			},
		},
		{
			id: "status",
			header: "Status",
			enableSorting: false,
			cell: ({ row }) => (isScored(row.original) ? <Badge tone="success">Final</Badge> : isLive(row.original) ? <Badge tone="info">In Progress</Badge> : <Badge>Scheduled</Badge>),
		},
	];

	return (
		<div className="space-y-6">
			<PageHeader title="Master schedule" />
			<DayPlanCard day={day} isAdmin={access.is_admin} />

			{day.start && day.end ? (
				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
						<Stat label="Day used" value={`${pct}%`} context={`${fmtDuration(elapsed / 60000)} of ${fmtDuration((window_ ?? 0) / 60000)}`} />
						<Stat label="Games finished" value={`${finished} of ${matches.length}`} />
						<Stat label="Game time played" value={played ? fmtDuration(played) : "—"} />
						<Stat
							label="Projected finish"
							value={finish ? fmtTime(finish) : "All done"}
							delta={overBy == null ? undefined : overBy > 0 ? `${fmtDuration(overBy)} over` : `${fmtDuration(overBy)} to spare`}
							sentiment={overBy == null ? "neutral" : overBy > 0 ? "error" : "success"}
							context="at the current pace"
						/>
					</div>
					<Progress value={pct} label="Share of the day used" />
				</div>
			) : (
				<EmptyState title="Set when the day starts and ends" description="Once the organizer sets the start and end of the day, planned start times and how much time is used show up here." />
			)}

			<section className="space-y-2">
				<h3 className="text-base font-semibold">Courts</h3>
				<DataTable
					columns={courtColumns(day.game_minutes)}
					data={stats}
					isLoading={isLoading}
					emptyState={<EmptyState title="No games yet" />}
				/>
				{stats.length === 1 && stats[0].court === NO_COURT && <p className="text-sm text-secondary">Games have no court yet, so they are counted as one court. Set a court on each match to see every court's pace.</p>}
			</section>

			<section className="space-y-2">
				<h3 className="text-base font-semibold">Every game</h3>
				<DataTable
					columns={columns}
					data={ordered}
					isLoading={isLoading}
					getRowHref={(m: MatchRow) => tour.to(`/schedule/${m.id}`)}
					emptyState={<EmptyState title="No games yet" />}
				/>
			</section>
		</div>
	);
}
