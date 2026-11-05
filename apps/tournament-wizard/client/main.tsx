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

createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<App />
			</AuthProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
