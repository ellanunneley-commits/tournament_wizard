import React from "react";
import { cn } from "../lib/cn";

const TONE = {
	neutral: "bg-subtle text-ink-2",
	success: "bg-success-weak text-success-ink",
	info: "bg-info-weak text-info-ink",
	warning: "bg-warning-weak text-warning-ink",
	error: "bg-error-weak text-error-ink",
};

export function Badge({ tone, className, children }: { tone?: keyof typeof TONE; className?: string; children: React.ReactNode }) {
	return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONE[tone ?? "neutral"], className)}>{children}</span>;
}
