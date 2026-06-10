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
  widerspruch_eingelegt: string | null;
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
  widerspruch_eingelegt?: string | null;
}

export interface InvoiceFilter {
  person_id?: string | null;
  status?: string | null;
  search?: string | null;
  sort_by?: string | null;
  sort_dir?: string | null;
  hide_final?: boolean | null;
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

export interface PaperlessDownloadResult {
  downloaded: number;
  errors: string[];
}

export type InvoiceStatus =
  | "neu"
  | "teilweise_eingereicht"
  | "eingereicht"
  | "teilweise_bezahlt"
  | "bezahlt"
  | "widerspruch"
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
  widerspruch: {
    label: "Widerspruch",
    color: "text-rose-700",
    bg: "bg-rose-100",
  },
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
  if (invoice.widerspruch_eingelegt) return "widerspruch";
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

export const NEXT_STEP_LABELS = [
  "Einreichen",
  "BH einreichen",
  "DK einreichen",
  "Warten auf BH",
  "Warten auf DK",
  "Warten auf BH + DK",
  "Widerspruch klären",
  "Überweisen",
  "Fertig markieren",
] as const;

export type NextStepLabel = (typeof NEXT_STEP_LABELS)[number] | "—";

export function deriveNextStep(invoice: Invoice): { label: NextStepLabel; color: string } {
  if (invoice.is_final) return { label: "—", color: "text-gray-400" };
  if (invoice.widerspruch_eingelegt && !invoice.ueberwiesen_datum)
    return { label: "Widerspruch klären", color: "text-rose-600" };

  const bhOffen = invoice.beihilfe_bezahlt < invoice.beihilfe_zu_bezahlen;
  const dkOffen = invoice.debeka_bezahlt < invoice.debeka_zu_bezahlen;

  if (invoice.ueberwiesen_datum) {
    if (bhOffen && dkOffen) return { label: "Warten auf BH + DK", color: "text-amber-600" };
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Fertig markieren", color: "text-emerald-600" };
  }

  if (invoice.beihilfe_bezahlt > 0 && invoice.debeka_bezahlt > 0)
    return { label: "Überweisen", color: "text-violet-600" };

  if (invoice.beihilfe_bezahlt > 0 || invoice.debeka_bezahlt > 0) {
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Überweisen", color: "text-violet-600" };
  }

  if (invoice.beihilfe_eingereicht && invoice.debeka_eingereicht) {
    if (bhOffen && dkOffen) return { label: "Warten auf BH + DK", color: "text-amber-600" };
    if (bhOffen) return { label: "Warten auf BH", color: "text-amber-600" };
    if (dkOffen) return { label: "Warten auf DK", color: "text-amber-600" };
    return { label: "Überweisen", color: "text-violet-600" };
  }
  if (invoice.beihilfe_eingereicht && !invoice.debeka_eingereicht)
    return { label: "DK einreichen", color: "text-blue-600" };
  if (!invoice.beihilfe_eingereicht && invoice.debeka_eingereicht)
    return { label: "BH einreichen", color: "text-blue-600" };
  return { label: "Einreichen", color: "text-blue-600" };
}
