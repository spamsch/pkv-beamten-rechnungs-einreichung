import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { PlusCircle, CheckSquare, ClipboardCopy, Download } from "lucide-react";
import type { Invoice, InvoiceFilter, NextStepLabel } from "../lib/types";
import { deriveStatus, deriveNextStep, STATUS_CONFIG } from "../lib/types";
import { todayISO, formatDate, formatEur } from "../lib/format";
import {
  useInvoices,
  usePersons,
  useDeleteInvoice,
  useBatchUpdate,
  useBatchMarkEingereicht,
  useBatchMarkBezahlt,
  usePaperlessDownload,
} from "../hooks/useInvoices";
import { FilterBar } from "../components/FilterBar";
import { InvoiceTable } from "../components/InvoiceTable";

export function InvoiceListPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<InvoiceFilter>({ hide_final: true });
  const [nextStepFilter, setNextStepFilter] = useState<NextStepLabel | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(["rechnungs_nummer", "beihilfe_zu_bezahlen", "debeka_zu_bezahlen"])
  );

  const { data: persons = [] } = usePersons();
  const { data: rawInvoices = [], isLoading } = useInvoices(filter);
  const invoices = nextStepFilter
    ? rawInvoices.filter((inv: Invoice) => deriveNextStep(inv).label === nextStepFilter)
    : rawInvoices;
  const deleteMutation = useDeleteInvoice();
  const batchMutation = useBatchUpdate();
  const batchEingereichMutation = useBatchMarkEingereicht();
  const batchBezahltMutation = useBatchMarkBezahlt();
  const downloadMutation = usePaperlessDownload();
  const [copied, setCopied] = useState(false);
  const [downloadResult, setDownloadResult] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    const unlisten = listen<{ current: number; total: number }>("download-progress", (event) => {
      setDownloadProgress({ current: event.payload.current, total: event.payload.total });
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const personMap = new Map(persons.map((p) => [p.id, p.name]));

  const copyAsMarkdown = useCallback((onlySelected = false) => {
    const source = onlySelected
      ? invoices.filter((inv: Invoice) => inv.id != null && selectedIds.has(inv.id))
      : invoices;
    const headers = ["Paperless Id", "Person", "Arzt", "Datum", "Re-Nr.", "Betrag", "Status", "BH eingereicht", "BH soll", "BH ist", "DK soll", "DK ist", "Diff."];
    const sep = headers.map(() => "---");
    const rows = source.map((inv: Invoice) => [
      inv.paperless_doc_id != null ? String(inv.paperless_doc_id) : "—",
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
  }, [invoices, personMap, selectedIds]);

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

      <FilterBar
        filter={filter}
        onChange={setFilter}
        persons={persons}
        nextStep={nextStepFilter}
        onNextStepChange={setNextStepFilter}
      />

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
                batchBezahltMutation.mutate(
                  { ids: Array.from(selectedIds), source: "beihilfe" },
                  { onSuccess: () => setSelectedIds(new Set()) }
                )
              }
              disabled={batchBezahltMutation.isPending || batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              BH überwiesen
            </button>
            <button
              onClick={() =>
                batchBezahltMutation.mutate(
                  { ids: Array.from(selectedIds), source: "debeka" },
                  { onSuccess: () => setSelectedIds(new Set()) }
                )
              }
              disabled={batchBezahltMutation.isPending || batchMutation.isPending}
              className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              DK überwiesen
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
            <button
              onClick={() => {
                setDownloadResult(null);
                setDownloadProgress(null);
                downloadMutation.mutate(Array.from(selectedIds), {
                  onSuccess: (result) => {
                    setDownloadProgress(null);
                    const msg =
                      result.downloaded > 0
                        ? `${result.downloaded} Dokument${result.downloaded !== 1 ? "e" : ""} heruntergeladen`
                        : "";
                    const errMsg =
                      result.errors.length > 0
                        ? result.errors.join("; ")
                        : "";
                    setDownloadResult([msg, errMsg].filter(Boolean).join(" — "));
                    setTimeout(() => setDownloadResult(null), 8000);
                  },
                  onError: (err) => {
                    setDownloadProgress(null);
                    setDownloadResult(String(err));
                    setTimeout(() => setDownloadResult(null), 5000);
                  },
                });
              }}
              disabled={downloadMutation.isPending}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download size={12} />
              {downloadMutation.isPending && downloadProgress
                ? `${downloadProgress.current}/${downloadProgress.total}…`
                : downloadMutation.isPending
                  ? "Lädt…"
                  : "Paperless Download"}
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

      {downloadMutation.isPending && downloadProgress && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
          <div className="flex items-center gap-3">
            <span>Dokument {downloadProgress.current} von {downloadProgress.total} wird heruntergeladen…</span>
            <div className="flex-1 h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {downloadResult && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-800">
          {downloadResult}
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
          onClick={() => copyAsMarkdown()}
          disabled={invoices.length === 0}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          <ClipboardCopy size={14} />
          {copied ? "Kopiert!" : "Als Markdown kopieren"}
        </button>
        {selectedIds.size > 0 && (
          <button
            onClick={() => copyAsMarkdown(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ClipboardCopy size={14} />
            {copied ? "Kopiert!" : `Auswahl als Markdown (${selectedIds.size})`}
          </button>
        )}
      </div>
    </div>
  );
}
