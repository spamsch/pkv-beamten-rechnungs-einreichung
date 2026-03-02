import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, CheckSquare } from "lucide-react";
import type { InvoiceFilter } from "../lib/types";
import { todayISO } from "../lib/format";
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
  const [filter, setFilter] = useState<InvoiceFilter>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: persons = [] } = usePersons();
  const { data: invoices = [], isLoading } = useInvoices(filter);
  const deleteMutation = useDeleteInvoice();
  const batchMutation = useBatchUpdate();
  const batchEingereichMutation = useBatchMarkEingereicht();

  const handleBatch = (field: string, value: string) => {
    if (selectedIds.size === 0) return;
    batchMutation.mutate(
      { ids: Array.from(selectedIds), field, value },
      { onSuccess: () => setSelectedIds(new Set()) }
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
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      <div className="text-sm text-gray-500">
        {invoices.length} Rechnung{invoices.length !== 1 ? "en" : ""}
      </div>
    </div>
  );
}
