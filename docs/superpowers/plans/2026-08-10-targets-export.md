# Targets CSV/Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV and Excel export of campaign targets on `/campaigns/targets` (respecting table filter/selection) and on each target list detail page (member targets).

**Architecture:** Pure client-side export — both pages already load full `crm_Targets` records to the browser. A shared field list (extracted from the import modal) defines the columns so exports are re-importable. CSV is string-built with quote escaping; XLSX uses the existing `exceljs` dependency via dynamic import (same pattern as `lib/spreadsheet/parse.ts`). A reusable dropdown button component is wired into both pages.

**Tech Stack:** Next.js app router (client components), TypeScript, exceljs, shadcn/ui (`DropdownMenu`, `Button`), jest.

**Spec:** `docs/superpowers/specs/2026-08-10-targets-export-design.md`

## Global Constraints

- Work on the `dev` branch; commit per task.
- No new dependencies — `exceljs` is already in package.json.
- `exceljs` must be loaded via dynamic `import("exceljs")` in app code so it never lands in the main client bundle (matches `lib/spreadsheet/parse.ts`). Static import is fine in jest tests.
- Match existing style: default exports for components, `any`-tolerant props where surrounding code uses them, existing toolbar button styling (`size="sm" variant="outline"`).
- Verification commands: `pnpm exec jest <testfile>` and `pnpm exec tsc --noEmit`.

---

### Task 1: Extract TARGET_FIELDS into a shared module

**Files:**
- Create: `lib/spreadsheet/target-fields.ts`
- Modify: `components/modals/ImportTargetsModal.tsx` (lines 30–59: the `TargetField` interface and `TARGET_FIELDS` array)

**Interfaces:**
- Consumes: nothing.
- Produces: `TARGET_FIELDS: TargetField[]` and `interface TargetField { key: string; label: string; required: boolean }` exported from `@/lib/spreadsheet/target-fields` — Tasks 2 and 3 import these.

This is a pure code move (no behavior change), so no new test — existing import tests plus tsc are the safety net.

- [ ] **Step 1: Create the shared module**

Create `lib/spreadsheet/target-fields.ts` with the interface and array moved verbatim from `ImportTargetsModal.tsx` (add `export` keywords):

```ts
// The importable/exportable crm_Targets fields. Used by the import
// mapping UI and by CSV/XLSX export so the two stay in sync.
export interface TargetField {
  key: string;
  label: string;
  required: boolean;
}

export const TARGET_FIELDS: TargetField[] = [
  { key: "last_name", label: "Last Name", required: false },
  { key: "first_name", label: "First Name", required: false },
  { key: "email", label: "Email", required: false },
  { key: "mobile_phone", label: "Mobile Phone", required: false },
  { key: "office_phone", label: "Office Phone", required: false },
  { key: "company", label: "Company", required: false },
  { key: "position", label: "Position", required: false },
  { key: "company_website", label: "Company Website", required: false },
  { key: "personal_website", label: "Personal Website", required: false },
  { key: "social_linkedin", label: "LinkedIn", required: false },
  { key: "social_x", label: "X / Twitter", required: false },
  { key: "social_instagram", label: "Instagram", required: false },
  { key: "social_facebook", label: "Facebook", required: false },
  { key: "personal_email", label: "Personal Email", required: false },
  { key: "company_email",  label: "Company Email",  required: false },
  { key: "company_phone",  label: "Company Phone",  required: false },
  { key: "city",           label: "City",           required: false },
  { key: "country",        label: "Country",        required: false },
  { key: "industry",       label: "Industry",       required: false },
  { key: "employees",      label: "Employees",      required: false },
  { key: "description",    label: "Description",    required: false },
];
```

Note: keep the array content EXACTLY as it currently is in `ImportTargetsModal.tsx` (copy from the file, including the aligned spacing on the last eight entries). Do not add, remove, or reorder fields.

- [ ] **Step 2: Point the import modal at the shared module**

In `components/modals/ImportTargetsModal.tsx`:
- Delete the local `interface TargetField { ... }` and `const TARGET_FIELDS: TargetField[] = [ ... ];` block (currently lines 30–59).
- Add to the imports near the top (after the `parseSpreadsheetFile` import):

