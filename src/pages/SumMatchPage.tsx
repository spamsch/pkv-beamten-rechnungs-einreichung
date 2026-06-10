import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useInvoices, usePersons } from "../hooks/useInvoices";
import { formatEur, formatDate } from "../lib/format";
import type { Invoice } from "../lib/types";

type Source = "beihilfe" | "debeka";

interface MatchResult {
  date: string;
  matchedInvoices: Invoice[];
  matchedSum: number;
  groupTotal: number;
  groupInvoices: Invoice[];
  exact: boolean;
}

function findSubsetSum(
  amounts: number[],
  target: number,
  tolerance: number,
): number[] | null {
  const n = amounts.length;
  // For small groups, enumerate all subsets via bitmask
  if (n <= 20) {
    let bestDiff = Infinity;
    let bestMask = -1;
    const limit = 1 << n;
    for (let mask = 1; mask < limit; mask++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) sum += amounts[i];
      }
      const diff = Math.abs(sum - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestMask = mask;
        if (diff <= tolerance) break;
      }
    }
    if (bestMask >= 0) {
      const indices: number[] = [];
      for (let i = 0; i < n; i++) {
        if (bestMask & (1 << i)) indices.push(i);
      }
      return indices;
    }
  }
  return null;
}

function parseGermanNumber(value: string): number | null {
  // Accept German format: "1.234,56" or "1234,56" or "1234.56"
  const cleaned = value.trim();
  if (!cleaned) return null;
  // If it has comma, treat as German decimal separator
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function SumMatchPage() {
  const [source, setSource] = useState<Source>("beihilfe");
  const [amountInput, setAmountInput] = useState("");
  const { data: invoices = [] } = useInvoices({ hide_final: true });
  const { data: persons = [] } = usePersons();

  const personMap = useMemo(
    () => new Map(persons.map((p) => [p.id, p.name])),
    [persons],
  );

  const targetAmount = useMemo(
    () => parseGermanNumber(amountInput),
    [amountInput],
  );

  const results = useMemo(() => {
    if (targetAmount === null || targetAmount <= 0) return [];

    const dateField =
      source === "beihilfe" ? "beihilfe_eingereicht" : "debeka_eingereicht";
    const amountField =
      source === "beihilfe" ? "beihilfe_zu_bezahlen" : "debeka_zu_bezahlen";

    // Group invoices by eingereicht date
    const groups = new Map<string, Invoice[]>();
    for (const inv of invoices) {
      const date = inv[dateField];
      if (!date) continue;
      const existing = groups.get(date);
      if (existing) {
        existing.push(inv);
      } else {
        groups.set(date, [inv]);
      }
    }

    const matches: MatchResult[] = [];
    const tolerance = 0.015; // rounding tolerance

    for (const [date, groupInvoices] of groups) {
      const amounts = groupInvoices.map((inv) => inv[amountField]);
      const groupTotal = amounts.reduce((a, b) => a + b, 0);

      // Skip groups where total is less than target (can't match)
      // But allow since "sum might be less" — target <= groupTotal
      // Actually target could match a subset, so check all groups
      // But skip if every single invoice amount is larger than target
      if (Math.min(...amounts) > targetAmount + tolerance) continue;

      const subsetIndices = findSubsetSum(amounts, targetAmount, tolerance);

      if (subsetIndices && subsetIndices.length >= 2) {
        const matchedInvoices = subsetIndices.map((i) => groupInvoices[i]);
        const matchedSum = subsetIndices.reduce(
          (sum, i) => sum + amounts[i],
          0,
        );
        const exact = Math.abs(matchedSum - targetAmount) <= tolerance;

        matches.push({
          date,
          matchedInvoices,
          matchedSum,
          groupTotal,
          groupInvoices,
          exact,
        });
      }
    }

    // Sort: exact matches first, then by closeness to target
    matches.sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return (
        Math.abs(a.matchedSum - targetAmount) -
        Math.abs(b.matchedSum - targetAmount)
      );
    });

    return matches;
  }, [invoices, source, targetAmount]);

  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Summen-Abgleich</h2>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Source toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Quelle:</span>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setSource("beihilfe")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                source === "beihilfe"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Beihilfe
            </button>
            <button
              onClick={() => setSource("debeka")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                source === "debeka"
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Debeka
            </button>
          </div>
        </div>

        {/* Amount input */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="amount"
            className="text-sm font-medium text-gray-700 whitespace-nowrap"
          >
            Erhaltener Betrag:
          </label>
          <div className="relative">
            <input
              id="amount"
              type="text"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="z.B. 234,56"
              className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              EUR
            </span>
          </div>
        </div>
      </div>

      {/* Results */}
      {targetAmount !== null && targetAmount > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-500">
            {results.length === 0 ? (
              "Keine passenden Gruppen gefunden."
            ) : (
              <>
                {results.length} passende Gruppe
                {results.length !== 1 ? "n" : ""} gefunden
              </>
            )}
          </h3>

          {results.map((result) => (
            <div
              key={result.date}
              className={`bg-white rounded-lg border ${
                result.exact ? "border-green-300" : "border-yellow-300"
              } overflow-hidden`}
            >
              <div
                className={`px-4 py-3 flex items-center justify-between ${
                  result.exact ? "bg-green-50" : "bg-yellow-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Search size={16} className="text-gray-500" />
                  <span className="font-medium text-gray-900">
                    {source === "beihilfe" ? "Beihilfe" : "Debeka"} eingereicht
                    am {formatDate(result.date)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      result.exact
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {result.exact
                      ? "Exakt"
                      : `Differenz: ${formatEur(result.matchedSum - targetAmount)}`}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  Treffer: {formatEur(result.matchedSum)} / Gruppe gesamt:{" "}
                  {formatEur(result.groupTotal)}
                </div>
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Treffer
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Person
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Arzt
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Rechnungsdatum
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Betrag
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      {source === "beihilfe" ? "BH" : "DK"} zu zahlen
                    </th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {result.groupInvoices.map((inv) => {
                    const isMatched = result.matchedInvoices.includes(inv);
                    const zuZahlen =
                      source === "beihilfe"
                        ? inv.beihilfe_zu_bezahlen
                        : inv.debeka_zu_bezahlen;
                    return (
                      <tr
                        key={inv.id}
                        className={isMatched ? "bg-blue-50" : "opacity-50"}
                      >
                        <td className="px-4 py-2">
                          {isMatched ? (
                            <span className="text-blue-600 font-medium">
                              ✓
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {personMap.get(inv.person_id) ?? inv.person_id}
                        </td>
                        <td className="px-4 py-2">{inv.arzt}</td>
                        <td className="px-4 py-2">{formatDate(inv.datum)}</td>
                        <td className="px-4 py-2 text-right">
                          {formatEur(inv.betrag)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatEur(zuZahlen)}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() =>
                              navigate(`/invoices/${inv.id}/edit`)
                            }
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
