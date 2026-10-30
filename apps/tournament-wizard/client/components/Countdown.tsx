import React from "react";

// Counts down to a moment, second by second, and says "Starting now" once it has passed.
export function Countdown({ to, className }: { to: string; className?: string }) {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	const left = Math.max(0, Math.ceil((new Date(to).getTime() - now) / 1000));
	if (left === 0) return <span className={className}>Starting now</span>;
	const m = Math.floor(left / 60);
	const s = String(left % 60).padStart(2, "0");
	return <span className={`tabular-nums ${className ?? ""}`}>Starts in {m}:{s}</span>;
}
