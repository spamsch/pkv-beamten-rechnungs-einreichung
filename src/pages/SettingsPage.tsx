import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useSettings, useSaveSettings, usePaperlessTags } from "../hooks/usePaperless";

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const saveMutation = useSaveSettings();

  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [testEnabled, setTestEnabled] = useState(false);

  const tagsQuery = usePaperlessTags(testEnabled);

  useEffect(() => {
    if (settings) {
      setUrl(settings.paperless_url);
      setToken(settings.paperless_token);
    }
  }, [settings]);

  // Handle test result
  useEffect(() => {
    if (!testEnabled) return;
    if (tagsQuery.isSuccess) {
      setTestResult({
        ok: true,
        message: `Verbindung erfolgreich — ${tagsQuery.data.length} Tags gefunden`,
      });
      setTestEnabled(false);
    }
    if (tagsQuery.isError) {
      setTestResult({
        ok: false,
        message: `Verbindung fehlgeschlagen: ${tagsQuery.error}`,
      });
      setTestEnabled(false);
    }
  }, [testEnabled, tagsQuery.isSuccess, tagsQuery.isError, tagsQuery.data, tagsQuery.error]);

  const handleSave = () => {
    saveMutation.mutate({ paperless_url: url, paperless_token: token });
  };

  const handleTest = async () => {
    // Save first so the backend has the current values
    await saveMutation.mutateAsync({ paperless_url: url, paperless_token: token });
    setTestResult(null);
    setTestEnabled(true);
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-400">Laden...</div>;
  }

  return (
    <div className="p-6 max-w-xl space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Einstellungen</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Paperless-ngx</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://paperless.example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Token
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Token eingeben"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Speichern..." : "Speichern"}
          </button>
          <button
            onClick={handleTest}
            disabled={tagsQuery.isFetching || !url || !token}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
          >
            {tagsQuery.isFetching && <Loader2 size={14} className="animate-spin" />}
            Verbindung testen
          </button>
        </div>

        {saveMutation.isSuccess && !testResult && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle size={16} />
            Einstellungen gespeichert
          </div>
        )}

        {saveMutation.isError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            Fehler beim Speichern: {String(saveMutation.error)}
          </div>
        )}

        {testResult && (
          <div
            className={`flex items-center gap-2 text-sm ${testResult.ok ? "text-green-600" : "text-red-600"}`}
          >
            {testResult.ok ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
