import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { TeamRow } from "../lib/tournament";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";
import { Button } from "../components/Button";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";

const columns: ColumnDef<TeamRow, unknown>[] = [
	{ accessorKey: "name", header: "Team" },
	{ accessorKey: "number", header: "No." },
	{ accessorKey: "pool", header: "Pool", cell: ({ row }) => <Badge>{`Pool ${row.original.pool}`}</Badge> },
	{ accessorKey: "code", header: "Code" },
	{ id: "record", header: "Record (W–L)", enableSorting: false, cell: ({ row }) => `${row.original.wins}–${row.original.losses}` },
	{ accessorKey: "pool_rank", header: "Pool rank" },
	{ accessorKey: "seed", header: "Seed" },
];

export default function Teams() {
	const [query, setQuery] = React.useState("");
	const tour = useT();
	const { data: teams = [], isLoading } = useQuery<TeamRow[]>({
		queryKey: ["teams", tour.tid],
		refetchInterval: 20000,
		queryFn: () => fetch(tour.api("/teams")).then((r) => r.json()),
	});
	const { data: access } = useAccess();
	const q = query.trim().toLowerCase();
	const shown = teams.filter((t) => !q || t.name.toLowerCase().includes(q) || t.code.toLowerCase() === q || `pool ${t.pool}`.toLowerCase() === q);

	if (access && !access.can_see) {
		return (
			<div className="space-y-6">
				<PageHeader title="Teams" />
				<EmptyState
					icon={<Lock />}
					title="Team names are for teams that have paid"
					description="Pay the entry fee and name your team to see who else is playing."
					action={
						access.payment_link ? (
							<Button variant="primary" asChild>
								<a href={access.payment_link} target="_blank" rel="noreferrer">
									Pay the entry fee
								</a>
							</Button>
						) : (
							<Button variant="primary" asChild>
								<Link to={tour.to("/my-team")}>Go to My team</Link>
							</Button>
						)
					}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader title="Teams" />
			<Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by team name or code…" />
			<DataTable
				columns={columns}
				data={shown}
				isLoading={isLoading}
				getRowHref={(t: TeamRow) => tour.to(`/teams/${t.id}`)}
				emptyState={<EmptyState title="No teams found" description="Try a different search." />}
			/>
		</div>
	);
}
