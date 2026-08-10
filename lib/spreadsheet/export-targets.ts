import { TARGET_FIELDS } from "./target-fields";

// Builds CSV/XLSX exports of targets using the same field set the
// import mapping supports, so exported files can be re-imported as-is.
// exceljs is loaded lazily so it never lands in the main client bundle.

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fieldValue(target: Record<string, unknown>, key: string): string {
  const value = target[key];
  return value == null ? "" : String(value);
}

export function buildTargetsCsv(targets: Record<string, unknown>[]): string {
  const header = TARGET_FIELDS.map((f) => escapeCsvValue(f.label)).join(",");
  const rows = targets.map((target) =>
    TARGET_FIELDS.map((f) => escapeCsvValue(fieldValue(target, f.key))).join(",")
  );
  return [header, ...rows].join("\n");
}

export async function buildTargetsXlsxBuffer(
  targets: Record<string, unknown>[]
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Targets");
  sheet.addRow(TARGET_FIELDS.map((f) => f.label));
  for (const target of targets) {
    sheet.addRow(TARGET_FIELDS.map((f) => fieldValue(target, f.key)));
  }
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTargets(
  targets: Record<string, unknown>[],
  format: "csv" | "xlsx",
  filenameBase: string
): Promise<void> {
  if (format === "csv") {
    const blob = new Blob([buildTargetsCsv(targets)], { type: "text/csv" });
    downloadBlob(blob, `${filenameBase}.csv`);
  } else {
    const buffer = await buildTargetsXlsxBuffer(targets);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${filenameBase}.xlsx`);
  }
}