```ts
import { TARGET_FIELDS } from "@/lib/spreadsheet/target-fields";
```

- [ ] **Step 3: Verify types and existing tests**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm exec jest __tests__/lib/parse-spreadsheet.test.ts`
Expected: PASS (unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add lib/spreadsheet/target-fields.ts components/modals/ImportTargetsModal.tsx
git commit -m "refactor: extract TARGET_FIELDS into shared spreadsheet module"
```

---

### Task 2: Export utility with tests (TDD)

**Files:**
- Create: `lib/spreadsheet/export-targets.ts`
- Test: `__tests__/lib/export-targets.test.ts`

**Interfaces:**
- Consumes: `TARGET_FIELDS`, `TargetField` from `@/lib/spreadsheet/target-fields` (Task 1).
- Produces (Task 3 relies on these):
  - `buildTargetsCsv(targets: Record<string, unknown>[]): string`
  - `buildTargetsXlsxBuffer(targets: Record<string, unknown>[]): Promise<ArrayBuffer>`
  - `exportTargets(targets: Record<string, unknown>[], format: "csv" | "xlsx", filenameBase: string): Promise<void>` — browser-only (triggers a download).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/export-targets.test.ts`:

```ts
import ExcelJS from "exceljs";
import {
  buildTargetsCsv,
  buildTargetsXlsxBuffer,
} from "@/lib/spreadsheet/export-targets";
import { TARGET_FIELDS } from "@/lib/spreadsheet/target-fields";

const col = (key: string) => TARGET_FIELDS.findIndex((f) => f.key === key);

