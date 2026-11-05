// Tournament Wizard service worker: lets the app open from the home screen like an app, and still open with no signal.
// Live data (/app-api) is never cached, so scores are always fresh.
const CACHE = "tw-v1";

// Save the app itself on install: the page, plus every script and stylesheet it loads.
self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(["/manifest.webmanifest", "/icon-192.png"]);
			const res = await fetch("/", { cache: "no-store" });
			const html = await res.clone().text();
			await cache.put("/", res);
			const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
			await cache.addAll(assets);
		})(),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

const save = (key, res) => {
	if (res.ok) {
		const copy = res.clone();
		caches.open(CACHE).then((c) => c.put(key, copy));
	}
	return res;
};

self.addEventListener("fetch", (event) => {
	const req = event.request;
	const url = new URL(req.url);
	if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/app-api/")) return;
	// Pages: try the network first so updates show up; with no signal, open the last saved copy.
	if (req.mode === "navigate") {
		event.respondWith(fetch(req).then((res) => save("/", res)).catch(() => caches.match("/", { ignoreVary: true })));
		return;
	}
	// Built files have a fingerprint in their name, so a saved copy is always right.
	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => save(req, res))));
	}
});
