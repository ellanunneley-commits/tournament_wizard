import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Megaphone, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { DataTable } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { Label } from "../components/Label";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";
import { Switch } from "../components/Switch";
import { Textarea } from "../components/Textarea";
import { toast } from "../components/Toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { Announcement } from "../components/AnnouncementsBanner";
import { api } from "../lib/tournament";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";

const stamp = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The announcements sheet: what was posted, when, and whether it is showing on the home screen.
export default function Announcements() {
	const tour = useT();
	const qc = useQueryClient();
	const { data: access } = useAccess();
	const isAdmin = !!access?.is_admin;
	const [dialog, setDialog] = React.useState<{ id: string | null; message: string } | null>(null);
	const [busy, setBusy] = React.useState(false);
	const [minutes, setMinutes] = React.useState("5");
	React.useEffect(() => {
		if (access) setMinutes(String(access.auto_announce.minutes));
	}, [access?.auto_announce.minutes]);
	const { data = [], isLoading } = useQuery<Announcement[]>({
		queryKey: ["announcements", tour.tid, "all"],
		enabled: isAdmin,
		queryFn: () => fetch(tour.api("/announcements")).then((r) => r.json()),
	});

	async function run(fn: () => Promise<unknown>, ok: string) {
		setBusy(true);
		try {
			await fn();
			await qc.invalidateQueries();
			toast.success(ok);
			return true;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Something went wrong");
			return false;
		} finally {
			setBusy(false);
		}
	}

	if (!access) return <PageHeader title="Announcements" />;
	if (!isAdmin) return <EmptyState icon={<ShieldCheck />} title="Organizers only" description="Only the organizers post announcements." />;

	const columns: ColumnDef<Announcement, unknown>[] = [
		{
			accessorKey: "message",
			header: "Message",
			cell: ({ row }) => (
				<span>
					{row.original.message}
					{row.original.auto && <span className="ml-2 align-middle"><Badge>Automatic</Badge></span>}
				</span>
			),
		},
		{ id: "time", header: "Time", accessorFn: (a) => a.created_at, cell: ({ row }) => stamp(row.original.created_at) },
		{
			id: "active",
			header: "Active",
			enableSorting: false,
			cell: ({ row }) => (
				<div className="flex items-center gap-2">
					<Switch
						aria-label={`Show "${row.original.message}" on the home screen`}
						checked={row.original.active}
						disabled={busy}
						onCheckedChange={(on: boolean) => run(() => api(tour.api(`/announcements/${row.original.id}`), "PATCH", { active: on }), on ? "Showing on the home screen" : "Hidden")}
					/>
					<span className="text-sm">{row.original.active ? "Yes" : "No"}</span>
				</div>
			),
		},
	];

	return (
		<div className="space-y-6">
			<PageHeader
				title="Announcements"
				actions={
					<Button variant="primary" onClick={() => setDialog({ id: null, message: "" })}>
						<Plus /> New announcement
					</Button>
				}
			/>
			<Card>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<Switch
							id="auto-announce"
							checked={access.auto_announce.enabled}
							disabled={busy}
							onCheckedChange={(on: boolean) => run(() => api(tour.api("/announcements/auto"), "PUT", { enabled: on }), on ? "Automatic announcements are on" : "Automatic announcements are off")}
						/>
						<div>
							<Label htmlFor="auto-announce">Announce the next game automatically</Label>
							<p className="text-sm text-secondary">When a game ends, the next one on that court is announced with a countdown. It disappears when that game starts.</p>
						</div>
					</div>
					<form
						className="flex shrink-0 items-end gap-2"
						onSubmit={(e) => {
							e.preventDefault();
							run(() => api(tour.api("/announcements/auto"), "PUT", { minutes }), "Saved");
						}}
					>
						<div className="space-y-2">
							<Label htmlFor="auto-minutes">Minutes before</Label>
							<Input id="auto-minutes" className="w-24" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
						</div>
						<Button type="submit" variant="secondary" disabled={busy || minutes === String(access.auto_announce.minutes)}>
							Save
						</Button>
					</form>
				</div>
			</Card>
			<DataTable
				columns={columns}
				data={data}
				isLoading={isLoading}
				onRowClick={(a: Announcement) => setDialog({ id: a.id, message: a.message })}
				emptyState={
					<EmptyState
						icon={<Megaphone />}
						title="No announcements yet"
						description='Post things like "Courts 3–4 running 10 min behind" or "Bracket starts at 1:00". Active ones show at the top of the home screen.'
						action={
							<Button variant="primary" onClick={() => setDialog({ id: null, message: "" })}>
								<Plus /> New announcement
							</Button>
						}
					/>
				}
			/>

			<Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{dialog?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
						<DialogDescription>{dialog?.id ? "Changes show right away." : "It shows at the top of the home screen as soon as you post it."}</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Label htmlFor="ann-message">Message</Label>
						<Textarea id="ann-message" value={dialog?.message ?? ""} maxLength={280} onChange={(e) => setDialog((d) => (d ? { ...d, message: e.target.value } : d))} placeholder="Lunch is here" />
					</div>
					<DialogFooter>
						<Button variant="tertiary" onClick={() => setDialog(null)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							isLoading={busy}
							disabled={!dialog?.message.trim()}
							onClick={async () => {
								if (!dialog) return;
								const ok = dialog.id
									? await run(() => api(tour.api(`/announcements/${dialog.id}`), "PATCH", { message: dialog.message }), "Announcement updated")
									: await run(() => api(tour.api("/announcements"), "POST", { message: dialog.message }), "Announcement posted");
								if (ok) setDialog(null);
							}}
						>
							{dialog?.id ? "Save" : "Post"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