describe("buildTargetsCsv", () => {
  it("returns only the label header row for empty input", () => {
    expect(buildTargetsCsv([])).toBe(
      TARGET_FIELDS.map((f) => f.label).join(",")
    );
  });

  it("emits one row per target in field order, nulls as empty strings", () => {
    const csv = buildTargetsCsv([
      { last_name: "Doe", first_name: null, email: "jane@acme.com" },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    const cells = lines[1].split(",");
    expect(cells).toHaveLength(TARGET_FIELDS.length);
    expect(cells[col("last_name")]).toBe("Doe");
    expect(cells[col("first_name")]).toBe("");
    expect(cells[col("email")]).toBe("jane@acme.com");
  });

  it("escapes quotes, commas and newlines", () => {
    const csv = buildTargetsCsv([
      { last_name: 'Do"e', company: "Acme, Inc.", description: "l1\nl2" },
    ]);
    expect(csv).toContain('"Do""e"');
    expect(csv).toContain('"Acme, Inc."');
    expect(csv).toContain('"l1\nl2"');
  });
});

describe("buildTargetsXlsxBuffer", () => {
  it("round-trips headers and values through exceljs", async () => {
    const buffer = await buildTargetsXlsxBuffer([
      { last_name: "Doe", email: "jane@acme.com", first_name: null },
    ]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheet = wb.worksheets[0];
    expect(sheet.getRow(1).getCell(1).text).toBe(TARGET_FIELDS[0].label);
    expect(sheet.getRow(1).getCell(TARGET_FIELDS.length).text).toBe(
      TARGET_FIELDS[TARGET_FIELDS.length - 1].label
    );
    expect(sheet.getRow(2).getCell(col("last_name") + 1).text).toBe("Doe");
    expect(sheet.getRow(2).getCell(col("email") + 1).text).toBe(
      "jane@acme.com"
    );
    expect(sheet.getRow(2).getCell(col("first_name") + 1).text).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec jest __tests__/lib/export-targets.test.ts`
Expected: FAIL — cannot find module `@/lib/spreadsheet/export-targets`.

- [ ] **Step 3: Implement the utility**

Create `lib/spreadsheet/export-targets.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec jest __tests__/lib/export-targets.test.ts`
Expected: PASS (4 tests).

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/spreadsheet/export-targets.ts __tests__/lib/export-targets.test.ts
git commit -m "feat: add CSV/XLSX export utility for targets"
```

---

### Task 3: ExportTargetsButton component + targets page wiring

**Files:**
- Create: `components/campaigns/ExportTargetsButton.tsx`
- Modify: `app/[locale]/(routes)/campaigns/targets/table-components/data-table.tsx` (the top action row, currently lines 78–93)

**Interfaces:**
- Consumes: `exportTargets` from `@/lib/spreadsheet/export-targets` (Task 2).
- Produces (Task 4 relies on this): default-exported component `ExportTargetsButton` with props `{ getTargets: () => Record<string, unknown>[]; filenameBase: string; disabled?: boolean }`. `getTargets` is a getter (not an array) so the table can read filter/selection state at click time.

No jest test for this task (per spec: DOM download flow is verified manually); verification is tsc plus manual check.

- [ ] **Step 1: Create the component**

Create `components/campaigns/ExportTargetsButton.tsx`:

```tsx
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
```

- [ ] **Step 2: Wire into the targets data table**

In `app/[locale]/(routes)/campaigns/targets/table-components/data-table.tsx`:

Add the import (with the other component imports near the top):

```tsx
import ExportTargetsButton from "@/components/campaigns/ExportTargetsButton";
```

In the top action row, replace:

```tsx
        <div className="flex justify-end space-x-2">
          {hide ? (
```

with:

```tsx
        <div className="flex justify-end items-center space-x-2">
          <ExportTargetsButton
            getTargets={() => {
              const selected = table.getSelectedRowModel().rows;
              const rows =
                selected.length > 0
                  ? selected
                  : table.getFilteredRowModel().rows;
              return rows.map(
                (row) => row.original as Record<string, unknown>
              );
            }}
            filenameBase={`targets-${new Date().toISOString().slice(0, 10)}`}
          />
          {hide ? (
```

(Selection wins over filter; with no selection and no filter, the filtered row model is all rows.)

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Manual check (if a dev server is practical): on `/campaigns/targets`, the Export dropdown downloads `targets-<date>.csv` and `.xlsx`; with a last-name filter active only matching rows are in the file; with rows checked only those rows are in the file. Otherwise defer manual check to the final task.

- [ ] **Step 4: Commit**

```bash
git add components/campaigns/ExportTargetsButton.tsx "app/[locale]/(routes)/campaigns/targets/table-components/data-table.tsx"
git commit -m "feat: add CSV/Excel export to campaign targets table"
```

---

### Task 4: Target list detail page wiring

**Files:**
- Modify: `app/[locale]/(routes)/campaigns/target-lists/[targetListId]/components/BasicView.tsx` (the Targets card header, currently lines 106–113)

**Interfaces:**
- Consumes: `ExportTargetsButton` from `@/components/campaigns/ExportTargetsButton` (Task 3). `data.targets` is `TargetsToTargetLists[]` with `target: crm_Targets` included by `getTargetList`.
- Produces: nothing downstream.

- [ ] **Step 1: Wire the export button into the Targets card**

In `BasicView.tsx`, add the import (with the other component imports):

```tsx
import ExportTargetsButton from "@/components/campaigns/ExportTargetsButton";
```

Replace the Targets card header block:

```tsx
          <div className="flex items-center justify-between">
            <CardTitle>Targets ({data.targets?.length || 0})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              + Add Target
            </Button>
          </div>
```

with:

```tsx
          <div className="flex items-center justify-between">
            <CardTitle>Targets ({data.targets?.length || 0})</CardTitle>
            <div className="flex items-center gap-2">
              <ExportTargetsButton
                getTargets={() =>
                  (data.targets ?? [])
                    .map((t: any) => t.target)
                    .filter(Boolean)
                }
                filenameBase={`${(data.name || "target-list")
                  .replace(/[^a-z0-9-_]+/gi, "-")
                  .toLowerCase()}-targets`}
                disabled={!data.targets || data.targets.length === 0}
              />
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                + Add Target
              </Button>
            </div>
          </div>
```

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm exec jest __tests__/lib/export-targets.test.ts __tests__/lib/parse-spreadsheet.test.ts`
Expected: PASS.

Manual check: on a target list detail page, Export downloads `<list-name>-targets.csv` / `.xlsx` containing the member targets; the button is disabled on an empty list. On `/campaigns/targets`, verify the three cases from Task 3 (all / filtered / selected) if not already done.

- [ ] **Step 3: Commit**

```bash
git add "app/[locale]/(routes)/campaigns/target-lists/[targetListId]/components/BasicView.tsx"
git commit -m "feat: add CSV/Excel export to target list detail page"
```
