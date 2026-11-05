import React from "react";
import * as S from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";

export const Select = S.Root;
export const SelectValue = S.Value;

export function SelectTrigger({ className, children, ...rest }: React.ComponentProps<typeof S.Trigger>) {
	return (
		<S.Trigger className={cn("inline-flex h-10 items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:outline-2 focus:outline-primary/30", className ?? "w-full")} {...rest}>
			{children}
			<S.Icon>
				<ChevronDown className="size-4 text-secondary" />
			</S.Icon>
		</S.Trigger>
	);
}

export function SelectContent({ children }: { children: React.ReactNode }) {
	return (
		<S.Portal>
			<S.Content position="popper" sideOffset={4} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
				<S.Viewport className="p-1">{children}</S.Viewport>
			</S.Content>
		</S.Portal>
	);
}

export function SelectItem({ children, ...rest }: React.ComponentProps<typeof S.Item>) {
	return (
		<S.Item className="relative flex cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm text-ink outline-none data-[highlighted]:bg-subtle" {...rest}>
			<S.ItemIndicator className="absolute left-2">
				<Check className="size-4" />
			</S.ItemIndicator>
			<S.ItemText>{children}</S.ItemText>
		</S.Item>
	);
}
