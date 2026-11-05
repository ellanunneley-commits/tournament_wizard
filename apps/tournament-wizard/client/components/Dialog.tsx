import React from "react";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const Dialog = D.Root;

// On a phone the dialog rises from the bottom like a sheet; on a bigger screen it sits in the middle.
export function DialogContent({ children }: { children: React.ReactNode }) {
	return (
		<D.Portal>
			<D.Overlay className="fixed inset-0 z-40 bg-black/40" />
			<D.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] space-y-4 overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
				{children}
				<D.Close className="absolute right-3 top-3 rounded-md p-1.5 text-secondary hover:bg-subtle" aria-label="Close">
					<X className="size-4" />
				</D.Close>
			</D.Content>
		</D.Portal>
	);
}

export const DialogHeader = ({ children }: { children: React.ReactNode }) => <div className="space-y-1 pr-8">{children}</div>;
export const DialogFooter = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">{children}</div>;
export const DialogTitle = ({ children }: { children: React.ReactNode }) => <D.Title className="text-lg font-semibold">{children}</D.Title>;
export const DialogDescription = ({ children }: { children: React.ReactNode }) => <D.Description className="text-sm text-secondary">{children}</D.Description>;
