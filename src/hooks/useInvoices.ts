import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  InvoiceFilter,
  InvoiceInput,
  BatchUpdateInput,
} from "../lib/types";

export function usePersons() {
  return useQuery({
    queryKey: ["persons"],
    queryFn: api.getPersons,
    staleTime: Infinity,
  });
}

export function useInvoices(filter: InvoiceFilter) {
  return useQuery({
    queryKey: ["invoices", filter],
    queryFn: () => api.getInvoices(filter),
  });
}

export function useInvoice(id: number | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api.getInvoice(id!),
    enabled: id !== undefined,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceInput) => api.createInvoice(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: InvoiceInput }) =>
      api.updateInvoice(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBatchUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchUpdateInput) => api.batchUpdateStatus(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBatchMarkEingereicht() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, date }: { ids: number[]; date: string }) =>
      api.batchMarkEingereicht(ids, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboardStats,
  });
}

export function useDeleteAllInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAllInvoices(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useNotes() {
  return useQuery({
    queryKey: ["notes"],
    queryFn: api.getNotes,
  });
}

export function useSaveNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.saveNotes(content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useImportExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filePath: string) => api.importExcel(filePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
