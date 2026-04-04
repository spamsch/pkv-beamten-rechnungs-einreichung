import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  useReactTable,
  type SortingState,
  type GroupingState,
} from "@tanstack/react-table";
import { Pencil, Trash2, ExternalLink, Columns3, ArrowRightLeft, ArrowUp, ArrowDown, ArrowUpDown, Group, ChevronRight, ChevronDown } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Invoice, Person } from "../lib/types";
import { deriveStatus, isOverdue } from "../lib/types";
import { formatDate, formatEur } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { useSettings } from "../hooks/usePaperless";

interface InvoiceTableProps {
  invoices: Invoice[];
  persons: Person[];
  onDelete: (id: number) => void;
  onMarkFinal: (id: number) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  hiddenColumns: Set<string>;
  onHiddenColumnsChange: (cols: Set<string>) => void;
}

const columnHelper = createColumnHelper<Invoice>();

/** All toggleable column IDs with their labels */
const TOGGLEABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "paperless_doc_id", label: "PL#" },
  { id: "person_id", label: "Person" },
  { id: "arzt", label: "Arzt" },
  { id: "datum", label: "Datum" },
  { id: "rechnungs_nummer", label: "Re-Nr." },
  { id: "betrag", label: "Betrag" },
  { id: "ueberwiesen", label: "Überwiesen" },
  { id: "status", label: "Status" },
  { id: "next_step", label: "Nächster Schritt" },
  { id: "beihilfe_eingereicht", label: "BH eingereicht" },
  { id: "beihilfe_zu_bezahlen", label: "BH soll" },
  { id: "beihilfe_bezahlt", label: "BH ist" },
  { id: "debeka_zu_bezahlen", label: "DK soll" },
  { id: "debeka_bezahlt", label: "DK ist" },
  { id: "differenz", label: "Diff." },
];

/** Columns available for grouping (non-monetary) */
const GROUPABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "person_id", label: "Person" },
  { id: "arzt", label: "Arzt" },
  { id: "datum", label: "Datum" },
  { id: "status", label: "Status" },
  { id: "next_step", label: "Nächster Schritt" },
  { id: "beihilfe_eingereicht", label: "BH eingereicht" },
  { id: "ueberwiesen", label: "Überwiesen" },
];

function deriveNextStep(invoice: Invoice): { label: string; color: string } {
  if (invoice.is_final) return { label: "—", color: "text-gray-400" };

  const bhOffen = invoice.beihilfe_bezahlt < invoice.beihilfe_zu_bezahlen;
  const dkOffen = invoice.debeka_bezahlt < invoice.debeka_zu_bezahlen;

  if (invoice.ueberwiesen_datum) {
    if (bhOffen && dkOffen) return { label: "Warten auf BH + DK", color: "text-amber-600" };
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Fertig markieren", color: "text-emerald-600" };
  }

  if (invoice.beihilfe_bezahlt > 0 && invoice.debeka_bezahlt > 0)
    return { label: "Überweisen", color: "text-violet-600" };

  if (invoice.beihilfe_bezahlt > 0 || invoice.debeka_bezahlt > 0) {
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Überweisen", color: "text-violet-600" };
  }

  if (invoice.beihilfe_eingereicht && invoice.debeka_eingereicht) {
    if (bhOffen && dkOffen) return { label: "Warten auf BH + DK", color: "text-amber-600" };
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Überweisen", color: "text-violet-600" };
  }
  if (invoice.beihilfe_eingereicht && !invoice.debeka_eingereicht)
    return { label: "DK einreichen", color: "text-blue-600" };
  if (!invoice.beihilfe_eingereicht && invoice.debeka_eingereicht)
    return { label: "BH einreichen", color: "text-blue-600" };
  return { label: "Einreichen", color: "text-blue-600" };
}

function rowClassName(invoice: Invoice, isSelected: boolean): string {
  if (isSelected) return "bg-blue-50 hover:bg-blue-100";

  const status = deriveStatus(invoice);
  const overdue = isOverdue(invoice);

  if (overdue) return "bg-amber-50/60 hover:bg-amber-50";

  switch (status) {
    case "neu":
      return "bg-white hover:bg-gray-50";
    case "teilweise_eingereicht":
      return "bg-sky-50/40 hover:bg-sky-50";
    case "eingereicht":
      return "bg-sky-50/40 hover:bg-sky-50";
    case "teilweise_bezahlt":
      return "bg-orange-50/40 hover:bg-orange-50";
    case "bezahlt":
      return "bg-violet-50/40 hover:bg-violet-50";
    case "ueberwiesen":
      return "bg-teal-50/40 hover:bg-teal-50";
    case "abgeschlossen":
      return "bg-emerald-50/30 hover:bg-emerald-50";
    default:
      return "bg-white hover:bg-gray-50";
  }
}

