import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Undo2 } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { toast } from "../components/Toast";
import { useT } from "../lib/useT";
import { ApiError, MatchRow, api, isLive, isScored, matchTitle } from "../lib/tournament";
import { get } from "../lib/http";

type Side = "a" | "b";

// The scoreboard for one match. The ref taps points as they happen; everyone else sees them within seconds.
export default function Score() {
	const { id } = useParams();
	const tour = useT();
	const qc = useQueryClient();
	const key = ["matches", tour.tid, id];
	const inFlight = React.useRef(0);
	const [busy, setBusy] = React.useState(false);
	const [warning, setWarning] = React.useState<string | null>(null);
	const { data: match, isLoading, isError } = useQuery<MatchRow>({
		queryKey: key,
		// Pause the automatic refresh while taps are still on their way, so the score never jumps back.
		refetchInterval: () => (inFlight.current > 0 ? false : 4000),
		queryFn: () => get(tour.api(`/matches/${id}`)),
	});

	if (isError) return <EmptyState title="Match not found" description="It may have been removed." />;
	if (isLoading || !match) return <PageHeader title="Keep score" />;

	const back = <Link to={tour.to(`/schedule/${match.id}`)}>{match.label}</Link>;
	if (!match.can_score) {
		return (
			<div className="space-y-6">
				<PageHeader breadcrumbs={back} title="Keep score" />
				<EmptyState title="You can't score this match" description="Only the ref team's captain, scorekeepers and organizers can keep score." />
			</div>
		);
	}

	const sets = match.sets ?? [];
	const current = sets.find((s) => !s.finished);
	const finished = sets.filter((s) => s.finished);
	const target = match.rules?.current_target ?? null;
	const a = current?.a_pts ?? 0;
	const b = current?.b_pts ?? 0;
	const setOver = target != null && Math.max(a, b) >= target && Math.abs(a - b) >= 2;

	// Tap a point: show it at once, tell the server, and let the next refresh settle any difference.
	async function tap(side: Side, delta: 1 | -1) {
		if (!current) return;
		inFlight.current++;
		await qc.cancelQueries({ queryKey: key });
		qc.setQueryData<MatchRow>(key, (old) =>
			old
				? {
						...old,
						sets: (old.sets ?? []).map((s) =>
							s.set_number === current.set_number ? { ...s, a_pts: Math.max(0, s.a_pts + (side === "a" ? delta : 0)), b_pts: Math.max(0, s.b_pts + (side === "b" ? delta : 0)) } : s,
						),
					}
				: old,
		);
		try {
			await api(tour.api(`/matches/${match!.id}/point`), "POST", { team: side, delta });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "That point did not save");
			await qc.invalidateQueries();
		} finally {
			inFlight.current--;
			if (inFlight.current === 0) await qc.invalidateQueries();
		}
	}

	async function action(path: string, ok?: (res: any) => string, force = false) {
		setBusy(true);
		setWarning(null);
		try {
			const res = await api(tour.api(`/matches/${match!.id}/${path}`), "POST", force ? { force } : undefined);
			await qc.invalidateQueries();
			if (ok) toast.success(ok(res));
		} catch (err) {
			if (err instanceof ApiError && err.data?.code === "clears_later") setWarning(err.message);
			else toast.error(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setBusy(false);
		}
	}

	const teams: { side: Side; name: string | null; pts: number; sets: number | null }[] = [
		{ side: "a", name: match.team_a_name, pts: a, sets: match.a_sets },
		{ side: "b", name: match.team_b_name, pts: b, sets: match.b_sets },
	];

	return (
		<div className="space-y-4">
			<PageHeader breadcrumbs={back} title={`Keep score · ${matchTitle(match)}`} />

			{isScored(match) ? (
				<Card>
					<div className="flex flex-col items-center gap-3 py-4 text-center">
						<Badge tone="success">Final</Badge>
						<p className="text-3xl font-semibold tabular-nums">
							{match.a_sets} – {match.b_sets}
						</p>
						<p className="text-sm text-secondary">{(match.a_sets ?? 0) > (match.b_sets ?? 0) ? match.team_a_name : match.team_b_name} won. Everyone watching can see the match is over.</p>
						<Button variant="secondary" disabled={busy} onClick={() => action("reopen", () => "Last set reopened")}>
							<Undo2 /> Reopen last set
						</Button>
						{warning && (
							<div role="alert" className="space-y-2 rounded-lg bg-warning-weak p-3 text-sm text-warning-ink">
								<p className="font-medium">{warning}</p>
								<Button size="sm" variant="primary" isLoading={busy} onClick={() => action("reopen", () => "Last set reopened", true)}>
									Reopen anyway
								</Button>
							</div>
						)}
					</div>
				</Card>
			) : match.status === "scheduled" ? (
				<Card>
					<div className="flex flex-col items-center gap-3 py-4 text-center">
						<p className="text-lg font-semibold">Ready to start?</p>
						<p className="text-sm text-secondary">Starting the match shows it as live to everyone in the tournament.</p>
						<Button variant="primary" size="lg" isLoading={busy} onClick={() => action("start", () => "Match started")}>
							Start match
						</Button>
					</div>
				</Card>
			) : (
				<>
					<div className="flex items-center justify-between gap-2">
						<Badge tone="info">{isLive(match) ? `Live · Set ${current?.set_number ?? ""}` : ""}</Badge>
						<p className="text-sm text-secondary">{target != null ? `First to ${target}, win by 2` : ""}</p>
					</div>
					<div className="grid grid-cols-2 gap-3">
						{teams.map((t) => (
							<Card key={t.side}>
								<div className="flex flex-col items-center gap-3">
									<p className="min-w-0 max-w-full truncate text-base font-semibold">{t.name}</p>
									<p className="text-xs text-secondary">Sets won: {t.sets ?? 0}</p>
									<p className="text-7xl font-bold tabular-nums leading-none">{t.pts}</p>
									<Button variant="primary" size="lg" className="h-16 w-full text-2xl" aria-label={`Point for ${t.name}`} onClick={() => tap(t.side, 1)}>
										<Plus /> 1
									</Button>
									<Button variant="tertiary" className="w-full" aria-label={`Take a point off ${t.name}`} onClick={() => tap(t.side, -1)}>
										<Minus /> 1
									</Button>
								</div>
							</Card>
						))}
					</div>
					<Button variant={setOver ? "primary" : "secondary"} size="lg" className="w-full" isLoading={busy} onClick={() => action("end-set", (r) => (r.final ? "Match over" : "Set over"))}>
						{setOver ? "End set" : "End set (when it's over)"}
					</Button>
					{finished.length > 0 && (
						<div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
							{finished.map((s) => (
								<span key={s.set_number}>
									Set {s.set_number}: {s.a_pts}–{s.b_pts}
								</span>
							))}
							<Button variant="tertiary" size="sm" disabled={busy || a + b > 0} onClick={() => action("reopen", () => "Last set reopened")}>
								<Undo2 /> Reopen last set
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}
