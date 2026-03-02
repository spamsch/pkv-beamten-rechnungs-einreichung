import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, AlertCircle, FileDown, Loader2 } from "lucide-react";
import {
  useSettings,
  usePaperlessTags,
  usePaperlessDocuments,
  usePaperlessImport,
} from "../hooks/usePaperless";
import { formatEur, formatDate } from "../lib/format";

export function PaperlessImportPage() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const isConfigured =
    !!settings?.paperless_url && !!settings?.paperless_token;

  const tagsQuery = usePaperlessTags(isConfigured);

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

  const docsQuery = usePaperlessDocuments(selectedTagIds);
  const importMutation = usePaperlessImport();

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
    setSelectedDocIds(new Set());
    importMutation.reset();
  };

  const toggleDoc = (id: number) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const importableDocs = docsQuery.data?.filter((d) => !d.already_imported) ?? [];

  const toggleAllDocs = () => {
    if (importableDocs.length === 0) return;
    if (selectedDocIds.size === importableDocs.length) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(importableDocs.map((d) => d.id)));
    }
  };

  const handleImport = () => {
    importMutation.mutate({
      documentIds: Array.from(selectedDocIds),
      tagIds: selectedTagIds,
    });
  };

  if (settingsLoading) {
    return <div className="p-6 text-center text-gray-400">Laden...</div>;
  }

  if (!isConfigured) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Paperless Import</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          Paperless ist noch nicht konfiguriert.{" "}
          <Link to="/settings" className="underline font-medium">
            Einstellungen öffnen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Paperless Import</h2>

      {/* Step 1: Tag selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <h3 className="font-semibold text-gray-900">
          1. Tags auswählen
        </h3>
        {tagsQuery.isLoading && (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Tags laden...
          </div>
        )}
        {tagsQuery.isError && (
          <div className="text-sm text-red-600">
            Fehler beim Laden der Tags: {String(tagsQuery.error)}
          </div>
        )}
        {tagsQuery.data && (
          <div className="flex flex-wrap gap-2">
            {tagsQuery.data.map((tag) => (
              <button
                key={tag.id}
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? "bg-blue-100 border-blue-300 text-blue-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Document list */}
      {selectedTagIds.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">
            2. Dokumente auswählen
          </h3>
          {docsQuery.isLoading && (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Dokumente laden...
            </div>
          )}
          {docsQuery.isError && (
            <div className="text-sm text-red-600">
              Fehler: {String(docsQuery.error)}
            </div>
          )}
          {docsQuery.data && docsQuery.data.length === 0 && (
            <div className="text-sm text-gray-400">
              Keine Dokumente mit den ausgewählten Tags gefunden.
            </div>
          )}
          {docsQuery.data && docsQuery.data.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={importableDocs.length > 0 && selectedDocIds.size === importableDocs.length}
                        disabled={importableDocs.length === 0}
                        onChange={toggleAllDocs}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Titel
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Korrespondent
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Betrag
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Erstellt
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Paperless
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {docsQuery.data.map((doc) => (
                    <tr
                      key={doc.id}
                      className={`hover:bg-gray-50 ${
                        doc.already_imported
                          ? "opacity-50"
                          : selectedDocIds.has(doc.id)
                            ? "bg-blue-50"
                            : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDocIds.has(doc.id)}
                          disabled={doc.already_imported}
                          onChange={() => toggleDoc(doc.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2">{doc.id}</td>
                      <td className="px-3 py-2 font-medium">{doc.title}</td>
                      <td className="px-3 py-2">
                        {doc.correspondent_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {doc.betrag != null ? formatEur(doc.betrag) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {formatDate(doc.created.slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {doc.already_imported ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle size={12} />
                            Importiert
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            Neu
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <a
                          href={`${settings.paperless_url}/documents/${doc.id}/details`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                          Öffnen
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Import */}
      {selectedDocIds.size > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900">
            3. Importieren
          </h3>
          <p className="text-sm text-gray-600">
            {selectedDocIds.size} Dokument(e) ausgewählt
          </p>
          <button
            onClick={handleImport}
            disabled={importMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {importMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileDown size={14} />
            )}
            {importMutation.isPending
              ? "Importiere..."
              : "Ausgewählte importieren"}
          </button>

          {importMutation.isSuccess && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle size={16} />
                {importMutation.data.imported} Rechnung(en) importiert
              </div>
              {importMutation.data.errors.length > 0 && (
                <div className="space-y-1">
                  {importMutation.data.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-red-600 text-sm"
                    >
                      <AlertCircle size={14} />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {importMutation.isError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              Fehler: {String(importMutation.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
