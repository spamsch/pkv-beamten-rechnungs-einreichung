import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Settings } from "../lib/types";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) => api.saveSettings(settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function usePaperlessTags(enabled: boolean) {
  return useQuery({
    queryKey: ["paperless-tags"],
    queryFn: api.paperlessGetTags,
    enabled,
  });
}

export function usePaperlessDocuments(tagIds: number[]) {
  return useQuery({
    queryKey: ["paperless-documents", tagIds],
    queryFn: () => api.paperlessGetDocuments(tagIds),
    enabled: tagIds.length > 0,
  });
}

export function usePaperlessImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentIds,
      tagIds,
    }: {
      documentIds: number[];
      tagIds: number[];
    }) => api.paperlessImportDocuments(documentIds, tagIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["paperless-documents"] });
    },
  });
}
