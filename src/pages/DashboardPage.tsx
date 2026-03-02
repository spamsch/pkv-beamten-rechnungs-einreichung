import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  FileText,
  Send,
  CreditCard,
} from "lucide-react";
import { useDashboardStats, useInvoices } from "../hooks/useInvoices";
import { formatEur, formatDate } from "../lib/format";
import { StatusBadge } from "../components/StatusBadge";

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: overdueInvoices = [] } = useInvoices({
    status: "ueberfaellig",
    sort_by: "zahlbar_bis",
    sort_dir: "ASC",
  });

  if (isLoading || !stats) {
    return <div className="p-6 text-center text-gray-400">Laden...</div>;
  }

  const cards = [
    {
      label: "Gesamt",
      value: stats.total_invoices,
      icon: FileText,
      color: "text-gray-600",
      bg: "bg-gray-50",
    },
    {
      label: "Offen",
      value: stats.open_invoices,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Überfällig",
      value: stats.overdue_invoices,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Einzureichen",
      value: stats.pending_submission,
      icon: Send,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Zu überweisen",
      value: stats.pending_wire,
      icon: CreditCard,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`${c.bg} rounded-lg p-4 border border-gray-200`}
          >
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={18} className={c.color} />
              <span className="text-sm text-gray-600">{c.label}</span>
            </div>
            <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Offener Gesamtbetrag
          </h3>
          <div className="text-2xl font-bold text-gray-900">
            {formatEur(stats.total_open_amount)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Beihilfe offen
          </h3>
          <div className="text-2xl font-bold text-purple-600">
            {formatEur(stats.total_beihilfe_offen)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Debeka offen
          </h3>
          <div className="text-2xl font-bold text-indigo-600">
            {formatEur(stats.total_debeka_offen)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Zu überweisen
          </h3>
          <div className="text-2xl font-bold text-orange-600">
            {formatEur(stats.total_zu_ueberweisen)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500 mb-1">
            Gesamtdifferenz
          </h3>
          <div
            className={`text-2xl font-bold ${stats.total_differenz < 0 ? "text-red-600" : "text-green-600"}`}
          >
            {formatEur(stats.total_differenz)}
          </div>
        </div>
      </div>

      {/* Per-person breakdown */}
      <div className="bg-white rounded-lg border border-gray-200">
        <h3 className="px-4 pt-4 pb-2 font-semibold text-gray-900">
          Pro Person
        </h3>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Person
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Gesamt
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Offen
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Summe
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                BH offen
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                DK offen
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Zu überw.
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stats.per_person.map((p) => (
              <tr key={p.person_id}>
                <td className="px-4 py-2 font-medium">{p.person_name}</td>
                <td className="px-4 py-2 text-right">{p.count}</td>
                <td className="px-4 py-2 text-right">{p.open_count}</td>
                <td className="px-4 py-2 text-right">
                  {formatEur(p.total_betrag)}
                </td>
                <td className="px-4 py-2 text-right text-purple-600">
                  {formatEur(p.beihilfe_offen)}
                </td>
                <td className="px-4 py-2 text-right text-indigo-600">
                  {formatEur(p.debeka_offen)}
                </td>
                <td className="px-4 py-2 text-right text-orange-600">
                  {formatEur(p.zu_ueberweisen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Overdue invoices */}
      {overdueInvoices.length > 0 && (
        <OverdueSection invoices={overdueInvoices} />
      )}
    </div>
  );
}

function OverdueSection({
  invoices,
}: {
  invoices: import("../lib/types").Invoice[];
}) {
  const navigate = useNavigate();
  return (
    <div className="bg-white rounded-lg border border-red-200">
      <h3 className="px-4 pt-4 pb-2 font-semibold text-red-700 flex items-center gap-2">
        <AlertTriangle size={18} />
        Überfällige Rechnungen
      </h3>
      <table className="min-w-full text-sm">
        <thead className="bg-red-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Arzt
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Fällig
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
              Betrag
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invoices.slice(0, 10).map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2">{inv.arzt}</td>
              <td className="px-4 py-2 text-red-600">
                {formatDate(inv.zahlbar_bis)}
              </td>
              <td className="px-4 py-2 text-right">
                {formatEur(inv.betrag)}
              </td>
              <td className="px-4 py-2">
                <StatusBadge invoice={inv} />
              </td>
              <td className="px-4 py-2">
                <button
                  onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Bearbeiten
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
