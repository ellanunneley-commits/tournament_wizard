import React from "react";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { setAuthHeaders } from "./http";
import { CLERK_PUBLISHABLE_KEY } from "../config";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/Dialog";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Label } from "../components/Label";

// Sign-in. The online app uses Clerk: people sign in with their email and a one-time code.
// When running on your own computer (npm run dev) a simple test sign-in is used instead,
// unless VITE_CLERK_PUBLISHABLE_KEY is set in .env to try Clerk locally.
const CLERK_KEY = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined) || (import.meta.env.PROD ? CLERK_PUBLISHABLE_KEY : undefined);

type Session = { ready: boolean; email: string | null; signIn: () => void; signOut: () => void };
const SessionContext = React.createContext<Session>({ ready: false, email: null, signIn: () => {}, signOut: () => {} });
export const useSession = () => React.useContext(SessionContext);

function ClerkSession({ children }: { children: React.ReactNode }) {
	const { isLoaded, getToken } = useAuth();
	const { user } = useUser();
	const clerk = useClerk();
	const qc = useQueryClient();
	const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
	React.useEffect(() => {
		setAuthHeaders(async () => {
			const token = await getToken();
			return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
		});
		qc.invalidateQueries();
	}, [getToken, email]);
	const value = { ready: isLoaded, email, signIn: () => clerk.openSignIn(), signOut: () => clerk.signOut() };
	// Hold the app back until Clerk knows who is here, so the first requests carry the right person.
	return <SessionContext.Provider value={value}>{isLoaded ? children : null}</SessionContext.Provider>;
}

const DEV_KEY = "tw-dev-email";
const readDev = () => {
	try {
		return localStorage.getItem(DEV_KEY);
	} catch {
		return null;
	}
};

function DevSession({ children }: { children: React.ReactNode }) {
	const qc = useQueryClient();
	const [email, setEmail] = React.useState<string | null>(readDev);
	const [open, setOpen] = React.useState(false);
	const [draft, setDraft] = React.useState("");
	React.useMemo(() => setAuthHeaders(async (): Promise<Record<string, string>> => (readDev() ? { "x-dev-email": readDev()! } : {})), []);
	const change = (next: string | null) => {
		try {
			if (next) localStorage.setItem(DEV_KEY, next);
			else localStorage.removeItem(DEV_KEY);
		} catch {}
		setEmail(next);
		qc.invalidateQueries();
	};
	const value = { ready: true, email, signIn: () => setOpen(true), signOut: () => change(null) };
	return (
		<SessionContext.Provider value={value}>
			{children}
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							change(draft.trim().toLowerCase());
							setOpen(false);
						}}
					>
						<DialogHeader>
							<DialogTitle>Test sign-in</DialogTitle>
							<DialogDescription>Real sign-in (email code) is switched on when the Clerk keys are added. For now, type any email to act as that person.</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor="dev-email">Email</Label>
							<Input id="dev-email" type="email" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="you@email.com" />
						</div>
						<DialogFooter>
							<Button type="submit" variant="primary" disabled={!draft.includes("@")}>
								Sign in
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</SessionContext.Provider>
	);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
	if (CLERK_KEY) {
		return (
			<ClerkProvider publishableKey={CLERK_KEY}>
				<ClerkSession>{children}</ClerkSession>
			</ClerkProvider>
		);
	}
	return <DevSession>{children}</DevSession>;
}
