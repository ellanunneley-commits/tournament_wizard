import React from "react";
import { cn } from "../lib/cn";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("rounded-xl border border-line bg-surface p-4 shadow-sm", className)} {...rest}>
			{children}
		</div>
	);
}
