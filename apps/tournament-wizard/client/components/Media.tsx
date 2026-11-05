import React from "react";
import { cn } from "../lib/cn";

const initialsOf = (text: string) =>
	text
		.split(/[\s@._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]!.toUpperCase())
		.join("");

export function Media({ initials, icon, shape = "square" }: { initials?: string; icon?: React.ReactNode; shape?: "circle" | "square" }) {
	return (
		<div className={cn("flex size-10 shrink-0 items-center justify-center bg-subtle text-sm font-semibold text-ink-2 [&_svg]:size-5", shape === "circle" ? "rounded-full" : "rounded-lg")}>
			{icon ?? (initials ? initialsOf(initials) : null)}
		</div>
	);
}
