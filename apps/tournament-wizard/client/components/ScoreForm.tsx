import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./Button";
import { Input } from "./Input";
import { Label } from "./Label";
import { toast } from "./Toast";
import { api, ApiError, MatchRow } from "../lib/tournament";
import { useT } from "../lib/useT";

const toText = (v: number | null) => (v == null ? "" : String(v));

export function ScoreForm({ match, onSaved }: { match: MatchRow; onSaved?: () => void }) {
	const qc = useQueryClient();
	const { tid } = useT();
	const [court, setCourt] = React.useState(match.court ?? "");
	const [aSets, setASets] = React.useState(toText(match.a_sets));
	const [bSets, setBSets] = React.useState(toText(match.b_sets));
	const [aPts, setAPts] = React.useState(toText(match.a_pts));
	const [bPts, setBPts] = React.useState(toText(match.b_pts));
	const [saving, setSaving] = React.useState(false);
	const [warning, setWarning] = React.useState<{ message: string; clear: boolean } | null>(null);

	React.useEffect(() => {
		setCourt(match.court ?? "");
		setASets(toText(match.a_sets));
		setBSets(toText(match.b_sets));
		setAPts(toText(match.a_pts));
		setBPts(toText(match.b_pts));
	}, [match.id, match.court, match.a_sets, match.b_sets, match.a_pts, match.b_pts]);

	const canScore = !!match.team_a_id && !!match.team_b_id;
	const aName = match.team_a_name ?? "Team A";
	const bName = match.team_b_name ?? "Team B";

	async function save(clear: boolean, force = false) {
		setSaving(true);
		setWarning(null);
		try {
			await api(`/app-api/t/${tid}/matches/${match.id}`, "PATCH", {
				court,
				a_sets: clear ? null : aSets,
				b_sets: clear ? null : bSets,
				a_pts: clear ? null : aPts,
				b_pts: clear ? null : bPts,
				force,
			});
			if (clear) {
				setASets("");
				setBSets("");
				setAPts("");
				setBPts("");
			}
			await qc.invalidateQueries();
			toast.success(clear ? "Score cleared" : "Saved");
			onSaved?.();
		} catch (e) {
			// A later bracket match was already played: show what would be cleared and let the organizer decide.
			if (e instanceof ApiError && e.data?.code === "clears_later") setWarning({ message: e.message, clear });
			else toast.error(e instanceof Error ? e.message : "Could not save");
		} finally {
			setSaving(false);
		}
	}

	return (
		<form
			className="space-y-4"
			onSubmit={(e) => {
				e.preventDefault();
				save(false);
			}}
		>
			<div className="space-y-2">
				<Label htmlFor={`court-${match.id}`}>Court</Label>
				<Input id={`court-${match.id}`} value={court} onChange={(e) => setCourt(e.target.value)} placeholder="e.g. Court 3" />
			</div>
			<div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2">
				<span />
				<Label htmlFor={`as-${match.id}`}>Sets</Label>
				<Label htmlFor={`ap-${match.id}`}>Points</Label>
				<span className="min-w-0 truncate text-sm font-medium">{aName}</span>
				<Input id={`as-${match.id}`} type="number" min={0} inputMode="numeric" disabled={!canScore} value={aSets} onChange={(e) => setASets(e.target.value)} />
				<Input id={`ap-${match.id}`} type="number" min={0} inputMode="numeric" disabled={!canScore} value={aPts} onChange={(e) => setAPts(e.target.value)} />
				<span className="min-w-0 truncate text-sm font-medium">{bName}</span>
				<Input aria-label={`${bName} sets`} type="number" min={0} inputMode="numeric" disabled={!canScore} value={bSets} onChange={(e) => setBSets(e.target.value)} />
				<Input aria-label={`${bName} points`} type="number" min={0} inputMode="numeric" disabled={!canScore} value={bPts} onChange={(e) => setBPts(e.target.value)} />
			</div>
			{!canScore && <p className="text-sm text-secondary">Scores can be entered once both teams are known.</p>}
			{warning && (
				<div role="alert" className="space-y-2 rounded-lg bg-warning-weak p-3 text-sm text-warning-ink">
					<p className="font-medium">{warning.message}</p>
					<div className="flex gap-2">
						<Button type="button" size="sm" variant="primary" isLoading={saving} onClick={() => save(warning.clear, true)}>
							Save anyway
						</Button>
						<Button type="button" size="sm" variant="tertiary" onClick={() => setWarning(null)}>
							Cancel
						</Button>
					</div>
				</div>
			)}
			<div className="flex justify-end gap-2">
				{match.a_sets != null && (
					<Button type="button" variant="tertiary" disabled={saving} onClick={() => save(true)}>
						Clear score
					</Button>
				)}
				<Button type="submit" variant="primary" isLoading={saving}>
					Save
				</Button>
			</div>
		</form>
	);
}
