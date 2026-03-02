export interface Person {
  id: string;
  name: string;
  beihilfe_percent: number;
  debeka_percent: number;
}

export interface Invoice {
  id: number;
  person_id: string;
  arzt: string;
  datum: string | null;
  zahlbar_bis: string | null;
  rechnungs_nummer: string;
  betrag: number;
  mahngebuehr: number;
  beihilfe_eingereicht: string | null;
  debeka_eingereicht: string | null;
  beihilfe_zu_bezahlen: number;
  debeka_zu_bezahlen: number;
  beihilfe_bezahlt: number;
  debeka_bezahlt: number;
  zu_ueberweisen: number;
  ueberwiesen_datum: string | null;
  differenz: number;
  is_final: boolean;
  paperless_doc_id: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceInput {
  person_id: string;
  arzt?: string;
  datum?: string | null;
  zahlbar_bis?: string | null;
  rechnungs_nummer?: string;
  betrag?: number;
  mahngebuehr?: number;
  beihilfe_eingereicht?: string | null;
  debeka_eingereicht?: string | null;
  beihilfe_bezahlt?: number;
  debeka_bezahlt?: number;
  ueberwiesen_datum?: string | null;
  is_final?: boolean;
  paperless_doc_id?: number | null;
  notes?: string;
}

export interface InvoiceFilter {
  person_id?: string | null;
  status?: string | null;
  search?: string | null;
  sort_by?: string | null;
  sort_dir?: string | null;
}

export interface BatchUpdateInput {
  ids: number[];
  field: string;
  value: string;
}

export interface DashboardStats {
  total_invoices: number;
  open_invoices: number;
  overdue_invoices: number;
  pending_submission: number;
  pending_wire: number;
  total_open_amount: number;
  total_differenz: number;
  total_beihilfe_offen: number;
  total_debeka_offen: number;
  total_zu_ueberweisen: number;
  per_person: PersonStats[];
}

export interface PersonStats {
  person_id: string;
  person_name: string;
  count: number;
  total_betrag: number;
  open_count: number;
  beihilfe_offen: number;
  debeka_offen: number;
  zu_ueberweisen: number;
}

export interface ImportResult {
  imported: number;
  errors: string[];
}

// --- Paperless types ---

export interface Settings {
  paperless_url: string;
  paperless_token: string;
}

export interface PaperlessTag {
  id: number;
  name: string;
}

export interface PaperlessDocument {
  id: number;
  title: string;
  correspondent_name: string | null;
  betrag: number | null;
  created: string;
  tag_ids: number[];
  already_imported: boolean;
}

export interface PaperlessImportResult {
  imported: number;
  errors: string[];
}

export type InvoiceStatus =
  | "neu"
  | "teilweise_eingereicht"
  | "eingereicht"
  | "teilweise_bezahlt"
  | "bezahlt"
  | "ueberwiesen"
  | "abgeschlossen"
  | "ueberfaellig";

export const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string }
> = {
  neu: { label: "Neu", color: "text-gray-700", bg: "bg-gray-100" },
  teilweise_eingereicht: {
    label: "Teilw. eingereicht",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
  eingereicht: {
    label: "Eingereicht",
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  teilweise_bezahlt: {
    label: "Teilw. bezahlt",
    color: "text-orange-700",
    bg: "bg-orange-100",
  },
  bezahlt: { label: "Bezahlt", color: "text-green-700", bg: "bg-green-100" },
  ueberwiesen: {
    label: "Überwiesen",
    color: "text-teal-700",
    bg: "bg-teal-100",
  },
  abgeschlossen: {
    label: "Abgeschlossen",
    color: "text-emerald-800",
    bg: "bg-emerald-100",
  },
  ueberfaellig: {
    label: "Überfällig",
    color: "text-red-700",
    bg: "bg-red-100",
  },
};

export function deriveStatus(invoice: Invoice): InvoiceStatus {
  if (invoice.is_final) return "abgeschlossen";
  if (invoice.ueberwiesen_datum) return "ueberwiesen";
  if (invoice.beihilfe_bezahlt > 0 && invoice.debeka_bezahlt > 0)
    return "bezahlt";
  if (invoice.beihilfe_bezahlt > 0 || invoice.debeka_bezahlt > 0)
    return "teilweise_bezahlt";
  if (invoice.beihilfe_eingereicht && invoice.debeka_eingereicht)
    return "eingereicht";
  if (invoice.beihilfe_eingereicht || invoice.debeka_eingereicht)
    return "teilweise_eingereicht";
  return "neu";
}

export function isOverdue(invoice: Invoice): boolean {
  if (invoice.is_final) return false;
  if (!invoice.zahlbar_bis) return false;
  return invoice.zahlbar_bis < new Date().toISOString().slice(0, 10);
}
