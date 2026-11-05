import React from "react";
import { cn } from "../lib/cn";

type Props = { label: string; value: string; context?: string; icon?: React.ReactNode; delta?: string; sentiment?: "neutral" | "success" | "error" };

export function Stat({ label, value, context, icon, delta, sentiment = "neutral" }: Props) {
	return (
		<div className="min-w-0 rounded-xl border border-line bg-surface p-3 shadow-sm sm:p-4">
			<p className="flex items-center gap-1.5 text-xs font-medium text-secondary">
				{icon}
				{label}
			</p>
			<p className="mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
			{delta && <p className={cn("text-sm font-medium", sentiment === "success" ? "text-success-ink" : sentiment === "error" ? "text-error-ink" : "text-secondary")}>{delta}</p>}
			{context && <p className="truncate text-xs text-secondary">{context}</p>}
		</div>
	);
}
