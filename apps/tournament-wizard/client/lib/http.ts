// Every request to the server goes through here, so it carries who is signed in.
let authHeaders: () => Promise<Record<string, string>> = async () => ({});

export function setAuthHeaders(fn: () => Promise<Record<string, string>>) {
	authHeaders = fn;
}

export async function authFetch(path: string, init: RequestInit = {}) {
	const headers = { ...(init.headers as Record<string, string>), ...(await authHeaders()) };
	return fetch(path, { ...init, headers });
}

// Read data from the server. An error (like "only organizers can do that") becomes a thrown error instead of bad data.
export async function get<T = any>(path: string): Promise<T> {
	const res = await authFetch(path);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? "Something went wrong");
	return data as T;
}
