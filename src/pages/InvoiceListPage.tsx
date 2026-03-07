import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, CheckSquare, ClipboardCopy } from "lucide-react";
import type { Invoice, InvoiceFilter } from "../lib/types";
import { deriveStatus, STATUS_CONFIG } from "../lib/types";
import { todayISO, formatDate, formatEur } from "../lib/format";
import {
  useInvoices,
  usePersons,
  useDeleteInvoice,
  useBatchUpdate,
  useBatchMarkEingereicht,
} from "../hooks/useInvoices";
import { FilterBar } from "../components/FilterBar";
import { InvoiceTable } from "../components/InvoiceTable";

export function InvoiceListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InvoiceFilter>({ hide_final: true });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(["rechnungs_nummer", "beihilfe_zu_bezahlen", "debeka_zu_bezahlen"])
  );

  const { data: persons = [] } = usePersons();
  const { data: invoices = [], isLoading } = useInvoices(filter);
  const deleteMutation = useDeleteInvoice();
  const batchMutation = useBatchUpdate();
  const batchEingereichMutation = useBatchMarkEingereicht();
  const [copied, setCopied] = useState(false);

  const personMap = new Map(persons.map((p) => [p.id, p.name]));

  const copyAsMarkdown = useCallback(() => {
    const headers = ["#", "Person", "Arzt", "Datum", "Re-Nr.", "Betrag", "Status", "BH eingereicht", "BH soll", "BH ist", "DK soll", "DK ist", "Diff."];
    const sep = headers.map(() => "---");
    const rows = invoices.map((inv: Invoice) => [
      String(inv.id),
      personMap.get(inv.person_id) ?? inv.person_id,
      inv.arzt,
      formatDate(inv.datum),
      inv.rechnungs_nummer,
      formatEur(inv.betrag),
      STATUS_CONFIG[deriveStatus(inv)].label,
      formatDate(inv.beihilfe_eingereicht),
      formatEur(inv.beihilfe_zu_bezahlen),
      formatEur(inv.beihilfe_bezahlt),
      formatEur(inv.debeka_zu_bezahlen),
      formatEur(inv.debeka_bezahlt),
      formatEur(inv.differenz),
    ]);
    const lines = [
      `| ${headers.join(" | ")} |`,
      `| ${sep.join(" | ")} |`,
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [invoices, personMap]);

  const handleBatch = (field: string, value: string, ids?: number[]) => {
    const targetIds = ids ?? Array.from(selectedIds);
    if (targetIds.length === 0) return;
    batchMutation.mutate(
      { ids: targetIds, field, value },
      { onSuccess: () => { if (!ids) setSelectedIds(new Set()); } }
    );
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Rechnungen</h2>
        <button
          onClick={() => navigate("/invoices/new")}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <PlusCircle size={16} />
          Neue Rechnung
        </button>
      </div>

      <FilterBar filter={filter} onChange={setFilter} persons={persons} />

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <CheckSquare size={16} className="text-blue-600" />
          <span className="text-sm text-blue-800 font-medium">
            {selectedIds.size} ausgewählt
          </span>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() =>
                batchEingereichMutation.mutate(
                  { ids: Array.from(selectedIds), date: todayISO() },
                  { onSuccess: () => setSelectedIds(new Set()) }
                )
              }
              disabled={batchEingereichMutation.isPending || batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Eingereicht
            </button>
            <button
              onClick={() =>
                handleBatch("beihilfe_eingereicht", todayISO())
              }
              disabled={batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              BH eingereicht
            </button>
            <button
              onClick={() =>
                handleBatch("debeka_eingereicht", todayISO())
              }
              disabled={batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              DK eingereicht
            </button>
            <button
              onClick={() =>
                handleBatch("ueberwiesen_datum", todayISO())
              }
              disabled={batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Überwiesen
            </button>
            <button
              onClick={() => handleBatch("is_final", "1")}
              disabled={batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Abschließen
            </button>
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-blue-600 hover:text-blue-800"
          >
            Auswahl aufheben
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Laden...</div>
      ) : (
        <InvoiceTable
          invoices={invoices}
          persons={persons}
          onDelete={(id) => deleteMutation.mutate(id)}
          onMarkFinal={(id) => handleBatch("is_final", "1", [id])}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          hiddenColumns={hiddenColumns}
          onHiddenColumnsChange={setHiddenColumns}
        />
      )}

      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>{invoices.length} Rechnung{invoices.length !== 1 ? "en" : ""}</span>
        <button
          onClick={copyAsMarkdown}
          disabled={invoices.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          <ClipboardCopy size={14} />
          {copied ? "Kopiert!" : "Als Markdown kopieren"}
        </button>
      </div>
    </div>
  );
}
