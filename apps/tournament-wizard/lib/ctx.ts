import type { NeonQueryFunction } from "@neondatabase/serverless";

export type Row = Record<string, any>;
export type Sql = NeonQueryFunction<false, false>;

export type Viewer = {
	email: string | null;
	isAdmin: boolean; // organizer of this tournament, or an app owner
	isOwner: boolean; // owns the app: sees every tournament and the money owed
	scorekeeper: boolean; // an organizer allowed this person to score any match live
	paid: boolean;
	invited: boolean;
	activated: boolean; // the app fee is paid or waived
	canSee: boolean;
	tournament: Row;
};

export type Env = {
	Bindings: { DATABASE_URL: string; CLERK_SECRET_KEY?: string; DEV_AUTH?: string; LOCAL_SQL?: Sql };
	Variables: { sql: Sql; tid: number; v: Viewer; email: string | null };
};

export const forbidden = (c: any) => c.json({ error: "Only the organizers can do that" }, 403);
export const ownerOnly = (c: any) => c.json({ error: "Only the app owner can do that" }, 403);
export const locked = (c: any) => c.json({ error: "Only registered teams and their invited guests can see this" }, 403);
