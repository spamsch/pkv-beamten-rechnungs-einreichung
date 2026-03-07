import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import type { Person, Invoice, InvoiceInput } from "../lib/types";
import { formatEur, formatPercent, todayISO } from "../lib/format";

interface InvoiceFormProps {
  persons: Person[];
  initial?: Invoice;
  onSubmit: (input: InvoiceInput) => Promise<void>;
  isSubmitting: boolean;
}

function emptyForm(persons: Person[]): InvoiceInput {
  return {
    person_id: persons[0]?.id ?? "",
    arzt: "",
    datum: todayISO(),
    zahlbar_bis: null,
    rechnungs_nummer: "",
    betrag: 0,
    mahngebuehr: 0,
    beihilfe_eingereicht: null,
    debeka_eingereicht: null,
    beihilfe_bezahlt: 0,
    debeka_bezahlt: 0,
    ueberwiesen_datum: null,
    is_final: false,
    paperless_doc_id: null,
    notes: "",
  };
}

function invoiceToInput(inv: Invoice): InvoiceInput {
  return {
    person_id: inv.person_id,
    arzt: inv.arzt,
    datum: inv.datum,
    zahlbar_bis: inv.zahlbar_bis,
    rechnungs_nummer: inv.rechnungs_nummer,
    betrag: inv.betrag,
    mahngebuehr: inv.mahngebuehr,
    beihilfe_eingereicht: inv.beihilfe_eingereicht,
    debeka_eingereicht: inv.debeka_eingereicht,
    beihilfe_bezahlt: inv.beihilfe_bezahlt,
    debeka_bezahlt: inv.debeka_bezahlt,
    ueberwiesen_datum: inv.ueberwiesen_datum,
    is_final: inv.is_final,
    paperless_doc_id: inv.paperless_doc_id,
    notes: inv.notes,
  };
}

export function InvoiceForm({
  persons,
  initial,
  onSubmit,
  isSubmitting,
}: InvoiceFormProps) {
  const navigate = useNavigate();
  const [form, setForm] = useState<InvoiceInput>(
    initial ? invoiceToInput(initial) : emptyForm(persons)
  );

  useEffect(() => {
    if (initial) setForm(invoiceToInput(initial));
  }, [initial]);

  const selectedPerson = persons.find((p) => p.id === form.person_id);
  const betrag = form.betrag ?? 0;
  const mahngebuehr = form.mahngebuehr ?? 0;
  const beihilfe_zu = selectedPerson
    ? Math.round(betrag * selectedPerson.beihilfe_percent * 100) / 100
    : 0;
  const debeka_zu = selectedPerson
    ? Math.round(betrag * selectedPerson.debeka_percent * 100) / 100
    : 0;
  const zu_ueberweisen = Math.round((betrag + mahngebuehr) * 100) / 100;
  const differenz =
    Math.round(
      ((form.beihilfe_bezahlt ?? 0) +
        (form.debeka_bezahlt ?? 0) -
        zu_ueberweisen) *
        100
    ) / 100;

  const set = <K extends keyof InvoiceInput>(
    key: K,
    value: InvoiceInput[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const applyAndSave = (updates: Partial<InvoiceInput>) => {
    const updated = { ...form, ...updates };
    setForm(updated);
    onSubmit(updated);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Person */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Person</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Person
            </label>
            <select
              value={form.person_id}
              onChange={(e) => set("person_id", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              {persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatPercent(p.beihilfe_percent)} /{" "}
                  {formatPercent(p.debeka_percent)})
                </option>
              ))}
            </select>
          </div>
          {selectedPerson && (
            <div className="flex items-end text-sm text-gray-500">
              Beihilfe: {formatPercent(selectedPerson.beihilfe_percent)},
              Debeka: {formatPercent(selectedPerson.debeka_percent)}
            </div>
          )}
        </div>
      </section>

      {/* Invoice basics */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Rechnungsdaten</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arzt / Behandler
            </label>
            <input
              type="text"
              value={form.arzt ?? ""}
              onChange={(e) => set("arzt", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsnummer
            </label>
            <input
              type="text"
              value={form.rechnungs_nummer ?? ""}
              onChange={(e) => set("rechnungs_nummer", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <DateField
            label="Rechnungsdatum"
            value={form.datum}
            onChange={(v) => set("datum", v)}
          />
          <DateField
            label="Zahlbar bis"
            value={form.zahlbar_bis}
            onChange={(v) => set("zahlbar_bis", v)}
          />
        </div>
      </section>

      {/* Amounts */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Beträge</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsbetrag (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.betrag ?? 0}
              onChange={(e) => set("betrag", parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mahngebühr (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.mahngebuehr ?? 0}
              onChange={(e) =>
                set("mahngebuehr", parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div>
            <span className="text-gray-500">Beihilfe:</span>{" "}
            <span className="font-medium">{formatEur(beihilfe_zu)}</span>
          </div>
          <div>
            <span className="text-gray-500">Debeka:</span>{" "}
            <span className="font-medium">{formatEur(debeka_zu)}</span>
          </div>
          <div>
            <span className="text-gray-500">Zu überweisen:</span>{" "}
            <span className="font-medium">{formatEur(zu_ueberweisen)}</span>
          </div>
          <div>
            <span className="text-gray-500">Differenz:</span>{" "}
            <span
              className={`font-medium ${differenz < 0 ? "text-red-600" : differenz > 0 ? "text-green-600" : ""}`}
            >
              {formatEur(differenz)}
            </span>
          </div>
        </div>
      </section>

      {/* Submissions */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Einreichungen</h3>
        <div className="grid grid-cols-2 gap-4">
          <DateField
            label="Beihilfe eingereicht"
            value={form.beihilfe_eingereicht}
            onChange={(v) => set("beihilfe_eingereicht", v)}
          />
          <DateField
            label="Debeka eingereicht"
            value={form.debeka_eingereicht}
            onChange={(v) => set("debeka_eingereicht", v)}
          />
        </div>
      </section>

      {/* Payments */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Zahlungen</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beihilfe bezahlt (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.beihilfe_bezahlt ?? 0}
              onChange={(e) =>
                set("beihilfe_bezahlt", parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
              Erwartet: {formatEur(beihilfe_zu)}
              <button
                type="button"
                onClick={() => applyAndSave({ beihilfe_bezahlt: beihilfe_zu })}
                disabled={isSubmitting}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                Übernehmen
              </button>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Debeka bezahlt (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.debeka_bezahlt ?? 0}
              onChange={(e) =>
                set("debeka_bezahlt", parseFloat(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400 flex items-center gap-1">
              Erwartet: {formatEur(debeka_zu)}
              <button
                type="button"
                onClick={() => applyAndSave({ debeka_bezahlt: debeka_zu })}
                disabled={isSubmitting}
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                Übernehmen
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Wire transfer */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Überweisung & Extras</h3>
        <div className="grid grid-cols-2 gap-4">
          <DateField
            label="Überwiesen am"
            value={form.ueberwiesen_datum}
            onChange={(v) => set("ueberwiesen_datum", v)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paperless Dokument-ID
            </label>
            <input
              type="number"
              value={form.paperless_doc_id ?? ""}
              onChange={(e) =>
                set(
                  "paperless_doc_id",
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notizen
          </label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_final ?? false}
            onChange={(e) => set("is_final", e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Abgeschlossen
          </span>
        </label>
      </section>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Speichern..." : initial ? "Aktualisieren" : "Erstellen"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/invoices")}
          className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-1">
        <input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => onChange(todayISO())}
          title="Heute"
          className="px-2 py-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <Calendar size={16} />
        </button>
      </div>
    </div>
  );
}
