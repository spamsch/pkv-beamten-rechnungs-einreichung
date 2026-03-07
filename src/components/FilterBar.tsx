import { Search } from "lucide-react";
import type { Person, InvoiceFilter, InvoiceStatus } from "../lib/types";
import { STATUS_CONFIG } from "../lib/types";

interface FilterBarProps {
  filter: InvoiceFilter;
  onChange: (filter: InvoiceFilter) => void;
  persons: Person[];
}

const statusOptions: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "Alle Status" },
  ...Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({
    value: value as InvoiceStatus,
    label,
  })),
];

export function FilterBar({ filter, onChange, persons }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Suche..."
          value={filter.search || ""}
          onChange={(e) => onChange({ ...filter, search: e.target.value || null })}
          className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-52"
        />
      </div>

      <select
        value={filter.person_id || ""}
        onChange={(e) =>
          onChange({ ...filter, person_id: e.target.value || null })
        }
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Alle Personen</option>
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={filter.status || ""}
        onChange={(e) =>
          onChange({ ...filter, status: e.target.value || null })
        }
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        {statusOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={filter.hide_final ?? false}
          onChange={(e) =>
            onChange({ ...filter, hide_final: e.target.checked || null })
          }
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Abgeschlossene ausblenden
      </label>

      <select
        value={`${filter.sort_by || "datum"}:${filter.sort_dir || "DESC"}`}
        onChange={(e) => {
          const [sort_by, sort_dir] = e.target.value.split(":");
          onChange({ ...filter, sort_by, sort_dir });
        }}
        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        <option value="datum:DESC">Datum (neueste)</option>
        <option value="datum:ASC">Datum (älteste)</option>
        <option value="betrag:DESC">Betrag (höchste)</option>
        <option value="betrag:ASC">Betrag (niedrigste)</option>
        <option value="zahlbar_bis:ASC">Fällig (nächste)</option>
        <option value="created_at:DESC">Erstellt (neueste)</option>
      </select>
    </div>
  );
}
