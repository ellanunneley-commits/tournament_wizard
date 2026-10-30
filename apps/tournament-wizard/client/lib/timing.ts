import { MatchRow } from "./tournament";

export type Day = { start: string | null; end: string | null; game_minutes: number };

const MIN = 60000;
const ON_PACE = 2; // minutes either way that still counts as on pace

export const NO_COURT = "No court";
export const laneOf = (m: MatchRow) => m.court ?? NO_COURT;

// Minutes the game took, once it has both a logged start and a logged end.
export function lengthOf(m: MatchRow) {
	return m.started_at && m.ended_at ? (new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / MIN : null;
}

export function fmtDuration(minutes: number) {
	const total = Math.round(Math.abs(minutes));
	const h = Math.floor(total / 60);
	const m = total % 60;
	return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m} min`;
}

export const fmtTime = (iso: string | Date) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtSigned = (minutes: number) => `${minutes > 0 ? "+" : minutes < 0 ? "−" : ""}${Math.round(Math.abs(minutes))} min`;

// Games in the order they are played: pool play first, then the bracket.
export const playOrder = (matches: MatchRow[]) => [...matches].sort((a, b) => Number(a.stage === "bracket") - Number(b.stage === "bracket") || a.sort_order - b.sort_order);

export function lanes(matches: MatchRow[]) {
	const map = new Map<string, MatchRow[]>();
	for (const m of playOrder(matches)) {
		const key = laneOf(m);
		map.set(key, [...(map.get(key) ?? []), m]);
	}
	return map;
}

// Planned start of each game: the day's start, then one planned game length after another on each court.
export function plannedStarts(matches: MatchRow[], day: Day) {
	const planned = new Map<string, Date>();
	if (!day.start) return planned;
	const base = new Date(day.start).getTime();
	for (const list of lanes(matches).values()) {
		list.forEach((m, i) => planned.set(m.id, new Date(base + i * day.game_minutes * MIN)));
	}
	return planned;
}

export type CourtStat = {
	court: string;
	games: number;
	finished: number;
	live: number;
	played: number; // finished games with a logged length
	avg: number | null;
	timeUsed: number;
	diff: number | null; // average length minus the planned length
	pace: "long" | "short" | "on pace" | "no data";
	projectedFinish: Date | null;
};

export function courtStats(matches: MatchRow[], day: Day, now: number): CourtStat[] {
	return [...lanes(matches).entries()].map(([court, list]) => {
		const lengths = list.map(lengthOf).filter((x): x is number => x != null);
		const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null;
		const diff = avg == null ? null : avg - day.game_minutes;
		const remaining = list.filter((m) => m.status !== "final").length;
		return {
			court,
			games: list.length,
			finished: list.filter((m) => m.status === "final").length,
			live: list.filter((m) => m.status === "live").length,
			played: lengths.length,
			avg,
			timeUsed: lengths.reduce((a, b) => a + b, 0),
			diff,
			pace: diff == null ? "no data" : diff > ON_PACE ? "long" : diff < -ON_PACE ? "short" : "on pace",
			projectedFinish: remaining === 0 ? null : new Date(now + remaining * (avg ?? day.game_minutes) * MIN),
		};
	});
}
