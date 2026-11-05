import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./lib/auth";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: {
		// Pages refresh on their own timers; a failed request (like a locked page) is not worth retrying three times.
		queries: { retry: 1, refetchOnWindowFocus: true },
	},
});

// The service worker makes the app installable and lets it open without a signal. Only in the real (built) app.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<App />
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
