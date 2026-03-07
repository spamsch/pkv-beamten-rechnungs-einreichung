import { invoke } from "@tauri-apps/api/core";
import type {
  Person,
  Invoice,
  InvoiceInput,
  InvoiceFilter,
  BatchUpdateInput,
  DashboardStats,
  ImportResult,
  Settings,
  PaperlessTag,
  PaperlessDocument,
  PaperlessImportResult,
} from "./types";

export const api = {
  getPersons: () => invoke<Person[]>("get_persons"),

  getInvoices: (filter: InvoiceFilter) =>
    invoke<Invoice[]>("get_invoices", { filter }),

  getInvoice: (id: number) => invoke<Invoice>("get_invoice", { id }),

  createInvoice: (input: InvoiceInput) =>
    invoke<Invoice>("create_invoice", { input }),

  updateInvoice: (id: number, input: InvoiceInput) =>
    invoke<Invoice>("update_invoice", { id, input }),

  deleteInvoice: (id: number) => invoke<void>("delete_invoice", { id }),

  deleteAllInvoices: () => invoke<number>("delete_all_invoices"),

  batchUpdateStatus: (input: BatchUpdateInput) =>
    invoke<Invoice[]>("batch_update_status", { input }),

  batchMarkEingereicht: (ids: number[], date: string) =>
    invoke<Invoice[]>("batch_mark_eingereicht", { ids, date }),

  getDashboardStats: () => invoke<DashboardStats>("get_dashboard_stats"),

  importExcel: (filePath: string) =>
    invoke<ImportResult>("import_excel", { filePath }),

  getSettings: () => invoke<Settings>("get_settings"),

  saveSettings: (settings: Settings) =>
    invoke<void>("save_settings", { settings }),

  paperlessGetTags: () => invoke<PaperlessTag[]>("paperless_get_tags"),

  paperlessGetDocuments: (tagIds: number[]) =>
    invoke<PaperlessDocument[]>("paperless_get_documents", { tagIds }),

  paperlessImportDocuments: (documentIds: number[], tagIds: number[]) =>
    invoke<PaperlessImportResult>("paperless_import_documents", {
      documentIds,
      tagIds,
    }),

  getNotes: () => invoke<string>("get_notes"),

  saveNotes: (content: string) => invoke<void>("save_notes", { content }),
};
