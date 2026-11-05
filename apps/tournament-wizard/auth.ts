import type { MiddlewareHandler } from "hono";
import { verifyToken } from "@clerk/backend";
import { getCookie } from "hono/cookie";
import type { Env } from "./lib/ctx";

// Who is signed in. Sign-in is handled by Clerk: people enter their email and get a one-time code.
// The Clerk session token must carry the email: in the Clerk dashboard, under Sessions > Customize session token, add
//   { "email": "{{user.primary_email_address}}" }
//
// For local testing without Clerk, set DEV_AUTH=1: the browser then sends the email it signed in with as "x-dev-email".
export const authMiddleware: MiddlewareHandler<Env> = async (c, next) => {
	let email: string | null = null;
	if (c.env.CLERK_SECRET_KEY) {
		const header = c.req.header("authorization");
		const token = header?.startsWith("Bearer ") ? header.slice(7) : getCookie(c, "__session");
		if (token) {
			try {
				const claims = await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY });
				email = typeof claims.email === "string" ? claims.email : null;
			} catch {
				email = null; // expired or forged token: treat as signed out
			}
		}
	} else if (c.env.DEV_AUTH === "1") {
		email = c.req.header("x-dev-email") ?? null;
	}
	c.set("email", email ? email.trim().toLowerCase() : null);
	await next();
};

// Kept in the same shape the original Glide helper had, so the routes did not need to change.
export const auth = (c: any) => ({
	user: () => {
		const email: string | null = c.get("email");
		return email ? { email } : null;
	},
});
