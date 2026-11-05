import React from "react";
import { ChevronLeft } from "lucide-react";

export function PageHeader({ title, actions, breadcrumbs }: { title: string; actions?: React.ReactNode; breadcrumbs?: React.ReactNode }) {
	return (
		<header className="space-y-1">
			{breadcrumbs && (
				<div className="flex items-center gap-1 text-sm text-secondary [&_a:hover]:text-ink">
					<ChevronLeft className="size-4" />
					{breadcrumbs}
				</div>
			)}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="min-w-0 text-2xl font-bold tracking-tight">{title}</h1>
				{actions && <div className="flex shrink-0 gap-2">{actions}</div>}
			</div>
		</header>
	);
}
