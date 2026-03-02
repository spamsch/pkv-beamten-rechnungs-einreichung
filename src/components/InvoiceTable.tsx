import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Invoice, Person } from "../lib/types";
import { isOverdue } from "../lib/types";
import { formatDate, formatEur } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { useSettings } from "../hooks/usePaperless";

interface InvoiceTableProps {
  invoices: Invoice[];
  persons: Person[];
  onDelete: (id: number) => void;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
}

const columnHelper = createColumnHelper<Invoice>();

export function InvoiceTable({
  invoices,
  persons,
  onDelete,
  selectedIds,
  onSelectionChange,
}: InvoiceTableProps) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const { data: settings } = useSettings();
  const paperlessUrl = settings?.paperless_url;

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p.name])),
    [persons]
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
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
              // Force table update
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
      columnHelper.accessor("id", {
        header: "#",
        size: 50,
      }),
      columnHelper.accessor("person_id", {
        header: "Person",
        cell: (info) => personMap.get(info.getValue()) ?? info.getValue(),
        size: 90,
      }),
      columnHelper.accessor("arzt", {
        header: "Arzt",
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
        size: 100,
      }),
      columnHelper.display({
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge invoice={row.original} />,
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
        size: 90,
      }),
      columnHelper.accessor("debeka_zu_bezahlen", {
        header: "DK soll",
        cell: (info) => formatEur(info.getValue()),
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
        size: 90,
      }),
      columnHelper.display({
        id: "actions",
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
    [personMap, selectedIds, onSelectionChange, navigate, onDelete, invoices, confirmDelete, paperlessUrl]
  );

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-gray-400"
              >
                Keine Rechnungen gefunden
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-gray-50 ${
                  isOverdue(row.original)
                    ? "border-l-4 border-l-red-400 bg-red-50/30"
                    : ""
                } ${selectedIds.has(row.original.id) ? "bg-blue-50" : ""}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
