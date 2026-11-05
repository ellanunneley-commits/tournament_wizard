import React from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: "primary" | "secondary" | "tertiary";
	size?: "sm" | "md" | "lg" | "icon";
	isLoading?: boolean;
	asChild?: boolean;
};

const VARIANT = {
	primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-sm",
	secondary: "border border-line bg-surface text-ink hover:bg-subtle",
	tertiary: "text-ink hover:bg-subtle",
};
const SIZE = {
	sm: "h-8 gap-1.5 px-3 text-sm [&_svg]:size-4",
	md: "h-10 gap-2 px-4 text-sm [&_svg]:size-4",
	lg: "h-12 gap-2 px-6 text-base [&_svg]:size-5",
	icon: "size-10 [&_svg]:size-4",
};

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
	{ variant = "secondary", size = "md", isLoading, asChild, className, children, disabled, ...rest },
	ref,
) {
	const classes = cn(
		"inline-flex shrink-0 select-none items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50",
		VARIANT[variant],
		SIZE[size],
		className,
	);
	if (asChild) {
		return (
			<Slot ref={ref as any} className={classes} {...(rest as any)}>
				{children}
			</Slot>
		);
	}
	return (
		<button ref={ref} type="button" className={classes} disabled={disabled || isLoading} aria-busy={isLoading || undefined} {...rest}>
			{isLoading && <Loader2 className="animate-spin" />}
			{children}
		</button>
	);
});
