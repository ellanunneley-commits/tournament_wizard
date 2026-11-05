import React from "react";
import { cn } from "../lib/cn";

export const fieldClass =
	"w-full rounded-lg border border-line bg-surface px-3 text-base text-ink placeholder:text-tertiary focus:border-primary focus:outline-2 focus:outline-primary/30 disabled:opacity-50 sm:text-sm";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
	return <input ref={ref} className={cn(fieldClass, "h-10", className)} {...rest} />;
});
