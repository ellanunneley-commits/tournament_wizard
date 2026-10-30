import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";
import { DetailList, DetailItem } from "./DetailList";
import { toast } from "./Toast";
import { api } from "../lib/tournament";
import { useT } from "../lib/useT";
import { Day } from "../lib/timing";

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (iso: string | null) => {
	if (!iso) return "";
	const d = new Date(iso);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const show = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not set");

// When the day starts and ends, and how long one game is planned to take. Organizers edit it; everyone else reads it.
export function DayPlanCard({ day, isAdmin }: { day: Day; isAdmin: boolean }) {
	const tour = useT();
	const qc = useQueryClient();
	const [start, setStart] = React.useState(toLocalInput(day.start));
	const [end, setEnd] = React.useState(toLocalInput(day.end));
	const [minutes, setMinutes] = React.useState(String(day.game_minutes));
	const [busy, setBusy] = React.useState(false);
	React.useEffect(() => {
		setStart(toLocalInput(day.start));
		setEnd(toLocalInput(day.end));
		setMinutes(String(day.game_minutes));
	}, [day.start, day.end, day.game_minutes]);

	if (!isAdmin) {
		return (
			<DetailList title="The day">
				<DetailItem label="Starts">{show(day.start)}</DetailItem>
				<DetailItem label="Ends">{show(day.end)}</DetailItem>
				<DetailItem label="Planned game length">{`${day.game_minutes} min`}</DetailItem>
			</DetailList>
		);
	}

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		try {
			await api(tour.api("/day"), "PUT", {
				start: start ? new Date(start).toISOString() : "",
				end: end ? new Date(end).toISOString() : "",
				game_minutes: minutes,
			});
			await qc.invalidateQueries();
			toast.success("Day saved");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not save");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<h3 className="text-base font-semibold">The day</h3>
			<form className="mt-3 grid gap-3 md:grid-cols-4 md:items-end" onSubmit={save}>
				<div className="space-y-2">
					<Label htmlFor="day-start">Day starts</Label>
					<Input id="day-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="day-end">Day ends</Label>
					<Input id="day-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="game-min">Planned game length (min)</Label>
					<Input id="game-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
				</div>
				<Button type="submit" variant="primary" isLoading={busy}>
					Save
				</Button>
			</form>
			<p className="mt-2 text-sm text-secondary">Planned start times follow from these: each court plays one game after another, starting when the day starts.</p>
		</Card>
	);
}
