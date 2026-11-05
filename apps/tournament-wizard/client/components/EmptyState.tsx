import React from "react";

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
	return (
		<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center">
			{icon && <div className="rounded-full bg-subtle p-3 text-secondary [&_svg]:size-6">{icon}</div>}
			<div className="space-y-1">
				<p className="font-semibold">{title}</p>
				{description && <p className="mx-auto max-w-md text-sm text-secondary">{description}</p>}
			</div>
			{action}
		</div>
	);
}
