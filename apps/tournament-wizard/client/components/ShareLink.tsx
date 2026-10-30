import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { toast } from "./Toast";
import { useT } from "../lib/useT";

// A link and QR code to the app. Opening it only leads to sign-in: what people can see still depends on being registered or invited.
export function ShareLink({ title, note }: { title: string; note: string }) {
	const { tid } = useT();
	const url = typeof window === "undefined" ? "" : `${window.location.origin}/t/${tid}`;
	async function copy() {
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied");
		} catch {
			toast.error("Could not copy the link");
		}
	}
	return (
		<Card>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="shrink-0 self-start rounded-lg bg-white p-3 dark:bg-white">
					<QRCodeSVG value={url} size={120} />
				</div>
				<div className="min-w-0 flex-1 space-y-2">
					<h3 className="text-base font-semibold">{title}</h3>
					<p className="text-sm text-secondary">{note}</p>
					<div className="flex gap-2">
						<Input aria-label="App link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
						<Button variant="secondary" onClick={copy}>
							<Copy /> Copy
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}
