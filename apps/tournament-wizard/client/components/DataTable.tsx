import React from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef, SortingState, flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../lib/cn";

type Props<T> = {
	columns: ColumnDef<T, unknown>[];
	data: T[];
	isLoading?: boolean;
	emptyState?: React.ReactNode;
	getRowHref?: (row: T) => string;
	onRowClick?: (row: T) => void;
};

export function DataTable<T>({ columns, data, isLoading, emptyState, getRowHref, onRowClick }: Props<T>) {
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

	return (
		<div className="overflow-x-auto rounded-xl border border-line bg-surface">
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
					{table.getRowModel().rows.map((row) => (
						<tr
							key={row.id}
							className={cn(clickable && "cursor-pointer hover:bg-subtle")}
							onClick={(e) => {
								// Let buttons and links inside a row do their own thing.
								if ((e.target as HTMLElement).closest("a,button,[role=switch]")) return;
								if (clickable) open(row.original);
							}}
						>
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
	);
}
