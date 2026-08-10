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