export function InvoiceTable({
  invoices,
  persons,
  onDelete,
  onMarkFinal,
  selectedIds,
  onSelectionChange,
  hiddenColumns,
  onHiddenColumnsChange,
}: InvoiceTableProps) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const { data: settings } = useSettings();
  const paperlessUrl = settings?.paperless_url;

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p.name])),
    [persons]
  );

  const allColumns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={
              invoices.length > 0 &&
              invoices.every((i) => selectedIds.has(i.id))
            }
            onChange={(e) => {
              if (e.target.checked) {
                onSelectionChange(new Set(invoices.map((i) => i.id)));
              } else {
                onSelectionChange(new Set());
              }
              table.resetRowSelection();
            }}
            className="rounded border-gray-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={(e) => {
              const next = new Set(selectedIds);
              if (e.target.checked) {
                next.add(row.original.id);
              } else {
                next.delete(row.original.id);
              }
              onSelectionChange(next);
            }}
            className="rounded border-gray-300"
          />
        ),
        size: 40,
      }),
      columnHelper.accessor("paperless_doc_id", {
        header: "PL#",
        enableGrouping: false,
        aggregatedCell: () => null,
        cell: (info) => info.getValue() ?? "—",
        size: 55,
      }),
      columnHelper.accessor("person_id", {
        header: "Person",
        cell: (info) => personMap.get(info.getValue()) ?? info.getValue(),
        aggregatedCell: (info) => personMap.get(info.getValue() as string) ?? info.getValue(),
        size: 90,
      }),
      columnHelper.accessor("arzt", {
        header: "Arzt",
        cell: (info) => {
          const notes = info.row.original.notes;
          return (
            <div>
              <span>{info.getValue()}</span>
              {notes && (
                <p className="text-xs text-gray-400 whitespace-normal break-words">{notes}</p>
              )}
            </div>
          );
        },
        size: 150,
      }),
      columnHelper.accessor("datum", {
        header: "Datum",
        cell: (info) => formatDate(info.getValue()),
        size: 100,
      }),
      columnHelper.accessor("rechnungs_nummer", {
        header: "Re-Nr.",
        size: 110,
      }),
      columnHelper.accessor("betrag", {
        header: "Betrag",
        cell: (info) => formatEur(info.getValue()),
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => formatEur(info.getValue() as number),
        size: 100,
      }),
      columnHelper.accessor((row) => row.ueberwiesen_datum ?? "", {
        id: "ueberwiesen",
        header: "Überw.",
        cell: ({ row }) => {
          const datum = row.original.ueberwiesen_datum;
          if (!datum) return null;
          return (
            <span title={`Überwiesen am ${formatDate(datum)}`} className="text-teal-600">
              <ArrowRightLeft size={15} />
            </span>
          );
        },
        size: 50,
      }),
      columnHelper.accessor((row) => deriveStatus(row), {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge invoice={row.original} />,
        size: 140,
      }),
      columnHelper.accessor((row) => deriveNextStep(row).label, {
        id: "next_step",
        header: "Nächster Schritt",
        cell: ({ row }) => {
          const step = deriveNextStep(row.original);
          if (step.label === "Fertig markieren") {
            return (
              <button
                onClick={() => onMarkFinal(row.original.id)}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-800 underline underline-offset-2"
              >
                {step.label}
              </button>
            );
          }
          return (
            <span className={`text-xs font-medium ${step.color}`}>
              {step.label}
            </span>
          );
        },
        size: 140,
      }),
      columnHelper.accessor("beihilfe_eingereicht", {
        header: "BH eingereicht",
        cell: (info) => formatDate(info.getValue()),
        size: 110,
      }),
      columnHelper.accessor("beihilfe_zu_bezahlen", {
        header: "BH soll",
        cell: (info) => formatEur(info.getValue()),
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => formatEur(info.getValue() as number),
        size: 90,
      }),
      columnHelper.accessor("beihilfe_bezahlt", {
        header: "BH ist",
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={v === 0 ? "text-red-400 font-medium" : "text-green-700"}>
              {formatEur(v)}
            </span>
          );
        },
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => formatEur(info.getValue() as number),
        size: 90,
      }),
      columnHelper.accessor("debeka_zu_bezahlen", {
        header: "DK soll",
        cell: (info) => formatEur(info.getValue()),
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => formatEur(info.getValue() as number),
        size: 90,
      }),
      columnHelper.accessor("debeka_bezahlt", {
        header: "DK ist",
        cell: (info) => {
          const v = info.getValue();
          return (
            <span className={v === 0 ? "text-red-400 font-medium" : "text-green-700"}>
              {formatEur(v)}
            </span>
          );
        },
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => formatEur(info.getValue() as number),
        size: 90,
      }),
      columnHelper.accessor("differenz", {
        header: "Diff.",
        cell: (info) => {
          const v = info.getValue();
          return (
            <span
              className={
                v < 0
                  ? "text-red-600"
                  : v > 0
                    ? "text-green-600"
                    : "text-gray-500"
              }
            >
              {formatEur(v)}
            </span>
          );
        },
        enableGrouping: false,
        aggregationFn: "sum",
        aggregatedCell: (info) => {
          const v = info.getValue() as number;
          return (
            <span className={v < 0 ? "text-red-600" : v > 0 ? "text-green-600" : "text-gray-500"}>
              {formatEur(v)}
            </span>
          );
        },
        size: 90,
      }),
      columnHelper.display({
        id: "actions",
        enableSorting: false,
        header: "",
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex gap-1">
              {inv.paperless_doc_id && paperlessUrl && (
                <button
                  onClick={() =>
                    openUrl(
                      `${paperlessUrl}/documents/${inv.paperless_doc_id}/details`
                    )
                  }
                  title="In Paperless öffnen"
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                >
                  <ExternalLink size={15} />
                </button>
              )}
              <button
                onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                title="Bearbeiten"
                className="p-1 text-gray-400 hover:text-blue-600 rounded"
              >
                <Pencil size={15} />
              </button>
              {confirmDelete === inv.id ? (
                <button
                  onClick={() => {
                    onDelete(inv.id);
                    setConfirmDelete(null);
                  }}
                  className="p-1 text-red-600 hover:text-red-800 rounded text-xs font-medium"
                >
                  OK?
                </button>
              ) : (
                <button
                  onClick={() => setConfirmDelete(inv.id)}
                  title="Löschen"
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        },
        size: 100,
      }),
    ],
    [personMap, selectedIds, onSelectionChange, navigate, onDelete, onMarkFinal, invoices, confirmDelete, paperlessUrl]
  );

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selectedIds.has(i.id)),
    [invoices, selectedIds]
  );

  const sums = useMemo(() => {
    if (selectedInvoices.length === 0) return null;
    return {
      betrag: selectedInvoices.reduce((s, i) => s + i.betrag, 0),
      beihilfe_zu_bezahlen: selectedInvoices.reduce((s, i) => s + i.beihilfe_zu_bezahlen, 0),
      beihilfe_bezahlt: selectedInvoices.reduce((s, i) => s + i.beihilfe_bezahlt, 0),
      debeka_zu_bezahlen: selectedInvoices.reduce((s, i) => s + i.debeka_zu_bezahlen, 0),
      debeka_bezahlt: selectedInvoices.reduce((s, i) => s + i.debeka_bezahlt, 0),
      differenz: selectedInvoices.reduce((s, i) => s + i.differenz, 0),
    };
  }, [selectedInvoices]);

  const sumColumns: Record<string, keyof NonNullable<typeof sums>> = {
    betrag: "betrag",
    beihilfe_zu_bezahlen: "beihilfe_zu_bezahlen",
    beihilfe_bezahlt: "beihilfe_bezahlt",
    debeka_zu_bezahlen: "debeka_zu_bezahlen",
    debeka_bezahlt: "debeka_bezahlt",
    differenz: "differenz",
  };

  const visibleColumns = useMemo(
    () => allColumns.filter((col) => {
      const id = col.id ?? (col as any).accessorKey;
      if (id === "select" || id === "actions") return true;
      return !hiddenColumns.has(id);
    }),
    [allColumns, hiddenColumns]
  );

  const table = useReactTable({
    data: invoices,
    columns: visibleColumns,
    state: { sorting, grouping },
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2 relative">
        <div className="flex items-center gap-1">
          <Group size={14} className="text-gray-500" />
          <select
            value={grouping[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setGrouping(val ? [val] : []);
            }}
            className="px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <option value="">Keine Gruppierung</option>
            {GROUPABLE_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>
                {col.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowColumnPicker((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Columns3 size={14} />
          Spalten
        </button>
        {showColumnPicker && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowColumnPicker(false)}
            />
            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-1 min-w-48">
              {TOGGLEABLE_COLUMNS.map(({ id, label }) => (
                <label key={id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(id)}
                    onChange={(e) => {
                      const next = new Set(hiddenColumns);
                      if (e.target.checked) {
                        next.delete(id);
                      } else {
                        next.add(id);
                      }
                      onHiddenColumnsChange(next);
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${canSort ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                      style={{ width: header.getSize() }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && (
                            header.column.getIsSorted() === "asc"
                              ? <ArrowUp size={12} />
                              : header.column.getIsSorted() === "desc"
                                ? <ArrowDown size={12} />
                                : <ArrowUpDown size={12} className="opacity-30" />
                          )}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  Keine Rechnungen gefunden
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                if (row.getIsGrouped()) {
                  // Group header row
                  return (
                    <tr
                      key={row.id}
                      className="bg-gray-100 hover:bg-gray-200 font-medium"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                          {cell.getIsGrouped() ? (
                            <button
                              onClick={row.getToggleExpandedHandler()}
                              className="flex items-center gap-1 text-gray-700"
                            >
                              {row.getIsExpanded()
                                ? <ChevronDown size={14} />
                                : <ChevronRight size={14} />}
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              <span className="text-xs text-gray-500 font-normal ml-1">
                                ({row.subRows.length})
                              </span>
                            </button>
                          ) : cell.getIsAggregated() ? (
                            flexRender(
                              cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                              cell.getContext()
                            )
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    className={rowClassName(row.original, selectedIds.has(row.original.id))}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {sums && (
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const colId = header.column.id;
                  const sumKey = sumColumns[colId];
                  return (
                    <td
                      key={header.id}
                      className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-700"
                    >
                      {colId === "select"
                        ? `${selectedInvoices.length}x`
                        : sumKey
                          ? formatEur(sums[sumKey])
                          : ""}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
