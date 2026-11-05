import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Timer } from "lucide-react";
import { Countdown } from "./Countdown";
import { useT } from "../lib/useT";
import { get } from "../lib/http";

export type Announcement = {
	id: string;
	message: string;
	active: boolean;
	auto: boolean;
	created_at: string;
	countdown_to: string | null;
	expired: boolean;
};

export const timeText = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// The messages the organizers have switched on (and the automatic "next game" ones), newest first, at the top of the home screen.
export function AnnouncementsBanner() {
	const tour = useT();
	const { data = [] } = useQuery<Announcement[]>({
		queryKey: ["announcements", tour.tid],
		refetchInterval: 10000,
		queryFn: () => get(tour.api("/announcements")),
	});
	const active = Array.isArray(data) ? data.filter((a) => a.active && !a.expired) : [];
	if (active.length === 0) return null;
	return (
		<div className="space-y-2" role="status" aria-label="Announcements">
			{active.map((a) => (
				<div key={a.id} className="flex items-start gap-3 rounded-lg border border-info-weak bg-info-weak px-4 py-3 text-info-ink">
					{a.countdown_to ? <Timer className="mt-0.5 size-5 shrink-0" /> : <Megaphone className="mt-0.5 size-5 shrink-0" />}
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium">{a.message}</p>
						{a.countdown_to && <Countdown to={a.countdown_to} className="text-lg font-semibold" />}
					</div>
					<span className="shrink-0 text-xs opacity-80">{timeText(a.created_at)}</span>
				</div>
			))}
		</div>
	);
}
