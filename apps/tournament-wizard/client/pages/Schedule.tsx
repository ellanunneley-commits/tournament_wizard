import { Link } from "react-router-dom";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { CalendarX } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Badge } from "../components/Badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { MatchRow, isLive, isScored, scoreText, teamLabel } from "../lib/tournament";
import { useT } from "../lib/useT";
import { Button } from "../components/Button";
import { Countdown } from "../components/Countdown";
import { get } from "../lib/http";

const statusBadge = (m: MatchRow) => (isScored(m) ? <Badge tone="success">Final</Badge> : isLive(m) ? <Badge tone="info">In Progress</Badge> : <Badge>Scheduled</Badge>);

// On deck = next to play. With courts set, that is the next unstarted match on each court. Matches with no court take the next two in the schedule.
function onDeckIds(matches: MatchRow[]) {
	const queue = matches.filter((m) => m.status === "scheduled" && m.team_a_id && m.team_b_id).sort((a, b) => a.sort_order - b.sort_order);
	const deck = new Set<string>();
	const courts = new Set<string>();
	let noCourt = 0;
	for (const m of queue) {
		if (m.court) {
			if (!courts.has(m.court)) {
				courts.add(m.court);
				deck.add(m.id);
			}
		} else if (noCourt < 2) {
			noCourt++;
			deck.add(m.id);
		}
	}
	return deck;
}

const columnsFor = (to: (p: string) => string, deck: Set<string>): ColumnDef<MatchRow, unknown>[] => [
	{ accessorKey: "label", header: "Match" },
	{ accessorKey: "round", header: "Round" },
	{ id: "court", header: "Court", accessorFn: (m) => m.court ?? "—" },
	{ id: "team_a", header: "Team A", enableSorting: false, accessorFn: (m) => teamLabel(m.team_a_name, m.team_a_code) },
	{ id: "team_b", header: "Team B", enableSorting: false, accessorFn: (m) => teamLabel(m.team_b_name, m.team_b_code) },
	{ id: "ref", header: "Ref", enableSorting: false, accessorFn: (m) => teamLabel(m.ref_name, m.ref_code) },
	{ id: "score", header: "Score", enableSorting: false, accessorFn: (m) => scoreText(m) },
	{ id: "status", header: "Status", accessorFn: (m) => (isScored(m) ? "Final" : isLive(m) ? "In Progress" : "Scheduled"), cell: ({ row }) => statusBadge(row.original) },
	{ id: "on_deck", header: "On deck", enableSorting: false, cell: ({ row }) => (row.original.starts_at && row.original.status === "scheduled" ? <Badge tone="warning"><Countdown to={row.original.starts_at} /></Badge> : deck.has(row.original.id) ? <Badge tone="warning">On deck</Badge> : null) },
	{
		id: "score_it",
		header: "",
		enableSorting: false,
		cell: ({ row }) =>
			row.original.can_score && !isScored(row.original) ? (
				<Button size="sm" variant="secondary" asChild>
					<Link to={to(`/score/${row.original.id}`)}>{isLive(row.original) ? "Keep score" : "Score"}</Link>
				</Button>
			) : null,
	},
];

