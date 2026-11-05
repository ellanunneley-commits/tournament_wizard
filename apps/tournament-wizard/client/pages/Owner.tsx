import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Stat } from "../components/Stat";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { usd } from "../components/FeesCard";
import type { TournamentList } from "./Home";
import { get } from "../lib/http";

type Overview = {
	id: string;
	name: string;
	created_by: string | null;
	fees_waived: boolean;
	entries: number;
	entries_total_cents: number;
	due_cents: number;
	paid_cents: number;
	balance_cents: number;
};

const columns: ColumnDef<Overview, unknown>[] = [
	{ accessorKey: "name", header: "Tournament" },
	{ accessorKey: "created_by", header: "Organizer", cell: ({ row }) => row.original.created_by ?? "—" },
	{ accessorKey: "entries", header: "Paid teams" },
	{ id: "entry_fees", header: "Entry fees", accessorFn: (t) => t.entries_total_cents, cell: ({ row }) => usd(row.original.entries_total_cents) },
	{ id: "due", header: "App fee due", accessorFn: (t) => t.due_cents, cell: ({ row }) => (row.original.fees_waived ? <Badge tone="success">Waived</Badge> : usd(row.original.due_cents)) },
	{ id: "paid", header: "Paid to you", accessorFn: (t) => t.paid_cents, cell: ({ row }) => usd(row.original.paid_cents) },
	{ id: "balance", header: "Balance", accessorFn: (t) => t.balance_cents, cell: ({ row }) => (row.original.balance_cents > 0 ? <Badge tone="warning">{usd(row.original.balance_cents)}</Badge> : usd(0)) },
];

// Every tournament and what it owes the app owner. Only app owners can open this.
export default function Owner() {
	const [query, setQuery] = React.useState("");
	const { data: list } = useQuery<TournamentList>({
		queryKey: ["tournaments"],
		queryFn: () => get("/app-api/tournaments"),
	});
	const isOwner = !!list?.is_owner;
	const { data = [], isLoading } = useQuery<Overview[]>({
		queryKey: ["owner-overview"],
		enabled: isOwner,
		refetchInterval: 30000,
		queryFn: () => get("/app-api/owner/overview"),
	});

	if (!list) return <PageHeader title="Owner" />;
	if (!isOwner) return <EmptyState icon={<ShieldCheck />} title="App owners only" description="This page shows what every tournament owes the app owner." />;

	const q = query.trim().toLowerCase();
	const shown = data.filter((t) => !q || t.name.toLowerCase().includes(q) || (t.created_by ?? "").toLowerCase().includes(q));
	const sum = (f: (t: Overview) => number) => data.reduce((n, t) => n + f(t), 0);

	return (
		<div className="space-y-6">
			<PageHeader title="Owner" />
			<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
				<Stat label="Tournaments" value={String(data.length)} />
				<Stat label="Entry fees across all" value={usd(sum((t) => t.entries_total_cents))} />
				<Stat label="Paid to you" value={usd(sum((t) => t.paid_cents))} />
				<Stat label="Still owed to you" value={usd(sum((t) => t.balance_cents))} />
			</div>
			<Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by tournament or organizer…" />
			<DataTable
				columns={columns}
				data={shown}
				isLoading={isLoading}
				getRowHref={(t: Overview) => `/t/${t.id}/entries`}
				emptyState={<EmptyState title="No tournaments found" description="Try a different search." />}
			/>
		</div>
	);
}
