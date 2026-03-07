import { deriveStatus, isOverdue, STATUS_CONFIG, type Invoice } from "../lib/types";

export function StatusBadge({ invoice }: { invoice: Invoice }) {
  const status = deriveStatus(invoice);
  const config = STATUS_CONFIG[status];
  const overdue = isOverdue(invoice) && status !== "abgeschlossen";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
    >
      {config.label}{overdue && " — überfällig"}
    </span>
  );
}
