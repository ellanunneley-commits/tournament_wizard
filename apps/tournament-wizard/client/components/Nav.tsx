import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogIn, LogOut, MoreHorizontal, Volleyball } from "lucide-react";
import { cn } from "../lib/cn";
import { useSession } from "../lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./Dialog";

// `more`: on a phone, keep this under "More" so the bottom tabs go to what players use most.
export type NavItem = { href: string; label: string; icon: React.ReactNode; more?: boolean };

const MAX_TABS = 4;

// Wide screens: a bar across the top. Phones: a tab bar along the bottom, like an app, with the rest under "More".
export function Nav({ items }: { items: NavItem[]; layout?: "top" }) {
	const session = useSession();
	const location = useLocation();
	const [more, setMore] = React.useState(false);
	React.useEffect(() => setMore(false), [location.pathname]);

	const isActive = (href: string) => location.pathname === href || (href.split("/").length > 3 && location.pathname.startsWith(href + "/"));
	const crowded = items.length > MAX_TABS + 1;
	const tabs = crowded ? items.filter((it) => !it.more).slice(0, MAX_TABS) : items;
	const extra = crowded ? items.filter((it) => !tabs.includes(it)) : [];
	const account = session.email ? (
		<button type="button" onClick={session.signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-secondary hover:bg-subtle hover:text-ink">
			<LogOut className="size-4" /> <span className="hidden max-w-48 truncate sm:inline">Sign out {session.email}</span>
			<span className="sr-only sm:hidden">Sign out</span>
		</button>
	) : (
		<button type="button" onClick={session.signIn} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-subtle">
			<LogIn className="size-4" /> Sign in
		</button>
	);

	return (
		<>
			<header className="sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
				<div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
					<NavLink to="/" className="mr-2 flex items-center gap-2 font-bold">
						<span className="flex size-8 items-center justify-center rounded-lg bg-primary text-on-primary">
							<Volleyball className="size-5" />
						</span>
						<span className="whitespace-nowrap">Tournament Wizard</span>
					</NavLink>
					<nav className="hidden min-w-0 flex-1 gap-1 overflow-x-auto md:flex">
						{items.map((it) => (
							<NavLink
								key={it.href}
								to={it.href}
								end
								className={() => cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm [&_svg]:size-4", isActive(it.href) ? "bg-subtle font-semibold text-ink" : "text-secondary hover:bg-subtle hover:text-ink")}
							>
								{it.icon}
								{it.label}
							</NavLink>
						))}
					</nav>
					<div className="ml-auto">{account}</div>
				</div>
			</header>

			<nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
				<div className="flex">
					{tabs.map((it) => (
						<NavLink key={it.href} to={it.href} end className={() => cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] [&_svg]:size-5", isActive(it.href) ? "font-semibold text-primary" : "text-secondary")}>
							{it.icon}
							<span className="max-w-full truncate px-1">{it.label}</span>
						</NavLink>
					))}
					{extra.length > 0 && (
						<button type="button" onClick={() => setMore(true)} className={cn("flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]", extra.some((e) => isActive(e.href)) ? "font-semibold text-primary" : "text-secondary")}>
							<MoreHorizontal className="size-5" />
							More
						</button>
					)}
				</div>
			</nav>

			<Dialog open={more} onOpenChange={setMore}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>More</DialogTitle>
					</DialogHeader>
					<div className="grid grid-cols-3 gap-2">
						{extra.map((it) => (
							<NavLink key={it.href} to={it.href} end className={() => cn("flex flex-col items-center gap-1.5 rounded-xl border border-line p-3 text-center text-xs [&_svg]:size-6", isActive(it.href) ? "border-primary text-primary" : "text-ink")}>
								{it.icon}
								{it.label}
							</NavLink>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
