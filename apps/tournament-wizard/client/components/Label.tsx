import React from "react";
import { cn } from "../lib/cn";

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
	return <label className={cn("block text-sm font-medium text-ink", className)} {...rest} />;
}
