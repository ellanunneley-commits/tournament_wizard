import React from "react";

export function DetailList({ title, children }: { title?: string; children: React.ReactNode }) {
	return (
		<section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
			{title && <h3 className="mb-2 text-base font-semibold">{title}</h3>}
			<dl className="divide-y divide-line">{children}</dl>
		</section>
	);
}

export function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center justify-between gap-4 py-2 text-sm">
			<dt className="text-secondary">{label}</dt>
			<dd className="text-right font-medium">{children}</dd>
		</div>
	);
}
