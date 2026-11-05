import { useQuery } from "@tanstack/react-query";
import { useT } from "./useT";
import { get } from "./http";

export type Player = { id: string; team_id: string; name: string };

export type MyEntry = {
	id: string;
	team_id: string | null;
	team_name: string | null;
	pool: string | null;
	pool_slot: number | null;
	players: Player[];
	guests: { id: string; email: string }[];
};

export type Access = {
	tournament_id: string;
	tournament_name: string;
	email: string | null;
	is_admin: boolean;
	can_see: boolean;
	activated: boolean;
	is_owner: boolean;
	open_slots: number;
	payment_link: string | null;
	pay_url: string | null; // the payment link tagged for this tournament, with the person's email filled in
	team_count: number;
	has_webhook_secret: boolean;
	auto_announce: { enabled: boolean; minutes: number };
	day: { start: string | null; end: string | null; game_minutes: number };
	rules: { scoring_format: "sand" | "court"; sets_to_win: number; set_points: number; deciding_set_points: number };
	registrations: MyEntry[];
};

// What the signed-in person may do in the tournament they are looking at.
export function useAccess() {
	const t = useT();
	return useQuery<Access>({
		queryKey: ["access", t.tid],
		queryFn: () => get(t.api("/access")),
	});
}
