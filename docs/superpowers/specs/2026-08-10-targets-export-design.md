# CSV/Excel Export for Campaign Targets and Target Lists

**Date:** 2026-08-10
**Status:** Approved

## Goal

`/campaigns/targets` and target list detail pages currently support importing
targets from CSV/XLSX but have no export. Add export in both formats:

- **Targets page:** export the targets shown in the data table, respecting the
  current filter and row selection.
- **Target list detail page:** export the member targets of that list.

## Approach

Pure client-side export. Both pages already load full `crm_Targets` records to
the client, and table filter/selection state lives in the browser, so no API
route or server action is needed. CSV is built with the same escaping rules as
`actions/reports/export-csv.ts`; XLSX uses `exceljs` (existing dependency) via
dynamic import, mirroring `lib/spreadsheet/parse.ts`.

## Components

### 1. Shared field list — `lib/spreadsheet/target-fields.ts`

Move the `TARGET_FIELDS` array (~21 importable fields: names, emails, phones,
company, socials, city, country, industry, employees, description) out of
`components/modals/ImportTargetsModal.tsx` into this module. The import modal
imports it from there. Export columns are exactly these fields, so an exported
file can be re-imported as-is.

### 2. Export utility — `lib/spreadsheet/export-targets.ts` (client-side)

`exportTargets(targets, format: "csv" | "xlsx", filename)`:

- Header row from `TARGET_FIELDS` labels; one row per target in field order.
- Null/undefined values become empty strings.
- CSV: quote-escape values containing `,`, `"`, or newlines; download as
  `text/csv` Blob.
- XLSX: lazy `import("exceljs")`, single worksheet, download as Blob.

### 3. Export button — `ExportTargetsButton` component

Reusable dropdown (shadcn `DropdownMenu`) with "Export CSV" / "Export Excel"
items, `Download` icon, styled like existing toolbar buttons. Props: the target
array (or a getter) and a filename base.

### 4. Targets page wiring

Button rendered inside `TargetsDataTable` (targets `table-components/`), where
the table instance is available. Row scope:

- If rows are selected → export `table.getSelectedRowModel().rows`.
- Else → export `table.getFilteredRowModel().rows`.
- Map rows via `row.original`.

Filename: `targets-YYYY-MM-DD.{csv,xlsx}`.

### 5. Target list detail wiring

In `BasicView` (target-lists `[targetListId]/components/`), an export button
next to "+ Add Target", exporting `data.targets.map(t => t.target)` (full
records already included by `getTargetList`). Filename derived from the list
name. Disabled when the list has no targets.

## Error handling

Export of zero rows: button disabled (list detail) or exports header-only file
(targets page after filtering to nothing) — no crash. No other failure modes:
data is already in memory.

## Testing

Jest unit tests for `export-targets.ts`:

- CSV: header row, field order, quote/comma/newline escaping, null → empty.
- XLSX: generate a buffer and read it back with exceljs to verify headers and
  cell values.

DOM download trigger (Blob/anchor click) is exercised manually, not unit-tested.
