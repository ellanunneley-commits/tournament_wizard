import React from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "./Button";

const KEY = "tw-install-dismissed";
const dismissedBefore = () => {
	try {
		return localStorage.getItem(KEY) === "1";
	} catch {
		return false;
	}
};
const installed = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const isIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Invites people to put the app on their home screen. Android and desktop Chrome get a button;
// iPhones can't do that from a web page, so they get the two taps to do it themselves.
export function InstallPrompt() {
	const [event, setEvent] = React.useState<any>(null);
	const [hidden, setHidden] = React.useState(() => installed() || dismissedBefore());
	React.useEffect(() => {
		const grab = (e: Event) => {
			e.preventDefault();
			setEvent(e);
		};
		window.addEventListener("beforeinstallprompt", grab);
		return () => window.removeEventListener("beforeinstallprompt", grab);
	}, []);

	const dismiss = () => {
		try {
			localStorage.setItem(KEY, "1");
		} catch {}
		setHidden(true);
	};
	if (hidden || (!event && !isIPhone())) return null;

	return (
		<div className="relative flex items-start gap-3 rounded-xl border border-line bg-surface p-4 pr-10 shadow-sm">
			<img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
			<div className="min-w-0 space-y-2">
				<p className="font-semibold">Put Tournament Wizard on your home screen</p>
				{event ? (
					<>
						<p className="text-sm text-secondary">It opens full screen like an app, so scores are one tap away on tournament day.</p>
						<Button
							size="sm"
							variant="primary"
							onClick={async () => {
								event.prompt();
								await event.userChoice.catch(() => null);
								setEvent(null);
								setHidden(true);
							}}
						>
							<Download /> Install
						</Button>
					</>
				) : (
					<p className="text-sm text-secondary">
						In Safari, tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> Share, then <span className="font-medium text-ink">Add to Home Screen</span>.
					</p>
				)}
			</div>
			<button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded-md p-1.5 text-secondary hover:bg-subtle" aria-label="Don't show this again">
				<X className="size-4" />
			</button>
		</div>
	);
}
