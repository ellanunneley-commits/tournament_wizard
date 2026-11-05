import React from "react";
import { BrowserRouter, Route as RouterRoute, Routes as RouterRoutes, useParams } from "react-router-dom";
import { ListOrdered, CalendarDays, Network, Users, UserRound, Ticket, Trophy, ShieldCheck, Radio, Megaphone, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Nav } from "./components/Nav";
import { Toaster } from "./components/Toast";
import { LockedScreen } from "./components/LockedScreen";
import { PageHeader } from "./components/PageHeader";
import { useAccess } from "./lib/access";
import Home, { TournamentList } from "./pages/Home";
import Owner from "./pages/Owner";
import Standings from "./pages/Standings";
import Live from "./pages/Live";
import Master from "./pages/Master";
import Schedule from "./pages/Schedule";
import Match from "./pages/Match";
import Score from "./pages/Score";
import Bracket from "./pages/Bracket";
import Teams from "./pages/Teams";
import Team from "./pages/Team";
import MyTeam from "./pages/MyTeam";
import Entries from "./pages/Entries";
import Announcements from "./pages/Announcements";
import { get } from "./lib/http";

// Tournament pages are for registered teams, their invited guests and organizers.
function Members({ children }: { children: React.ReactNode }) {
	const { data: access } = useAccess();
	if (!access) return <PageHeader title="Loading" />;
	if (!access.can_see) return <LockedScreen email={access.email} activated={access.activated} />;
	return <>{children}</>;
}

// Everything inside one tournament lives under /t/:tid.
function TournamentLayout() {
	const { tid } = useParams();
	const { data: access } = useAccess();
	const base = `/t/${tid}`;
	const items = [
		{ href: "/", label: "Tournaments", icon: <Trophy /> },
		...(access?.can_see
			? [
					{ href: base, label: "Standings", icon: <ListOrdered /> },
					{ href: `${base}/live`, label: "Live", icon: <Radio /> },
					{ href: `${base}/schedule`, label: "Schedule", icon: <CalendarDays /> },
					{ href: `${base}/master`, label: "Master", icon: <Clock /> },
					{ href: `${base}/bracket`, label: "Bracket", icon: <Network /> },
					{ href: `${base}/teams`, label: "Teams", icon: <Users /> },
				]
			: []),
		{ href: `${base}/my-team`, label: "My team", icon: <UserRound /> },
		...(access?.is_admin
			? [
					{ href: `${base}/announcements`, label: "Announcements", icon: <Megaphone /> },
					{ href: `${base}/entries`, label: "Entries", icon: <Ticket /> },
				]
			: []),
	];
	return (
		<>
			<Nav layout="top" items={items} />
			<main className="mx-auto max-w-[1200px] px-4 pt-4 pb-28 md:pt-6 md:pb-8">
				{access && <p className="mb-2 text-sm text-secondary">{access.tournament_name}</p>}
				<RouterRoutes>
					<RouterRoute path="/" element={<Members><Standings /></Members>} />
					<RouterRoute path="/live" element={<Members><Live /></Members>} />
					<RouterRoute path="/schedule" element={<Members><Schedule /></Members>} />
					<RouterRoute path="/master" element={<Members><Master /></Members>} />
					<RouterRoute path="/schedule/:id" element={<Members><Match /></Members>} />
					<RouterRoute path="/score/:id" element={<Members><Score /></Members>} />
					<RouterRoute path="/bracket" element={<Members><Bracket /></Members>} />
					<RouterRoute path="/teams" element={<Members><Teams /></Members>} />
					<RouterRoute path="/teams/:id" element={<Members><Team /></Members>} />
					<RouterRoute path="/my-team" element={<MyTeam />} />
					<RouterRoute path="/entries" element={<Entries />} />
					<RouterRoute path="/announcements" element={<Announcements />} />
				</RouterRoutes>
			</main>
		</>
	);
}

// The list of tournaments, and the owner's overview of all of them.
function GlobalLayout() {
	const { data } = useQuery<TournamentList>({
		queryKey: ["tournaments"],
		queryFn: () => get("/app-api/tournaments"),
	});
	const items = [
		{ href: "/", label: "Tournaments", icon: <Trophy /> },
		...(data?.is_owner ? [{ href: "/owner", label: "Owner", icon: <ShieldCheck /> }] : []),
	];
	return (
		<>
			<Nav layout="top" items={items} />
			<main className="mx-auto max-w-[1200px] px-4 pt-4 pb-28 md:pt-6 md:pb-8">
				<RouterRoutes>
					<RouterRoute path="/owner" element={<Owner />} />
					<RouterRoute path="*" element={<Home />} />
				</RouterRoutes>
			</main>
		</>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<RouterRoutes>
				<RouterRoute path="/t/:tid/*" element={<TournamentLayout />} />
				<RouterRoute path="*" element={<GlobalLayout />} />
			</RouterRoutes>
			<Toaster />
		</BrowserRouter>
	);
}
