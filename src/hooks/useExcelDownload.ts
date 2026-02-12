import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiCall, getErrorMessage } from "@/utils/apiClient";

interface DownloadExcelOptions {
  endpoint: string;
  params: URLSearchParams;
  fileName: string;
  successMessage?: string;
  fallbackErrorMessage?: string;
  onError?: (message: string) => void;
  onLogout?: () => void;
}

export const useExcelDownload = () => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const downloadExcel = useCallback(
    async ({
      endpoint,
      params,
      fileName,
      successMessage = "File Excel berhasil diunduh",
      fallbackErrorMessage = "Gagal mengunduh file Excel",
      onError,
      onLogout,
    }: DownloadExcelOptions) => {
      try {
        setExporting(true);
        const blob = await apiCall<Blob>(`${endpoint}?${params.toString()}`, {
          responseType: "blob",
          onLogout,
        });
        const url = globalThis.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        globalThis.URL.revokeObjectURL(url);
        document.body.removeChild(link);

        toast({
          title: "Berhasil",
          description: successMessage,
        });
      } catch (error) {
        const message = getErrorMessage(error) || fallbackErrorMessage;
        onError?.(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      } finally {
        setExporting(false);
      }
    },
    [toast],
  );

  return { downloadExcel, exporting };
};
