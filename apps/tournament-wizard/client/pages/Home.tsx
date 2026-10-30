import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trophy } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Label } from "../components/Label";
import { toast } from "../components/Toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { api } from "../lib/tournament";

export type TournamentRow = { id: string; name: string; created_at: string; teams: number; role: "organizer" | "captain" | "guest" | "owner" };
export type TournamentList = { is_owner: boolean; tournaments: TournamentRow[] };

const ROLE: Record<TournamentRow["role"], { label: string; tone?: "success" | "info" }> = {
	organizer: { label: "Organizer", tone: "success" },
	owner: { label: "App owner", tone: "success" },
	captain: { label: "Team captain", tone: "info" },
	guest: { label: "Guest" },
};

const columns: ColumnDef<TournamentRow, unknown>[] = [
	{ accessorKey: "name", header: "Tournament" },
	{ id: "role", header: "You are", enableSorting: false, cell: ({ row }) => <Badge tone={ROLE[row.original.role].tone}>{ROLE[row.original.role].label}</Badge> },
	{ id: "teams", header: "Teams", accessorFn: (t) => t.teams, cell: ({ row }) => `${row.original.teams} of 16` },
];

export default function Home() {
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	const { data, isLoading } = useQuery<TournamentList>({
		queryKey: ["tournaments"],
		queryFn: () => fetch("/app-api/tournaments").then((r) => r.json()),
	});

	async function create(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			const res = await api("/app-api/tournaments", "POST", { name });
			await qc.invalidateQueries();
			setOpen(false);
			setName("");
			toast.success("Tournament created");
			navigate(`/t/${res.id}/entries`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not create the tournament");
		} finally {
			setBusy(false);
		}
	}

	const newButton = (
		<Button variant="primary" onClick={() => setOpen(true)}>
			<Plus /> New tournament
		</Button>
	);

	return (
		<div className="space-y-6">
			<PageHeader title="Tournaments" actions={newButton} />
			<DataTable
				columns={columns}
				data={data?.tournaments ?? []}
				isLoading={isLoading}
				getRowHref={(t: TournamentRow) => `/t/${t.id}`}
				emptyState={
					<EmptyState
						icon={<Trophy />}
						title="You're not in a tournament yet"
						description="Running one? Create it here. Playing or watching? Open the link or QR code your organizer or team captain shared."
						action={newButton}
					/>
				}
			/>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<form onSubmit={create} className="space-y-4">
						<DialogHeader>
							<DialogTitle>New tournament</DialogTitle>
							<DialogDescription>You become its organizer. It opens to teams once the app fee is paid.</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor="new-name">Tournament name</Label>
							<Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Spike Classic" />
						</div>
						<DialogFooter>
							<Button type="button" variant="tertiary" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" variant="primary" isLoading={busy} disabled={!name.trim()}>
								Create
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