// One match on a phone: where and when, the two teams with the score, who refs, and a button to score it.
function MatchCard({ m, to, deck }: { m: MatchRow; to: (p: string) => string; deck: Set<string> }) {
	const won = (side: "a" | "b") => isScored(m) && (side === "a" ? (m.a_sets ?? 0) > (m.b_sets ?? 0) : (m.b_sets ?? 0) > (m.a_sets ?? 0));
	const line = (side: "a" | "b") => {
		const name = side === "a" ? teamLabel(m.team_a_name, m.team_a_code) : teamLabel(m.team_b_name, m.team_b_code);
		const sets = side === "a" ? m.a_sets : m.b_sets;
		const live = side === "a" ? m.cur_a : m.cur_b;
		return (
			<div className={`flex items-center justify-between gap-3 ${won(side) ? "font-semibold" : isScored(m) ? "text-secondary" : ""}`}>
				<span className="min-w-0 truncate">{name}</span>
				<span className="shrink-0 tabular-nums">{isLive(m) ? <><span className="text-lg font-bold">{live ?? 0}</span> <span className="text-xs text-secondary">({sets ?? 0})</span></> : isScored(m) ? sets : ""}</span>
			</div>
		);
	};
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-2 text-xs text-secondary">
				<span>
					{m.label} · Round {m.round}
					{m.court ? ` · ${m.court}` : ""}
				</span>
				<span className="flex items-center gap-1.5">
					{m.starts_at && m.status === "scheduled" ? <Badge tone="warning"><Countdown to={m.starts_at} /></Badge> : deck.has(m.id) ? <Badge tone="warning">On deck</Badge> : null}
					{statusBadge(m)}
				</span>
			</div>
			{line("a")}
			{line("b")}
			<div className="flex items-center justify-between gap-2">
				<span className="min-w-0 truncate text-xs text-secondary">Ref: {teamLabel(m.ref_name, m.ref_code)}</span>
				{m.can_score && !isScored(m) && (
					<Button size="sm" variant={isLive(m) ? "primary" : "secondary"} asChild>
						<Link to={to(`/score/${m.id}`)}>{isLive(m) ? "Keep score" : "Score"}</Link>
					</Button>
				)}
			</div>
		</div>
	);
}

export default function Schedule() {
	const [pool, setPool] = React.useState("all");
	const [round, setRound] = React.useState("all");
	const [status, setStatus] = React.useState("all");
	const tour = useT();
	const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
		queryKey: ["matches", tour.tid, "pool"],
		refetchInterval: 8000,
		queryFn: () => get(tour.api("/matches?stage=pool")),
	});
	const deck = React.useMemo(() => onDeckIds(matches), [matches]);
	const columns = React.useMemo(() => columnsFor(tour.to, deck), [tour.tid, deck]);

	const shown = matches.filter(
		(m) =>
			(pool === "all" || m.pool === pool) &&
			(round === "all" || String(m.round) === round) &&
			(status === "all" || (status === "done" ? isScored(m) : status === "live" ? isLive(m) : status === "deck" ? deck.has(m.id) : m.status === "scheduled")),
	);

	return (
		<div className="space-y-6">
			<PageHeader title="Schedule" />
			<div className="flex gap-2 overflow-x-auto">
				<Select value={pool} onValueChange={setPool}>
					<SelectTrigger className="w-auto shrink-0" aria-label="Pool">
						<SelectValue placeholder="Pool" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All pools</SelectItem>
						{[...new Set(matches.map((m) => m.pool).filter((p): p is string => !!p))].sort().map((p) => (
							<SelectItem key={p} value={p}>
								Pool {p}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={round} onValueChange={setRound}>
					<SelectTrigger className="w-auto shrink-0" aria-label="Round">
						<SelectValue placeholder="Round" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All rounds</SelectItem>
						{[1, 2, 3, 4, 5, 6].map((r) => (
							<SelectItem key={r} value={String(r)}>
								Round {r}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-auto shrink-0" aria-label="Status">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Any status</SelectItem>
						<SelectItem value="todo">Scheduled</SelectItem>
						<SelectItem value="live">In Progress</SelectItem>
						<SelectItem value="done">Final</SelectItem>
						<SelectItem value="deck">On deck</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<DataTable
				columns={columns}
				data={shown}
				isLoading={isLoading}
				getRowHref={(m: MatchRow) => tour.to(`/schedule/${m.id}`)}
				mobileCard={(m: MatchRow) => <MatchCard m={m} to={tour.to} deck={deck} />}
				emptyState={<EmptyState icon={<CalendarX />} title="No matches" description="Try a different filter." />}
			/>
		</div>
	);
}
