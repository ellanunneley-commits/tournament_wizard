import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ScoreForm } from "../components/ScoreForm";
import { toast } from "../components/Toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { MatchRow, Summary, api, isLive, isScored } from "../lib/tournament";
import { useAccess } from "../lib/access";
import { useT } from "../lib/useT";
import { get } from "../lib/http";

const ROUNDS = ["Round of 16", "Quarterfinal", "Semifinal", "Final"];

function TeamLine({ name, seed, sets, won, scored }: { name: string | null; seed: number | null; sets: number | string | null; won: boolean; scored: boolean }) {
	return (
		<div className={`flex items-center justify-between gap-2 py-1 text-sm ${won ? "font-semibold" : scored ? "text-secondary" : ""}`}>
			<span className="min-w-0 truncate">
				{seed != null && <span className="mr-1 text-xs text-tertiary">{seed}</span>}
				{name ?? <span className="text-secondary">To be decided</span>}
			</span>
			<span className="shrink-0 tabular-nums">{sets ?? ""}</span>
		</div>
	);
}

export default function Bracket() {
	const qc = useQueryClient();
	const tour = useT();
	const { data: access } = useAccess();
	const isAdmin = !!access?.is_admin;
	const [openId, setOpenId] = React.useState<string | null>(null);
	const [confirmSeed, setConfirmSeed] = React.useState(false);
	const [seeding, setSeeding] = React.useState(false);
	const { data: matches = [] } = useQuery<MatchRow[]>({
		queryKey: ["matches", tour.tid, "bracket"],
		refetchInterval: 8000,
		queryFn: () => get(tour.api("/matches?stage=bracket")),
	});
	const { data: summary } = useQuery<Summary>({
		queryKey: ["summary", tour.tid],
		refetchInterval: 20000,
		queryFn: () => get(tour.api("/summary")),
	});

	const open = matches.find((m) => m.id === openId) ?? null;
	const poolLeft = summary ? summary.pool_total - summary.pool_done : 0;
	const seeded = (summary?.bracket_seeded ?? 0) > 0;

	async function seed() {
		setSeeding(true);
		try {
			await api(tour.api("/bracket/seed"), "POST");
			await qc.invalidateQueries();
			toast.success("Bracket seeded from the standings");
			setConfirmSeed(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not seed the bracket");
		} finally {
			setSeeding(false);
		}
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Bracket"
				actions={
					isAdmin ? (
						<Button variant="primary" onClick={() => (seeded ? setConfirmSeed(true) : seed())} isLoading={seeding && !confirmSeed}>
							{seeded ? "Re-seed from standings" : "Seed from standings"}
						</Button>
					) : undefined
				}
			/>
			{poolLeft > 0 && isAdmin && (
				<p className="text-sm text-secondary">
					{poolLeft} pool {poolLeft === 1 ? "match is" : "matches are"} still to play, so seeds are provisional. Re-seed once pool play is done.
				</p>
			)}
			{summary?.champion && (
				<Card>
					<div className="flex items-center gap-3">
						<Trophy className="size-6 text-accent-ink" />
						<div>
							<p className="text-sm text-secondary">Champion</p>
							<p className="text-lg font-semibold">{summary.champion}</p>
						</div>
					</div>
				</Card>
			)}
			<div className="overflow-x-auto">
				<div className="flex min-w-max gap-4">
					{ROUNDS.map((round) => (
						<div key={round} className="flex w-60 flex-col gap-3">
							<h3 className="text-sm font-semibold text-secondary">{round}</h3>
							<div className="flex flex-1 flex-col justify-around gap-3">
								{matches
									.filter((m) => m.bracket_round === round)
									.map((m) => {
										const scored = isScored(m);
										const live = isLive(m);
										const show = (sets: number | null, cur: number | null) => (live ? `${sets ?? 0} · ${cur ?? 0}` : sets);
										return (
											<div key={m.id} className="space-y-1">
												<button type="button" onClick={() => isAdmin && setOpenId(m.id)} className={`w-full ${isAdmin ? "text-left" : "cursor-default text-left"}`}>
													<Card>
														<div className="mb-1 flex items-center justify-between gap-2">
															<span className="text-xs text-secondary">{m.label}{m.court ? ` · ${m.court}` : ""}</span>
															{scored ? <Badge tone="success">Final</Badge> : live ? <Badge tone="info">Live · Set {m.cur_set ?? 1}</Badge> : null}
														</div>
														<TeamLine name={m.team_a_name} seed={m.seed_a} sets={show(m.a_sets, m.cur_a)} scored={scored} won={scored && (m.a_sets ?? 0) > (m.b_sets ?? 0)} />
														<TeamLine name={m.team_b_name} seed={m.seed_b} sets={show(m.b_sets, m.cur_b)} scored={scored} won={scored && (m.b_sets ?? 0) > (m.a_sets ?? 0)} />
													</Card>
												</button>
												{m.can_score && !scored && m.team_a_id && m.team_b_id && (
													<Button size="sm" variant="secondary" asChild>
														<a href={tour.to(`/score/${m.id}`)}>{live ? "Keep score" : "Score this match"}</a>
													</Button>
												)}
											</div>
										);
									})}
							</div>
						</div>
					))}
				</div>
			</div>

			<Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{open ? `${open.bracket_round} · ${open.label}` : ""}</DialogTitle>
						<DialogDescription>Enter the court and the result.</DialogDescription>
					</DialogHeader>
					{open && <ScoreForm match={open} onSaved={() => setOpenId(null)} />}
				</DialogContent>
			</Dialog>

			<Dialog open={confirmSeed} onOpenChange={setConfirmSeed}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Re-seed the bracket?</DialogTitle>
						<DialogDescription>Teams are placed again from the current standings and every bracket score is cleared.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="tertiary" onClick={() => setConfirmSeed(false)}>
							Cancel
						</Button>
						<Button variant="primary" isLoading={seeding} onClick={seed}>
							Re-seed
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
