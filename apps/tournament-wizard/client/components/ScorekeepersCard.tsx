import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { List, ListItem } from "./List";
import { Media } from "./Media";
import { toast } from "./Toast";
import { api } from "../lib/tournament";
import { useT } from "../lib/useT";
import { get } from "../lib/http";

type Scorekeeper = { id: string; email: string };

// People an organizer allows to score any match live. Ref team captains can already score the matches their team refs.
export function ScorekeepersCard() {
	const tour = useT();
	const qc = useQueryClient();
	const [email, setEmail] = React.useState("");
	const [busy, setBusy] = React.useState(false);
	const { data = [] } = useQuery<Scorekeeper[]>({
		queryKey: ["scorekeepers", tour.tid],
		queryFn: () => get(tour.api("/scorekeepers")),
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

	return (
		<div className="space-y-2">
			<h3 className="text-base font-semibold">Scorekeepers</h3>
			<p className="text-sm text-secondary">They sign in with this email and can keep live score for any match. The captain of a match's ref team can already score it.</p>
			<form
				className="flex gap-2"
				onSubmit={async (e) => {
					e.preventDefault();
					if (await run(() => api(tour.api("/scorekeepers"), "POST", { email }), "Scorekeeper added")) setEmail("");
				}}
			>
				<Input type="email" aria-label="Scorekeeper email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="scorekeeper@email.com" />
				<Button type="submit" variant="primary" disabled={!email.includes("@") || busy}>
					Add
				</Button>
			</form>
			<List>
				{data.map((s) => (
					<ListItem
						key={s.id}
						leading={<Media initials={s.email} shape="circle" />}
						title={s.email}
						trailing={
							<Button size="icon" variant="tertiary" aria-label={`Remove ${s.email}`} disabled={busy} onClick={() => run(() => api(tour.api(`/scorekeepers/${s.id}`), "DELETE"), "Scorekeeper removed")}>
								<Trash2 />
							</Button>
						}
					/>
				))}
			</List>
		</div>
	);
}
