import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function List({ children, emptyState }: { children?: React.ReactNode; emptyState?: React.ReactNode }) {
	const items = React.Children.toArray(children);
	if (items.length === 0) return <>{emptyState ?? null}</>;
	return <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{items}</ul>;
}

type ItemProps = { title: React.ReactNode; description?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode; to?: string };

export function ListItem({ title, description, leading, trailing, to }: ItemProps) {
	const body = (
		<>
			{leading}
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{title}</p>
				{description && <p className="truncate text-sm text-secondary">{description}</p>}
			</div>
			{trailing && <div className="shrink-0">{trailing}</div>}
			{to && <ChevronRight className="size-4 shrink-0 text-tertiary" />}
		</>
	);
	return (
		<li>
			{to ? (
				<Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-subtle active:bg-subtle">
					{body}
				</Link>
			) : (
				<div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{body}</div>
			)}
		</li>
	);
}
