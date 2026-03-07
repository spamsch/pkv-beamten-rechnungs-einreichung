import { useState, useEffect, useRef } from "react";
import { useNotes, useSaveNotes } from "../hooks/useInvoices";

export function NotesPage() {
  const { data: savedNotes, isLoading } = useNotes();
  const saveMutation = useSaveNotes();
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedNotes !== undefined) {
      setContent(savedNotes);
    }
  }, [savedNotes]);

  const handleChange = (value: string) => {
    setContent(value);
    setSaveStatus("unsaved");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSaveStatus("saving");
      saveMutation.mutate(value, {
        onSuccess: () => setSaveStatus("saved"),
      });
    }, 800);
  };

  if (isLoading) {
    return <div className="p-6 text-gray-400">Laden...</div>;
  }

  return (
    <div className="p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Notizen</h2>
        <span className="text-xs text-gray-400">
          {saveStatus === "saving"
            ? "Speichern..."
            : saveStatus === "unsaved"
              ? "Nicht gespeichert"
              : "Gespeichert"}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Allgemeine Notizen hier eingeben..."
        className="flex-1 w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    </div>
  );
}
