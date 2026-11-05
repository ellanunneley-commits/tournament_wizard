import React from "react";
import { useNavigate } from "react-router-dom";
import { Cell, ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

type Props<T> = {
	columns: ColumnDef<T, unknown>[];
	data: T[];
	isLoading?: boolean;
	emptyState?: React.ReactNode;
	getRowHref?: (row: T) => string;
	onRowClick?: (row: T) => void;
	// How one row looks on a phone. Without it, each row becomes a card: the first column as its title, the rest as labelled values.
	mobileCard?: (row: T) => React.ReactNode;
};

// Wide screens get a sortable table. Phones get a list of cards that fit the screen, with no sideways scrolling.
export function DataTable<T>({ columns, data, isLoading, emptyState, getRowHref, onRowClick, mobileCard }: Props<T>) {
	const navigate = useNavigate();
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

	if (isLoading) return <div className="h-32 animate-pulse rounded-xl bg-subtle" aria-label="Loading" />;
	if (data.length === 0) return <>{emptyState ?? null}</>;

	const open = (row: T) => {
		if (onRowClick) onRowClick(row);
		else if (getRowHref) navigate(getRowHref(row));
	};
	const clickable = !!(onRowClick || getRowHref);
	// Let buttons, links and switches inside a row do their own thing.
	const fromControl = (e: React.MouseEvent) => !!(e.target as HTMLElement).closest("a,button,[role=switch],input");
	const rows = table.getRowModel().rows;

	return (
		<>
			<ul className="space-y-2 md:hidden">
				{rows.map((row) => (
					<li
						key={row.id}
						className={cn("rounded-xl border border-line bg-surface p-3 shadow-sm", clickable && "cursor-pointer active:bg-subtle")}
						onClick={(e) => clickable && !fromControl(e) && open(row.original)}
					>
						{mobileCard ? mobileCard(row.original) : <DefaultCard cells={row.getVisibleCells()} clickable={clickable} />}
					</li>
				))}
			</ul>

			<div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
				<table className="w-full text-sm">
					<thead className="bg-subtle text-left text-xs text-secondary">
						{table.getHeaderGroups().map((g) => (
							<tr key={g.id}>
								{g.headers.map((h) => {
									const canSort = h.column.getCanSort();
									const dir = h.column.getIsSorted();
									return (
										<th key={h.id} className="whitespace-nowrap px-3 py-2 font-medium">
											{canSort ? (
												<button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={h.column.getToggleSortingHandler()}>
													{flexRender(h.column.columnDef.header, h.getContext())}
													{dir === "asc" ? <ArrowUp className="size-3" /> : dir === "desc" ? <ArrowDown className="size-3" /> : null}
												</button>
											) : (
												flexRender(h.column.columnDef.header, h.getContext())
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody className="divide-y divide-line">
						{rows.map((row) => (
							<tr key={row.id} className={cn(clickable && "cursor-pointer hover:bg-subtle")} onClick={(e) => clickable && !fromControl(e) && open(row.original)}>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="whitespace-nowrap px-3 py-2.5">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function DefaultCard<T>({ cells, clickable }: { cells: Cell<T, unknown>[]; clickable: boolean }) {
	const [first, ...rest] = cells;
	const label = (c: Cell<T, unknown>) => (typeof c.column.columnDef.header === "string" ? c.column.columnDef.header : "");
	const values = rest.filter((c) => label(c));
	const actions = rest.filter((c) => !label(c));
	return (
		<div className="space-y-2">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 font-semibold">{flexRender(first.column.columnDef.cell, first.getContext())}</div>
				{clickable && actions.length === 0 && <ChevronRight className="mt-0.5 size-4 shrink-0 text-tertiary" />}
			</div>
			{values.length > 0 && (
				<dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
					{values.map((c) => (
						<div key={c.id} className="min-w-0">
							<dt className="text-xs text-secondary">{label(c)}</dt>
							<dd className="truncate">{flexRender(c.column.columnDef.cell, c.getContext())}</dd>
						</div>
					))}
				</dl>
			)}
			{actions.length > 0 && (
				<div className="flex justify-end gap-2">
					{actions.map((c) => (
						<React.Fragment key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</React.Fragment>
					))}
				</div>
			)}
		</div>
	);
}
