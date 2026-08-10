"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportTargets } from "@/lib/spreadsheet/export-targets";

interface ExportTargetsButtonProps {
  // Getter so callers can resolve rows (filter/selection) at click time.
  getTargets: () => Record<string, unknown>[];
  filenameBase: string;
  disabled?: boolean;
}

const ExportTargetsButton = ({
  getTargets,
  filenameBase,
  disabled,
}: ExportTargetsButtonProps) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: "csv" | "xlsx") => {
    setIsExporting(true);
    try {
      await exportTargets(getTargets(), format, filenameBase);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled || isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          Export Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ExportTargetsButton;
