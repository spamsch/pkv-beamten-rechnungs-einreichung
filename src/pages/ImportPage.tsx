import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { useImportExcel, useDeleteAllInvoices } from "../hooks/useInvoices";
import type { ImportResult } from "../lib/types";

export function ImportPage() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [deleteCount, setDeleteCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const importMutation = useImportExcel();
  const deleteMutation = useDeleteAllInvoices();

  const handlePickFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
    });
    if (selected) {
      setFilePath(selected as string);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!filePath) return;
    const res = await importMutation.mutateAsync(filePath);
    setResult(res);
  };

  const handleDeleteAll = async () => {
    const count = await deleteMutation.mutateAsync();
    setDeleteCount(count);
    setConfirmDelete(false);
    setResult(null);
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Excel Import</h2>
      <p className="text-sm text-gray-600">
        Importiere Rechnungsdaten aus einer bestehenden Excel-Datei. Die Spalten
        werden automatisch zugeordnet basierend auf den Spaltenüberschriften.
      </p>

      {/* Delete all */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Vor dem Import</h3>
        <p className="text-sm text-gray-600">
          Alle bestehenden Rechnungen löschen, um einen sauberen Re-Import zu
          ermöglichen.
        </p>
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-700 font-medium">
              Wirklich alle Rechnungen löschen?
            </span>
            <button
              onClick={handleDeleteAll}
              disabled={deleteMutation.isPending}
              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Lösche..." : "Ja, alle löschen"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50"
          >
            <Trash2 size={16} />
            Alle Rechnungen löschen
          </button>
        )}
        {deleteCount !== null && (
          <p className="text-sm text-green-700">
            {deleteCount} Rechnungen gelöscht.
          </p>
        )}
      </div>

      {/* Import */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Import</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handlePickFile}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            <Upload size={16} />
            Datei auswählen
          </button>
          {filePath && (
            <span className="text-sm text-gray-600 truncate max-w-md">
              {filePath}
            </span>
          )}
        </div>

        {filePath && (
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {importMutation.isPending ? "Importiere..." : "Import starten"}
          </button>
        )}
      </div>

      {importMutation.isError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle
            size={20}
            className="text-red-600 flex-shrink-0 mt-0.5"
          />
          <div>
            <p className="text-sm font-medium text-red-800">
              Import fehlgeschlagen
            </p>
            <p className="text-sm text-red-700 mt-1">
              {String(importMutation.error)}
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle
              size={20}
              className="text-green-600 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-green-800">
                {result.imported} Rechnungen importiert
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                {result.errors.length} Hinweise/Fehler
              </p>
              <div className="max-h-48 overflow-auto space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-yellow-700 font-mono">
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
