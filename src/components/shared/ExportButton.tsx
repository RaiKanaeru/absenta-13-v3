import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  loading: boolean;
  label?: string;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export const ExportButton = ({
  onClick,
  loading,
  label = "Export Excel",
  loadingLabel = "Mengekspor...",
  disabled,
  className,
  variant,
}: ExportButtonProps) => {
  return (
    <Button onClick={onClick} disabled={loading || disabled} className={className} variant={variant}>
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
};
